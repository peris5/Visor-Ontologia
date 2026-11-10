import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * ObraDeArte extends Entidad
 *
 * Una obra de arte del grafo (pintura, escultura, edificio...).
 *
 * Requisitos: modelo de dominio usado en RF-08 a RF-12.
 */
export class ObraDeArte extends Entidad {
  #fechaCreacion;
  #tecnica;

  /**
   * @param {Object} datos - los de Entidad más fechaCreacion y tecnica (opcionales).
   */
  constructor(datos) {
    super(datos);
    this.#fechaCreacion = Entidad._textoOVacio(datos.fechaCreacion);
    this.#tecnica = Entidad._textoOVacio(datos.tecnica);
  }

  /**
   * @returns {string} TipoEntidad.OBRA_DE_ARTE
   */
  getTipo() {
    return TipoEntidad.OBRA_DE_ARTE;
  }

  /**
   * Atributos comunes más los propios de una obra de arte.
   *
   * @returns {Map<string, *>}
   */
  getAtributos() {
    const atributos = super.getAtributos();
    this._anadirSiNoVacio(atributos, "fechaCreacion", this.#fechaCreacion);
    this._anadirSiNoVacio(atributos, "tecnica", this.#tecnica);
    return atributos;
  }
}
