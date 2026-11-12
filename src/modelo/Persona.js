import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * Persona extends Entidad
 *
 * Una persona (:Person en Neo4j). A diferencia del resto de entidades, su
 * nombre no está en tres idiomas: tiene nombre propio (name) y apellidos
 * (lastName), y su nombre para mostrar es «nombre apellidos».
 *
 * Desde el incremento 3b no tiene fechas ni nacionalidad: el nacimiento, la
 * defunción y la residencia son eventos de la base de datos y se ven en el
 * detalle (DetalleEntidad).
 *
 * Requisitos: RF-19 (tipo de nodo), RF-28.
 */
export class Persona extends Entidad {
  #nombrePropio;
  #apellidos;

  /**
   * @param {Object} datos - ver Entidad (propiedades con name y lastName).
   */
  constructor(datos) {
    super(datos);
    let propiedades = {};
    if (datos.propiedades !== undefined && datos.propiedades !== null) {
      propiedades = datos.propiedades;
    }
    this.#nombrePropio = Entidad._textoOVacio(propiedades.name).trim();
    this.#apellidos = Entidad._textoOVacio(propiedades.lastName).trim();
  }

  /**
   * @returns {string} TipoEntidad.PERSONA
   */
  getTipo() {
    return TipoEntidad.PERSONA;
  }

  /**
   * @returns {string} «nombre apellidos»; «(sin nombre)» si no tiene ninguno.
   */
  getNombre() {
    const completo = (this.#nombrePropio + " " + this.#apellidos).trim();
    if (completo === "") {
      return Entidad.NOMBRE_VACIO;
    }
    return completo;
  }

  /**
   * @returns {string}
   */
  getNombrePropio() {
    return this.#nombrePropio;
  }

  /**
   * @returns {string}
   */
  getApellidos() {
    return this.#apellidos;
  }

  /**
   * Para el buscador: el nombre completo y, por separado, el nombre propio y
   * los apellidos.
   *
   * @returns {string[]}
   */
  getTodosLosNombres() {
    const todos = super.getTodosLosNombres();
    Entidad._anadirSinRepetir(todos, this.#nombrePropio);
    Entidad._anadirSinRepetir(todos, this.#apellidos);
    return todos;
  }

  /**
   * (Protegido) name y lastName forman el nombre: no son atributos.
   *
   * @returns {string[]}
   */
  _propiedadesConocidas() {
    const conocidas = super._propiedadesConocidas();
    conocidas.push("name");
    conocidas.push("lastName");
    return conocidas;
  }
}
