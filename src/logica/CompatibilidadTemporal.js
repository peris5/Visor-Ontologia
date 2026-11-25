import { TablaTransferencia } from './TablaTransferencia.js';

/**
 * τ: ¿respeta el TIEMPO el camino central → P → Z? Para algunos pares de
 * tipos importa el orden: la obra que pintó tu maestro mientras te
 * enseñaba dice mucho de ti; la que pintó 35 años después, poco.
 *
 * Solo se aplica a los pares de paresTemporales (public/relevancia.json),
 * «tipo del primer tramo > tipo del segundo», con herencia como la tabla T
 * (Mentorship>Paint usa Mentorship>Creation). Cada par tiene un modo:
 *  - antesODurante: el segundo tramo empieza antes de que acabe el primero
 *    (más margenAnios);
 *  - solapa: los dos tramos coinciden en el tiempo (con el margen).
 *
 *  - Si se cumple, τ = 1; si no, factorFueraDeTiempo.
 *  - Si falta alguna fecha (o no se entiende), transferenciaSinFecha.
 *  - Si el par no está en paresTemporales, τ = 1.
 *
 * Los años son los del periodo principal de cada tramo (EvidenciaPareja):
 * periodo.from y periodo.to o, si no hay, la fecha; de un texto se toma el
 * primer número de 3 o 4 cifras (RelevanciaCompuesta.aniosDe).
 */
export class CompatibilidadTemporal {
  static ANTES_O_DURANTE = "antesODurante";
  static SOLAPA = "solapa";

  #pares;
  #margen;
  #fueraDeTiempo;
  #sinFecha;

  /**
   * @param {Object} configuracion - { paresTemporales, margenAnios,
   *   factorFueraDeTiempo, transferenciaSinFecha }
   */
  constructor(configuracion) {
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
  }

  /**
   * @param {EvidenciaPareja} primerTramo - P visto desde la central.
   * @param {EvidenciaPareja} segundoTramo - Z visto desde P.
   * @returns {number} τ, entre 0 y 1.
   */
  getFactor(primerTramo, segundoTramo) {
    const modo = this.#modo(primerTramo.getTipoPrincipal(), segundoTramo.getTipoPrincipal());
    if (modo === null) {
      return 1;
    }
    const p1 = primerTramo.getPeriodoPrincipal();
    const p2 = segundoTramo.getPeriodoPrincipal();
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

  /** El modo del par «tipo1>tipo2» con herencia, o null si no está. */
  #modo(tipo1, tipo2) {
    const ids1 = TablaTransferencia.tipoYPadres(tipo1);
    const ids2 = TablaTransferencia.tipoYPadres(tipo2);
    for (let i = 0; i < ids1.length; i++) {
      for (let j = 0; j < ids2.length; j++) {
        const clave = ids1[i] + ">" + ids2[j];
        if (Object.prototype.hasOwnProperty.call(this.#pares, clave)) {
          return this.#pares[clave];
        }
      }
    }
    return null;
  }

  static #entre0y1(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número entre 0 y 1.");
    }
    return valor;
  }
}
