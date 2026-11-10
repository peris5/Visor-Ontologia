/**
 * Organizacion extends Entidad
 *
 * Una organización del grafo (academia, taller, fundación, museo...).
 *
 * Requisitos: modelo de dominio usado en RF-08 a RF-12.
 */
class Organizacion extends Entidad {
  #fechaFundacion;
  #sede;

  /**
   * @param {Object} datos - los de Entidad más fechaFundacion y sede (opcionales).
   */
  constructor(datos) {
    super(datos);
    this.#fechaFundacion = Entidad._textoOVacio(datos.fechaFundacion);
    this.#sede = Entidad._textoOVacio(datos.sede);
  }

  /**
   * @returns {string} TipoEntidad.ORGANIZACION
   */
  getTipo() {
    return TipoEntidad.ORGANIZACION;
  }

  /**
   * Atributos comunes más los propios de una organización.
   *
   * @returns {Map<string, *>}
   */
  getAtributos() {
    const atributos = super.getAtributos();
    this._anadirSiNoVacio(atributos, "fechaFundacion", this.#fechaFundacion);
    this._anadirSiNoVacio(atributos, "sede", this.#sede);
    return atributos;
  }
}
