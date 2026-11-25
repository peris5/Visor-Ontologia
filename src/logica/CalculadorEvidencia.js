import { EvidenciaPareja } from '../modelo/EvidenciaPareja.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';
import { RelevanciaCompuesta } from './RelevanciaCompuesta.js';
import { NormalizadorRoles } from './NormalizadorRoles.js';

/**
 * Capa 0 de la relevancia: la EVIDENCIA de cada pareja de entidades, VISTA
 * DESDE UNA DE ELLAS (es dirigida: calcular(A, B) y calcular(B, A) pueden
 * dar fuerzas distintas por el rol).
 *
 * Se juntan TODAS las relaciones y eventos que unen a dos entidades, se
 * dibujen o no (también las de los eventos grandes, dibujable = false):
 *
 *     r = peso(tipo, rol del otro) × (2/n)^β × f_t          (RelevanciaCompuesta)
 *
 *     por tipo:  fuerza_tipo = 1 − Π_k (1 − r_k · ρ^(k−1))   pruebas del mismo tipo, de mayor a menor
 *     total:     F = 1 − Π_tipos (1 − fuerza_tipo)
 *
 *     certeza:   C = 1 si hay alguna relación DECLARADA;
 *                si no, 1 − Π_k (1 − pCoincidencia · (2/n_k)^β)   sobre sus eventos
 *
 * MULTIPLEXIDAD: las pruebas repetidas del mismo tipo rinden cada vez
 * menos (ρ, rho): diez exposiciones juntos no son diez veces una. Los tipos
 * DISTINTOS se combinan sin descuento: ser amigos, compañeros de taller y
 * coexpositores dice más que repetir lo mismo.
 *
 * Fuerza y certeza se combinan como «o» de probabilidades («noisy-OR»): cada
 * prueba nueva solo puede subirlas, nunca pasan de 1, y dos pruebas débiles
 * suman más que una.
 *
 * ¿Coincidencia o declarada?
 *  - COINCIDENCIA: una relación de un evento cuyo tipo más específico está en
 *    tiposCoincidencia Y cuyos dos extremos son personas (dos pintores que
 *    expusieron en la misma exposición). Coincidir no prueba que tengan
 *    relación: solo da una certeza parcial.
 *  - DECLARADA: todo lo demás (una Relationship, una relación directa, el
 *    autor y su obra en una Creation, la obra y el museo en una Exposition,
 *    los coautores de una obra...).
 *  - El tipo se compara EXACTO, sin herencia: Creation hereda de Event y no
 *    debe contar como coincidencia aunque Event esté en la lista.
 *
 * También elige los NODOS DIRECTOS de una entidad central: los X con
 * F(c,X) × C(c,X) × factorEntidad(X) ≥ umbralDirecto (como mucho maxDirectos).
 */
export class CalculadorEvidencia {
  #estrategia;
  #tabla;
  #normalizador;
  #tiposCoincidencia;
  #probabilidadCoincidencia;
  #rho;
  #umbralDirecto;
  #maxDirectos;

