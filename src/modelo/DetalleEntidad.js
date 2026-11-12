/**
 * DetalleEntidad
 *
 * Lo que se muestra de una entidad al seleccionarla y que no hace falta para
 * dibujar el grafo, así que se pide aparte (GET /api/detalle/{id}): sus
 * eventos (nacimiento, defunción, residencia y los demás), sus imágenes, sus
 * fuentes externas y su ubicación.
 *
 * Requisitos: RF-28 (información del nodo), RNF-27 (fuentes).
 */
export class DetalleEntidad {
  #idEntidad;
  #eventos;
  #imagenes;
  #fuentes;
  #ubicacion;

  /**
   * @param {string} idEntidad
   * @param {Evento[]} eventos
   * @param {Imagen[]} imagenes - ya ordenadas.
   * @param {FuenteExterna[]} fuentes
   * @param {string[]} ubicacion - nombres de los lugares, del más cercano
   *   al más amplio (ciudad, provincia, país).
   */
  constructor(idEntidad, eventos, imagenes, fuentes, ubicacion) {
    this.#idEntidad = idEntidad;
    this.#eventos = DetalleEntidad.#copia(eventos);
    this.#imagenes = DetalleEntidad.#copia(imagenes);
    this.#fuentes = DetalleEntidad.#copia(fuentes);
    this.#ubicacion = DetalleEntidad.#copia(ubicacion);
  }

  /**
   * @returns {string}
   */
  getIdEntidad() {
    return this.#idEntidad;
  }

  /**
   * @returns {Evento[]}
   */
  getEventos() {
    return DetalleEntidad.#copia(this.#eventos);
  }

  /**
   * Los eventos de un tipo (por ejemplo, el nacimiento).
   *
   * @param {string} tipo
   * @returns {Evento[]}
   */
  getEventosDeTipo(tipo) {
    const resultado = [];
    for (let i = 0; i < this.#eventos.length; i++) {
      if (this.#eventos[i].getTipo() === tipo) {
        resultado.push(this.#eventos[i]);
      }
    }
    return resultado;
  }

  /**
   * @returns {Imagen[]}
   */
  getImagenes() {
    return DetalleEntidad.#copia(this.#imagenes);
  }

  /**
   * @returns {FuenteExterna[]}
   */
  getFuentes() {
    return DetalleEntidad.#copia(this.#fuentes);
  }

  /**
   * @returns {string[]}
   */
  getUbicacion() {
    return DetalleEntidad.#copia(this.#ubicacion);
  }

  /**
   * (Privado) Copia de una lista ([] si no lo es).
   *
   * @param {*} lista
   * @returns {Array}
   */
  static #copia(lista) {
    const copia = [];
    if (Array.isArray(lista)) {
      for (let i = 0; i < lista.length; i++) {
        copia.push(lista[i]);
      }
    }
    return copia;
  }
}
