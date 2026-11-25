import { EstrategiaRelevancia } from './EstrategiaRelevancia.js';
import { RepartoParticipantes } from './RepartoParticipantes.js';
import { EquivalenciasTipos } from './EquivalenciasTipos.js';

/**
 * La relevancia de UNA relación, calculada siempre en el navegador (la base
 * de datos no trae relevancias):
 *
 *     r = peso(tipo, rol del otro) × (2/n)^β × f_t
 *
 *  - peso(tipo, rol): primero pesosPorRol con el rol que tiene EL OTRO
 *    extremo, visto desde la entidad que mira («Mentorship.maestro» = 0,95:
 *    el otro es mi maestro; «Mentorship.aprendiz» = 0,60: es mi alumno),
 *    también por los padres del tipo. Si no hay, el de pesosRelevancia
 *    (public/relevancia.json); si el tipo no tiene, el de su padre más
 *    cercano que tenga (Paint → Creation); si ninguno, pesoPorDefecto. Un
 *    tipo con equivalente usa los de este (EquivalenciasTipos).
 *    Por el rol, la relevancia de una relación puede ser distinta en cada
 *    sentido (la evidencia es dirigida, ver CalculadorEvidencia).
 *  - (2/n)^β: el REPARTO entre los participantes del intermediario. Una
 *    relación entre dos vale entera; coincidir en un evento de 40 personas,
 *    mucho menos. β = betaParticipantes. Quién cuenta en n, el tope de las
 *    coincidencias y lo que no se reparte: ver RepartoParticipantes.
 *  - f_t (factor de tiempo): penaliza lo que ocurrió lejos de la ÉPOCA de la
 *    entidad central (del primer al último año de sus propias relaciones
 *    con fecha, ver epocaDe):
 *        f_t = mínimo + (1 − mínimo) · e^(−Δ / τ)
 *    Δ = años que separan la relación de esa época (0 si cae dentro, y por
 *    tanto 0 en todas las relaciones de la propia central). mínimo =
 *    factorTiempoMinimo y τ = tauTiempoAnios. Una relación sin fecha recibe
 *    factorTiempoSinFecha; los tipos de tiposSinTiempo (y sus hijos) no
 *    caducan (f_t = 1). Si la central no tiene ninguna fecha, f_t = 1.
 *    ESTA FÓRMULA ES UNA PROPUESTA pendiente de validar.
 *
 * Ya NO combina varias relaciones de una misma pareja: eso lo hace
 * CalculadorEvidencia con TODAS las relaciones.
 *
 * Para el «mejor camino» (RelevanciaNodosMejorCamino), la relevancia de un
 * nodo es la de su padre por la de la relación.
 */
export class RelevanciaCompuesta extends EstrategiaRelevancia {
  #pesos;
  #pesosPorRol;
  #pesoPorDefecto;
  #reparto;
  #equivalencias;
  #factorTiempoMinimo;
  #tauTiempoAnios;
  #factorTiempoSinFecha;
  #tiposSinTiempo;
  #epoca;

