/**
 * «interface» RepositorioDatos
 *
 * Todo el acceso a los datos pasa por aquí. El resto de la aplicación no sabe
 * si los datos vienen de un archivo de ejemplo (RepositorioSimulado) o de la
 * base de datos real (incremento 4): basta con cambiar la implementación.
 *
 * Los métodos son asíncronos (devuelven una Promise) porque la base de datos
 * real responderá a través de la red y tardará un tiempo.
 *
 * Requisitos: RNF-17.
 */
class RepositorioDatos {
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
