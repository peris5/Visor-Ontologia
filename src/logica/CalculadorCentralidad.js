/**
 * CalculadorCentralidad
 *
 * Mide lo "conectado" que está cada nodo dentro del subgrafo con la
 * centralidad de grado ponderada:
 *   1. Para cada nodo, sumamos las relevancias de sus relaciones.
 *   2. Dividimos cada suma por la mayor, para que queden entre 0 y 1
 *      (el nodo más conectado vale 1). Si la mayor es 0, todos valen 0.
 *
 * Requisitos: RF-37.
 */
class CalculadorCentralidad {
  /**
   * @param {Subgrafo} subgrafo
   * @returns {Map<string, number>} idEntidad → centralidad entre 0 y 1.
   */
  calcular(subgrafo) {
    const sumasPorNodo = this.#sumarRelevanciasPorNodo(subgrafo);
    const sumaMaxima = this.#buscarMaximo(sumasPorNodo);
    const centralidadPorNodo = this.#normalizar(sumasPorNodo, sumaMaxima);
    return centralidadPorNodo;
  }

  /**
   * (Privado) Paso 1: suma de relevancias de las relaciones de cada nodo.
   * Cada relación suma a sus DOS extremos.
   *
   * @param {Subgrafo} subgrafo
   * @returns {Map<string, number>}
   */
  #sumarRelevanciasPorNodo(subgrafo) {
    const sumasPorNodo = new Map();

    // Empezamos todos en 0, así un nodo sin relaciones también aparece.
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const idEntidad = nodos[i].getEntidad().getId();
      sumasPorNodo.set(idEntidad, 0);
    }

    const relaciones = subgrafo.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const relevancia = relacion.getRelevancia();
      const idOrigen = relacion.getOrigen().getId();
      const idDestino = relacion.getDestino().getId();
      sumasPorNodo.set(idOrigen, sumasPorNodo.get(idOrigen) + relevancia);
      sumasPorNodo.set(idDestino, sumasPorNodo.get(idDestino) + relevancia);
    }
    return sumasPorNodo;
  }

  /**
   * (Privado) La suma más grande de todas.
   *
   * @param {Map<string, number>} sumasPorNodo
   * @returns {number}
   */
  #buscarMaximo(sumasPorNodo) {
    let maximo = 0;
    for (const suma of sumasPorNodo.values()) {
      if (suma > maximo) {
        maximo = suma;
      }
    }
    return maximo;
  }

  /**
   * (Privado) Paso 2: divide cada suma por el máximo.
   *
   * @param {Map<string, number>} sumasPorNodo
   * @param {number} sumaMaxima
   * @returns {Map<string, number>}
   */
  #normalizar(sumasPorNodo, sumaMaxima) {
    const centralidadPorNodo = new Map();
    for (const idEntidad of sumasPorNodo.keys()) {
      let centralidad = 0;
      // Si el máximo es 0 no se puede dividir: nadie tiene relaciones, así que todos valen 0.
      if (sumaMaxima > 0) {
        centralidad = sumasPorNodo.get(idEntidad) / sumaMaxima;
      }
      centralidadPorNodo.set(idEntidad, centralidad);
    }
    return centralidadPorNodo;
  }
}
