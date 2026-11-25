import { TipoRelacion } from '../modelo/TipoRelacion.js';

/**
 * h: la penalización de los intermediarios MUY CONECTADOS (idea del índice
 * de Adamic-Adar). Que dos entidades estén unidas a través de una academia
 * con 300 alumnos dice mucho menos que a través de un taller de cinco: un
 * intermediario con muchos contactos reparte su relevancia entre todos.
 *
 *     h(P, t) = min(1, log(2 + gradoReferencia) / log(2 + grado_t(P)))
 *
 * Hasta gradoReferencia contactos no se penaliza (h = 1); con 300 y la
 * referencia 10, h ≈ 0,44; con 1000, h ≈ 0,36.
 *
 * E1. EL GRADO ES EL DEL TIPO DEL SEGUNDO TRAMO (penalizacionPorTipo):
 * grado_t(P) = número de entidades distintas unidas a P por al menos una
 * relación de tipo t, siendo t el tipo principal de P–X. Antes (v3) contaba
 * todas. Un maestro famoso está unido a cientos de entidades, casi todas
 * personas con las que coincidió en exposiciones, y eso hundía sus obras de
 * la época de la mentoría (h ≈ 0,36). Para repartir hacia sus obras cuenta
 * cuántas obras tiene, no con cuánta gente expuso. Es la normalización por
 * meta-camino de PathSim (Sun y otros, 2011). El tipo se compara EXACTO, sin
 * herencia. Con penalizacionPorTipo = false se usa el grado total (v3).
 *
 * El grado sale de las relaciones de la caché (usarRelaciones). Como la
 * tanda 2 de GestorSubgrafos trae TODAS las relaciones de cada directo, y
 * solo los directos transmiten, el grado es exacto. Los grados se guardan, y
 * se olvidan cuando la caché recibe relaciones nuevas (getVersion).
 */
export class PenalizacionGrado {
  #gradoReferencia;
  #porTipo;
  #repositorio;
  #version;
  // idEntidad → { total: número, porTipo: Map idTipo → número }
  #grados;

  /**
   * @param {Object} configuracion - { gradoReferencia, penalizacionPorTipo (false si falta) }
   */
  constructor(configuracion) {
    if (typeof configuracion.gradoReferencia !== "number" || Number.isNaN(configuracion.gradoReferencia) ||
      configuracion.gradoReferencia < 0) {
      throw new Error("En public/relevancia.json, gradoReferencia debe ser un número mayor o igual que 0.");
    }
    this.#gradoReferencia = configuracion.gradoReferencia;
    this.#porTipo = configuracion.penalizacionPorTipo === true;
    this.#repositorio = null;
    this.#version = -1;
    this.#grados = new Map();
  }

  getGradoReferencia() {
    return this.#gradoReferencia;
  }

  /**
   * De dónde salen las relaciones con las que se cuentan los grados.
   *
   * @param {RepositorioVecindario} repositorio - la caché.
   */
  usarRelaciones(repositorio) {
    if (repositorio !== this.#repositorio) {
      this.#repositorio = repositorio;
      this.#version = -1;
    }
  }

  /**
   * h(P, t).
   *
   * @param {Entidad} entidad - el intermediario P.
   * @param {TipoRelacion} tipo - el tipo principal del segundo tramo.
   * @returns {number} entre 0 y 1.
   */
  getFactor(entidad, tipo) {
    return this.getFactorDeGrado(this.getGrado(entidad, tipo));
  }

  /**
   * El grado con que se penaliza: el del tipo, o el total si
   * penalizacionPorTipo es false.
   */
  getGrado(entidad, tipo) {
    if (this.#repositorio === null) {
      throw new Error("PenalizacionGrado necesita las relaciones (usarRelaciones) antes de contar grados.");
    }
    if (this.#version !== this.#repositorio.getVersion()) {
      this.#version = this.#repositorio.getVersion();
      this.#grados = new Map();
    }
    const id = entidad.getId();
    if (!this.#grados.has(id)) {
      this.#grados.set(id, this.#contar(entidad));
    }
    const grados = this.#grados.get(id);
    if (!this.#porTipo) {
      return grados.total;
    }
    if (!(tipo instanceof TipoRelacion) || !grados.porTipo.has(tipo.getId())) {
      return 0;
    }
    return grados.porTipo.get(tipo.getId());
  }

  /**
   * La fórmula, con el grado ya contado.
   *
   * @param {number} grado
   */
  getFactorDeGrado(grado) {
    let n = 0;
    if (typeof grado === "number" && grado > 0) {
      n = grado;
    }
    const factor = Math.log(2 + this.#gradoReferencia) / Math.log(2 + n);
    if (factor > 1) {
      return 1;
    }
    return factor;
  }

  /** Cuántas entidades distintas tiene unidas, en total y por cada tipo. */
  #contar(entidad) {
    const relaciones = this.#repositorio.relacionesDe(entidad.getId());
    const todas = new Set();
    const porTipo = new Map();
    for (let i = 0; i < relaciones.length; i++) {
      const idOtra = relaciones[i].getOtroExtremo(entidad).getId();
      if (idOtra !== entidad.getId()) {
        todas.add(idOtra);
        const idTipo = relaciones[i].getTipo().getId();
        if (!porTipo.has(idTipo)) {
          porTipo.set(idTipo, new Set());
        }
        porTipo.get(idTipo).add(idOtra);
      }
    }
    const numeros = new Map();
    for (const [idTipo, ids] of porTipo) {
      numeros.set(idTipo, ids.size);
    }
    return { total: todas.size, porTipo: numeros };
  }
}
