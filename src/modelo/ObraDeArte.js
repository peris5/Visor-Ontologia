import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * Un bien patrimonial (:HeritageItem). La creación no es un campo: es un
 * evento (Creation, Paint, Design) que la une con su autor.
 */
export class ObraDeArte extends Entidad {
  #dimensiones;

  constructor(datos) {
    super(datos);
    let propiedades = {};
    if (datos.propiedades !== undefined && datos.propiedades !== null) {
      propiedades = datos.propiedades;
    }
    this.#dimensiones = Entidad._textoOVacio(propiedades.dimensions);
  }

  getTipo() {
    return TipoEntidad.OBRA_DE_ARTE;
  }

  /** Por ejemplo "120 × 90 cm" ("" si no las tiene). */
  getDimensiones() {
    return this.#dimensiones;
  }

  /** Las dimensiones (si las tiene) y las propiedades desconocidas. */
  getAtributos() {
    const atributos = new Map();
    this._anadirSiNoVacio(atributos, "dimensiones", this.#dimensiones);
    const desconocidas = super.getAtributos();
    for (const clave of desconocidas.keys()) {
      atributos.set(clave, desconocidas.get(clave));
    }
    return atributos;
  }

  /** dimensions ya se muestra como «dimensiones», no tal cual. */
  _propiedadesConocidas() {
    const conocidas = super._propiedadesConocidas();
    conocidas.push("dimensions");
    return conocidas;
  }
}
