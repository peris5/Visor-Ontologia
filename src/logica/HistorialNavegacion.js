/**
 * HistorialNavegacion
 *
 * Recuerda por qué entidades ha pasado el usuario para poder volver atrás,
 * como el botón «Atrás» de un navegador web. Es una pila: lo último que
 * entra es lo primero que sale.
 *
 * Requisitos: RF-31 (volver a la entidad anterior).
 */
export class HistorialNavegacion {
  #pila;

  constructor() {
    this.#pila = [];
  }

  /**
   * Apunta una entidad en el historial. Si es la misma que la última, no se
   * apunta otra vez (si no, «Volver» llevaría a la misma entidad).
   *
   * @param {string} idEntidad
   */
  registrar(idEntidad) {
    if (typeof idEntidad !== "string" || idEntidad === "") {
      return;
    }
    const posicionUltimo = this.#pila.length - 1;
    if (posicionUltimo >= 0 && this.#pila[posicionUltimo] === idEntidad) {
      return;
    }
    this.#pila.push(idEntidad);
  }

  /**
   * Saca la última entidad apuntada y la devuelve.
   *
   * @returns {string|null} el id, o null si el historial está vacío.
   */
  volver() {
    if (this.#pila.length === 0) {
      return null;
    }
    return this.#pila.pop();
  }

  /**
   * @returns {boolean} true si hay alguna entidad a la que volver.
   */
  puedeVolver() {
    return this.#pila.length > 0;
  }

  /**
   * Borra todo el historial.
   */
  limpiar() {
    this.#pila = [];
  }
}
