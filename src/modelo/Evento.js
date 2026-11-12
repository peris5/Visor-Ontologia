/**
 * Evento
 *
 * Un nodo intermediario en el que participa una entidad, visto desde ella:
 * un evento (nacimiento, creación de una obra, exposición...) o una relación
 * (matrimonio, mentoría...). Forma parte del detalle de la entidad.
 *
 * El tipo es la etiqueta más específica del nodo ("Birth", "Marriage"...);
 * su nombre para mostrar lo pone quien lo muestra, con nombresTipos.
 *
 * Requisitos: RF-28 (información del nodo).
 */
export class Evento {
  #id;
  #tipo;
  #padres;
  #nombre;
  #rol;
  #periodo;
  #lugar;
  #fecha;
  #participantes;
  #sinRelacion;

  /**
   * @param {Object} datos - { id, tipo, padres, nombre, rol, periodo (Periodo
   *   o null), lugar (texto), fecha, participantes (nombres de las otras
   *   entidades), sinRelacion (true en nacimiento, muerte y residencia) }
   */
  constructor(datos) {
    this.#id = datos.id;
    this.#tipo = datos.tipo;
    this.#padres = Evento.#lista(datos.padres);
    this.#nombre = Evento.#texto(datos.nombre);
    this.#rol = Evento.#texto(datos.rol);
    this.#periodo = null;
    if (datos.periodo !== undefined) {
      this.#periodo = datos.periodo;
    }
    this.#lugar = Evento.#texto(datos.lugar);
    this.#fecha = Evento.#texto(datos.fecha);
    this.#participantes = Evento.#lista(datos.participantes);
    this.#sinRelacion = datos.sinRelacion === true;
  }

  /**
   * @returns {string}
   */
  getId() {
    return this.#id;
  }

  /**
   * @returns {string} etiqueta más específica ("Birth", "Paint"...).
   */
  getTipo() {
    return this.#tipo;
  }

  /**
   * @returns {string[]} copia de los padres del tipo.
   */
  getPadres() {
    return Evento.#lista(this.#padres);
  }

  /**
   * @returns {string} nombre del evento ("" si no tiene).
   */
  getNombre() {
    return this.#nombre;
  }

  /**
   * @returns {string} rol de la entidad en el evento ("" si no tiene).
   */
  getRol() {
    return this.#rol;
  }

  /**
   * @returns {Periodo|null}
   */
  getPeriodo() {
    return this.#periodo;
  }

  /**
   * @returns {string} nombre del lugar ("" si no hay).
   */
  getLugar() {
    return this.#lugar;
  }

  /**
   * @returns {string} fecha ("" si no hay).
   */
  getFecha() {
    return this.#fecha;
  }

  /**
   * @returns {string[]} nombres de las otras entidades que participan.
   */
  getParticipantes() {
    return Evento.#lista(this.#participantes);
  }

  /**
   * @returns {boolean} true si no crea relaciones (nacimiento, muerte, residencia).
   */
  esSinRelacion() {
    return this.#sinRelacion;
  }

  /**
   * Cuándo: la fecha si la hay; si no, el texto del periodo.
   *
   * @returns {string}
   */
  getCuando() {
    if (this.#fecha !== "") {
      return this.#fecha;
    }
    if (this.#periodo !== null) {
      return this.#periodo.getTexto();
    }
    return "";
  }

  /**
   * (Privado) Copia de una lista ([] si no lo es).
   *
   * @param {*} valor
   * @returns {Array}
   */
  static #lista(valor) {
    const copia = [];
    if (Array.isArray(valor)) {
      for (let i = 0; i < valor.length; i++) {
        copia.push(valor[i]);
      }
    }
    return copia;
  }

  /**
   * (Privado) El valor si es un texto; si no, "".
   *
   * @param {*} valor
   * @returns {string}
   */
  static #texto(valor) {
    if (typeof valor === "string") {
      return valor;
    }
    return "";
  }
}
