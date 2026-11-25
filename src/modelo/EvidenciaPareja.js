import { Entidad } from './Entidad.js';

/**
 * Capa 0: todo lo que une a DOS entidades, se dibuje o no, VISTO DESDE UNA
 * DE ELLAS (lo calcula CalculadorEvidencia). Es dirigida: la evidencia de
 * B vista desde A puede ser distinta de la de A vista desde B, porque el
 * peso depende del rol que tiene el otro (mi maestro pesa más para mí que
 * yo para él).
 *
 *  - desde, hacia: la entidad que mira y la otra.
 *  - fuerza (F): cuánto importaría la otra si la relación fuera segura.
 *  - certeza (C): 1 si hay alguna relación declarada; si solo hay
 *    coincidencias, crece con el número de coincidencias y baja con el
 *    tamaño de cada evento.
 *  - valor: F × C.
 *  - tipos: TODOS los tipos de sus relaciones, cada uno con su fuerza y el
 *    rol (normalizado) del otro extremo en su prueba más fuerte:
 *    [{ tipo: TipoRelacion, rol: string|null, fuerza: number }].
 *  - tipoPrincipal: el tipo de mayor fuerza; rolPrincipal: su rol;
 *    periodoPrincipal: los años de su prueba más fuerte ({ desde, hasta } o null).
 *  - declarada: ¿hay alguna relación declarada?
 *  - numeroEventos: cuántas de sus relaciones son coincidencias en eventos.
 *  - relaciones: todas, también las que no se dibujan.
 */
export class EvidenciaPareja {
  #desde;
  #hacia;
  #fuerza;
  #certeza;
  #tipos;
  #tipoPrincipal;
  #rolPrincipal;
  #periodoPrincipal;
  #declarada;
  #numeroEventos;
  #relaciones;

  /**
   * @param {Object} datos - { desde, hacia, fuerza, certeza, tipos,
   *   tipoPrincipal (TipoRelacion), rolPrincipal, periodoPrincipal,
   *   declarada, numeroEventos, relaciones }
   */
  constructor(datos) {
    if (!(datos.desde instanceof Entidad) || !(datos.hacia instanceof Entidad)) {
      throw new Error("La evidencia de una pareja necesita sus dos entidades.");
    }
    this.#desde = datos.desde;
    this.#hacia = datos.hacia;
    this.#fuerza = datos.fuerza;
    this.#certeza = datos.certeza;
    this.#tipos = [];
    if (Array.isArray(datos.tipos)) {
      for (let i = 0; i < datos.tipos.length; i++) {
        const tipo = datos.tipos[i];
        this.#tipos.push({ tipo: tipo.tipo, rol: tipo.rol, fuerza: tipo.fuerza });
      }
    }
    this.#tipoPrincipal = datos.tipoPrincipal;
    this.#rolPrincipal = null;
    if (typeof datos.rolPrincipal === "string") {
      this.#rolPrincipal = datos.rolPrincipal;
    }
    this.#periodoPrincipal = null;
    if (datos.periodoPrincipal !== undefined && datos.periodoPrincipal !== null) {
      this.#periodoPrincipal = { desde: datos.periodoPrincipal.desde, hasta: datos.periodoPrincipal.hasta };
    }
    this.#declarada = datos.declarada === true;
    this.#numeroEventos = datos.numeroEventos;
    this.#relaciones = [];
    for (let i = 0; i < datos.relaciones.length; i++) {
      this.#relaciones.push(datos.relaciones[i]);
    }
  }

  /**
   * @returns {Entidad} la entidad desde la que se mira.
   */
  getDesde() {
    return this.#desde;
  }

  /**
   * @returns {Entidad} la otra entidad.
   */
  getHacia() {
    return this.#hacia;
  }

  getFuerza() {
    return this.#fuerza;
  }

  getCerteza() {
    return this.#certeza;
  }

  /**
   * @returns {number} fuerza × certeza, entre 0 y 1.
   */
  getValor() {
    return this.#certeza * this.#fuerza;
  }

  /**
   * @returns {Object[]} copia de [{ tipo, rol, fuerza }], uno por tipo.
   */
  getTipos() {
    const copia = [];
    for (let i = 0; i < this.#tipos.length; i++) {
      const tipo = this.#tipos[i];
      copia.push({ tipo: tipo.tipo, rol: tipo.rol, fuerza: tipo.fuerza });
    }
    return copia;
  }

  /**
   * @returns {TipoRelacion} el tipo de mayor fuerza.
   */
  getTipoPrincipal() {
    return this.#tipoPrincipal;
  }

  /**
   * @returns {string|null} el rol normalizado del otro extremo en el tipo principal.
   */
  getRolPrincipal() {
    return this.#rolPrincipal;
  }

  /**
   * @returns {Object|null} { desde, hasta } en años de la prueba principal, o null.
   */
  getPeriodoPrincipal() {
    if (this.#periodoPrincipal === null) {
      return null;
    }
    return { desde: this.#periodoPrincipal.desde, hasta: this.#periodoPrincipal.hasta };
  }

  /**
   * @returns {boolean} true si hay alguna relación declarada (no solo coincidencias).
   */
  esDeclarada() {
    return this.#declarada;
  }

  getNumeroEventos() {
    return this.#numeroEventos;
  }

  /**
   * @returns {Relacion[]} copia de todas las relaciones de la pareja.
   */
  getRelaciones() {
    const copia = [];
    for (let i = 0; i < this.#relaciones.length; i++) {
      copia.push(this.#relaciones[i]);
    }
    return copia;
  }

  /**
   * @returns {Entidad[]} las dos entidades: [desde, hacia].
   */
  getEntidades() {
    return [this.#desde, this.#hacia];
  }

  /**
   * Dada una de las dos entidades, la otra.
   *
   * @param {Entidad} entidad
   */
  getOtroExtremo(entidad) {
    if (entidad.getId() === this.#desde.getId()) {
      return this.#hacia;
    }
    if (entidad.getId() === this.#hacia.getId()) {
      return this.#desde;
    }
    throw new Error("La entidad " + entidad.getId() + " no forma parte de esta pareja.");
  }
}
