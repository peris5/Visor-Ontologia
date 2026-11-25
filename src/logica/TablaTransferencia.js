import { EquivalenciasTipos } from './EquivalenciasTipos.js';

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
 * cada padre de tipo1 con tipo2 y sus padres. Un tipo con equivalente usa los
 * de este en lugar de sus padres (EquivalenciasTipos).
 *
 * Tr (getTransmision): el primer tramo (central–P) puede tener varios tipos
 * (Luis es amigo Y coexpositor de Ana). Cada tipo transmite su parte, con su
 * propio factor de tiempo τ, y las partes se combinan con noisy-OR:
 *
 *     Tr(c,P → P,Z) = 1 − Π_tipos t de c–P (1 − fuerza_t · T(t, rol_t, tipo(P,Z)) · τ(t, P–Z))
 *
 * Así, añadir un tipo o una prueba nunca baja la transmisión. La media
 * ponderada de la v2 sí podía bajarla: un vínculo nuevo con una T pequeña
 * tiraba de la media hacia abajo.
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
  #temporal;
  #equivalencias;
  // Lo ya buscado, para no repetir la búsqueda con herencia en cada camino:
  // «tipo1:rol>tipo2» → { valor, clave }, y entidad → su factor.
  #buscados;
  #factorPorEntidad;

  /**
   * @param {Object} configuracion - { tablaTransferencia, transferenciaPorDefecto, factorEntidad }
   * @param {Object} jerarquia - etiqueta → sus padres, del más cercano al más
   *   lejano (de /api/jerarquia). Opcional.
   * @param {CompatibilidadTemporal} temporal - τ, para getTransmision.
   *   Opcional: sin él, τ = 1.
   * @param {EquivalenciasTipos} equivalencias - opcional.
   */
  constructor(configuracion, jerarquia, temporal, equivalencias) {
    this.#equivalencias = equivalencias;
    if (!(equivalencias instanceof EquivalenciasTipos)) {
      this.#equivalencias = new EquivalenciasTipos(configuracion, jerarquia);
    }
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
    this.#temporal = null;
    if (temporal !== undefined && temporal !== null) {
      this.#temporal = temporal;
    }
    this.#buscados = new Map();
    this.#factorPorEntidad = new WeakMap();
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
    return this.buscarT(tipo1, rol1, tipo2).valor;
  }

  /**
   * Como getT, pero dice también de dónde sale el valor (para el laboratorio).
   *
   * @returns {Object} { valor, clave: "Mentorship:maestro>Creation", o null
   *   si no hay ninguna y se ha usado transferenciaPorDefecto }
   */
  buscarT(tipo1, rol1, tipo2) {
    let sufijo = "";
    if (typeof rol1 === "string" && rol1 !== "") {
      sufijo = ":" + rol1;
    }
    const consulta = tipo1.getId() + sufijo + ">" + tipo2.getId();
    if (!this.#buscados.has(consulta)) {
      this.#buscados.set(consulta, this.#buscarConHerencia(tipo1, sufijo, tipo2));
    }
    return this.#buscados.get(consulta);
  }

  /**
   * Tr: lo que transmite el primer tramo hacia el segundo (ver la
   * explicación de la clase). Nunca pasa de la fuerza del primer tramo:
   * T ≤ 1 y τ ≤ 1, así que cada parte es como mucho fuerza_t, y
   * 1 − Π (1 − fuerza_t) es justo F(c,P).
   *
   * @param {EvidenciaPareja} primerTramo - P visto desde la central.
   * @param {EvidenciaPareja} segundoTramo - Z visto desde P.
   * @returns {number} entre 0 y 1.
   */
  getTransmision(primerTramo, segundoTramo) {
    const tipos = primerTramo.getTipos();
    const tipo2 = segundoTramo.getTipoPrincipal();
    let producto = 1;
    for (let i = 0; i < tipos.length; i++) {
      let tau = 1;
      if (this.#temporal !== null) {
        tau = this.#temporal.getFactor(tipos[i], segundoTramo);
      }
      producto = producto * (1 - tipos[i].fuerza * this.getT(tipos[i].tipo, tipos[i].rol, tipo2) * tau);
    }
    return 1 - producto;
  }

  /**
   * El factor del tipo de entidad, con herencia (ver la explicación de la clase).
   *
   * @param {Entidad} entidad
   * @returns {number} entre 0 y 1.
   */
  getFactorEntidad(entidad) {
    if (!this.#factorPorEntidad.has(entidad)) {
      this.#factorPorEntidad.set(entidad, this.#calcularFactorEntidad(entidad));
    }
    return this.#factorPorEntidad.get(entidad);
  }

  /**
   * ¿La etiqueta, o alguno de sus padres, tiene factorEntidad?
   */
  tieneFactor(etiqueta) {
    return this.#factorDeEtiqueta(etiqueta) !== null;
  }

  #calcularFactorEntidad(entidad) {
    const ordenadas = entidad.getEtiquetas();
    // De la más específica (la que tiene más padres) a la más general.
    const tabla = this;
    ordenadas.sort(function (a, b) {
      return tabla.#padresDe(b).length - tabla.#padresDe(a).length;
    });
    for (let i = 0; i < ordenadas.length; i++) {
      const factor = this.#factorDeEtiqueta(ordenadas[i]);
      if (factor !== null) {
        return factor;
      }
    }
    return 1;
  }

  /** El factor de la etiqueta o de su padre más cercano que tenga; null si ninguno. */
  #factorDeEtiqueta(etiqueta) {
    const candidatas = [etiqueta];
    const padres = this.#padresDe(etiqueta);
    for (let i = 0; i < padres.length; i++) {
      candidatas.push(padres[i]);
    }
    for (let i = 0; i < candidatas.length; i++) {
      if (Object.prototype.hasOwnProperty.call(this.#factores, candidatas[i])) {
        return this.#factores[candidatas[i]];
      }
    }
    return null;
  }

  #buscarConHerencia(tipo1, sufijo, tipo2) {
    const ids1 = this.#equivalencias.getIds(tipo1);
    const ids2 = this.#equivalencias.getIds(tipo2);
    let clave = null;
    if (sufijo !== "") {
      clave = this.#buscarClave(ids1, sufijo, ids2);
    }
    if (clave === null) {
      clave = this.#buscarClave(ids1, "", ids2);
    }
    if (clave === null) {
      return { valor: this.#porDefecto, clave: null };
    }
    return { valor: this.#tabla[clave], clave: clave };
  }

  /** «a<sufijo>>b» para cada a de ids1 y b de ids2, en el orden de la herencia; null si no hay. */
  #buscarClave(ids1, sufijo, ids2) {
    for (let i = 0; i < ids1.length; i++) {
      for (let j = 0; j < ids2.length; j++) {
        const clave = ids1[i] + sufijo + ">" + ids2[j];
        if (Object.prototype.hasOwnProperty.call(this.#tabla, clave)) {
          return clave;
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
