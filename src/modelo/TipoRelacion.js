/**
 * TipoRelacion
 *
 * Un tipo de relación (por ejemplo "Matrimonio"). Los tipos no se conocen de
 * antemano: salen de la base de datos (la etiqueta más específica del nodo
 * intermediario, por ejemplo Marriage, o el tipo de una relación directa,
 * por ejemplo STUDENT_OF).
 *
 *  - padres: sus padres en la jerarquía, del más cercano al más lejano
 *    (Marriage → ["Related", "Relationship"]).
 *  - familia: el padre más alto por debajo de la raíz (Marriage → Related).
 *    Si solo tiene un padre (la raíz) o ninguno, el propio tipo. Sirve para
 *    agrupar la leyenda.
 *  - nombre: el de la configuración (nombresTipos) o, si es un tipo nuevo
 *    que no está, uno automático a partir del id (nombreDesdeId).
 *
 * Requisitos: RF-20 y RF-39 (cada tipo tiene su color y no se conocen de
 * antemano), RF-23 (leyenda por familias).
 */
export class TipoRelacion {
  #id;
  #nombre;
  #color;
  #padres;
  #nombreFamilia;

  /**
   * @param {string} id - identificador tal como viene en los datos ("Marriage").
   * @param {string} nombre - nombre para mostrar ("Matrimonio").
   * @param {string} color - color en formato "#rrggbb".
   * @param {string[]} padres - opcional: del más cercano al más lejano.
   * @param {string} nombreFamilia - opcional: nombre para mostrar de la familia
   *   (si no se indica, el automático de su id).
   */
  constructor(id, nombre, color, padres, nombreFamilia) {
    if (typeof id !== "string" || id === "") {
      throw new Error("El tipo de relación necesita un id (un texto no vacío).");
    }
    this.#id = id;
    this.#nombre = nombre;
    this.#color = color;
    this.#padres = [];
    if (Array.isArray(padres)) {
      for (let i = 0; i < padres.length; i++) {
        this.#padres.push(padres[i]);
      }
    }
    this.#nombreFamilia = TipoRelacion.nombreDesdeId(this.getFamilia());
    if (typeof nombreFamilia === "string" && nombreFamilia !== "") {
      this.#nombreFamilia = nombreFamilia;
    }
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
   * @returns {string[]} copia de los padres, del más cercano al más lejano.
   */
  getPadres() {
    const copia = [];
    for (let i = 0; i < this.#padres.length; i++) {
      copia.push(this.#padres[i]);
    }
    return copia;
  }

  /**
   * El padre más alto por debajo de la raíz; si no hay, el propio tipo.
   * Marriage ["Related", "Relationship"] → "Related";
   * Mentorship ["Relationship"] → "Mentorship"; STUDENT_OF [] → "STUDENT_OF".
   *
   * @returns {string}
   */
  getFamilia() {
    if (this.#padres.length >= 2) {
      return this.#padres[this.#padres.length - 2];
    }
    return this.#id;
  }

  /**
   * @returns {string} nombre para mostrar de la familia.
   */
  getNombreFamilia() {
    return this.#nombreFamilia;
  }

  /**
   * Nombre de un tipo: el de la tabla nombresTipos de la configuración o,
   * si no está (un tipo nuevo), el automático.
   *
   * @param {string} id
   * @param {Object} nombresTipos - id → nombre.
   * @returns {string}
   */
  static nombrar(id, nombresTipos) {
    if (nombresTipos !== undefined && nombresTipos !== null && typeof nombresTipos[id] === "string") {
      return nombresTipos[id];
    }
    return TipoRelacion.nombreDesdeId(id);
  }

  /**
   * Convierte un id en un nombre legible: separa las palabras por los
   * guiones bajos y por el cambio de minúscula a mayúscula (CamelCase), las
   * pone en minúsculas y la primera letra en mayúscula.
   * Ejemplos: "STUDENT_OF" → "Student of"; "HeritageItem" → "Heritage item";
   * "Apprenticeship" → "Apprenticeship"; "maestro_de" → "Maestro de".
   *
   * @param {string} id
   * @returns {string}
   */
  static nombreDesdeId(id) {
    if (typeof id !== "string") {
      return "";
    }
    const palabras = TipoRelacion.#separarPalabras(id);
    let nombre = "";
    for (let i = 0; i < palabras.length; i++) {
      let palabra = palabras[i].toLowerCase();
      if (i === 0) {
        palabra = palabra.charAt(0).toUpperCase() + palabra.substring(1);
      } else {
        nombre = nombre + " ";
      }
      nombre = nombre + palabra;
    }
    return nombre;
  }

  /**
   * (Privado) Palabras de un id: se corta en cada "_" o espacio y donde una
   * minúscula va seguida de una mayúscula ("heritageItem" → heritage | Item).
   *
   * @param {string} id
   * @returns {string[]}
   */
  static #separarPalabras(id) {
    const palabras = [];
    let actual = "";
    for (let i = 0; i < id.length; i++) {
      const caracter = id[i];
      let anterior = "";
      if (i > 0) {
        anterior = id[i - 1];
      }
      const esMayuscula = caracter !== caracter.toLowerCase();
      const anteriorEsMinuscula = anterior !== "" && anterior !== anterior.toUpperCase();
      if (caracter === "_" || caracter === " ") {
        if (actual !== "") {
          palabras.push(actual);
        }
        actual = "";
      } else if (esMayuscula && anteriorEsMinuscula) {
        palabras.push(actual);
        actual = caracter;
      } else {
        actual = actual + caracter;
      }
    }
    if (actual !== "") {
      palabras.push(actual);
    }
    return palabras;
  }
}
