import { EstrategiaRelevanciaNodos } from './EstrategiaRelevanciaNodos.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { PropagacionDesdeDirectos } from './PropagacionDesdeDirectos.js';
import { PenalizacionGrado } from './PenalizacionGrado.js';
import { ResultadoRelevanciaNodo } from '../modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * La relevancia ARTÍSTICA de los nodos, en tres capas: mide cuánto ayuda
 * una entidad a entender la trayectoria y la obra de la entidad central.
 * Cada nodo termina con tres números: fuerza R, certeza C y relevancia
 * S = R × C (ver ResultadoRelevanciaNodo).
 *
 *  - Capa 0 (CalculadorEvidencia): la evidencia de cada pareja, vista desde
 *    cada lado, con TODAS sus relaciones y eventos, se dibujen o no. Los
 *    nodos con F × C × fE ≥ umbralDirecto con la central son los DIRECTOS.
 *  - Capas 1 a 3 (PropagacionDesdeDirectos): una sola fórmula para todos los
 *    nodos; los directos transmiten y todos reciben igual.
 *
 * Separar fuerza y certeza sigue la idea de la lógica subjetiva de Jøsang:
 * una probabilidad con un grado de incertidumbre, con un operador de
 * DESCUENTO para encadenar a lo largo de un camino (los productos) y otro
 * de FUSIÓN para juntar varias fuentes (los «o» de probabilidades).
 *
 * Solo usa las relaciones de la central y de sus directos, que tras las dos
 * tandas de GestorSubgrafos están TODAS en la caché: por eso el grado de
 * cada directo (el de la penalización h) es exacto.
 *
 * Los textos de la explicación nunca dicen que dos personas «se conozcan»
 * si no hay una relación declarada (RNF-23): solo que «coinciden». Se
 * generan cuando alguien los pide: de los miles de nodos que se calculan
 * solo se enseñan 150.
 */
export class RelevanciaNodosTresCapas extends EstrategiaRelevanciaNodos {
  #calculador;
  #propagacion;
  #penalizacion;

  /**
   * @param {CalculadorEvidencia} calculador
   * @param {PropagacionDesdeDirectos} propagacion
   * @param {PenalizacionGrado} penalizacion - la de la propagación (hay que
   *   decirle de qué caché salen los grados).
   */
  constructor(calculador, propagacion, penalizacion) {
    super();
    if (!(calculador instanceof CalculadorEvidencia) || !(propagacion instanceof PropagacionDesdeDirectos) ||
      !(penalizacion instanceof PenalizacionGrado)) {
      throw new Error("RelevanciaNodosTresCapas necesita un CalculadorEvidencia, una PropagacionDesdeDirectos y una " +
        "PenalizacionGrado.");
    }
    this.#calculador = calculador;
    this.#propagacion = propagacion;
    this.#penalizacion = penalizacion;
  }

  calcular(central, cache) {
    const preparado = this.preparar(central, cache);
    const propagados = this.#propagacion.calcular(central, preparado.directos, preparado.evidencias);
    return this.#completar(central, propagados, preparado.evidencias);
  }

  /**
   * Lo mismo con la fórmula escrita tal cual (PropagacionDesdeDirectos.
   * calcularReferencia). Solo para comprobar (P0).
   */
  calcularReferencia(central, cache) {
    const preparado = this.preparar(central, cache);
    const propagados = this.#propagacion.calcularReferencia(central, preparado.directos, preparado.evidencias);
    return this.#completar(central, propagados, preparado.evidencias);
  }

