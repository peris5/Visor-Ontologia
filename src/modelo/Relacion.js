import { Entidad } from './Entidad.js';
import { TipoRelacion } from './TipoRelacion.js';

/**
 * Una relación entre dos entidades (origen → destino) de un tipo concreto.
 * Guarda dos números:
 *  - valor: el que viene de la base de datos.
 *  - relevancia: la que calcula la EstrategiaRelevancia a partir del valor.
 *    Hasta que la estrategia la calcula, vale lo mismo que el valor.
 *
 * Es una relación DERIVADA (ver ProyectorRelaciones en el servidor): en Neo4j las entidades se unen a través de un nodo
 * intermediario (una relación personal o un evento). Por eso guarda también:
 *  - idIntermedio: el id del intermediario (o de la relación directa);
 *  - roles: el papel de cada entidad («maestra», «aprendiz»...);
 *  - nombre (el del intermediario, por ejemplo «Exposición colectiva de
 *    1911»), periodo, lugar y fecha, si el intermediario los tiene;
 *  - participantes: cuántas entidades tiene el intermediario (2 en una
 *    relación directa). Cuanto más grande el evento, menos dice;
 *  - participantesPorClase: cuántas de cada clase ({ PERSONA: 3,
 *    OBRA_DE_ARTE: 8 }); entre dos personas solo cuentan las personas;
 *  - via: el tipo de la relación de la BD que une cada extremo al
 *    intermediario, en bruto (PARTICIPATES_IN, OCURRED_AT, IS_EXPOSED...).
 *    Dice, por ejemplo, cuál de los dos es el lugar del evento;
 *  - idsIntermediarios: los ids originales si el servidor ha juntado varios
 *    registros del mismo evento (si no, solo idIntermedio);
 *  - dibujable: false si el intermediario es demasiado grande para
 *    dibujarlo (más de maxParticipantesIntermediario en el servidor). No
 *    se dibuja, pero cuenta como evidencia para la relevancia;
 *  - sintetica: true en las aristas COINCIDENCIAS que añade
 *    ConstructorSubgrafo (no existen en la base de datos), con su texto.
 *
 * La base de datos NO trae relevancias: el valor de una relación de la BD
 * es 0 y la relevancia la calcula el navegador (RelevanciaCompuesta).
 */
export class Relacion {
  #id;
  #origen;
  #destino;
  #tipo;
  #valor;
  #relevancia;
  #idIntermedio;
  #roles;
  #periodo;
  #lugar;
  #fecha;
  #participantes;
  #participantesPorClase;
  #via;
  #idsIntermediarios;
  #nombre;
  #dibujable;
  #sintetica;
  #texto;

  /**
   * @param {number} valor - valor de partida de la relevancia (0 en las de
   *   la BD; la evidencia de la pareja en las sintéticas).
   * @param {Object} datos - opcional: { idIntermedio, roles (objeto o Map
   *   idEntidad → rol), nombre, periodo (Periodo o null), lugar, fecha,
   *   participantes (2 si no se indica), participantesPorClase (objeto
   *   TipoEntidad → número), via (objeto idEntidad → tipo de relación de la
   *   BD), idsIntermediarios (lista), dibujable (true si no se indica),
   *   sintetica (false si no se indica), texto }.
   */
  constructor(id, origen, destino, tipo, valor, datos) {
    if (typeof id !== "string" || id === "") {
      throw new Error("La relación necesita un id (un texto no vacío).");
    }
    if (!(origen instanceof Entidad) || !(destino instanceof Entidad)) {
      throw new Error("La relación " + id + " necesita una entidad de origen y otra de destino.");
    }
    if (!(tipo instanceof TipoRelacion)) {
      throw new Error("La relación " + id + " necesita un TipoRelacion.");
    }
    this.#id = id;
    this.#origen = origen;
    this.#destino = destino;
    this.#tipo = tipo;
    this.#valor = valor;
    this.#relevancia = valor;

    let extra = {};
    if (datos !== undefined && datos !== null) {
      extra = datos;
    }
    this.#idIntermedio = id;
    if (typeof extra.idIntermedio === "string" && extra.idIntermedio !== "") {
      this.#idIntermedio = extra.idIntermedio;
    }
    this.#roles = Relacion.#leerTextos(extra.roles);
    this.#via = Relacion.#leerTextos(extra.via);
    this.#idsIntermediarios = [this.#idIntermedio];
    if (Array.isArray(extra.idsIntermediarios) && extra.idsIntermediarios.length > 0) {
      this.#idsIntermediarios = extra.idsIntermediarios.slice();
    }
    this.#periodo = null;
    if (extra.periodo !== undefined) {
      this.#periodo = extra.periodo;
    }
    this.#lugar = Relacion.#textoONulo(extra.lugar);
    this.#fecha = Relacion.#textoONulo(extra.fecha);
    this.#participantes = 2;
    if (Number.isInteger(extra.participantes) && extra.participantes >= 2) {
      this.#participantes = extra.participantes;
    }
    this.#participantesPorClase = null;
    if (extra.participantesPorClase !== undefined && extra.participantesPorClase !== null) {
      this.#participantesPorClase = extra.participantesPorClase;
    }
    this.#dibujable = extra.dibujable !== false;
    this.#nombre = "";
    if (typeof extra.nombre === "string") {
      this.#nombre = extra.nombre;
    }
    this.#sintetica = extra.sintetica === true;
    this.#texto = "";
    if (typeof extra.texto === "string") {
      this.#texto = extra.texto;
    }
  }

