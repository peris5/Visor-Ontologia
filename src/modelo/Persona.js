/**
 * Persona extends Entidad
 *
 * Una persona del grafo (artista, mecenas, restauradora...).
 *
 * Requisitos: modelo de dominio usado en RF-08 a RF-12.
 */
class Persona extends Entidad {
  #fechaNacimiento;
  #fechaDefuncion;
  #nacionalidad;

  /**
   * @param {Object} datos - los de Entidad más fechaNacimiento,
   *   fechaDefuncion y nacionalidad (todos opcionales).
   */
  constructor(datos) {
    super(datos);
    this.#fechaNacimiento = Entidad._textoOVacio(datos.fechaNacimiento);
    this.#fechaDefuncion = Entidad._textoOVacio(datos.fechaDefuncion);
    this.#nacionalidad = Entidad._textoOVacio(datos.nacionalidad);
  }

  /**
   * @returns {string} TipoEntidad.PERSONA
   */
  getTipo() {
    return TipoEntidad.PERSONA;
  }

  /**
   * Atributos comunes más los propios de una persona.
   *
   * @returns {Map<string, *>}
   */
  getAtributos() {
    const atributos = super.getAtributos();
    this._anadirSiNoVacio(atributos, "fechaNacimiento", this.#fechaNacimiento);
    this._anadirSiNoVacio(atributos, "fechaDefuncion", this.#fechaDefuncion);
    this._anadirSiNoVacio(atributos, "nacionalidad", this.#nacionalidad);
    return atributos;
  }
}
