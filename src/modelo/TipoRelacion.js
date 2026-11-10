/**
 * TipoRelacion
 *
 * Un tipo de relación (por ejemplo "Maestro de"). El servidor descubre los
 * tipos a partir de los datos y les da un nombre legible y un color; el
 * navegador los recibe ya hechos.
 *
 * Requisitos: RF-20 y RF-39 (cada tipo tiene su color).
 */
export class TipoRelacion {
  #id;
  #nombre;
  #color;

  /**
   * @param {string} id - identificador tal como viene en los datos ("maestro_de").
   * @param {string} nombre - nombre para mostrar ("Maestro de").
   * @param {string} color - color en formato "#rrggbb".
   */
  constructor(id, nombre, color) {
    if (typeof id !== "string" || id === "") {
      throw new Error("El tipo de relación necesita un id (un texto no vacío).");
    }
    this.#id = id;
    this.#nombre = nombre;
    this.#color = color;
  }

  /**
   * @returns {string}
   */
  getId() {
    return this.#id;
  }

  /**
   * @returns {string}
   */
  getNombre() {
    return this.#nombre;
  }

  /**
   * @returns {string} color "#rrggbb".
   */
  getColor() {
    return this.#color;
  }
}
