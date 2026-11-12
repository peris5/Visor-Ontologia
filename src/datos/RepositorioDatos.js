/**
 * «interface» RepositorioDatos
 *
 * Todo el acceso a los datos pasa por aquí. ConstructorSubgrafo no sabe de
 * dónde salen los datos: basta con cambiar la implementación.
 *
 * Es la misma interfaz del incremento 1. Entonces la implementaba
 * RepositorioSimulado (datos de ejemplo en el navegador); desde el
 * incremento 3 la implementa RepositorioVecindario, que guarda en memoria el
 * vecindario que envía el servidor. Así ConstructorSubgrafo no ha cambiado.
 *
 * Los métodos son asíncronos (devuelven una Promise): así una
 * implementación que tenga que ir a la red puede usar la misma interfaz.
 *
 * Requisitos: RNF-17.
 */
export class RepositorioDatos {
  /**
   * Busca entidades cuyo nombre contenga el texto.
   *
   * @param {string} texto
   * @param {string|null} tipo - un valor de TipoEntidad, o null para todos.
   * @param {number|null} limite - máximo de resultados, o null para sin límite.
   * @returns {Promise<Entidad[]>}
   */
  async buscarEntidades(texto, tipo, limite) {
    throw new Error("No implementado");
  }

  /**
   * @param {string} id
   * @returns {Promise<Entidad|null>} la entidad, o null si no existe.
   */
  async obtenerEntidad(id) {
    throw new Error("No implementado");
  }

  /**
   * Relaciones en las que participa la entidad, sea como origen o como destino.
   *
   * @param {string} idEntidad
   * @returns {Promise<Relacion[]>}
   */
  async obtenerRelaciones(idEntidad) {
    throw new Error("No implementado");
  }

  /**
   * @returns {Promise<TipoRelacion[]>} todos los tipos de relación conocidos.
   */
  async obtenerTiposRelacion() {
    throw new Error("No implementado");
  }
}
