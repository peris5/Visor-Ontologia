import { EstrategiaRelevanciaNodos } from './EstrategiaRelevanciaNodos.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { NodoRelevante } from '../modelo/NodoRelevante.js';
import { ResultadoRelevanciaNodo } from '../modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * El cálculo ANTERIOR de la relevancia de los nodos: el PRODUCTO DEL MEJOR
 * CAMINO desde la entidad central. Es la búsqueda «primero el mejor» que
 * antes estaba dentro de ConstructorSubgrafo, sacada aquí sin cambiar el
 * algoritmo. Se conserva para comparar con RelevanciaNodosTresCapas en el
 * capítulo de pruebas ("estrategiaNodos": "mejorCamino").
 *
 * Diferencias con el comportamiento de antes (no son del algoritmo, sino de
 * lo que recibe):
 *  - la relevancia de cada relación es la de RelevanciaCompuesta
 *    (peso × (2/n)^β × f_t), no solo el peso;
 *  - solo se expanden la central y sus nodos directos (las entidades de las
 *    que la caché tiene todas las relaciones), así que llega a dos saltos;
 *  - no poda por el umbral: calcula todos los nodos y el umbral lo aplica
 *    ConstructorSubgrafo (da lo mismo, porque la relevancia nunca crece a lo
 *    largo de un camino).
 *
 * Tiene los tres problemas que explica la memoria: no suma vías (solo cuenta
 * el mejor camino), no distingue qué se transmite y solo usa la mejor
 * relación de cada pareja.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ¿Por qué «primero el mejor» da a cada nodo su MEJOR relevancia posible?
 *
 *   1. La relevancia de un nodo es el producto de las relevancias de las
 *      relaciones del camino. Todas valen entre 0 y 1, y multiplicar por un
 *      número menor o igual que 1 nunca hace crecer el resultado. Por tanto,
 *      a lo largo de un camino la relevancia NUNCA crece.
 *
 *   2. Un nodo NO entra cuando se descubre, sino cuando sale de la lista de
 *      pendientes como el candidato más relevante de todos.
 *
 *   3. Supongamos que el nodo V sale de pendientes con relevancia R. Cualquier
 *      otro camino hacia V todavía sin explorar tiene que pasar por algún
 *      candidato que sigue pendiente, y ese candidato tiene relevancia ≤ R
 *      (si no, habría salido antes que V). Por el punto 1, seguir ese camino
 *      hasta V solo puede dar una relevancia ≤ R. Luego R ya es la mejor.
 *
 *   Ejemplo: Central→V vale 0,4 y Central→Y→V vale 0,9 × 0,9 = 0,81.
 *   Al expandir la Central, V queda pendiente con 0,4 e Y con 0,9.
 *   Sale Y (0,9), se expande y V vuelve a quedar pendiente, ahora con 0,81.
 *   Sale V con 0,81, su mejor valor. Cuando más tarde salga la copia con 0,4,
 *   se descarta porque V ya está dentro.
 * ─────────────────────────────────────────────────────────────────────────
 */
export class RelevanciaNodosMejorCamino extends EstrategiaRelevanciaNodos {
  #calculador;
  #estrategia;

  /**
   * @param {CalculadorEvidencia} calculador - elige los directos y da la
   *   relevancia de cada relación (su RelevanciaCompuesta).
   */
  constructor(calculador) {
    super();
    if (!(calculador instanceof CalculadorEvidencia)) {
      throw new Error("RelevanciaNodosMejorCamino necesita un CalculadorEvidencia.");
    }
    this.#calculador = calculador;
    this.#estrategia = calculador.getEstrategia();
  }

