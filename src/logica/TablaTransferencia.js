/**
 * Cuánto se TRANSMITE la relevancia por un camino de dos tipos de relación
 * (tabla T) y cuánto pesa cada tipo de entidad (factorEntidad). Los valores
 * están en public/relevancia.json (perfil artístico) y son una PROPUESTA
 * pendiente de validar con el grupo de investigación.
 *
 * T(tipo1, rol1, tipo2): la central está unida a P por una relación de
 * tipo1 en la que P tiene el rol rol1, y P está unido a Z por una de tipo2.
 * «Mentorship:maestro>Creation» = 0,8: la obra de tu maestro dice mucho de
 * ti; «Mentorship:aprendiz>Creation» = 0,5: la de tu alumno, menos;
 * «Friendship>Creation» = 0,2: la de un amigo, poco.
 *
 * Búsqueda, en este orden:
 *   1. «tipo1:rol1>tipo2» (si hay rol);
 *   2. «tipo1>tipo2»;
 *   3. transferenciaPorDefecto.
 * En los pasos 1 y 2 se aplica la herencia por la jerarquía (IS_A): primero
 * tipo1 con tipo2 y con los padres de tipo2 (del más cercano al más lejano;
 * así Mentorship:maestro>Paint usa Mentorship:maestro>Creation), y después
 * cada padre de tipo1 con tipo2 y sus padres.
 *
 * getTEfectiva: el primer tramo (central–P) puede tener varios tipos (Luis
 * es amigo Y coexpositor de Ana). T̄ es la media de T ponderada por la
 * fuerza de cada tipo del primer tramo.
 *
 * factorEntidad: lo que no es creación artística transmite menos. Se usa la
 * etiqueta MÁS ESPECÍFICA de la entidad que tenga factor, subiendo por sus
 * padres (Painter → Creator → 1,0; una Person sin subtipo creador → 0,6). Si
 * ninguna tiene factor, 1.
 */
export class TablaTransferencia {
  #tabla;
  #porDefecto;
  #factores;
  #jerarquia;

  /**
   * @param {Object} configuracion - { tablaTransferencia, transferenciaPorDefecto, factorEntidad }
   * @param {Object} jerarquia - etiqueta → sus padres, del más cercano al más
   *   lejano (de /api/jerarquia). Opcional.
   */
  constructor(configuracion, jerarquia) {
    this.#tabla = {};
    if (configuracion.tablaTransferencia !== undefined && configuracion.tablaTransferencia !== null) {
      this.#tabla = configuracion.tablaTransferencia;
    }
    if (typeof configuracion.transferenciaPorDefecto !== "number" || configuracion.transferenciaPorDefecto < 0 ||
      configuracion.transferenciaPorDefecto > 1) {
      throw new Error("En public/relevancia.json, transferenciaPorDefecto debe ser un número entre 0 y 1.");
    }
    this.#porDefecto = configuracion.transferenciaPorDefecto;
    this.#factores = {};
    if (configuracion.factorEntidad !== undefined && configuracion.factorEntidad !== null) {
      this.#factores = configuracion.factorEntidad;
    }
    this.#jerarquia = {};
    if (jerarquia !== undefined && jerarquia !== null) {
      this.#jerarquia = jerarquia;
    }
  }

  /**
   * T(tipo1, rol1, tipo2) con rol y herencia (ver la explicación de la clase).
   *
   * @param {TipoRelacion} tipo1 - de la relación central–P.
   * @param {string|null} rol1 - el rol normalizado de P en esa relación, o null.
   * @param {TipoRelacion} tipo2 - de la relación P–Z.
   * @returns {number} entre 0 y 1.
   */
  getT(tipo1, rol1, tipo2) {
    const ids1 = TablaTransferencia.tipoYPadres(tipo1);
    const ids2 = TablaTransferencia.tipoYPadres(tipo2);
    if (typeof rol1 === "string" && rol1 !== "") {
      const conRol = this.#buscar(ids1, ":" + rol1, ids2);
      if (conRol !== null) {
        return conRol;
      }
    }
    const sinRol = this.#buscar(ids1, "", ids2);
    if (sinRol !== null) {
      return sinRol;
    }
    return this.#porDefecto;
  }

  /**
   * T̄: la media de T(tipo, rol, tipo2) sobre los tipos del primer tramo,
   * ponderada por la fuerza de cada tipo.
   *
   * @param {EvidenciaPareja} evidencia - el primer tramo (P visto desde la central).
   * @param {TipoRelacion} tipo2 - el del segundo tramo.
   */
  getTEfectiva(evidencia, tipo2) {
    const tipos = evidencia.getTipos();
    let suma = 0;
    let pesos = 0;
    for (let i = 0; i < tipos.length; i++) {
      suma = suma + tipos[i].fuerza * this.getT(tipos[i].tipo, tipos[i].rol, tipo2);
      pesos = pesos + tipos[i].fuerza;
    }
    if (pesos === 0) {
      return this.#porDefecto;
    }
    return suma / pesos;
  }

  /**
   * El factor del tipo de entidad, con herencia (ver la explicación de la clase).
   *
   * @param {Entidad} entidad
   * @returns {number} entre 0 y 1.
   */
  getFactorEntidad(entidad) {
    const etiquetas = entidad.getEtiquetas();
    // De la más específica (la que tiene más padres) a la más general.
    const ordenadas = [];
    for (let i = 0; i < etiquetas.length; i++) {
      ordenadas.push(etiquetas[i]);
    }
    const tabla = this;
    ordenadas.sort(function (a, b) {
      return tabla.#padresDe(b).length - tabla.#padresDe(a).length;
    });
    for (let i = 0; i < ordenadas.length; i++) {
      const candidatas = [ordenadas[i]];
      const padres = this.#padresDe(ordenadas[i]);
      for (let j = 0; j < padres.length; j++) {
        candidatas.push(padres[j]);
      }
      for (let j = 0; j < candidatas.length; j++) {
        if (Object.prototype.hasOwnProperty.call(this.#factores, candidatas[j])) {
          return this.#factores[candidatas[j]];
        }
      }
    }
    return 1;
  }

  /**
   * El id del tipo y los de sus padres, del más cercano al más lejano (lo
   * usa también CompatibilidadTemporal).
   *
   * @param {TipoRelacion} tipo
   * @returns {string[]}
   */
  static tipoYPadres(tipo) {
    const ids = [tipo.getId()];
    const padres = tipo.getPadres();
    for (let i = 0; i < padres.length; i++) {
      ids.push(padres[i]);
    }
    return ids;
  }

  /** «a<sufijo>>b» para cada a de ids1 y b de ids2, en el orden de la herencia; null si no hay. */
  #buscar(ids1, sufijo, ids2) {
    for (let i = 0; i < ids1.length; i++) {
      for (let j = 0; j < ids2.length; j++) {
        const clave = ids1[i] + sufijo + ">" + ids2[j];
        if (Object.prototype.hasOwnProperty.call(this.#tabla, clave)) {
          return this.#tabla[clave];
        }
      }
    }
    return null;
  }

  /** Los padres de una etiqueta según la jerarquía ([] si no tiene). */
  #padresDe(etiqueta) {
    if (Array.isArray(this.#jerarquia[etiqueta])) {
      return this.#jerarquia[etiqueta];
    }
    return [];
  }
}
