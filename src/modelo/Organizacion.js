import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * Organizacion extends Entidad
 *
 * Una organización (:Organization en Neo4j): museo, academia, taller...
 * Su nombre está en tres idiomas (name_es, name_ca, name_en).
 *
 * Desde el incremento 3b no tiene fechaFundacion ni sede: la fundación es un
 * evento (Fund) y el lugar, un nodo Ubication; los dos se ven en el detalle.
 *
 * Requisitos: RF-19 (tipo de nodo), RF-28.
 */
export class Organizacion extends Entidad {
  /**
   * @param {Object} datos - ver Entidad.
   */
  constructor(datos) {
    super(datos);
  }

  /**
   * @returns {string} TipoEntidad.ORGANIZACION
   */
  getTipo() {
    return TipoEntidad.ORGANIZACION;
  }
}
