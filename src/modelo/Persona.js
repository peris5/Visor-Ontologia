import { Entidad } from './Entidad.js';
import { TipoEntidad } from './TipoEntidad.js';

/**
 * Una persona (:Person). A diferencia del resto de entidades, su nombre no
 * está en tres idiomas: tiene nombre propio (name) y apellidos (lastName).
 * El nacimiento, la defunción y la residencia son eventos y se ven en el
 * detalle (DetalleEntidad).
 */
export class Persona extends Entidad {
  #nombrePropio;
  #apellidos;

  constructor(datos) {
    super(datos);
    let propiedades = {};
    if (datos.propiedades !== undefined && datos.propiedades !== null) {
      propiedades = datos.propiedades;
    }
    this.#nombrePropio = Entidad._textoOVacio(propiedades.name).trim();
    this.#apellidos = Entidad._textoOVacio(propiedades.lastName).trim();
  }

  getTipo() {
    return TipoEntidad.PERSONA;
  }

  /** «nombre apellidos»; «(sin nombre)» si no tiene ninguno. */
  getNombre() {
    const completo = (this.#nombrePropio + " " + this.#apellidos).trim();
    if (completo === "") {
      return Entidad.NOMBRE_VACIO;
    }
    return completo;
  }

  getNombrePropio() {
    return this.#nombrePropio;
  }

  getApellidos() {
    return this.#apellidos;
  }

  /** Para el buscador: el nombre completo, el nombre propio y los apellidos. */
  getTodosLosNombres() {
    const todos = super.getTodosLosNombres();
    Entidad._anadirSinRepetir(todos, this.#nombrePropio);
    Entidad._anadirSinRepetir(todos, this.#apellidos);
    return todos;
  }

  /** name y lastName forman el nombre: no son atributos. */
  _propiedadesConocidas() {
    const conocidas = super._propiedadesConocidas();
    conocidas.push("name");
    conocidas.push("lastName");
    return conocidas;
  }
}
