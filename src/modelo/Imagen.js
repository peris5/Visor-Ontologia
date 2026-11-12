/**
 * Imagen
 *
 * Una imagen de una entidad (nodo Image de Neo4j unido con HAS_IMAGE).
 * El pie (caption) se usa también como texto alternativo (RNF-25).
 *
 * Requisitos: RF-28, RNF-25.
 */
export class Imagen {
  #url;
  #pie;
  #orden;

  /**
   * @param {string} url
   * @param {string} pie - caption ("" si no tiene).
   * @param {number} orden - posición entre las imágenes de la entidad.
   */
  constructor(url, pie, orden) {
    this.#url = url;
    this.#pie = "";
    if (typeof pie === "string") {
      this.#pie = pie;
    }
    this.#orden = orden;
  }

  /**
   * @returns {string}
   */
  getUrl() {
    return this.#url;
  }

  /**
   * @returns {string}
   */
  getPie() {
    return this.#pie;
  }

  /**
   * @returns {number}
   */
  getOrden() {
    return this.#orden;
  }
}
