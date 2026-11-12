/**
 * Periodo
 *
 * Cuándo ocurrió algo: un nodo Period de Neo4j (from, to, description)
 * unido a una relación o a un evento.
 *
 * Requisitos: RF-28 y RF-29 (información de nodos y relaciones).
 */
export class Periodo {
  #desde;
  #hasta;
  #descripcion;

  /**
   * @param {string} desde - por ejemplo "1902" ("" si no se sabe).
   * @param {string} hasta - por ejemplo "1908" ("" si no se sabe).
   * @param {string} descripcion - texto libre ("" si no hay).
   */
  constructor(desde, hasta, descripcion) {
    this.#desde = Periodo.#texto(desde);
    this.#hasta = Periodo.#texto(hasta);
    this.#descripcion = Periodo.#texto(descripcion);
  }

  /**
   * Crea el periodo a partir de las propiedades de un nodo Period.
   *
   * @param {Object|null} propiedades - { from, to, description }
   * @returns {Periodo|null} null si no hay propiedades.
   */
  static desdePropiedades(propiedades) {
    if (propiedades === undefined || propiedades === null) {
      return null;
    }
    return new Periodo(propiedades.from, propiedades.to, propiedades.description);
  }

  /**
   * @returns {string}
   */
  getDesde() {
    return this.#desde;
  }

  /**
   * @returns {string}
   */
  getHasta() {
    return this.#hasta;
  }

  /**
   * @returns {string}
   */
  getDescripcion() {
    return this.#descripcion;
  }

  /**
   * Texto para mostrar: «1902–1908», «1902» (si empieza y acaba el mismo
   * año), «desde 1902», «hasta 1908» o, si no hay fechas, la descripción.
   *
   * @returns {string}
   */
  getTexto() {
    if (this.#desde !== "" && this.#hasta !== "") {
      if (this.#desde === this.#hasta) {
        return this.#desde;
      }
      return this.#desde + "–" + this.#hasta;
    }
    if (this.#desde !== "") {
      return "desde " + this.#desde;
    }
    if (this.#hasta !== "") {
      return "hasta " + this.#hasta;
    }
    return this.#descripcion;
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
