import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * ObraDeArte extends Entidad
 *
 * Un bien patrimonial (:HeritageItem en Neo4j). Su nombre está en tres
 * idiomas y tiene dimensiones (dimensions).
 *
 * Desde el incremento 3b no tiene fechaCreacion ni tecnica: la creación es un
 * evento (Creation, Paint, Design) que la une con su autor.
 *
 * Requisitos: RF-19 (tipo de nodo), RF-28.
 */
export class ObraDeArte extends Entidad {
  #dimensiones;

  /**
   * @param {Object} datos - ver Entidad (propiedades con dimensions).
   */
  constructor(datos) {
    super(datos);
    let propiedades = {};
    if (datos.propiedades !== undefined && datos.propiedades !== null) {
      propiedades = datos.propiedades;
    }
    this.#dimensiones = Entidad._textoOVacio(propiedades.dimensions);
  }

  /**
   * @returns {string} TipoEntidad.OBRA_DE_ARTE
   */
  getTipo() {
    return TipoEntidad.OBRA_DE_ARTE;
  }

  /**
   * @returns {string} por ejemplo "120 × 90 cm" ("" si no las tiene).
   */
  getDimensiones() {
    return this.#dimensiones;
  }

  /**
   * Las dimensiones (si las tiene) y las propiedades desconocidas.
   *
   * @returns {Map<string, *>}
   */
  getAtributos() {
    const atributos = new Map();
    this._anadirSiNoVacio(atributos, "dimensiones", this.#dimensiones);
    const desconocidas = super.getAtributos();
    for (const clave of desconocidas.keys()) {
      atributos.set(clave, desconocidas.get(clave));
    }
    return atributos;
  }

  /**
   * (Protegido) dimensions es una propiedad conocida (no va a los atributos tal cual).
   *
   * @returns {string[]}
   */
  _propiedadesConocidas() {
    const conocidas = super._propiedadesConocidas();
    conocidas.push("dimensions");
    return conocidas;
  }
}
