/**
 * TipoRelacion
 *
 * Un tipo de relación (por ejemplo "Maestro de"). Los tipos no se conocen de
 * antemano: el repositorio los descubre a partir de las relaciones que lee
 * y le da a cada uno un nombre legible y un color.
 *
 * Requisitos: RF-20 y RF-39 (cada tipo tiene su color).
 */
class TipoRelacion {
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

  /**
   * Convierte un id en un nombre legible: cambia los guiones bajos por
   * espacios y pone la primera letra en mayúscula.
   * Ejemplo: "maestro_de" → "Maestro de".
   *
   * @param {string} id
   * @returns {string}
   */
  static nombreDesdeId(id) {
    if (typeof id !== "string") {
      return "";
    }
    let nombre = "";
    for (let i = 0; i < id.length; i++) {
      const caracter = id[i];
      if (caracter === "_") {
        nombre = nombre + " ";
      } else if (nombre === "") {
        // Es la primera letra: va en mayúscula.
        nombre = nombre + caracter.toUpperCase();
      } else {
        nombre = nombre + caracter.toLowerCase();
      }
    }
    return nombre;
  }
}
