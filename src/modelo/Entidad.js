/**
 * «abstract» Entidad
 *
 * Cualquier elemento del grafo de patrimonio: una persona, una organización
 * o una obra de arte. Guarda lo que tienen en común (id, nombre, descripción
 * y atributos libres) y deja que cada subclase diga de qué tipo es.
 *
 * Es abstracta: no se puede hacer new Entidad(...). Solo se crean
 * Persona, Organizacion u ObraDeArte (normalmente con FabricaEntidades).
 *
 * Requisitos: modelo de dominio usado en RF-08 a RF-12.
 */
export class Entidad {
  #id;
  #nombre;
  #descripcion;
  #atributos;

  /**
   * @param {Object} datos - objeto con id (obligatorio), nombre, descripcion
   *   y atributos (opcional: objeto normal o Map con datos extra).
   */
  constructor(datos) {
    // Una entidad "genérica" no tiene sentido: tiene que ser de un tipo concreto.
    if (new.target === Entidad) {
      throw new Error("Entidad es una clase abstracta: crea una Persona, una Organizacion o una ObraDeArte.");
    }
    if (datos === undefined || datos === null) {
      throw new Error("Faltan los datos para crear la entidad.");
    }
    if (typeof datos.id !== "string" || datos.id === "") {
      throw new Error("La entidad necesita un id (un texto no vacío).");
    }

    this.#id = datos.id;
    this.#nombre = Entidad._textoOVacio(datos.nombre);
    this.#descripcion = Entidad._textoOVacio(datos.descripcion);
    this.#atributos = this.#convertirAtributos(datos.atributos);

    // Si no viene nombre, usamos el id para que siempre se pueda mostrar algo.
    if (this.#nombre === "") {
      this.#nombre = datos.id;
    }
  }

  /**
   * @returns {string} identificador único de la entidad.
   */
  getId() {
    return this.#id;
  }

  /**
   * @returns {string} nombre para mostrar.
   */
  getNombre() {
    return this.#nombre;
  }

  /**
   * @returns {string} descripción (puede estar vacía).
   */
  getDescripcion() {
    return this.#descripcion;
  }

  /**
   * Devuelve una COPIA de los atributos, para que quien la reciba no pueda
   * cambiar los datos internos de la entidad sin querer.
   * Las subclases la amplían con sus propios campos.
   *
   * @returns {Map<string, *>} atributos de la entidad.
   */
  getAtributos() {
    const copiaDeAtributos = new Map(this.#atributos);
    return copiaDeAtributos;
  }

  /**
   * Método abstracto: cada subclase devuelve su tipo.
   *
   * @abstract
   * @returns {string} un valor de TipoEntidad.
   */
  getTipo() {
    throw new Error("No implementado: cada subclase de Entidad debe implementar getTipo().");
  }

  /**
   * (Protegido) Añade un atributo al Map solo si tiene contenido,
   * para no llenar la ficha de campos vacíos.
   *
   * @param {Map<string, *>} atributos - Map al que se añade.
   * @param {string} clave - nombre del atributo.
   * @param {string} valor - valor del atributo.
   */
  _anadirSiNoVacio(atributos, clave, valor) {
    if (valor !== "") {
      atributos.set(clave, valor);
    }
  }

  /**
   * (Protegido) Devuelve el valor si es un texto; si no, un texto vacío.
   * Así los campos que no vienen en los datos quedan como "" y no como undefined.
   *
   * @param {*} valor - valor leído de los datos.
   * @returns {string}
   */
  static _textoOVacio(valor) {
    if (typeof valor === "string") {
      return valor;
    }
    return "";
  }

  /**
   * (Privado) Convierte los atributos de entrada en un Map nuevo.
   * Admite un Map o un objeto normal; si no hay atributos, el Map queda vacío.
   *
   * @param {*} atributosDeEntrada
   * @returns {Map<string, *>}
   */
  #convertirAtributos(atributosDeEntrada) {
    const atributos = new Map();
    if (atributosDeEntrada === undefined || atributosDeEntrada === null) {
      return atributos;
    }
    if (atributosDeEntrada instanceof Map) {
      for (const clave of atributosDeEntrada.keys()) {
        atributos.set(clave, atributosDeEntrada.get(clave));
      }
      return atributos;
    }
    const claves = Object.keys(atributosDeEntrada);
    for (let i = 0; i < claves.length; i++) {
      const clave = claves[i];
      atributos.set(clave, atributosDeEntrada[clave]);
    }
    return atributos;
  }
}
