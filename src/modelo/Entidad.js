/**
 * Cualquier elemento del grafo de patrimonio que se dibuja como un nodo: una
 * persona, una organización o una obra. Se crea a partir de las
 * propiedades EN BRUTO de un nodo de Neo4j:
 *
 *  - nombres: un Map idioma → texto, sacado de name_es, name_ca y name_en
 *    (las personas los tienen distintos: ver Persona). getNombre() da el del
 *    idioma configurado o, si no lo tiene, el primero que haya en el orden
 *    es → ca → en; si no hay ninguno, «(sin nombre)».
 *  - subtipos: las etiquetas de Neo4j que no son la principal (por ejemplo
 *    Creator y Painter en una persona :Person:Creator:Painter).
 *  - atributos: las propiedades que la clase no conoce. Así, si la base de
 *    datos añade propiedades nuevas, se ven en el panel sin cambiar código.
 *
 * Es abstracta: no se puede hacer new Entidad(...). Solo se crean
 * Persona, Organizacion u ObraDeArte (normalmente con FabricaEntidades).
 */
export class Entidad {
  static NOMBRE_VACIO = "(sin nombre)";
  // Orden en que se busca un nombre si no está en el idioma configurado.
  static ORDEN_IDIOMAS = ["es", "ca", "en"];

  #id;
  #nombres;
  #idioma;
  #subtipos;
  #atributos;
  #etiquetaPrincipal;

