/** De dónde sale un dato (nodo ExternalSource y sus subtipos: libro, API o web). */
export class FuenteExterna {
  #nombre;
  #tipo;
  #url;
  #actualizada;
  #idExterno;

  /**
   * @param {Object} datos - { nombre, tipo (subtipo: "Book", "API", "Web"...),
   *   url, actualizada (fecha), idExterno }
   */
  constructor(datos) {
    this.#nombre = FuenteExterna.#texto(datos.nombre);
    this.#tipo = FuenteExterna.#texto(datos.tipo);
    this.#url = FuenteExterna.#texto(datos.url);
    this.#actualizada = FuenteExterna.#texto(datos.actualizada);
    this.#idExterno = FuenteExterna.#texto(datos.idExterno);
  }

  getNombre() {
    return this.#nombre;
  }

  getTipo() {
    return this.#tipo;
  }

  getUrl() {
    return this.#url;
  }

  getActualizada() {
    return this.#actualizada;
  }

  /** Identificador de la entidad en esa fuente. */
  getIdExterno() {
    return this.#idExterno;
  }

  static #texto(valor) {
    if (valor === undefined || valor === null) {
      return "";
    }
    return String(valor);
  }
}
