import { RepositorioVecindario } from '../datos/RepositorioVecindario.js';
import { ConstructorSubgrafo } from './ConstructorSubgrafo.js';

/**
 * Une las piezas para obtener un subgrafo y evita peticiones innecesarias.
 * Para cada entidad central, obtenerSubgrafo:
 *
 *   1. Pide las relaciones de la entidad central (si la caché no las tiene ya).
 *   2. Calcula la evidencia con cada vecino y elige los nodos DIRECTOS
 *      (evidencia ≥ umbralDirecto). Si hay más de maxDirectos, se queda con
 *      los de más evidencia y avisa en la consola.
 *   3. Pide EN UNA SOLA TANDA (ClienteServicio la parte en trozos de 200 ids)
 *      las relaciones de los directos que la caché aún no tiene completas.
 *   4. Calcula las relevancias con la estrategia de nodos y construye el
 *      subgrafo (ConstructorSubgrafo).
 *
 * ¿Por qué el resultado es EXACTO con solo esas dos tandas? La relevancia en
 * tres capas solo mira, como mucho, a dos saltos de la central:
 *  - la evidencia de la central con cada vecino (capa 0) sale de las
 *    relaciones de la central (tanda 1);
 *  - el refuerzo (capas 1 y 2) solo mira las relaciones entre directos:
 *    salen de las relaciones de los directos (tanda 2);
 *  - la deducción (capa 3) solo llega a los vecinos de los directos, y la
 *    evidencia de cada directo con sus vecinos también está en la tanda 2.
 *  - el grado de cada directo (la penalización h de los intermediarios muy
 *    conectados) es EXACTO: tras la tanda 2 se tienen TODAS sus relaciones.
 * Nada más influye en el cálculo, así que tener más relaciones no cambiaría
 * ningún número. (Antes, con el producto del mejor camino, hacía falta
 * buscar por rondas sin saber hasta dónde llegar.)
 *
 * Consecuencias:
 *  - cambiar el umbral (subirlo o bajarlo) no pide nada: el cálculo no
 *    depende del umbral, solo qué nodos se muestran;
 *  - volver a una entidad ya visitada no pide nada: está en la caché;
 *  - mostrar u ocultar los deducidos no pide nada;
 *  - cada entidad nueva necesita como mucho 2 tandas.
 *
 * Al abrir una entidad, obtenerSubgrafoAjustado elige además el umbral
 * para que salgan más o menos los mismos nodos (AjustadorUmbral).
 *
 * También da el detalle de una entidad (guardándolo para no pedirlo dos veces).
 */
export class GestorSubgrafos {
  #cliente;
  #estrategiaNodos;
  #calculador;
  #maxNodos;
  #cache;
  #contexto;
  #mostrarDeducidos;
  #detalles;
  #estadisticas;
  #milisegundosUltimoCalculo;
  #bytesRecibidos;

  /**
   * @param {ClienteServicio} cliente - quien pide los datos al servidor
   *   (en las pruebas, un doble que cuenta las peticiones).
   * @param {EstrategiaRelevanciaNodos} estrategiaNodos
   * @param {CalculadorEvidencia} calculador - elige los nodos directos.
   * @param {number} maxNodos - máximo de nodos del subgrafo (de /api/configuracion).
   * @param {Object} contexto - { idioma, nombresTipos, etiquetasEntidad, tipos }
   *   para interpretar las relaciones (ver RepositorioVecindario).
   * @param {boolean} mostrarDeducidos - opcional; true si no se indica.
   */
  constructor(cliente, estrategiaNodos, calculador, maxNodos, contexto, mostrarDeducidos) {
    this.#cliente = cliente;
    this.#estrategiaNodos = estrategiaNodos;
    this.#calculador = calculador;
    this.#maxNodos = maxNodos;
    this.#contexto = contexto;
    this.#cache = new RepositorioVecindario(null, contexto);
    this.#mostrarDeducidos = mostrarDeducidos !== false;
    this.#detalles = new Map();
    this.#estadisticas = { tandas: 0, directos: 0, deducidos: 0 };
    this.#milisegundosUltimoCalculo = 0;
    this.#bytesRecibidos = 0;
  }

  /**
   * El subgrafo de una entidad con un umbral (ver los pasos en la
   * explicación de la clase).
   *
   * @param {number} umbral - entre 0 y 1.
   */
  async obtenerSubgrafo(idEntidad, umbral) {
    const tandas = await this.#cargar(idEntidad);
    return this.#construir(idEntidad, umbral, tandas);
  }

