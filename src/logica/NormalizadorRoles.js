/**
 * Convierte el rol de una entidad en una relación, tal y como viene de la
 * base de datos (propiedad "role" de la relación con el intermediario), en
 * un rol NORMALIZADO con el que se buscan los pesos (pesosPorRol) y la
 * tabla de transferencia («Mentorship:maestro>Creation»).
 *
 * Los roles equivalentes están en rolesEquivalentes (public/relevancia.json):
 * «Maestra», «teacher » y «Mestre» → "maestro". Se comparan sin distinguir
 * mayúsculas y sin los espacios de los lados.
 */
export class NormalizadorRoles {
  // rol en bruto (en minúsculas) → rol normalizado.
  #equivalencias;

  /**
   * @param {Object} configuracion - { rolesEquivalentes: { rolNormalizado: [rolEnBruto, ...] } }
   */
  constructor(configuracion) {
    this.#equivalencias = new Map();
    let roles = {};
    if (configuracion !== undefined && configuracion !== null && configuracion.rolesEquivalentes !== undefined &&
      configuracion.rolesEquivalentes !== null) {
      roles = configuracion.rolesEquivalentes;
    }
    for (const normalizado of Object.keys(roles)) {
      const lista = roles[normalizado];
      this.#equivalencias.set(NormalizadorRoles.#limpiar(normalizado), normalizado);
      if (Array.isArray(lista)) {
        for (let i = 0; i < lista.length; i++) {
          this.#equivalencias.set(NormalizadorRoles.#limpiar(lista[i]), normalizado);
        }
      }
    }
  }

  /**
   * @param {string} rolEnBruto - como venga de la base de datos («Maestra», «teacher »...).
   * @returns {string|null} el rol normalizado ("maestro"), o null si no se conoce.
   */
  normalizar(rolEnBruto) {
    if (typeof rolEnBruto !== "string") {
      return null;
    }
    const limpio = NormalizadorRoles.#limpiar(rolEnBruto);
    if (limpio === "" || !this.#equivalencias.has(limpio)) {
      return null;
    }
    return this.#equivalencias.get(limpio);
  }

  /** En minúsculas y sin espacios a los lados. */
  static #limpiar(texto) {
    return String(texto).trim().toLowerCase();
  }
}