  calcular(central, cache) {
    const eleccion = this.#calculador.elegirDirectos(central, cache.relacionesDe(central.getId()));
    // Solo se expanden las entidades de las que se tienen TODAS las relaciones.
    const expandibles = new Set();
    expandibles.add(central.getId());
    for (let i = 0; i < eleccion.directos.length; i++) {
      expandibles.add(eleccion.directos[i].getId());
    }

    // id → { nodo: NodoRelevante, padre: Entidad|null, relacion: Relacion|null }
    const dentro = new Map();
    dentro.set(central.getId(), { nodo: new NodoRelevante(central, 1, 0), padre: null, relacion: null });
    const pendientes = this.#expandir(central, 1, 0, cache, dentro, expandibles);

    while (pendientes.length > 0) {
      const candidato = RelevanciaNodosMejorCamino.#sacarElMasRelevante(pendientes);
      const id = candidato.nodo.getEntidad().getId();
      // Un vecino puede estar varias veces en pendientes (una por camino):
      // la primera copia que sale es la mejor; las demás se descartan.
      if (!dentro.has(id)) {
        dentro.set(id, candidato);
        const nuevos = this.#expandir(candidato.nodo.getEntidad(), candidato.nodo.getRelevancia(),
          candidato.nodo.getNivel(), cache, dentro, expandibles);
        for (let i = 0; i < nuevos.length; i++) {
          pendientes.push(nuevos[i]);
        }
      }
    }
    return this.#resultados(central, dentro, eleccion.evidencias);
  }

  /**
   * Los candidatos nuevos al expandir una entidad: por cada vecino que no
   * está dentro, su MEJOR relación, con relevancia = la del padre × la de la
   * relación. Si la entidad no es expandible, ninguno.
   */
  #expandir(entidad, relevancia, nivel, cache, dentro, expandibles) {
    if (!expandibles.has(entidad.getId())) {
      return [];
    }
    const relaciones = cache.relacionesDe(entidad.getId());
    const mejorPorVecino = new Map();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const r = this.#estrategia.calcularRelevanciaRelacion(relacion);
      const vecino = relacion.getOtroExtremo(entidad);
      if (r > 0 && vecino.getId() !== entidad.getId() && !dentro.has(vecino.getId())) {
        const guardada = mejorPorVecino.get(vecino.getId());
        if (guardada === undefined || r > guardada.getRelevancia()) {
          mejorPorVecino.set(vecino.getId(), relacion);
        }
      }
    }
    const candidatos = [];
    for (const relacion of mejorPorVecino.values()) {
      const vecino = relacion.getOtroExtremo(entidad);
      const relevanciaVecino = this.#estrategia.calcularRelevanciaNodo(relevancia, relacion.getRelevancia());
      candidatos.push({ nodo: new NodoRelevante(vecino, relevanciaVecino, nivel + 1), padre: entidad,
        relacion: relacion });
    }
    return candidatos;
  }

  /** Saca de la lista el candidato de mayor relevancia (si hay empate, el primero). */
  static #sacarElMasRelevante(pendientes) {
    let posicionDelMejor = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if (pendientes[i].nodo.getRelevancia() > pendientes[posicionDelMejor].nodo.getRelevancia()) {
        posicionDelMejor = i;
      }
    }
    const elMejor = pendientes[posicionDelMejor];
    pendientes.splice(posicionDelMejor, 1);
    return elMejor;
  }

  /**
   * Los ResultadoRelevanciaNodo: a un salto, DECLARADA o COINCIDENCIAS
   * según la evidencia con la central; a dos, DEDUCIDA (su padre es el nodo
   * del camino).
   */
  #resultados(central, dentro, evidenciasCentral) {
    const resultados = new Map();
    for (const [id, datos] of dentro) {
      const nodo = datos.nodo;
      let origen = OrigenRelevancia.CENTRAL;
      let explicacion = [];
      const padres = [];
      let propia = 1;
      if (nodo.getNivel() >= 1) {
        const nombreTipo = datos.relacion.getTipo().getNombre();
        propia = 0;
        if (evidenciasCentral.has(id)) {
          propia = this.#calculador.valorPropio(evidenciasCentral.get(id));
        }
        if (nodo.getNivel() === 1) {
          origen = OrigenRelevancia.COINCIDENCIAS;
          explicacion = ["Coinciden en " + this.#calculador.textoCoincidencias(evidenciasCentral.get(id))];
          if (evidenciasCentral.get(id).esDeclarada()) {
            origen = OrigenRelevancia.DECLARADA;
            explicacion = [nombreTipo];
          }
        } else {
          origen = OrigenRelevancia.DEDUCIDA;
          padres.push(datos.padre);
          explicacion = [nombreTipo + " de " + datos.padre.getNombre() + " (mejor camino)"];
        }
      }
      // Sin certeza: el cálculo antiguo no la distingue (C = 1, S = R).
      resultados.set(id, new ResultadoRelevanciaNodo({
        entidad: nodo.getEntidad(), fuerza: nodo.getRelevancia(), certeza: 1, origen: origen,
        explicacion: explicacion, padres: padres, evidenciaPropia: propia
      }));
    }
    return resultados;
  }
}