  /**
   * Los directos de la central y todas las evidencias que necesita la
   * propagación: las de la central y las de cada directo con sus vecinos.
   * El laboratorio lo usa para analizar los caminos.
   *
   * @returns {Object} { directos: Entidad[], evidencias: Map idDesde → (idHacia → EvidenciaPareja) }
   */
  preparar(central, cache) {
    this.#penalizacion.usarRelaciones(cache);
    const eleccion = this.#calculador.elegirDirectos(central, cache.relacionesDe(central.getId()));
    const evidencias = new Map();
    evidencias.set(central.getId(), eleccion.evidencias);
    for (let i = 0; i < eleccion.directos.length; i++) {
      const directo = eleccion.directos[i];
      evidencias.set(directo.getId(), this.#calculador.calcularDesde(directo, cache.relacionesDe(directo.getId())));
    }
    return { directos: eleccion.directos, evidencias: evidencias };
  }

  /** Añade la central y, a cada nodo, quién genera su explicación. */
  #completar(central, propagados, evidencias) {
    const resultados = new Map();
    resultados.set(central.getId(), new ResultadoRelevanciaNodo({
      entidad: central, fuerza: 1, certeza: 1, origen: OrigenRelevancia.CENTRAL, explicacion: [], padres: [],
      evidenciaPropia: 1
    }));
    const estrategia = this;
    for (const [id, resultado] of propagados) {
      resultado.setGeneradorExplicacion(function () {
        return estrategia.#explicar(central, resultado, evidencias);
      });
      resultados.set(id, resultado);
    }
    return resultados;
  }

  /**
   * Por qué es relevante un nodo:
   *  - declarada: «Mentoría (su maestro)», o «Amistad · 5 exposiciones juntos»;
   *  - coincidencias: «Coinciden en 3 exposiciones · Amistad con Luis Peris»
   *    (la relación declarada con otro directo que más le transmite);
   *  - deducida: «Creación de Joaquín Mestre (su maestro)», una por padre, y
   *    lo que la una a la central, si hay algo (aunque sea poco).
   */
  #explicar(central, resultado, evidencias) {
    const id = resultado.getEntidad().getId();
    const deLaCentral = evidencias.get(central.getId());
    let propia = null;
    if (deLaCentral.has(id)) {
      propia = deLaCentral.get(id);
    }
    if (resultado.getOrigen() === OrigenRelevancia.DEDUCIDA) {
      return this.#explicarDeducido(resultado, propia, deLaCentral, evidencias);
    }
    const textos = [];
    const coincidencias = this.#calculador.textoCoincidencias(propia);
    if (resultado.getOrigen() === OrigenRelevancia.DECLARADA) {
      textos.push(this.#calculador.textoDeclaradas(propia));
      if (coincidencias !== "") {
        textos.push(coincidencias + " juntos");
      }
      return textos;
    }
    textos.push("Coinciden en " + coincidencias);
    // Los padres van de más a menos aportación: el primero con relación declarada.
    const padres = resultado.getPadres();
    for (let i = 0; i < padres.length && textos.length === 1; i++) {
      const conElPadre = evidencias.get(padres[i].getId()).get(id);
      if (conElPadre.esDeclarada()) {
        textos.push(this.#calculador.textoDeclaradas(conElPadre) + " con " + padres[i].getNombre());
      }
    }
    return textos;
  }

  #explicarDeducido(resultado, propia, deLaCentral, evidencias) {
    const id = resultado.getEntidad().getId();
    const textos = [];
    const padres = resultado.getPadres();
    for (let i = 0; i < padres.length; i++) {
      const conElPadre = evidencias.get(padres[i].getId()).get(id);
      textos.push(conElPadre.getTipoPrincipal().getNombre() + " de " + padres[i].getNombre() + " (" +
        this.#calculador.textoVinculo(deLaCentral.get(padres[i].getId())) + ")");
    }
    if (propia !== null) {
      const declaradas = this.#calculador.textoDeclaradas(propia);
      if (declaradas !== "") {
        textos.push(declaradas);
      }
      const coincidencias = this.#calculador.textoCoincidencias(propia);
      if (coincidencias !== "") {
        textos.push("Coinciden en " + coincidencias);
      }
    }
    return textos;
  }
}
