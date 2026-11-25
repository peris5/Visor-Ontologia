import { Entidad } from './Entidad.js';
import { ResultadoRelevanciaNodo } from './ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from './OrigenRelevancia.js';

/**
 * Una entidad dentro de un subgrafo, con los datos que solo tienen sentido
 * en ese subgrafo:
 *  - relevancia: la que calcula la EstrategiaRelevanciaNodos.
 *  - nivel: número de saltos desde la entidad central (la central es 0, los
 *    nodos directos 1 y los deducidos 2).
 *  - centralidad: importancia del nodo dentro del subgrafo (entre 0 y 1).
 *  - resultado: el ResultadoRelevanciaNodo con el origen y la explicación
 *    de su relevancia (null si se ha creado sin él, como la central).
 */
export class NodoRelevante {
  #entidad;
  #relevancia;
  #nivel;
  #centralidad;
  #resultado;

  /**
   * @param {ResultadoRelevanciaNodo} resultado - opcional.
   */
  constructor(entidad, relevancia, nivel, resultado) {
    if (!(entidad instanceof Entidad)) {
      throw new Error("Un NodoRelevante necesita una Entidad.");
    }
    this.#entidad = entidad;
    this.#relevancia = relevancia;
    this.#nivel = nivel;
    // La centralidad se calcula al final, cuando el subgrafo está completo.
    this.#centralidad = 0;
    this.#resultado = null;
    if (resultado instanceof ResultadoRelevanciaNodo) {
      this.#resultado = resultado;
    }
  }

  getEntidad() {
    return this.#entidad;
  }

  getRelevancia() {
    return this.#relevancia;
  }

  getNivel() {
    return this.#nivel;
  }

  getCentralidad() {
    return this.#centralidad;
  }

  setCentralidad(valor) {
    this.#centralidad = valor;
  }

  /**
   * @returns {ResultadoRelevanciaNodo|null}
   */
  getResultado() {
    return this.#resultado;
  }

  /**
   * @returns {string} un valor de OrigenRelevancia (CENTRAL en el nivel 0 si no hay resultado).
   */
  getOrigen() {
    if (this.#resultado !== null) {
      return this.#resultado.getOrigen();
    }
    if (this.#nivel === 0) {
      return OrigenRelevancia.CENTRAL;
    }
    return OrigenRelevancia.DECLARADA;
  }

  /**
   * @returns {boolean} true si el nodo es deducido (capa 3).
   */
  esDeducido() {
    return this.getOrigen() === OrigenRelevancia.DEDUCIDA;
  }
}
