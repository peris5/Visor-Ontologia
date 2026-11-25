/**
 * Convierte el rol de una entidad en una relación, tal y como viene de la
 * base de datos (propiedad "role" de la relación con el intermediario), en
 * un rol NORMALIZADO con el que se buscan los pesos (pesosPorRol) y la
 * tabla de transferencia («Mentorship:maestro>Creation»).
 *
 * Los roles equivalentes están en rolesEquivalentes (public/relevancia.json):
 * «Maestra», «teacher » y «Mestre» → "maestro". Se comparan sin distinguir
 * mayúsculas, sin los espacios de los lados y sin el «/a» final: «maestro/a»
 * es «maestro» y «profesor/a», «profesor».
 *
 * ROLES POR DIRECCIÓN (rolesPorDireccion): una relación DIRECTA entre dos
 * entidades (sin intermediario) no tiene roles, pero el sentido de la flecha
 * los dice. En «A STUDENT_OF B», A es el alumno y B, el maestro:
 *
 *     "rolesPorDireccion": { "STUDENT_OF": { "origen": "aprendiz", "destino": "maestro" } }
 */
export class NormalizadorRoles {
  // rol en bruto (ya limpio) → rol normalizado.
  #equivalencias;
  // id del tipo → { origen, destino }.
  #porDireccion;

  /**
   * @param {Object} configuracion - { rolesEquivalentes: { rolNormalizado: [rolEnBruto, ...] },
   *   rolesPorDireccion: { idTipo: { origen: rol, destino: rol } } } (los dos opcionales)
   */
  constructor(configuracion) {
    this.#equivalencias = new Map();
    const roles = NormalizadorRoles.#objeto(configuracion, "rolesEquivalentes");
    for (const normalizado of Object.keys(roles)) {
      const lista = roles[normalizado];
      this.#equivalencias.set(NormalizadorRoles.limpiar(normalizado), normalizado);
      if (Array.isArray(lista)) {
        for (let i = 0; i < lista.length; i++) {
          this.#equivalencias.set(NormalizadorRoles.limpiar(lista[i]), normalizado);
        }
      }
    }
    this.#porDireccion = new Map();
    const direcciones = NormalizadorRoles.#objeto(configuracion, "rolesPorDireccion");
    for (const idTipo of Object.keys(direcciones)) {
      const direccion = direcciones[idTipo];
      if (direccion === null || typeof direccion !== "object" || typeof direccion.origen !== "string" ||
        typeof direccion.destino !== "string") {
        throw new Error("En public/relevancia.json, rolesPorDireccion: \"" + idTipo +
          "\" necesita los roles \"origen\" y \"destino\".");
      }
      this.#porDireccion.set(idTipo, { origen: direccion.origen, destino: direccion.destino });
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
    const limpio = NormalizadorRoles.limpiar(rolEnBruto);
    if (limpio === "" || !this.#equivalencias.has(limpio)) {
      return null;
    }
    return this.#equivalencias.get(limpio);
  }

  /**
   * El rol normalizado de una entidad en una relación: el de la base de
   * datos o, si la relación es directa y no tiene, el que dice la flecha.
   *
   * @param {Relacion} relacion
   * @param {Entidad} entidad - su origen o su destino.
   * @returns {string|null}
   */
  rolDe(relacion, entidad) {
    const rol = relacion.getRol(entidad);
    if (rol !== "") {
      return this.normalizar(rol);
    }
    const idTipo = relacion.getTipo().getId();
    if (!relacion.esDirecta() || !this.#porDireccion.has(idTipo)) {
      return null;
    }
    const direccion = this.#porDireccion.get(idTipo);
    if (relacion.getOrigen().getId() === entidad.getId()) {
      return this.#rolDeDireccion(direccion.origen);
    }
    return this.#rolDeDireccion(direccion.destino);
  }

  /** El rol de la configuración, normalizado si tiene equivalencia. */
  #rolDeDireccion(rol) {
    const normalizado = this.normalizar(rol);
    if (normalizado !== null) {
      return normalizado;
    }
    return rol;
  }

  /**
   * En minúsculas, sin espacios a los lados y sin el «/a» (o «/as») final.
   */
  static limpiar(texto) {
    return String(texto).trim().toLowerCase().replace(/\s*\/\s*as?$/, "");
  }

  /** Ese apartado de la configuración, o {} si no está. */
  static #objeto(configuracion, nombre) {
    if (configuracion === undefined || configuracion === null || configuracion[nombre] === undefined ||
      configuracion[nombre] === null) {
      return {};
    }
    return configuracion[nombre];
  }
}
