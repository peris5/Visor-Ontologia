/**
 * «interface» EstrategiaRelevancia
 *
 * Define cómo se calcula la relevancia. Separarlo en una interfaz permite
 * cambiar la fórmula en el futuro sin tocar ConstructorSubgrafo
 * (patrón Estrategia).
 *
 * Requisitos: RNF-30.
 */
class EstrategiaRelevancia {
  /**
   * Relevancia de una relación, entre 0 y 1.
   *
   * @param {Relacion} relacion
   * @returns {number}
   */
  calcularRelevanciaRelacion(relacion) {
    throw new Error("No implementado");
  }

  /**
   * Relevancia de un nodo a partir de la de su padre y la de la relación que los une.
   *
   * @param {number} relevanciaPadre
   * @param {number} relevanciaRelacion
   * @returns {number}
   */
  calcularRelevanciaNodo(relevanciaPadre, relevanciaRelacion) {
    throw new Error("No implementado");
  }
}
