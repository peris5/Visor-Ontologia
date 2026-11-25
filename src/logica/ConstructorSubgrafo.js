import { RepositorioVecindario } from '../datos/RepositorioVecindario.js';
import { EstrategiaRelevanciaNodos } from './EstrategiaRelevanciaNodos.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { CalculadorCentralidad } from './CalculadorCentralidad.js';
import { SeleccionadorNodos } from './SeleccionadorNodos.js';
import { NodoRelevante } from '../modelo/NodoRelevante.js';
import { Subgrafo } from '../modelo/Subgrafo.js';
import { Relacion } from '../modelo/Relacion.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * Construye el entorno relevante (Subgrafo) de una entidad:
 *
 *   1. Pide la relevancia de los nodos (ResultadoRelevanciaNodo) a la
 *      EstrategiaRelevanciaNodos, con las relaciones que ya están en la caché.
 *   2. Ordena por la relevancia S (= R × C; a igualdad, por C y por id),
 *      aplica el umbral a S, las cuotas por clase y el máximo de nodos; la
 *      entidad central siempre entra. Si no se muestran los deducidos, se
 *      quitan ANTES (así su sitio lo ocupan otros nodos). Ver
 *      SeleccionadorNodos.
 *   3. Aristas: las relaciones dibujables (dibujable = true) entre nodos
 *      incluidos. De cada pareja guarda también su evidencia en el subgrafo
 *      (para la línea discontinua y el panel).
 *   4. Arista SINTÉTICA: si un nodo incluido no tiene ninguna relación
 *      dibujable con otro nodo incluido (por ejemplo, porque solo coincide con
 *      la central en eventos grandes), se añade UNA arista de tipo
 *      COINCIDENCIAS hacia la central (si es directo) o hacia su mejor padre
 *      (si es deducido), con la evidencia de la pareja como valor.
 *   5. MUELLES para la simulación de fuerzas: UNO POR PAREJA de nodos
 *      incluidos, aunque se dibujen varias curvas (si cada curva tuviera el
 *      suyo, una pareja con cinco exposiciones tiraría cinco veces). Su
 *      peso es lo que esa pareja transmite en el cálculo:
 *        - si un directo Y transmite a X: fE(Y) · Tr · F(Y,X) · fE(X) · h(Y)
 *          (PropagacionDesdeDirectos); si los dos son directos y se
 *          transmiten mutuamente, el mayor de los dos sentidos;
 *        - cualquier otra pareja: F × C de su evidencia;
 *        - con la central no hay muelle (su distancia ya la fija la
 *          restricción radial).
 *      El dibujo NUNCA modifica la relevancia: los muelles salen del
 *      cálculo y no al revés (lo contrario sería circular).
 *   6. Calcula la centralidad de grado (como siempre).
 *
 * Relaciones con otras clases:
 *  - usa un RepositorioVecindario (la caché) para leer entidades y relaciones;
 *  - usa una EstrategiaRelevanciaNodos y un CalculadorEvidencia;
 *  - tiene (composición) un CalculadorCentralidad propio;
 *  - crea el Subgrafo que devuelve.
 */
export class ConstructorSubgrafo {
  static UMBRAL_POR_DEFECTO = 0.3;
  static MAX_NODOS_POR_DEFECTO = 150;

  #repositorio;
  #estrategia;
  #calculador;
  #centralidad;
  #umbral;
  #maxNodos;
  #mostrarDeducidos;
  #seleccionador;
  #resultados;

  /**
   * @param {RepositorioVecindario} repositorio - la caché de relaciones.
   * @param {EstrategiaRelevanciaNodos} estrategia
   * @param {CalculadorEvidencia} calculador
   * @param {number} umbral - opcional; 0.3 si no se indica.
   * @param {number} maxNodos - opcional; 150 si no se indica.
   * @param {boolean} mostrarDeducidos - opcional; true si no se indica.
   * @param {SeleccionadorNodos} seleccionador - opcional; sin cuotas si no se indica.
   */
  constructor(repositorio, estrategia, calculador, umbral, maxNodos, mostrarDeducidos, seleccionador) {
    if (!(repositorio instanceof RepositorioVecindario)) {
      throw new Error("ConstructorSubgrafo necesita un RepositorioVecindario.");
    }
    if (!(estrategia instanceof EstrategiaRelevanciaNodos)) {
      throw new Error("ConstructorSubgrafo necesita una EstrategiaRelevanciaNodos.");
    }
    if (!(calculador instanceof CalculadorEvidencia)) {
      throw new Error("ConstructorSubgrafo necesita un CalculadorEvidencia.");
    }
    this.#repositorio = repositorio;
    this.#estrategia = estrategia;
    this.#calculador = calculador;
    // Composición: el calculador de centralidad nace y muere con este constructor.
    this.#centralidad = new CalculadorCentralidad();

    this.#umbral = ConstructorSubgrafo.UMBRAL_POR_DEFECTO;
    if (umbral !== undefined) {
      this.setUmbral(umbral);
    }
    this.#maxNodos = ConstructorSubgrafo.MAX_NODOS_POR_DEFECTO;
    if (maxNodos !== undefined) {
      if (!Number.isInteger(maxNodos) || maxNodos < 1) {
        throw new Error("El máximo de nodos debe ser un número entero mayor que 0.");
      }
      this.#maxNodos = maxNodos;
    }
    this.#mostrarDeducidos = mostrarDeducidos !== false;
    this.#seleccionador = new SeleccionadorNodos();
    if (seleccionador instanceof SeleccionadorNodos) {
      this.#seleccionador = seleccionador;
    }
    this.#resultados = new Map();
  }

