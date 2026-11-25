/**
 * Define cómo se calcula la relevancia de UNA relación (y, para la
 * estrategia de nodos «mejor camino», cómo se encadena a lo largo de un
 * camino). Separarlo en una interfaz permite cambiar la fórmula sin tocar
 * el resto (patrón Estrategia).
 *
 * La única implementación es RelevanciaCompuesta. La relevancia de los
 * NODOS la calcula una EstrategiaRelevanciaNodos.
 */
export class EstrategiaRelevancia {
  /** Relevancia de una relación, entre 0 y 1. */
  calcularRelevanciaRelacion(relacion) {
    throw new Error("No implementado");
  }

  /** Relevancia de un nodo a partir de la de su padre y la de la relación que los une (mejor camino). */
  calcularRelevanciaNodo(relevanciaPadre, relevanciaRelacion) {
    throw new Error("No implementado");
  }
}
