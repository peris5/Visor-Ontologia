/**
 * Relacion
 *
 * Una relación entre dos entidades (origen → destino) de un tipo concreto.
 * Guarda dos números:
 *  - valor: el que viene de la base de datos.
 *  - relevancia: la que calcula la EstrategiaRelevancia a partir del valor.
 *    Hasta que la estrategia la calcula, vale lo mismo que el valor.
 *
 * Requisitos: RF-08 a RF-12 (la relevancia de las relaciones decide el subgrafo).
 */
class Relacion {
  #id;
  #origen;
  #destino;
  #tipo;
  #valor;
  #relevancia;

  /**
   * @param {string} id
   * @param {Entidad} origen
   * @param {Entidad} destino
   * @param {TipoRelacion} tipo
   * @param {number} valor - relevancia que trae la base de datos.
   */
  constructor(id, origen, destino, tipo, valor) {
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
  }

  /**
   * @returns {string}
   */
  getId() {
    return this.#id;
  }

  /**
   * @returns {Entidad}
   */
  getOrigen() {
    return this.#origen;
  }

  /**
   * @returns {Entidad}
   */
  getDestino() {
    return this.#destino;
  }

  /**
   * @returns {TipoRelacion}
   */
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
}
