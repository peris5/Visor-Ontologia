/**
 * Cuándo ocurrió algo: un nodo Period (from, to, description) unido a una
 * relación o a un evento.
 */
export class Periodo {
  #desde;
  #hasta;
  #descripcion;

  constructor(desde, hasta, descripcion) {
    this.#desde = Periodo.#texto(desde);
    this.#hasta = Periodo.#texto(hasta);
    this.#descripcion = Periodo.#texto(descripcion);
  }

  /** Devuelve null si no hay propiedades. */
  static desdePropiedades(propiedades) {
    if (propiedades === undefined || propiedades === null) {
      return null;
    }
    return new Periodo(propiedades.from, propiedades.to, propiedades.description);
  }

  getDesde() {
    return this.#desde;
  }

  getHasta() {
    return this.#hasta;
  }

  getDescripcion() {
    return this.#descripcion;
  }

  /**
   * Texto para mostrar: «1902–1908», «1902» (si empieza y acaba el mismo
   * año), «desde 1902», «hasta 1908» o, si no hay fechas, la descripción.
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

  static #texto(valor) {
    if (valor === undefined || valor === null) {
      return "";
    }
    return String(valor);
  }
}
