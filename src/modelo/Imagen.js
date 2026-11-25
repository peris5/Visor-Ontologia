/**
 * Una imagen de una entidad (nodo Image unido con HAS_IMAGE). El pie
 * (caption) se usa también como texto alternativo.
 */
export class Imagen {
  #url;
  #pie;
  #orden;

  /**
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

  getUrl() {
    return this.#url;
  }

  getPie() {
    return this.#pie;
  }

  getOrden() {
    return this.#orden;
  }
}