  /**
   * @param {Object} datos - {
   *     id: texto (obligatorio),
   *     propiedades: objeto con las propiedades del nodo de Neo4j,
   *     subtipos: lista de etiquetas (opcional),
   *     idioma: "es", "ca" o "en" (opcional; "es" si no se indica),
   *     etiquetaPrincipal: la etiqueta de Neo4j de su tipo, p. ej. "Person" (opcional)
   *   }
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

    let propiedades = {};
    if (datos.propiedades !== undefined && datos.propiedades !== null) {
      propiedades = datos.propiedades;
    }
    this.#id = datos.id;
    this.#idioma = "es";
    if (typeof datos.idioma === "string" && datos.idioma !== "") {
      this.#idioma = datos.idioma;
    }
    this.#subtipos = [];
    if (Array.isArray(datos.subtipos)) {
      for (let i = 0; i < datos.subtipos.length; i++) {
        this.#subtipos.push(datos.subtipos[i]);
      }
    }
    this.#etiquetaPrincipal = "";
    if (typeof datos.etiquetaPrincipal === "string") {
      this.#etiquetaPrincipal = datos.etiquetaPrincipal;
    }
    this.#nombres = Entidad.#leerNombres(propiedades);
    this.#atributos = this.#leerDesconocidas(propiedades);
  }

  /**
   * Todas las etiquetas de Neo4j de la entidad: la principal (si se conoce)
   * y los subtipos. Las usa TablaTransferencia para el factor de cada tipo
   * de entidad (Painter → Creator → 1,0).
   *
   * @returns {string[]} copia.
   */
  getEtiquetas() {
    const etiquetas = [];
    if (this.#etiquetaPrincipal !== "") {
      etiquetas.push(this.#etiquetaPrincipal);
    }
    for (let i = 0; i < this.#subtipos.length; i++) {
      etiquetas.push(this.#subtipos[i]);
    }
    return etiquetas;
  }

  /**
   * @returns {string} identificador único de la entidad.
   */
  getId() {
    return this.#id;
  }

  /**
   * Nombre para mostrar: en el idioma configurado o, si no lo tiene, en el
   * primero que haya (es → ca → en). Persona lo cambia por «nombre apellidos».
   */
  getNombre() {
    if (this.#nombres.has(this.#idioma)) {
      return this.#nombres.get(this.#idioma);
    }
    for (let i = 0; i < Entidad.ORDEN_IDIOMAS.length; i++) {
      const idioma = Entidad.ORDEN_IDIOMAS[i];
      if (this.#nombres.has(idioma)) {
        return this.#nombres.get(idioma);
      }
    }
    return Entidad.NOMBRE_VACIO;
  }

  /**
   * @returns {Map<string, string>} copia de los nombres (idioma → texto).
   */
  getNombres() {
    return new Map(this.#nombres);
  }

  /**
   * Todos los nombres de la entidad, sin repetir, para el buscador: así
   * «Museu» y «Museo» encuentran la misma organización.
   */
  getTodosLosNombres() {
    const todos = [];
    Entidad._anadirSinRepetir(todos, this.getNombre());
    for (const nombre of this.#nombres.values()) {
      Entidad._anadirSinRepetir(todos, nombre);
    }
    return todos;
  }

  /**
   * @returns {string} idioma en que se muestra el nombre.
   */
  getIdioma() {
    return this.#idioma;
  }

  /**
   * @returns {string[]} copia de los subtipos (etiquetas que no son la principal).
   */
  getSubtipos() {
    const copia = [];
    for (let i = 0; i < this.#subtipos.length; i++) {
      copia.push(this.#subtipos[i]);
    }
    return copia;
  }

  /**
   * Devuelve una COPIA de los atributos, para que quien la reciba no pueda
   * cambiar los datos internos de la entidad sin querer. Solo tiene lo que
   * existe: las propiedades que la clase no conoce y, en las subclases, las
   * suyas (por ejemplo, las dimensiones de una obra).
   *
   * @returns {Map<string, *>} nombre de la propiedad → valor.
   */
  getAtributos() {
    return new Map(this.#atributos);
  }

  /**
   * Método abstracto: cada subclase devuelve su tipo.
   *
   * @returns {string} un valor de TipoEntidad.
   */
  getTipo() {
    throw new Error("No implementado: cada subclase de Entidad debe implementar getTipo().");
  }

  /**
   * El nombre de un nodo cualquiera de Neo4j (un lugar, un evento...) a
   * partir de sus propiedades: name_<idioma>, después es → ca → en, y si no,
   * "name". "" si no tiene ninguno.
   */
  static nombreEnIdioma(propiedades, idioma) {
    if (propiedades === undefined || propiedades === null) {
      return "";
    }
    const claves = ["name_" + idioma];
    for (let i = 0; i < Entidad.ORDEN_IDIOMAS.length; i++) {
      claves.push("name_" + Entidad.ORDEN_IDIOMAS[i]);
    }
    claves.push("name");
    for (let i = 0; i < claves.length; i++) {
      const valor = propiedades[claves[i]];
      if (typeof valor === "string" && valor !== "") {
        return valor;
      }
    }
    return "";
  }

  /**
   * Las propiedades que la subclase conoce y usa (las demás van
   * a los atributos). Las subclases la amplían.
   */
  _propiedadesConocidas() {
    const conocidas = [];
    for (let i = 0; i < Entidad.ORDEN_IDIOMAS.length; i++) {
      conocidas.push("name_" + Entidad.ORDEN_IDIOMAS[i]);
    }
    return conocidas;
  }

  /**
   * Añade un atributo al Map solo si tiene contenido,
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
   * Devuelve el valor si es un texto; si no, un texto vacío.
   * Así los campos que no vienen en los datos quedan como "" y no como undefined.
   *
   * @param {*} valor - valor leído de los datos.
   */
  static _textoOVacio(valor) {
    if (typeof valor === "string") {
      return valor;
    }
    return "";
  }

  /** Añade el texto a la lista si no está vacío ni repetido. */
  static _anadirSinRepetir(lista, texto) {
    if (texto !== "" && texto !== Entidad.NOMBRE_VACIO && !lista.includes(texto)) {
      lista.push(texto);
    }
  }

  /** Nombres name_es, name_ca y name_en que tengan contenido. */
  static #leerNombres(propiedades) {
    const nombres = new Map();
    for (let i = 0; i < Entidad.ORDEN_IDIOMAS.length; i++) {
      const idioma = Entidad.ORDEN_IDIOMAS[i];
      const valor = Entidad._textoOVacio(propiedades["name_" + idioma]);
      if (valor !== "") {
        nombres.set(idioma, valor);
      }
    }
    return nombres;
  }

  /**
   * Las propiedades que la clase no conoce, con contenido.
   * _propiedadesConocidas es de la subclase: se puede llamar desde aquí
   * porque no usa ningún campo privado de la subclase (aún no existen).
   */
  #leerDesconocidas(propiedades) {
    const conocidas = this._propiedadesConocidas();
    const atributos = new Map();
    const claves = Object.keys(propiedades);
    for (let i = 0; i < claves.length; i++) {
      const clave = claves[i];
      const valor = propiedades[clave];
      const tieneValor = valor !== undefined && valor !== null && valor !== "";
      if (!conocidas.includes(clave) && tieneValor) {
        atributos.set(clave, valor);
      }
    }
    return atributos;
  }
}