  /**
   * @param {number} valor - umbral entre 0 y 1.
   */
  setUmbral(valor) {
    if (typeof valor !== "number" || Number.isNaN(valor)) {
      throw new Error("El umbral debe ser un número.");
    }
    if (valor < 0 || valor > 1) {
      throw new Error("El umbral debe estar entre 0 y 1 (se ha recibido " + valor + ").");
    }
    this.#umbral = valor;
  }

  getUmbral() {
    return this.#umbral;
  }

  /**
   * Los resultados de la estrategia en el último construir (TODOS los nodos,
   * también los que no han entrado por el umbral o el máximo).
   *
   * @returns {Map<string, ResultadoRelevanciaNodo>}
   */
  getResultados() {
    return new Map(this.#resultados);
  }

  /**
   * Construye el subgrafo relevante de una entidad cuyas relaciones (y las de
   * sus directos) ya están en la caché.
   *
   * @param {string} idEntidad - id de la entidad central.
   */
  async construir(idEntidad) {
    const umbral = this.#umbral;
    const central = await this.#repositorio.obtenerEntidad(idEntidad);
    if (central === null) {
      throw new Error("No existe ninguna entidad con el id \"" + idEntidad + "\".");
    }

    // Paso 1: la relevancia de todos los nodos.
    this.#resultados = this.#estrategia.calcular(central, this.#repositorio);

    // Paso 2: umbral y máximo de nodos (la central siempre está).
    const subgrafo = new Subgrafo(central, umbral);
    const elegidos = this.#elegirNodos(idEntidad, umbral);
    for (let i = 0; i < elegidos.length; i++) {
      const resultado = elegidos[i];
      let nivel = 1;
      if (resultado.esDeducido()) {
        nivel = 2;
      }
      subgrafo.agregarNodo(new NodoRelevante(resultado.getEntidad(), resultado.getRelevancia(), nivel, resultado));
    }

    // Pasos 3 y 4: aristas.
    const parejas = this.#anadirAristas(subgrafo);
    this.#anadirAristasSinteticas(subgrafo, parejas.conArista);

    // Paso 5: los muelles.
    subgrafo.setMuelles(this.#crearMuelles(subgrafo, parejas.evidencias));

    // Paso 6: con el subgrafo terminado, la centralidad.
    this.#guardarCentralidad(subgrafo);
    return subgrafo;
  }

  /**
   * Los resultados que entran: los elegibles (en orden y con las cuotas) de
   * relevancia S mayor que el umbral y como mucho maxNodos − 1 (el otro sitio
   * es de la central).
   */
  #elegirNodos(idCentral, umbral) {
    const elegibles = this.#seleccionador.elegibles(this.#resultados, idCentral, this.#mostrarDeducidos);
    const elegidos = [];
    for (let i = 0; i < elegibles.length && elegidos.length < this.#maxNodos - 1; i++) {
      if (elegibles[i].getRelevancia() > umbral) {
        elegidos.push(elegibles[i]);
      }
    }
    return elegidos;
  }

  /**
   * Las relaciones dibujables entre nodos incluidos. Se miran las relaciones
   * de la central y de sus directos (las que ha usado el cálculo), agrupadas
   * por pareja; la evidencia de cada pareja se guarda en el subgrafo.
   *
   * La evidencia de cada pareja se calcula vista desde el nodo más cercano
   * a la central (la central, luego los directos): así la relevancia que
   * queda guardada en cada relación es la de ese sentido.
   *
   * @returns {Object} { conArista: Set de ids de los nodos con alguna arista
   *   dibujada, evidencias: Map clave del par → EvidenciaPareja }
   */
  #anadirAristas(subgrafo) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const fuentes = [idCentral];
    for (const [id, resultado] of this.#resultados) {
      const origen = resultado.getOrigen();
      if (origen === OrigenRelevancia.DECLARADA || origen === OrigenRelevancia.COINCIDENCIAS) {
        fuentes.push(id);
      }
    }
    const porPareja = new Map();
    const vistas = new Set();
    for (let i = 0; i < fuentes.length; i++) {
      const relaciones = this.#repositorio.relacionesDe(fuentes[i]);
      for (let j = 0; j < relaciones.length; j++) {
        const relacion = relaciones[j];
        const idOrigen = relacion.getOrigen().getId();
        const idDestino = relacion.getDestino().getId();
        const entreIncluidos = subgrafo.contieneEntidad(idOrigen) && subgrafo.contieneEntidad(idDestino);
        if (entreIncluidos && idOrigen !== idDestino && !vistas.has(relacion.getId())) {
          vistas.add(relacion.getId());
          const clave = relacion.getClavePar();
          if (!porPareja.has(clave)) {
            porPareja.set(clave, []);
          }
          porPareja.get(clave).push(relacion);
        }
      }
    }
    const conArista = new Set();
    const evidencias = new Map();
    for (const [clave, relacionesDeLaPareja] of porPareja) {
      let desde = relacionesDeLaPareja[0].getOrigen();
      let hacia = relacionesDeLaPareja[0].getDestino();
      if (subgrafo.getNodo(hacia.getId()).getNivel() < subgrafo.getNodo(desde.getId()).getNivel()) {
        desde = relacionesDeLaPareja[0].getDestino();
        hacia = relacionesDeLaPareja[0].getOrigen();
      }
      // calcular() pone también la relevancia de cada relación.
      const evidencia = this.#calculador.calcular(desde, hacia, relacionesDeLaPareja);
      subgrafo.setEvidencia(evidencia);
      evidencias.set(clave, evidencia);
      for (let i = 0; i < relacionesDeLaPareja.length; i++) {
        const relacion = relacionesDeLaPareja[i];
        if (relacion.esDibujable()) {
          subgrafo.agregarRelacion(relacion);
          conArista.add(relacion.getOrigen().getId());
          conArista.add(relacion.getDestino().getId());
        }
      }
    }
    return { conArista: conArista, evidencias: evidencias };
  }

