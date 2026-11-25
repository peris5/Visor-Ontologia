import { EquivalenciasTipos } from './EquivalenciasTipos.js';

/**
 * τ: ¿respeta el TIEMPO el camino central → P → Z? Para algunos pares de
 * tipos importa el orden: la obra que pintó tu maestro mientras te
 * enseñaba dice mucho de ti; la que pintó 35 años después, poco.
 *
 * Se calcula para CADA TIPO del primer tramo (la central y P pueden estar
 * unidas por varios), y solo si el par está en paresTemporales
 * (public/relevancia.json), «tipo del primer tramo > tipo del segundo», con
 * herencia y equivalencias como la tabla T (Mentorship>Paint usa
 * Mentorship>Creation). Cada par tiene un modo:
 *  - antesODurante: el segundo tramo empieza antes de que acabe el primero
 *    (más margenAnios);
 *  - solapa: los dos tramos coinciden en el tiempo (con el margen).
 *
 *  - Si se cumple, τ = 1; si no, factorFueraDeTiempo.
 *  - Si falta alguna fecha (o no se entiende), transferenciaSinFecha.
 *  - Si el par no está en paresTemporales, τ = 1.
 *
 * Si hay varias pruebas del mismo tipo en el primer tramo (dos mentorías, en
 * años distintos), τ es el MEJOR valor entre todas: así una prueba nueva
 * nunca lo baja (P1 y P10).
 *
 * Los años de cada prueba son los de su periodo (from y to) o, si no hay, la
 * fecha; de un texto se toma el primer número de 3 o 4 cifras
 * (RelevanciaCompuesta.aniosDe). Del segundo tramo se usa el de su prueba
 * más fuerte (EvidenciaPareja.getPeriodoPrincipal).
 */
export class CompatibilidadTemporal {
  static ANTES_O_DURANTE = "antesODurante";
  static SOLAPA = "solapa";

  #pares;
  #margen;
  #fueraDeTiempo;
  #sinFecha;
  #equivalencias;
  // «tipo1>tipo2» → el par que se aplica (ya buscado con herencia).
  #buscados;

  /**
   * @param {Object} configuracion - { paresTemporales, margenAnios,
   *   factorFueraDeTiempo, transferenciaSinFecha }
   * @param {EquivalenciasTipos} equivalencias - opcional.
   */
  constructor(configuracion, equivalencias) {
    this.#equivalencias = equivalencias;
    if (!(equivalencias instanceof EquivalenciasTipos)) {
      this.#equivalencias = new EquivalenciasTipos(configuracion, null);
    }
    this.#pares = {};
    if (configuracion.paresTemporales !== undefined && configuracion.paresTemporales !== null) {
      this.#pares = configuracion.paresTemporales;
    }
    this.#margen = 0;
    if (typeof configuracion.margenAnios === "number" && configuracion.margenAnios >= 0) {
      this.#margen = configuracion.margenAnios;
    }
    this.#fueraDeTiempo = CompatibilidadTemporal.#entre0y1(configuracion.factorFueraDeTiempo, "factorFueraDeTiempo");
    this.#sinFecha = CompatibilidadTemporal.#entre0y1(configuracion.transferenciaSinFecha, "transferenciaSinFecha");
    this.#buscados = new Map();
  }

  /**
   * @param {Object} tipoPrimerTramo - un elemento de EvidenciaPareja.getTipos()
   *   de P visto desde la central: { tipo, periodos: [{ desde, hasta } o null] }.
   * @param {EvidenciaPareja} segundoTramo - Z visto desde P.
   * @returns {number} τ, entre 0 y 1: el mejor de sus pruebas.
   */
  getFactor(tipoPrimerTramo, segundoTramo) {
    const par = this.buscarPar(tipoPrimerTramo.tipo, segundoTramo.getTipoPrincipal());
    if (par === null) {
      return 1;
    }
    const periodoSegundo = segundoTramo.getPeriodoPrincipal();
    let mejor = 0;
    for (let i = 0; i < tipoPrimerTramo.periodos.length; i++) {
      const factor = this.#comparar(par.modo, tipoPrimerTramo.periodos[i], periodoSegundo);
      if (factor > mejor) {
        mejor = factor;
      }
    }
    return mejor;
  }

  /**
   * El par de paresTemporales que se aplica a esos dos tipos, con herencia.
   *
   * @param {TipoRelacion} tipo1 - del primer tramo.
   * @param {TipoRelacion} tipo2 - del segundo.
   * @returns {Object|null} { clave: "Mentorship>Creation", modo }, o null si no hay.
   */
  buscarPar(tipo1, tipo2) {
    const consulta = tipo1.getId() + ">" + tipo2.getId();
    if (!this.#buscados.has(consulta)) {
      this.#buscados.set(consulta, this.#buscarConHerencia(tipo1, tipo2));
    }
    return this.#buscados.get(consulta);
  }

  #buscarConHerencia(tipo1, tipo2) {
    const ids1 = this.#equivalencias.getIds(tipo1);
    const ids2 = this.#equivalencias.getIds(tipo2);
    for (let i = 0; i < ids1.length; i++) {
      for (let j = 0; j < ids2.length; j++) {
        const clave = ids1[i] + ">" + ids2[j];
        if (Object.prototype.hasOwnProperty.call(this.#pares, clave)) {
          return { clave: clave, modo: this.#pares[clave] };
        }
      }
    }
    return null;
  }

  /** τ de una prueba del primer tramo (p1) con el segundo (p2). */
  #comparar(modo, p1, p2) {
    if (p1 === null || p2 === null) {
      return this.#sinFecha;
    }
    let compatible = false;
    if (modo === CompatibilidadTemporal.ANTES_O_DURANTE) {
      compatible = p2.desde <= p1.hasta + this.#margen;
    } else if (modo === CompatibilidadTemporal.SOLAPA) {
      compatible = p2.desde <= p1.hasta + this.#margen && p2.hasta >= p1.desde - this.#margen;
    } else {
      // Un modo que no se entiende: como si faltara la fecha.
      return this.#sinFecha;
    }
    if (compatible) {
      return 1;
    }
    return this.#fueraDeTiempo;
  }

  static #entre0y1(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número entre 0 y 1.");
    }
    return valor;
  }
}
