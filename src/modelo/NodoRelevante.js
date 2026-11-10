/**
 * NodoRelevante
 *
 * Una entidad dentro de un subgrafo, junto con los datos que solo tienen
 * sentido en ese subgrafo:
 *  - relevancia: producto de las relevancias del camino desde la central.
 *  - nivel: número de saltos desde la entidad central (la central es 0).
 *  - centralidad: importancia del nodo dentro del subgrafo (entre 0 y 1).
 *
 * Requisitos: RF-08 a RF-12 (relevancia y nivel) y RF-37 (centralidad).
 */
class NodoRelevante {
  #entidad;
  #relevancia;
  #nivel;
  #centralidad;

  /**
   * @param {Entidad} entidad
   * @param {number} relevancia - entre 0 y 1.
   * @param {number} nivel - saltos desde la entidad central.
   */
  constructor(entidad, relevancia, nivel) {
    if (!(entidad instanceof Entidad)) {
      throw new Error("Un NodoRelevante necesita una Entidad.");
    }
    this.#entidad = entidad;
    this.#relevancia = relevancia;
    this.#nivel = nivel;
    // La centralidad se calcula al final, cuando el subgrafo está completo.
    this.#centralidad = 0;
  }

  /**
   * @returns {Entidad}
   */
  getEntidad() {
    return this.#entidad;
  }

  /**
   * @returns {number}
   */
  getRelevancia() {
    return this.#relevancia;
  }

  /**
   * @returns {number}
   */
  getNivel() {
    return this.#nivel;
  }

  /**
   * @returns {number} entre 0 y 1.
   */
  getCentralidad() {
    return this.#centralidad;
  }

  /**
   * @param {number} valor - centralidad calculada por CalculadorCentralidad.
   */
  setCentralidad(valor) {
    this.#centralidad = valor;
  }
}
