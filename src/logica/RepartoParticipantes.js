import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * Cuánto se REPARTE una relación entre los participantes de su intermediario
 * (el factor (2/n)^β de r = peso × reparto × f_t) y cuándo una relación es
 * una COINCIDENCIA y no algo declarado. Reúne los cuatro cambios de la v4
 * sobre los eventos. Cada uno tiene su interruptor en public/relevancia.json;
 * con todos apagados se obtiene la v3.
 *
 * E2. ENTRE DOS PERSONAS SOLO CUENTAN LAS PERSONAS (contarSoloPersonas). En
 *   una exposición con tres artistas, ocho obras y la galería hay 12
 *   entidades, y exponer juntos valía 0,7 × 2/12 = 0,12. Una mentoría con el
 *   taller donde ocurrió (OCURRED_AT) tenía 3 y bajaba de 0,95 a 0,63. Las
 *   obras y el lugar no diluyen lo que une a dos personas: si los dos
 *   extremos son personas, n = número de personas. En cualquier otra pareja,
 *   n = todas las entidades.
 *
 * E4. EN UN EVENTO TODO ES COINCIDENCIA, SALVO LO QUE UNE CON EL LUGAR
 *   (coincidenciaSalvoLugar). Antes solo lo era la pareja de dos personas, y
 *   dos obras de la misma exposición, o un artista y la obra de otro,
 *   contaban como relación declarada (certeza 1). Ahora, en un
 *   intermediario cuyo tipo EXACTO está en tiposCoincidencia, toda pareja es
 *   coincidencia salvo que uno de sus extremos sea el lugar del evento: está
 *   unido al intermediario por una relación de relacionesLugar (OCURRED_AT:
 *   la galería, el museo). El tipo se compara sin herencia porque Creation
 *   hereda de Event y no debe contar.
 *
 * E5. UNA COINCIDENCIA VALE COMO MUCHO UN TOPE (topeCoincidencia). Los
 *   eventos se registran desde fuentes muy distintas (anécdotas, vídeos,
 *   prensa...): que haya 3 participantes registrados no quiere decir que
 *   hubiera 3, y con 2/n un evento poco documentado parecía íntimo. Los
 *   registrados se usan solo como MÍNIMO:
 *        factor = min(topeCoincidencia, (2/n)^β)
 *   Con 100 registrados hubo al menos 100 y el evento fue grande (2/100);
 *   con 3 no se sabe, y se queda en el tope. El mismo factor multiplica la
 *   certeza. Idea de Crandall y otros (2010) y Pham y otros (2013): un
 *   evento concurrido dice poco de cada pareja, y lo que más informa es
 *   coincidir en VARIOS eventos distintos. En lo declarado se sigue usando
 *   (2/n)^β, porque esa lista de participantes sí está completa.
 *
 * E6. LO QUE UNE CON EL LUGAR NO SE REPARTE (lugarSinReparto). Que una obra
 *   se expusiera en un museo no depende de cuánta gente expusiera con ella:
 *   una pareja declarada en la que un extremo es el lugar tiene factor 1.
 */
export class RepartoParticipantes {
  #beta;
  #tiposCoincidencia;
  #relacionesLugar;
  #contarSoloPersonas;
  #coincidenciaSalvoLugar;
  #lugarSinReparto;
  #tope;

