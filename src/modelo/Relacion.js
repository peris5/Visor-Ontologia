import { Entidad } from './Entidad.js';
import { TipoRelacion } from './TipoRelacion.js';

/**
 * Relacion
 *
 * Una relación entre dos entidades (origen → destino) de un tipo concreto,
 * con su relevancia.
 *
 * En el navegador la relevancia llega ya calculada por el servidor (la
 * calcula EstrategiaRelevancia en Python), así que aquí solo se guarda.
 * El modelo del navegador es una versión reducida del de Python: solo tiene
 * lo que hace falta para dibujar el subgrafo.
 *
 * Requisitos: RF-20 y RF-21 (color y opacidad de cada relación), RF-38.
 */
export class Relacion {
  #id;
  #origen;
  #destino;
  #tipo;
  #relevancia;

  /**
   * @param {string} id
   * @param {Entidad} origen
   * @param {Entidad} destino
   * @param {TipoRelacion} tipo
   * @param {number} relevancia - entre 0 y 1 (calculada por el servidor).
   */
  constructor(id, origen, destino, tipo, relevancia) {
    if (typeof id !== "string" || id === "") {
      throw new Error("La relación necesita un id (un texto no vacío).");
    }
    if (!(origen instanceof Entidad) || !(destino instanceof Entidad)) {
      throw new Error("La relación " + id + " necesita una entidad de origen y otra de destino.");
    }
    if (!(tipo instanceof TipoRelacion)) {
      throw new Error("La relación " + id + " necesita un TipoRelacion.");
    }
    this.#id = id;
    this.#origen = origen;
    this.#destino = destino;
    this.#tipo = tipo;
    this.#relevancia = relevancia;
  }

  /**
   * @returns {string}
   */
  getId() {
    return this.#id;
  }

  /**
   * @returns {Entidad}
   */
  getOrigen() {
    return this.#origen;
  }

  /**
   * @returns {Entidad}
   */
  getDestino() {
    return this.#destino;
  }

  /**
   * @returns {TipoRelacion}
   */
  getTipo() {
    return this.#tipo;
  }

  /**
   * @returns {number} relevancia entre 0 y 1.
   */
  getRelevancia() {
    return this.#relevancia;
  }

  /**
   * Clave que identifica al par de entidades, sin importar el sentido:
   * la relación A→B y la relación B→A dan la misma clave.
   * Se consigue poniendo siempre primero el id más pequeño (orden alfabético).
   *
   * @returns {string} por ejemplo "a01|p03".
   */
  getClavePar() {
    const idOrigen = this.#origen.getId();
    const idDestino = this.#destino.getId();
    if (idOrigen < idDestino) {
      return idOrigen + "|" + idDestino;
    }
    return idDestino + "|" + idOrigen;
  }
}
