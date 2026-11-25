/**
 * h: la penalización de los intermediarios MUY CONECTADOS (idea del índice
 * de Adamic-Adar). Que dos entidades estén unidas a través de una academia
 * con 300 alumnos dice mucho menos que a través de un taller de cinco: un
 * intermediario con muchos contactos reparte su relevancia entre todos.
 *
 *     h(P) = min(1, log(2 + gradoReferencia) / log(2 + grado(P)))
 *
 * grado(P) = número de entidades distintas relacionadas con P. Hasta
 * gradoReferencia contactos no se penaliza (h = 1); con 1000 y la
 * referencia 10, h ≈ 0,36.
 */
export class PenalizacionGrado {
  #gradoReferencia;

  /**
   * @param {Object} configuracion - { gradoReferencia }
   */
  constructor(configuracion) {
    if (typeof configuracion.gradoReferencia !== "number" || Number.isNaN(configuracion.gradoReferencia) ||
      configuracion.gradoReferencia < 0) {
      throw new Error("En public/relevancia.json, gradoReferencia debe ser un número mayor o igual que 0.");
    }
    this.#gradoReferencia = configuracion.gradoReferencia;
  }

  getGradoReferencia() {
    return this.#gradoReferencia;
  }

  /**
   * @param {Entidad} entidad - el intermediario P (de momento no se usa: el
   *   factor solo depende del grado; está para poder distinguir tipos de
   *   entidad más adelante sin cambiar quién lo llama).
   * @param {number} grado - entidades distintas relacionadas con P.
   * @returns {number} entre 0 y 1.
   */
  getFactor(entidad, grado) {
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
}
