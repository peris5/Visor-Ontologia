/**
 * FuenteExterna
 *
 * De dónde sale un dato (nodo ExternalSource de Neo4j y sus subtipos: libro,
 * API o web). Mostrarlas en el panel ayuda a cumplir la atribución.
 *
 * Requisitos: RF-28, RNF-27 (atribución de las fuentes).
 */
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

  /**
   * @returns {string}
   */
  getNombre() {
    return this.#nombre;
  }

  /**
   * @returns {string} subtipo ("Book", "API", "Web"...).
   */
  getTipo() {
    return this.#tipo;
  }

  /**
   * @returns {string} "" si no tiene.
   */
  getUrl() {
    return this.#url;
  }

  /**
   * @returns {string} fecha de actualización ("" si no se sabe).
   */
  getActualizada() {
    return this.#actualizada;
  }

  /**
   * @returns {string} identificador de la entidad en esa fuente.
   */
  getIdExterno() {
    return this.#idExterno;
  }

  /**
   * (Privado) El valor como texto ("" si no hay).
   *
   * @param {*} valor
   * @returns {string}
   */
  static #texto(valor) {
    if (valor === undefined || valor === null) {
      return "";
    }
    return String(valor);
  }
}