  /**
   * Un muelle por pareja de nodos incluidos que no toca la central, con el
   * peso del paso 5 (ver la explicación de la clase).
   *
   * @param {Map<string, EvidenciaPareja>} evidencias - clave del par → evidencia.
   * @returns {Object[]} [{ nodoA, nodoB, peso }] (NodoRelevante, NodoRelevante, entre 0 y 1).
   */
  #crearMuelles(subgrafo, evidencias) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const muelles = [];
    for (const evidencia of evidencias.values()) {
      const idA = evidencia.getDesde().getId();
      const idB = evidencia.getHacia().getId();
      if (idA !== idCentral && idB !== idCentral) {
        const nodoA = subgrafo.getNodo(idA);
        const nodoB = subgrafo.getNodo(idB);
        let peso = -1;
        peso = ConstructorSubgrafo.#transmision(nodoA, idB, peso);
        peso = ConstructorSubgrafo.#transmision(nodoB, idA, peso);
        if (peso < 0) {
          peso = evidencia.getValor();
        }
        muelles.push({ nodoA: nodoA, nodoB: nodoB, peso: Math.min(1, Math.max(0, peso)) });
      }
    }
    return muelles;
  }

  /** El mayor entre «peso» y lo que el resultado del nodo dice que transmite hacia idOtro. */
  static #transmision(nodo, idOtro, peso) {
    const resultado = nodo.getResultado();
    if (resultado === null) {
      return peso;
    }
    const transmisiones = resultado.getTransmisiones();
    if (transmisiones.has(idOtro) && transmisiones.get(idOtro) > peso) {
      return transmisiones.get(idOtro);
    }
    return peso;
  }

  /**
   * Una arista COINCIDENCIAS para cada nodo sin ninguna arista dibujada:
   * hacia la central si es directo, o hacia su mejor padre si es deducido (el
   * mejor de los que han entrado; si no ha entrado ninguno, la central).
   */
  #anadirAristasSinteticas(subgrafo, conArista) {
    const central = subgrafo.getEntidadCentral();
    const tipo = this.#repositorio.getTipo(RepositorioVecindario.TIPO_COINCIDENCIAS);
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const entidad = nodo.getEntidad();
      if (entidad.getId() !== central.getId() && !conArista.has(entidad.getId())) {
        let destino = central;
        const resultado = nodo.getResultado();
        if (resultado !== null && resultado.esDeducido()) {
          const padres = resultado.getPadres();
          for (let j = 0; j < padres.length && destino === central; j++) {
            if (subgrafo.contieneEntidad(padres[j].getId())) {
              destino = padres[j];
            }
          }
        }
        const evidencia = subgrafo.getEvidencia(destino.getId(), entidad.getId());
        let valor = nodo.getRelevancia();
        let texto = "Coincidencias en eventos";
        if (evidencia !== null) {
          valor = evidencia.getValor();
          if (evidencia.getNumeroEventos() > 0) {
            texto = "Coinciden en " + CalculadorEvidencia.contar(evidencia.getNumeroEventos(), "evento");
          } else {
            texto = evidencia.getTipoPrincipal().getNombre();
          }
        }
        const id = RepositorioVecindario.TIPO_COINCIDENCIAS + "|" + Subgrafo.clavePar(destino.getId(), entidad.getId());
        subgrafo.agregarRelacion(new Relacion(id, destino, entidad, tipo, valor,
          { sintetica: true, texto: texto, dibujable: true }));
      }
    }
  }

  /** Calcula la centralidad y la guarda en cada nodo. */
  #guardarCentralidad(subgrafo) {
    const centralidadPorNodo = this.#centralidad.calcular(subgrafo);
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      nodo.setCentralidad(centralidadPorNodo.get(nodo.getEntidad().getId()));
    }
  }
}