  /**
   * El subgrafo de una entidad con el umbral que da más o menos los nodos
   * que quiere el ajustador (ver AjustadorUmbral). El umbral elegido se lee
   * con subgrafo.getUmbral(). Como el cálculo no depende del umbral, con las
   * mismas dos tandas se conocen las relevancias de TODOS los nodos.
   */
  async obtenerSubgrafoAjustado(idEntidad, ajustador) {
    const tandas = await this.#cargar(idEntidad);
    const completo = new ConstructorSubgrafo(this.#cache, this.#estrategiaNodos, this.#calculador, 0, this.#maxNodos,
      this.#mostrarDeducidos);
    await completo.construir(idEntidad);
    const relevancias = [];
    for (const [id, resultado] of completo.getResultados()) {
      const seMuestra = this.#mostrarDeducidos || !resultado.esDeducido();
      if (id !== idEntidad && seMuestra) {
        relevancias.push(resultado.getRelevancia());
      }
    }
    const eleccion = ajustador.elegir(relevancias, 0, this.#maxNodos);
    return this.#construir(idEntidad, eleccion.umbral, tandas);
  }

  /**
   * Muestra u oculta los nodos deducidos en los próximos subgrafos (no pide nada).
   */
  setMostrarDeducidos(mostrar) {
    this.#mostrarDeducidos = mostrar === true;
  }

  getMostrarDeducidos() {
    return this.#mostrarDeducidos;
  }

  /**
   * Para la barra de rendimiento: del último subgrafo, cuántas tandas de
   * peticiones hicieron falta (0 si todo estaba en la caché), cuántos nodos
   * directos y deducidos se calcularon.
   *
   * @returns {Object} { tandas, directos, deducidos }
   */
  getEstadisticas() {
    return {
      tandas: this.#estadisticas.tandas,
      directos: this.#estadisticas.directos,
      deducidos: this.#estadisticas.deducidos
    };
  }

  /**
   * Cuánto tardó el último cálculo del subgrafo, sin contar la red
   * (para la barra de rendimiento).
   */
  getMilisegundosUltimoCalculo() {
    return this.#milisegundosUltimoCalculo;
  }

  /**
   * Cuántos bytes se recibieron para el último subgrafo (0 si no hizo falta
   * pedir nada).
   */
  getBytesRecibidos() {
    return this.#bytesRecibidos;
  }

  /**
   * La caché de relaciones (para las pruebas).
   *
   * @returns {RepositorioVecindario}
   */
  getCache() {
    return this.#cache;
  }

  /**
   * El detalle de una entidad. Se pide al servidor solo la primera vez; las
   * siguientes se reutiliza.
   */
  async obtenerDetalle(idEntidad) {
    if (this.#detalles.has(idEntidad)) {
      return this.#detalles.get(idEntidad);
    }
    const detalle = await this.#cliente.obtenerDetalle(idEntidad, this.#contexto);
    this.#detalles.set(idEntidad, detalle);
    return detalle;
  }

  /**
   * Pasos 1 a 3: carga en la caché lo que falte de la central y de sus
   * directos.
   *
   * @returns {Promise<number>} cuántas tandas han hecho falta (0, 1 o 2).
   */
  async #cargar(idEntidad) {
    let tandas = 0;
    this.#bytesRecibidos = 0;
    if (!this.#cache.tieneCompletas(idEntidad)) {
      await this.#pedirTanda([idEntidad]);
      tandas = tandas + 1;
    }
    const central = this.#cache.entidad(idEntidad);
    if (central === null) {
      throw new Error("No existe ninguna entidad con el id \"" + idEntidad + "\".");
    }
    const eleccion = this.#calculador.elegirDirectos(central, this.#cache.relacionesDe(idEntidad));
    if (eleccion.descartados > 0) {
      console.warn("La entidad " + idEntidad + " tiene " + (eleccion.directos.length + eleccion.descartados) +
        " nodos directos: solo se usan los " + eleccion.directos.length + " de más evidencia (maxDirectos).");
    }
    const faltan = [];
    for (let i = 0; i < eleccion.directos.length; i++) {
      const id = eleccion.directos[i].getId();
      if (!this.#cache.tieneCompletas(id)) {
        faltan.push(id);
      }
    }
    if (faltan.length > 0) {
      await this.#pedirTanda(faltan);
      tandas = tandas + 1;
    }
    return tandas;
  }

  /** Pide las relaciones de esas entidades y las mete en la caché. */
  async #pedirTanda(ids) {
    const respuesta = await this.#cliente.obtenerRelaciones(ids);
    this.#cache.incorporar(respuesta);
    this.#bytesRecibidos = this.#bytesRecibidos + this.#cliente.getBytesUltimaRespuesta();
  }

  /** Paso 4: el subgrafo con las relaciones ya cargadas, y sus estadísticas. */
  async #construir(idEntidad, umbral, tandas) {
    // Se mide solo el cálculo, sin la red (para las pruebas de rendimiento).
    const inicio = performance.now();
    const constructor = new ConstructorSubgrafo(this.#cache, this.#estrategiaNodos, this.#calculador, umbral,
      this.#maxNodos, this.#mostrarDeducidos);
    const subgrafo = await constructor.construir(idEntidad);
    this.#milisegundosUltimoCalculo = performance.now() - inicio;

    let directos = 0;
    let deducidos = 0;
    for (const [id, resultado] of constructor.getResultados()) {
      if (resultado.esDeducido()) {
        deducidos = deducidos + 1;
      } else if (id !== idEntidad) {
        directos = directos + 1;
      }
    }
    this.#estadisticas = {
      tandas: tandas,
      directos: directos,
      deducidos: deducidos
    };
    return subgrafo;
  }
}
