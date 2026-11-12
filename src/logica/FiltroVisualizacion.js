import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * FiltroVisualizacion
 *
 * Qué tipos de nodo y de relación quiere ver el usuario. Lo cambian las
 * casillas de la leyenda y lo aplica EscenaGrafo, que oculta o muestra cada
 * nodo y cada línea. No pide nada al servidor ni recalcula el subgrafo:
 * solo decide qué se ve.
 *
 * Reglas:
 *  - La entidad central SIEMPRE se ve, aunque su tipo esté oculto (si no,
 *    la escena se quedaría sin centro). Por eso esVisibleNodo y
 *    esVisibleRelacion reciben el id de la central.
 *  - Una relación se ve si su tipo está activo Y sus dos extremos se ven.
 *  - Los tipos de relación ocultos se guardan por su ID ("maestro_de") y no
 *    como objetos TipoRelacion, porque cada subgrafo crea sus propios
 *    objetos: el «Maestro de» de un subgrafo no es el mismo objeto que el
 *    del siguiente, pero sí tiene el mismo id.
 *  - Los filtros SE MANTIENEN al navegar a otra entidad o cambiar el umbral.
 *    (Pendiente de confirmar con el tutor: la alternativa sería
 *    restablecerlos en cada subgrafo nuevo, llamando a restablecer() desde
 *    ControladorExploracion.cargarSubgrafo.)
 *
 * Requisitos: RF-32 (filtrar por tipo de nodo), RF-33 (filtrar por tipo de
 * relación).
 */
export class FiltroVisualizacion {
  #tiposNodoVisibles;
  #tiposRelacionOcultos;

  constructor() {
    this.#tiposNodoVisibles = [];
    this.#tiposRelacionOcultos = [];
    this.restablecer();
  }

  /**
   * Si el tipo de nodo se veía, lo oculta; si estaba oculto, lo muestra.
   *
   * @param {string} tipo - un valor de TipoEntidad.
   */
  alternarTipoNodo(tipo) {
    const posicion = this.#tiposNodoVisibles.indexOf(tipo);
    if (posicion >= 0) {
      this.#tiposNodoVisibles.splice(posicion, 1);
    } else {
      this.#tiposNodoVisibles.push(tipo);
    }
  }

  /**
   * Si el tipo de relación se veía, lo oculta; si estaba oculto, lo muestra.
   *
   * @param {TipoRelacion} tipo
   */
  alternarTipoRelacion(tipo) {
    this.setTipoRelacionActivo(tipo, !this.esTipoRelacionActivo(tipo));
  }

  /**
   * Muestra (activo = true) u oculta (activo = false) un tipo de relación.
   * Lo usan los botones «Todas» y «Ninguna» de la leyenda.
   *
   * @param {TipoRelacion} tipo
   * @param {boolean} activo
   */
  setTipoRelacionActivo(tipo, activo) {
    const idTipo = tipo.getId();
    const posicion = this.#tiposRelacionOcultos.indexOf(idTipo);
    const estabaOculto = posicion >= 0;
    if (activo && estabaOculto) {
      this.#tiposRelacionOcultos.splice(posicion, 1);
    }
    if (!activo && !estabaOculto) {
      this.#tiposRelacionOcultos.push(idTipo);
    }
  }

  /**
   * @param {string} tipo - un valor de TipoEntidad.
   * @returns {boolean} true si ese tipo de nodo se ve.
   */
  esTipoNodoActivo(tipo) {
    return this.#tiposNodoVisibles.includes(tipo);
  }

  /**
   * @param {TipoRelacion} tipo
   * @returns {boolean} true si ese tipo de relación se ve.
   */
  esTipoRelacionActivo(tipo) {
    return !this.#tiposRelacionOcultos.includes(tipo.getId());
  }

  /**
   * @param {NodoRelevante} nodo
   * @param {string} idCentral - id de la entidad central (siempre se ve).
   * @returns {boolean}
   */
  esVisibleNodo(nodo, idCentral) {
    const entidad = nodo.getEntidad();
    if (entidad.getId() === idCentral) {
      return true;
    }
    return this.esTipoNodoActivo(entidad.getTipo());
  }

  /**
   * Una relación se ve si su tipo está activo y sus dos extremos se ven.
   *
   * @param {Relacion} relacion
   * @param {string} idCentral
   * @returns {boolean}
   */
  esVisibleRelacion(relacion, idCentral) {
    if (!this.esTipoRelacionActivo(relacion.getTipo())) {
      return false;
    }
    const seVeElOrigen = this.#esVisibleEntidad(relacion.getOrigen(), idCentral);
    const seVeElDestino = this.#esVisibleEntidad(relacion.getDestino(), idCentral);
    return seVeElOrigen && seVeElDestino;
  }

  /**
   * Vuelve al principio: todos los tipos de nodo visibles y ningún tipo de
   * relación oculto.
   */
  restablecer() {
    this.#tiposNodoVisibles = [TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION, TipoEntidad.OBRA_DE_ARTE];
    this.#tiposRelacionOcultos = [];
  }

  /**
   * (Privado) Lo mismo que esVisibleNodo, pero con una Entidad (los
   * extremos de una relación son entidades, no nodos).
   *
   * @param {Entidad} entidad
   * @param {string} idCentral
   * @returns {boolean}
   */
  #esVisibleEntidad(entidad, idCentral) {
    if (entidad.getId() === idCentral) {
      return true;
    }
    return this.esTipoNodoActivo(entidad.getTipo());
  }
}