  /**
   * @param {Object} configuracion - la de public/relevancia.json: {
   *   pesosRelevancia, pesosPorRol (opcional), pesoPorDefecto, betaParticipantes, factorTiempoMinimo,
   *   tauTiempoAnios, factorTiempoSinFecha, tiposSinTiempo, y lo de RepartoParticipantes }
   * @param {EquivalenciasTipos} equivalencias - opcional; sin ellas, las de la
   *   configuración sin jerarquía.
   */
  constructor(configuracion, equivalencias) {
    super();
    this.#equivalencias = equivalencias;
    if (!(equivalencias instanceof EquivalenciasTipos)) {
      this.#equivalencias = new EquivalenciasTipos(configuracion, null);
    }
    this.#pesos = RelevanciaCompuesta.#objeto(configuracion.pesosRelevancia);
    this.#pesosPorRol = {};
    if (configuracion.pesosPorRol !== undefined && configuracion.pesosPorRol !== null) {
      this.#pesosPorRol = configuracion.pesosPorRol;
    }
    this.#pesoPorDefecto = RelevanciaCompuesta.#entre0y1(configuracion.pesoPorDefecto, "pesoPorDefecto");
    this.#reparto = new RepartoParticipantes(configuracion);
    this.#factorTiempoMinimo = RelevanciaCompuesta.#entre0y1(configuracion.factorTiempoMinimo, "factorTiempoMinimo");
    this.#tauTiempoAnios = RelevanciaCompuesta.#positivo(configuracion.tauTiempoAnios, "tauTiempoAnios");
    this.#factorTiempoSinFecha = RelevanciaCompuesta.#entre0y1(configuracion.factorTiempoSinFecha,
      "factorTiempoSinFecha");
    this.#tiposSinTiempo = [];
    if (Array.isArray(configuracion.tiposSinTiempo)) {
      for (let i = 0; i < configuracion.tiposSinTiempo.length; i++) {
        this.#tiposSinTiempo.push(configuracion.tiposSinTiempo[i]);
      }
    }
    this.#epoca = null;
  }

  /**
   * La época de la entidad central con que se calcula f_t (ver epocaDe).
   *
   * @param {Object|null} epoca - { desde, hasta } en años, o null.
   */
  setEpoca(epoca) {
    this.#epoca = epoca;
  }

  getEpoca() {
    return this.#epoca;
  }

  getBeta() {
    return this.#reparto.getBeta();
  }

  /**
   * @returns {RepartoParticipantes} cómo se reparte cada relación y qué es coincidencia.
   */
  getReparto() {
    return this.#reparto;
  }

  /**
   * r = peso × (2/n)^β × f_t. También la guarda en la relación
   * (setRelevancia): si se calcula en los dos sentidos, queda la del último.
   *
   * @param {Relacion} relacion
   * @param {string|null} rolDelOtro - opcional: el rol NORMALIZADO del otro
   *   extremo (NormalizadorRoles), o null.
   */
  calcularRelevanciaRelacion(relacion, rolDelOtro) {
    let rol = null;
    if (typeof rolDelOtro === "string") {
      rol = rolDelOtro;
    }
    const r = this.getPeso(relacion.getTipo(), rol) * this.#reparto.getFactor(relacion) *
      this.getFactorTiempo(relacion);
    relacion.setRelevancia(r);
    return r;
  }

  /** Producto de las dos (nunca crece a lo largo de un camino). */
  calcularRelevanciaNodo(relevanciaPadre, relevanciaRelacion) {
    return relevanciaPadre * relevanciaRelacion;
  }

  /**
   * Peso del tipo según el rol del otro extremo (pesosPorRol), o el del
   * tipo, el de su padre más cercano que tenga peso o el de por defecto.
   *
   * @param {TipoRelacion} tipo
   * @param {string|null} rolDelOtro - opcional: rol normalizado del otro extremo.
   */
  getPeso(tipo, rolDelOtro) {
    return this.buscarPeso(tipo, rolDelOtro).valor;
  }

  /**
   * Como getPeso, pero dice también de dónde sale (para el laboratorio).
   *
   * @returns {Object} { valor, clave: «Mentorship.maestro», «Creation»... o
   *   null si ha sido pesoPorDefecto }
   */
  buscarPeso(tipo, rolDelOtro) {
    const ids = this.#equivalencias.getIds(tipo);
    if (typeof rolDelOtro === "string" && rolDelOtro !== "") {
      for (let i = 0; i < ids.length; i++) {
        const clave = ids[i] + "." + rolDelOtro;
        if (Object.prototype.hasOwnProperty.call(this.#pesosPorRol, clave)) {
          return { valor: this.#pesosPorRol[clave], clave: clave };
        }
      }
    }
    for (let i = 0; i < ids.length; i++) {
      if (Object.prototype.hasOwnProperty.call(this.#pesos, ids[i])) {
        return { valor: this.#pesos[ids[i]], clave: ids[i] };
      }
    }
    return { valor: this.#pesoPorDefecto, clave: null };
  }

  /**
   * f_t (ver la explicación de la clase).
   */
  getFactorTiempo(relacion) {
    const ids = this.#equivalencias.getIds(relacion.getTipo());
    for (let i = 0; i < ids.length; i++) {
      if (this.#tiposSinTiempo.includes(ids[i])) {
        return 1;
      }
    }
    if (this.#epoca === null) {
      return 1;
    }
    const anios = RelevanciaCompuesta.aniosDe(relacion);
    if (anios === null) {
      return this.#factorTiempoSinFecha;
    }
    let distancia = 0;
    if (anios.hasta < this.#epoca.desde) {
      distancia = this.#epoca.desde - anios.hasta;
    } else if (anios.desde > this.#epoca.hasta) {
      distancia = anios.desde - this.#epoca.hasta;
    }
    return this.#factorTiempoMinimo + (1 - this.#factorTiempoMinimo) * Math.exp(-distancia / this.#tauTiempoAnios);
  }

  /**
   * Los años de una relación: los de su periodo o, si no tiene, el de su fecha.
   *
   * @returns {Object|null} { desde, hasta }, o null si no tiene ninguno.
   */
  static aniosDe(relacion) {
    let desde = null;
    let hasta = null;
    const periodo = relacion.getPeriodo();
    if (periodo !== null) {
      desde = RelevanciaCompuesta.#anio(periodo.getDesde());
      hasta = RelevanciaCompuesta.#anio(periodo.getHasta());
    }
    if (desde === null && hasta === null) {
      desde = RelevanciaCompuesta.#anio(relacion.getFecha());
      hasta = desde;
    }
    if (desde === null && hasta === null) {
      return null;
    }
    if (desde === null) {
      desde = hasta;
    }
    if (hasta === null) {
      hasta = desde;
    }
    if (hasta < desde) {
      return { desde: hasta, hasta: desde };
    }
    return { desde: desde, hasta: hasta };
  }

  /**
   * La época de una entidad: del primer al último año de sus relaciones con
   * fecha. null si ninguna tiene fecha.
   *
   * @param {Relacion[]} relaciones - las de la entidad central.
   */
  static epocaDe(relaciones) {
    let epoca = null;
    for (let i = 0; i < relaciones.length; i++) {
      const anios = RelevanciaCompuesta.aniosDe(relaciones[i]);
      if (anios !== null) {
        if (epoca === null) {
          epoca = { desde: anios.desde, hasta: anios.hasta };
        } else {
          epoca.desde = Math.min(epoca.desde, anios.desde);
          epoca.hasta = Math.max(epoca.hasta, anios.hasta);
        }
      }
    }
    return epoca;
  }

  /**
   * El año de un valor: un número, o el PRIMER número de 3 o 4 cifras de un
   * texto ("1902", "1910-05-01", "hacia 1905", "c. 980"). null si no hay.
   */
  static #anio(valor) {
    if (typeof valor === "number" && Number.isFinite(valor)) {
      return Math.trunc(valor);
    }
    if (typeof valor !== "string") {
      return null;
    }
    const encontrado = valor.match(/\d{3,4}/);
    if (encontrado === null) {
      return null;
    }
    return parseInt(encontrado[0], 10);
  }

  static #objeto(valor) {
    if (valor === undefined || valor === null || typeof valor !== "object") {
      throw new Error("Falta pesosRelevancia en public/relevancia.json.");
    }
    return valor;
  }

  static #entre0y1(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número entre 0 y 1.");
    }
    return valor;
  }

  static #positivo(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor <= 0) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número mayor que 0.");
    }
    return valor;
  }
}
