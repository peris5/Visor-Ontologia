/**
 * FabricaEntidades
 *
 * Crea la subclase de Entidad que corresponde a cada tipo. Así, quien lee
 * los datos no tiene que saber qué clase concreta usar (patrón Fábrica).
 *
 */
class FabricaEntidades {
  /**
   * @param {string} tipo - un valor de TipoEntidad.
   * @param {Object} datos - datos de la entidad.
   * @returns {Entidad}
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
}
