import { RepositorioVecindario } from '../datos/RepositorioVecindario.js';
import { ConstructorSubgrafo } from './ConstructorSubgrafo.js';

/**
 * GestorSubgrafos
 *
 * Une las piezas para obtener un subgrafo y evita peticiones innecesarias:
 *   1. Pide al servidor (ClienteServicio) el vecindario de la entidad.
 *   2. Lo mete en un RepositorioVecindario (en memoria).
 *   3. Construye el subgrafo con ConstructorSubgrafo, exactamente igual que
 *      en el incremento 1.
 *
 * Reutilización: si se pide la MISMA entidad con un umbral IGUAL O MAYOR
 * que el del vecindario guardado, no se pide nada al servidor. ¿Por qué se
 * puede? Con un umbral mayor, todo nodo que lo supere supera también el
 * umbral anterior, y (como se explica en el servidor, en
 * RepositorioDatos.obtener_vecindario) las relaciones de su camino también.
 * Así que el vecindario guardado ya contiene todo lo necesario. Con un
 * umbral MENOR podrían faltar relaciones (las que están entre los dos
 * umbrales), así que hay que pedir otro.
 *
 * Por eso subir el umbral muchas veces no le cuesta nada al servidor.
 *
 * Requisitos: RF-08 a RF-13 (el subgrafo se calcula en el cliente), RNF-05
 * (el servidor trabaja lo mínimo).
 */
export class GestorSubgrafos {
  #cliente;
  #estrategia;
  #maxNodos;
  #vecindarioGuardado;
  #idGuardado;
  #umbralGuardado;
  #milisegundosUltimoCalculo;
  #bytesVecindario;

  /**
   * @param {ClienteServicio} cliente - quien pide los datos al servidor
   *   (en las pruebas, un doble que cuenta las peticiones).
   * @param {EstrategiaRelevancia} estrategia
   * @param {number} maxNodos - máximo de nodos del subgrafo (de /api/configuracion).
   */
  constructor(cliente, estrategia, maxNodos) {
    this.#cliente = cliente;
    this.#estrategia = estrategia;
    this.#maxNodos = maxNodos;
    this.#vecindarioGuardado = null;
    this.#idGuardado = null;
    this.#umbralGuardado = null;
    this.#milisegundosUltimoCalculo = 0;
    this.#bytesVecindario = 0;
  }

  /**
   * El subgrafo de una entidad con un umbral. Pide un vecindario nuevo solo
   * si hace falta (ver necesitaPedir).
   *
   * @param {string} idEntidad
   * @param {number} umbral - entre 0 y 1.
   * @returns {Promise<Subgrafo>}
   */
  async obtenerSubgrafo(idEntidad, umbral) {
    let vecindario = this.#vecindarioGuardado;
    if (this.#necesitaPedir(idEntidad, umbral)) {
      vecindario = await this.#cliente.obtenerVecindario(idEntidad, umbral);
      this.#guardar(idEntidad, umbral, vecindario);
    }

    // Se mide solo el cálculo, sin la red (para las pruebas de rendimiento).
    // Se usa la variable local "vecindario" y no la guardada porque, mientras
    // se esperaba al servidor, otra petición podría haber guardado otra.
    const inicio = performance.now();
    const repositorio = new RepositorioVecindario(vecindario);
    const constructor = new ConstructorSubgrafo(repositorio, this.#estrategia, umbral, this.#maxNodos);
    const subgrafo = await constructor.construir(idEntidad);
    this.#milisegundosUltimoCalculo = performance.now() - inicio;
    return subgrafo;
  }

  /**
   * Cuánto tardó el último cálculo del subgrafo, sin contar la red
   * (para la barra de rendimiento).
   *
   * @returns {number} milisegundos.
   */
  getMilisegundosUltimoCalculo() {
    return this.#milisegundosUltimoCalculo;
  }

  /**
   * Cuánto ocupaba el vecindario con el que se ha calculado el último
   * subgrafo (para la barra de rendimiento).
   *
   * @returns {number} bytes.
   */
  getBytesVecindario() {
    return this.#bytesVecindario;
  }

  /**
   * (Privado) ¿Hay que pedir un vecindario nuevo al servidor?
   * No, si es la misma entidad y el umbral es igual o mayor que el del
   * vecindario guardado (ver la explicación de la clase).
   *
   * @param {string} idEntidad
   * @param {number} umbral
   * @returns {boolean}
   */
  #necesitaPedir(idEntidad, umbral) {
    if (this.#vecindarioGuardado === null) {
      return true;
    }
    if (idEntidad !== this.#idGuardado) {
      return true;
    }
    if (umbral < this.#umbralGuardado) {
      return true;
    }
    return false;
  }

  /**
   * (Privado) Guarda el vecindario recibido para poder reutilizarlo.
   *
   * Se guarda el umbral que dice la respuesta, no el pedido: el servidor lo
   * redondea hacia abajo a 2 decimales (0,349 → 0,34), y el vecindario vale
   * para cualquier umbral igual o mayor que ese.
   *
   * @param {string} idEntidad
   * @param {number} umbralPedido
   * @param {Object} vecindario - el JSON de /api/vecindario.
   */
  #guardar(idEntidad, umbralPedido, vecindario) {
    let umbralDelVecindario = umbralPedido;
    if (typeof vecindario.umbral === "number" && vecindario.umbral <= umbralPedido) {
      umbralDelVecindario = vecindario.umbral;
    }
    this.#vecindarioGuardado = vecindario;
    this.#idGuardado = idEntidad;
    this.#umbralGuardado = umbralDelVecindario;
    this.#bytesVecindario = this.#cliente.getBytesUltimaRespuesta();

    if (vecindario.recortado === true) {
      // El servidor ha llegado a su máximo de entidades: el subgrafo podría
      // no ser exactamente el que saldría con todos los datos.
      console.warn("El vecindario de " + idEntidad + " (umbral " + umbralDelVecindario +
        ") ha llegado recortado: el servidor ha alcanzado su máximo de entidades.");
    }
  }
}
