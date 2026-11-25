import { Entidad } from './Entidad.js';
import { OrigenRelevancia } from './OrigenRelevancia.js';

/**
 * La relevancia de UN nodo y de dónde sale (lo devuelve una
 * EstrategiaRelevanciaNodos). Tres números:
 *
 *  - fuerza (R): cuánto importaría la entidad si la relación fuera segura.
 *  - certeza (C): cuánto se sabe de verdad (1 con una relación declarada;
 *    menos si solo hay coincidencias en eventos o deducciones).
 *  - relevancia (S = R × C): decide quién entra en el subgrafo, el orden y
 *    la distancia al centro. C decide además la opacidad.
 *
 * Y además:
 *  - origen: un valor de OrigenRelevancia.
 *  - explicacion: textos para la etiqueta y el panel («Mentoría (su
 *    maestro)», «Coinciden en 3 exposiciones», «Creación de Joaquín Mestre
 *    (su maestro)»).
 *  - padres: en un nodo deducido, los nodos directos por los que entra, de
 *    más a menos aportación; si no, [].
 *  - evidenciaPropia: la del nodo con la central (F × C × factorEntidad).
 *  - transmisiones: id de otro nodo → lo que esa pareja transmite en el
 *    cálculo (entre dos directos, o entre un deducido y cada padre). Con
 *    eso ConstructorSubgrafo da el peso de los muelles.
 *
 * Guarda también su Entidad (para crear el NodoRelevante sin buscarla).
 */
export class ResultadoRelevanciaNodo {
  #entidad;
  #relevancia;
  #fuerza;
  #certeza;
  #origen;
  #explicacion;
  #padres;
  #evidenciaPropia;
  #transmisiones;

  /**
   * @param {Object} datos - { entidad, fuerza, certeza, origen, explicacion,
   *   padres, evidenciaPropia, transmisiones (Map, opcional) }. La
   *   relevancia es fuerza × certeza; si solo se da «relevancia» (sin fuerza
   *   ni certeza), se toma fuerza = relevancia y certeza = 1.
   */
  constructor(datos) {
    if (!(datos.entidad instanceof Entidad)) {
      throw new Error("El resultado de relevancia necesita su entidad.");
    }
    if (!Object.prototype.hasOwnProperty.call(OrigenRelevancia, datos.origen)) {
      throw new Error("Origen de relevancia desconocido: " + datos.origen + ".");
    }
    this.#entidad = datos.entidad;
    if (typeof datos.fuerza === "number" && typeof datos.certeza === "number") {
      this.#fuerza = datos.fuerza;
      this.#certeza = datos.certeza;
      this.#relevancia = datos.fuerza * datos.certeza;
    } else {
      this.#fuerza = ResultadoRelevanciaNodo.#numero(datos.relevancia);
      this.#certeza = 1;
      this.#relevancia = this.#fuerza;
    }
    this.#origen = datos.origen;
    this.#explicacion = [];
    if (Array.isArray(datos.explicacion)) {
      for (let i = 0; i < datos.explicacion.length; i++) {
        this.#explicacion.push(datos.explicacion[i]);
      }
    }
    this.#padres = [];
    if (Array.isArray(datos.padres)) {
      for (let i = 0; i < datos.padres.length; i++) {
        if (datos.padres[i] instanceof Entidad) {
          this.#padres.push(datos.padres[i]);
        }
      }
    }
    this.#evidenciaPropia = ResultadoRelevanciaNodo.#numero(datos.evidenciaPropia);
    this.#transmisiones = new Map();
    if (datos.transmisiones instanceof Map) {
      for (const [id, peso] of datos.transmisiones) {
        this.#transmisiones.set(id, peso);
      }
    }
  }

  getEntidad() {
    return this.#entidad;
  }

  /**
   * @returns {number} S = R × C, entre 0 y 1.
   */
  getRelevancia() {
    return this.#relevancia;
  }

  /**
   * @returns {number} R, entre 0 y 1.
   */
  getFuerza() {
    return this.#fuerza;
  }

  /**
   * @returns {number} C, entre 0 y 1.
   */
  getCerteza() {
    return this.#certeza;
  }

  /**
   * @returns {string} un valor de OrigenRelevancia.
   */
  getOrigen() {
    return this.#origen;
  }

  /**
   * @returns {string[]} copia de los textos de la explicación.
   */
  getExplicacion() {
    const copia = [];
    for (let i = 0; i < this.#explicacion.length; i++) {
      copia.push(this.#explicacion[i]);
    }
    return copia;
  }

  /**
   * La explicación en una línea: «Amistad · 5 exposiciones juntos».
   */
  getTextoExplicacion() {
    return this.#explicacion.join(" · ");
  }

  /**
   * @returns {Entidad[]} copia de los padres de un deducido, del que más aporta al que menos.
   */
  getPadres() {
    const copia = [];
    for (let i = 0; i < this.#padres.length; i++) {
      copia.push(this.#padres[i]);
    }
    return copia;
  }

  /**
   * @returns {Entidad|null} el padre que más aporta (o null si no tiene).
   */
  getPadre() {
    if (this.#padres.length === 0) {
      return null;
    }
    return this.#padres[0];
  }

  getEvidenciaPropia() {
    return this.#evidenciaPropia;
  }

  /**
   * @returns {Map<string, number>} copia de id del otro nodo → lo que transmite esa pareja.
   */
  getTransmisiones() {
    return new Map(this.#transmisiones);
  }

  esDeducido() {
    return this.#origen === OrigenRelevancia.DEDUCIDA;
  }

  /** El valor si es un número; si no, 0. */
  static #numero(valor) {
    if (typeof valor === "number" && !Number.isNaN(valor)) {
      return valor;
    }
    return 0;
  }
}