  /**
   * @param {RelevanciaCompuesta} estrategia - la relevancia de cada relación.
   * @param {Object} configuracion - la de public/relevancia.json:
   *   { tiposCoincidencia, probabilidadCoincidencia, rho, rolesEquivalentes,
   *     umbralDirecto, maxDirectos }
   * @param {TablaTransferencia} tabla - opcional: para el factorEntidad con
   *   que se eligen los directos (sin ella, 1).
   */
  constructor(estrategia, configuracion, tabla) {
    if (!(estrategia instanceof RelevanciaCompuesta)) {
      throw new Error("CalculadorEvidencia necesita una RelevanciaCompuesta.");
    }
    this.#estrategia = estrategia;
    this.#tabla = null;
    if (tabla !== undefined && tabla !== null) {
      this.#tabla = tabla;
    }
    this.#normalizador = new NormalizadorRoles(configuracion);
    this.#tiposCoincidencia = [];
    if (Array.isArray(configuracion.tiposCoincidencia)) {
      for (let i = 0; i < configuracion.tiposCoincidencia.length; i++) {
        this.#tiposCoincidencia.push(configuracion.tiposCoincidencia[i]);
      }
    }
    this.#probabilidadCoincidencia = CalculadorEvidencia.#entre0y1(configuracion.probabilidadCoincidencia,
      "probabilidadCoincidencia");
    this.#rho = CalculadorEvidencia.#entre0y1(configuracion.rho, "rho");
    this.#umbralDirecto = CalculadorEvidencia.#entre0y1(configuracion.umbralDirecto, "umbralDirecto");
    this.#maxDirectos = 1000;
    if (Number.isInteger(configuracion.maxDirectos) && configuracion.maxDirectos > 0) {
      this.#maxDirectos = configuracion.maxDirectos;
    }
  }

  /**
   * @returns {RelevanciaCompuesta} la estrategia de las relaciones.
   */
  getEstrategia() {
    return this.#estrategia;
  }

  /**
   * @returns {NormalizadorRoles}
   */
  getNormalizador() {
    return this.#normalizador;
  }

  getUmbralDirecto() {
    return this.#umbralDirecto;
  }

  getMaxDirectos() {
    return this.#maxDirectos;
  }

  /**
   * ¿Es una coincidencia (ver la explicación de la clase)?
   */
  esCoincidencia(relacion) {
    if (relacion.esSintetica()) {
      return false;
    }
    if (!this.#tiposCoincidencia.includes(relacion.getTipo().getId())) {
      return false;
    }
    const origenEsPersona = relacion.getOrigen().getTipo() === TipoEntidad.PERSONA;
    const destinoEsPersona = relacion.getDestino().getTipo() === TipoEntidad.PERSONA;
    return origenEsPersona && destinoEsPersona;
  }

  /**
   * La evidencia de «hacia» vista desde «desde», con todas las relaciones
   * entre las dos. Calcula (y guarda en cada relación) su relevancia r.
   *
   * @param {Entidad} desde
   * @param {Entidad} hacia
   * @param {Relacion[]} relaciones - todas entre esas dos entidades (al menos una).
   * @returns {EvidenciaPareja}
   */
  calcular(desde, hacia, relaciones) {
    if (relaciones.length === 0) {
      throw new Error("Para calcular la evidencia de una pareja hace falta al menos una relación.");
    }
    // id del tipo → { tipo, pruebas: [{ r, relacion, rol }] }, en el orden en que aparecen.
    const porTipo = new Map();
    let productoCerteza = 1;
    let hayDeclarada = false;
    let numeroEventos = 0;
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const rol = this.#normalizador.normalizar(relacion.getRol(hacia));
      const r = this.#estrategia.calcularRelevanciaRelacion(relacion, rol);
      const idTipo = relacion.getTipo().getId();
      if (!porTipo.has(idTipo)) {
        porTipo.set(idTipo, { tipo: relacion.getTipo(), pruebas: [] });
      }
      porTipo.get(idTipo).pruebas.push({ r: r, relacion: relacion, rol: rol });
      if (this.esCoincidencia(relacion)) {
        numeroEventos = numeroEventos + 1;
        const factorParticipantes = this.#estrategia.getFactorParticipantes(relacion.getParticipantes());
        productoCerteza = productoCerteza * (1 - this.#probabilidadCoincidencia * factorParticipantes);
      } else {
        hayDeclarada = true;
      }
    }

    let productoFuerza = 1;
    const tipos = [];
    let principal = null;
    let mejorFuerza = -1;
    for (const grupo of porTipo.values()) {
      // De mayor a menor r (sort es estable: a igual r, en el orden en que llegaron).
      grupo.pruebas.sort(function (a, b) {
        return b.r - a.r;
      });
      let producto = 1;
      let atenuacion = 1;
      for (let k = 0; k < grupo.pruebas.length; k++) {
        producto = producto * (1 - grupo.pruebas[k].r * atenuacion);
        atenuacion = atenuacion * this.#rho;
      }
      const fuerzaTipo = 1 - producto;
      productoFuerza = productoFuerza * (1 - fuerzaTipo);
      tipos.push({ tipo: grupo.tipo, rol: grupo.pruebas[0].rol, fuerza: fuerzaTipo });
      if (fuerzaTipo > mejorFuerza) {
        mejorFuerza = fuerzaTipo;
        principal = grupo;
      }
    }
    let certeza = 1 - productoCerteza;
    if (hayDeclarada) {
      certeza = 1;
    }
    return new EvidenciaPareja({
      desde: desde,
      hacia: hacia,
      fuerza: 1 - productoFuerza,
      certeza: certeza,
      tipos: tipos,
      tipoPrincipal: principal.tipo,
      rolPrincipal: principal.pruebas[0].rol,
      periodoPrincipal: RelevanciaCompuesta.aniosDe(principal.pruebas[0].relacion),
      declarada: hayDeclarada,
      numeroEventos: numeroEventos,
      relaciones: relaciones
    });
  }

  /**
   * La evidencia de cada pareja EN LOS DOS SENTIDOS, como un mapa de
   * vecinos: idDesde → (idHacia → EvidenciaPareja de «hacia» vista desde
   * «desde»). Las relaciones repetidas (mismo id) se cuentan una vez; las de
   * una entidad consigo misma no cuentan.
   *
   * vecinos.get(id).size es el GRADO de esa entidad (cuántas entidades
   * distintas tiene relacionadas), exacto si se le han pasado todas sus
   * relaciones.
   *
   * @param {Relacion[]} relaciones - de varias parejas.
   * @returns {Map<string, Map<string, EvidenciaPareja>>}
   */
  calcularVecinos(relaciones) {
    const porPareja = new Map();
    const vistas = new Set();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const esConsigoMisma = relacion.getOrigen().getId() === relacion.getDestino().getId();
      if (!vistas.has(relacion.getId()) && !esConsigoMisma) {
        vistas.add(relacion.getId());
        const clave = relacion.getClavePar();
        if (!porPareja.has(clave)) {
          porPareja.set(clave, []);
        }
        porPareja.get(clave).push(relacion);
      }
    }
    const vecinos = new Map();
    for (const relacionesDeLaPareja of porPareja.values()) {
      const una = relacionesDeLaPareja[0].getOrigen();
      const otra = relacionesDeLaPareja[0].getDestino();
      CalculadorEvidencia.#apuntar(vecinos, una.getId(), otra.getId(), this.calcular(una, otra, relacionesDeLaPareja));
      CalculadorEvidencia.#apuntar(vecinos, otra.getId(), una.getId(), this.calcular(otra, una, relacionesDeLaPareja));
    }
    return vecinos;
  }

  /**
   * La evidencia propia de un nodo con la central, como la mide la elección
   * de directos: F × C × factorEntidad(hacia).
   *
   * @param {EvidenciaPareja} evidencia - vista desde la central.
   */
  valorPropio(evidencia) {
    return evidencia.getValor() * this.#factorEntidad(evidencia.getHacia());
  }

  /**
   * Los nodos DIRECTOS de la central: los vecinos con F × C × factorEntidad ≥
   * umbralDirecto, de mayor a menor. Si hay más de maxDirectos, se queda
   * con los de más evidencia.
   *
   * Es lo primero que se calcula para una central, así que aquí se fija
   * también su ÉPOCA (RelevanciaCompuesta.setEpoca), con la que se calcula
   * el factor de tiempo de todas las relaciones que vengan después.
   *
   * @param {Entidad} central
   * @param {Relacion[]} relacionesDeLaCentral - TODAS las de la central.
   * @returns {Object} { directos: Entidad[], evidencias: Map<idOtra, EvidenciaPareja> (vistas desde
   *   la central), descartados: número }
   */
  elegirDirectos(central, relacionesDeLaCentral) {
    this.#estrategia.setEpoca(RelevanciaCompuesta.epocaDe(relacionesDeLaCentral));
    const vecinos = this.calcularVecinos(relacionesDeLaCentral);
    let evidencias = new Map();
    if (vecinos.has(central.getId())) {
      evidencias = vecinos.get(central.getId());
    }
    const candidatos = [];
    for (const evidencia of evidencias.values()) {
      const valor = this.valorPropio(evidencia);
      if (valor >= this.#umbralDirecto) {
        candidatos.push({ entidad: evidencia.getHacia(), valor: valor });
      }
    }
    // sort con una función normal: de mayor a menor (estable: a igual
    // evidencia se mantiene el orden en que llegaron).
    candidatos.sort(function (a, b) {
      return b.valor - a.valor;
    });
    const directos = [];
    for (let i = 0; i < candidatos.length && i < this.#maxDirectos; i++) {
      directos.push(candidatos[i].entidad);
    }
    return { directos: directos, evidencias: evidencias, descartados: candidatos.length - directos.length };
  }

  /**
   * Los tipos con alguna relación DECLARADA en palabras, de más a menos
   * fuerza y con el rol del otro si se conoce: «Mentoría (su maestro)»,
   * «Amistad», «Amistad, Empleo». "" si solo hay coincidencias.
   *
   * @param {EvidenciaPareja} evidencia
   */
  textoDeclaradas(evidencia) {
    const declarados = this.#tiposDeclarados(evidencia);
    const nombres = [];
    for (let i = 0; i < declarados.length; i++) {
      let nombre = declarados[i].tipo.getNombre();
      if (declarados[i].rol !== null) {
        nombre = nombre + " (su " + declarados[i].rol + ")";
      }
      if (!nombres.includes(nombre)) {
        nombres.push(nombre);
      }
    }
    return nombres.join(", ");
  }

  /**
   * Lo que une a la central con un nodo directo, en pocas palabras, para
   * explicar un deducido («Creación de Joaquín Mestre (su maestro)»): el rol
   * del otro en su tipo declarado más fuerte («su maestro»); si no tiene
   * rol, los nombres de los tipos declarados («Amistad»); si solo hay
   * coincidencias, «coinciden en 3 exposiciones».
   *
   * @param {EvidenciaPareja} evidencia - el directo visto desde la central.
   */
  textoVinculo(evidencia) {
    const declarados = this.#tiposDeclarados(evidencia);
    if (declarados.length === 0) {
      return "coinciden en " + this.textoCoincidencias(evidencia);
    }
    if (declarados[0].rol !== null) {
      return "su " + declarados[0].rol;
    }
    const nombres = [];
    for (let i = 0; i < declarados.length; i++) {
      const nombre = declarados[i].tipo.getNombre();
      if (!nombres.includes(nombre)) {
        nombres.push(nombre);
      }
    }
    return nombres.join(", ");
  }

  /**
   * Las coincidencias de una pareja en palabras: «3 exposiciones» si son
   * todas del mismo tipo, «3 eventos» si son de varios, «» si no hay.
   * Nunca dice que se conozcan (RNF-23): solo que coinciden.
   *
   * @param {EvidenciaPareja} evidencia
   */
  textoCoincidencias(evidencia) {
    const relaciones = evidencia.getRelaciones();
    let numero = 0;
    let tipo = null;
    let variosTipos = false;
    for (let i = 0; i < relaciones.length; i++) {
      if (this.esCoincidencia(relaciones[i])) {
        numero = numero + 1;
        if (tipo === null) {
          tipo = relaciones[i].getTipo();
        } else if (tipo.getId() !== relaciones[i].getTipo().getId()) {
          variosTipos = true;
        }
      }
    }
    if (numero === 0) {
      return "";
    }
    let nombre = "evento";
    if (!variosTipos) {
      nombre = tipo.getNombre().toLowerCase();
    }
    return CalculadorEvidencia.contar(numero, nombre);
  }

  /**
   * «1 exposición», «3 exposiciones», «2 eventos», «4 bodas»: el número y el
   * nombre en singular o plural (reglas sencillas del castellano).
   */
  static contar(numero, nombreEnSingular) {
    if (numero === 1) {
      return "1 " + nombreEnSingular;
    }
    return numero + " " + CalculadorEvidencia.#plural(nombreEnSingular);
  }

  /**
   * Los tipos de la evidencia que tienen alguna relación declarada (no
   * coincidencia), de más a menos fuerza: [{ tipo, rol, fuerza }].
   */
  #tiposDeclarados(evidencia) {
    const conDeclarada = new Set();
    const relaciones = evidencia.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      if (!this.esCoincidencia(relaciones[i])) {
        conDeclarada.add(relaciones[i].getTipo().getId());
      }
    }
    const tipos = evidencia.getTipos();
    const declarados = [];
    for (let i = 0; i < tipos.length; i++) {
      if (conDeclarada.has(tipos[i].tipo.getId())) {
        declarados.push(tipos[i]);
      }
    }
    declarados.sort(function (a, b) {
      return b.fuerza - a.fuerza;
    });
    return declarados;
  }

  /** El factor de entidad de la tabla, o 1 si no hay tabla. */
  #factorEntidad(entidad) {
    if (this.#tabla === null) {
      return 1;
    }
    return this.#tabla.getFactorEntidad(entidad);
  }

  /** Plural sencillo: «exposición» → «exposiciones», «evento» → «eventos», «mentor» → «mentores». */
  static #plural(palabra) {
    if (palabra.endsWith("ón")) {
      return palabra.substring(0, palabra.length - 2) + "ones";
    }
    const ultima = palabra.charAt(palabra.length - 1);
    if ("aeiouáéó".includes(ultima)) {
      return palabra + "s";
    }
    return palabra + "es";
  }

  static #apuntar(vecinos, idDesde, idHacia, evidencia) {
    if (!vecinos.has(idDesde)) {
      vecinos.set(idDesde, new Map());
    }
    vecinos.get(idDesde).set(idHacia, evidencia);
  }

  static #entre0y1(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número entre 0 y 1.");
    }
    return valor;
  }
}
