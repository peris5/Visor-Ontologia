import { TipoEntidad } from '../modelo/TipoEntidad.js';
import { Persona } from '../modelo/Persona.js';
import { Organizacion } from '../modelo/Organizacion.js';
import { ObraDeArte } from '../modelo/ObraDeArte.js';

/**
 * Crea la subclase de Entidad que corresponde a un tipo, así el resto del
 * código no necesita hacer if/else con los tipos.
 *
 * crearDesdeNeo4j crea la entidad a partir de un nodo en bruto de Neo4j: el tipo sale de sus ETIQUETAS con la
 * tabla etiquetasEntidad de la configuración (Person → PERSONA...), que
 * llega del servidor. Ninguna etiqueta de Neo4j está escrita aquí.
 */
export class FabricaEntidades {
  /**
   * @param {string} tipo - un valor de TipoEntidad.
   * @param {Object} datos - { id, propiedades, subtipos, idioma } (ver Entidad).
   */
  static crearEntidad(tipo, datos) {
    if (tipo === TipoEntidad.PERSONA) {
      return new Persona(datos);
    }
    if (tipo === TipoEntidad.ORGANIZACION) {
      return new Organizacion(datos);
    }
    if (tipo === TipoEntidad.OBRA_DE_ARTE) {
      return new ObraDeArte(datos);
    }
    throw new Error("Tipo de entidad desconocido: \"" + tipo + "\".");
  }

  /**
   * Crea la entidad de un nodo de Neo4j. La etiqueta principal es la
   * primera que está en etiquetasEntidad; las demás son sus subtipos
   * (por ejemplo Creator y Painter).
   *
   * @param {string[]} etiquetas - las del nodo ("Person", "Creator", "Painter").
   * @param {Object} propiedades - las del nodo, en bruto.
   * @param {string} idioma - "es", "ca" o "en".
   * @param {Object} etiquetasEntidad - etiqueta → TipoEntidad (de la configuración).
   */
  static crearDesdeNeo4j(etiquetas, propiedades, id, idioma, etiquetasEntidad) {
    let principal = null;
    for (let i = 0; i < etiquetas.length; i++) {
      const etiqueta = etiquetas[i];
      if (principal === null && Object.prototype.hasOwnProperty.call(etiquetasEntidad, etiqueta)) {
        principal = etiqueta;
      }
    }
    if (principal === null) {
      throw new Error("El nodo " + id + " no es una entidad: ninguna de sus etiquetas (" + etiquetas.join(", ") +
        ") está en etiquetasEntidad de la configuración.");
    }
    const subtipos = [];
    for (let i = 0; i < etiquetas.length; i++) {
      if (etiquetas[i] !== principal) {
        subtipos.push(etiquetas[i]);
      }
    }
    const datos = { id: id, propiedades: propiedades, subtipos: subtipos, idioma: idioma, etiquetaPrincipal: principal };
    return FabricaEntidades.crearEntidad(etiquetasEntidad[principal], datos);
  }
}
