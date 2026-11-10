/**
 * RelevanciaDesdeBD implements EstrategiaRelevancia
 *
 * La estrategia de este TFG:
 *  - Relación: el valor que trae la base de datos, acotado a [0, 1].
 *  - Nodo: relevancia del padre × relevancia de la relación.
 *
 * Requisitos: RNF-30 y RF-08 a RF-12.
 */
class RelevanciaDesdeBD extends EstrategiaRelevancia {
  /**
   * @param {Relacion} relacion
   * @returns {number} el valor de la BD, acotado entre 0 y 1.
   */
  calcularRelevanciaRelacion(relacion) {
    const valor = relacion.getValor();
    // Un valor que no es un número no aporta relevancia.
    if (typeof valor !== "number" || Number.isNaN(valor)) {
      return 0;
    }
    // Acotamos para que un dato erróneo de la BD (por ejemplo 1.4 o -0.2)
    // no rompa la regla de que la relevancia está entre 0 y 1.
    if (valor < 0) {
      return 0;
    }
    if (valor > 1) {
      return 1;
    }
    return valor;
  }

  /**
   * Producto de las dos relevancias. Como las dos están entre 0 y 1,
   * el resultado nunca es mayor que la relevancia del padre: alejarse de
   * la central nunca hace a un nodo más relevante.
   *
   * @param {number} relevanciaPadre
   * @param {number} relevanciaRelacion
   * @returns {number}
   */
  calcularRelevanciaNodo(relevanciaPadre, relevanciaRelacion) {
    const relevanciaDelNodo = relevanciaPadre * relevanciaRelacion;
    return relevanciaDelNodo;
  }
}