  /**
   * @returns {number} entidades del intermediario (2 en una relación directa).
   */
  getParticipantes() {
    return this.#participantes;
  }

  /**
   * Cuántas entidades de una clase tiene el intermediario.
   *
   * @param {string} clase - un valor de TipoEntidad.
   * @returns {number} si no se sabe (no han llegado participantesPorClase), todas.
   */
  getParticipantesDeClase(clase) {
    if (this.#participantesPorClase === null) {
      return this.#participantes;
    }
    if (typeof this.#participantesPorClase[clase] === "number") {
      return this.#participantesPorClase[clase];
    }
    return 0;
  }

  /**
   * El tipo de la relación de la BD que une un extremo al intermediario.
   *
   * @param {Entidad} entidad - el origen o el destino.
   * @returns {string} en bruto («OCURRED_AT»), o "" si no hay (una relación directa).
   */
  getVia(entidad) {
    if (this.#via.has(entidad.getId())) {
      return this.#via.get(entidad.getId());
    }
    return "";
  }

  /**
   * @returns {boolean} true si une directamente sus dos entidades, sin un
   *   intermediario (ninguno de sus extremos tiene vía).
   */
  esDirecta() {
    return this.#via.size === 0 && !this.#sintetica;
  }

  /**
   * @returns {string[]} copia de los ids de los registros del intermediario
   *   (más de uno si el servidor ha juntado varios del mismo evento).
   */
  getIdsIntermediarios() {
    return this.#idsIntermediarios.slice();
  }

  /**
   * @returns {string} nombre del intermediario («Exposición colectiva de 1911»), o "".
   */
  getNombre() {
    return this.#nombre;
  }

  /**
   * @returns {boolean} false si solo cuenta como evidencia y no se dibuja.
   */
  esDibujable() {
    return this.#dibujable;
  }

  /**
   * @returns {boolean} true si es una arista COINCIDENCIAS añadida por
   *   ConstructorSubgrafo (no está en la base de datos).
   */
  esSintetica() {
    return this.#sintetica;
  }

  /**
   * @returns {string} texto de una arista sintética («Coinciden en 3 eventos»); "" en las demás.
   */
  getTexto() {
    return this.#texto;
  }

  /**
   * @returns {string} id del nodo intermediario (o de la relación directa).
   */
  getIdIntermedio() {
    return this.#idIntermedio;
  }

  /**
   * @returns {Map<string, string>} copia de los roles (idEntidad → rol).
   */
  getRoles() {
    return new Map(this.#roles);
  }

  /**
   * @param {Entidad} entidad - el origen o el destino.
   * @returns {string} su rol en la relación ("" si no tiene).
   */
  getRol(entidad) {
    if (this.#roles.has(entidad.getId())) {
      return this.#roles.get(entidad.getId());
    }
    return "";
  }

  getPeriodo() {
    return this.#periodo;
  }

  /**
   * @returns {string|null} nombre del lugar.
   */
  getLugar() {
    return this.#lugar;
  }

  getFecha() {
    return this.#fecha;
  }

  getId() {
    return this.#id;
  }

  getOrigen() {
    return this.#origen;
  }

  getDestino() {
    return this.#destino;
  }

  getTipo() {
    return this.#tipo;
  }

  /**
   * @returns {number} valor original de la base de datos.
   */
  getValor() {
    return this.#valor;
  }

  /**
   * @returns {number} relevancia calculada por la estrategia.
   */
  getRelevancia() {
    return this.#relevancia;
  }

  /**
   * @param {number} valor - nueva relevancia (la pone la estrategia).
   */
  setRelevancia(valor) {
    this.#relevancia = valor;
  }

  /**
   * Dada una de las dos entidades de la relación, devuelve la otra.
   * Sirve para recorrer el grafo sin importar el sentido de la flecha.
   *
   * @param {Entidad} entidad - el origen o el destino.
   * @returns {Entidad} el otro extremo.
   */
  getOtroExtremo(entidad) {
    const idEntidad = entidad.getId();
    if (idEntidad === this.#origen.getId()) {
      return this.#destino;
    }
    if (idEntidad === this.#destino.getId()) {
      return this.#origen;
    }
    throw new Error("La entidad " + idEntidad + " no forma parte de la relación " + this.#id + ".");
  }

  /**
   * Clave que identifica al par de entidades, sin importar el sentido:
   * la relación A→B y la relación B→A dan la misma clave.
   * Se consigue poniendo siempre primero el id más pequeño (orden alfabético).
   *
   * @returns {string} por ejemplo "a01|p03".
   */
  getClavePar() {
    const idOrigen = this.#origen.getId();
    const idDestino = this.#destino.getId();
    if (idOrigen < idDestino) {
      return idOrigen + "|" + idDestino;
    }
    return idDestino + "|" + idOrigen;
  }

  /** idEntidad → texto (roles o vías) como Map (admite un objeto normal o un Map). */
  static #leerTextos(textos) {
    const resultado = new Map();
    if (textos === undefined || textos === null) {
      return resultado;
    }
    if (textos instanceof Map) {
      for (const clave of textos.keys()) {
        resultado.set(clave, textos.get(clave));
      }
      return resultado;
    }
    const claves = Object.keys(textos);
    for (let i = 0; i < claves.length; i++) {
      if (typeof textos[claves[i]] === "string" && textos[claves[i]] !== "") {
        resultado.set(claves[i], textos[claves[i]]);
      }
    }
    return resultado;
  }

  /** El valor si es un texto con contenido; si no, null. */
  static #textoONulo(valor) {
    if (typeof valor === "string" && valor !== "") {
      return valor;
    }
    return null;
  }
}