  /**
   * @param {Object} configuracion - { betaParticipantes, tiposCoincidencia, relacionesLugar,
   *   contarSoloPersonas, coincidenciaSalvoLugar, lugarSinReparto (false si
   *   faltan), topeCoincidencia (null o sin poner: sin tope) }
   */
  constructor(configuracion) {
    const beta = configuracion.betaParticipantes;
    if (typeof beta !== "number" || Number.isNaN(beta) || beta <= 0) {
      throw new Error("En public/relevancia.json, betaParticipantes debe ser un número mayor que 0.");
    }
    this.#beta = beta;
    this.#tiposCoincidencia = new Set();
    if (Array.isArray(configuracion.tiposCoincidencia)) {
      for (let i = 0; i < configuracion.tiposCoincidencia.length; i++) {
        this.#tiposCoincidencia.add(configuracion.tiposCoincidencia[i]);
      }
    }
    this.#relacionesLugar = new Set();
    if (Array.isArray(configuracion.relacionesLugar)) {
      for (let i = 0; i < configuracion.relacionesLugar.length; i++) {
        this.#relacionesLugar.add(configuracion.relacionesLugar[i]);
      }
    }
    this.#contarSoloPersonas = configuracion.contarSoloPersonas === true;
    this.#coincidenciaSalvoLugar = configuracion.coincidenciaSalvoLugar === true;
    this.#lugarSinReparto = configuracion.lugarSinReparto === true;
    this.#tope = null;
    const tope = configuracion.topeCoincidencia;
    if (tope !== undefined && tope !== null) {
      if (typeof tope !== "number" || Number.isNaN(tope) || tope < 0 || tope > 1) {
        throw new Error("En public/relevancia.json, topeCoincidencia debe ser un número entre 0 y 1, o null.");
      }
      this.#tope = tope;
    }
  }

  getBeta() {
    return this.#beta;
  }

  /**
   * @returns {number|null} lo máximo que vale una coincidencia, o null si no hay tope.
   */
  getTope() {
    return this.#tope;
  }

  /**
   * ¿El tipo (exacto, sin herencia) está en tiposCoincidencia?
   *
   * @param {TipoRelacion} tipo
   */
  esTipoDeCoincidencia(tipo) {
    return this.#tiposCoincidencia.has(tipo.getId());
  }

  /**
   * ¿Es una coincidencia (ver E4 en la explicación de la clase)?
   *
   * @param {Relacion} relacion
   */
  esCoincidencia(relacion) {
    if (relacion.esSintetica() || !this.esTipoDeCoincidencia(relacion.getTipo())) {
      return false;
    }
    if (this.#coincidenciaSalvoLugar) {
      return !this.uneConElLugar(relacion);
    }
    return RepartoParticipantes.esEntrePersonas(relacion);
  }

  /**
   * ¿Uno de los dos extremos es el lugar del evento (unido al intermediario
   * por una relación de relacionesLugar)?
   *
   * @param {Relacion} relacion
   */
  uneConElLugar(relacion) {
    return this.esElLugar(relacion, relacion.getOrigen()) || this.esElLugar(relacion, relacion.getDestino());
  }

  /**
   * ¿Esa entidad es el lugar del evento?
   *
   * @param {Relacion} relacion
   * @param {Entidad} entidad - su origen o su destino.
   */
  esElLugar(relacion, entidad) {
    return this.#relacionesLugar.has(relacion.getVia(entidad));
  }

  /**
   * ¿Los dos extremos son personas (también Creator, Painter..., que son
   * entidades de la clase PERSONA)?
   *
   * @param {Relacion} relacion
   */
  static esEntrePersonas(relacion) {
    return relacion.getOrigen().getTipo() === TipoEntidad.PERSONA &&
      relacion.getDestino().getTipo() === TipoEntidad.PERSONA;
  }

  /**
   * n: entre cuántos se reparte (ver E2 en la explicación de la clase).
   *
   * @param {Relacion} relacion
   */
  getParticipantes(relacion) {
    if (this.#contarSoloPersonas && RepartoParticipantes.esEntrePersonas(relacion)) {
      return relacion.getParticipantesDeClase(TipoEntidad.PERSONA);
    }
    return relacion.getParticipantes();
  }

  /**
   * El factor de reparto de una relación, entre 0 y 1 (E2, E5 y E6).
   *
   * @param {Relacion} relacion
   */
  getFactor(relacion) {
    const reparto = this.getFactorDeNumero(this.getParticipantes(relacion));
    if (this.esCoincidencia(relacion)) {
      if (this.#tope !== null && this.#tope < reparto) {
        return this.#tope;
      }
      return reparto;
    }
    if (this.#lugarSinReparto && this.uneConElLugar(relacion)) {
      return 1;
    }
    return reparto;
  }

  /**
   * (2/n)^β: 1 con dos participantes, más pequeño cuanto más grande el evento.
   */
  getFactorDeNumero(participantes) {
    let n = 2;
    if (typeof participantes === "number" && participantes > 2) {
      n = participantes;
    }
    return Math.pow(2 / n, this.#beta);
  }
}
