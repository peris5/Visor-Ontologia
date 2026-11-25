/**
 * Cómo se calcula la relevancia de los NODOS alrededor de una entidad
 * central (patrón Estrategia). Hay dos implementaciones, y se elige con
 * estrategiaNodos en public/relevancia.json:
 *
 *  - RelevanciaNodosTresCapas ("tresCapas", la del visor): evidencia de
 *    cada pareja, refuerzo simétrico entre los nodos directos y deducción a
 *    dos saltos.
 *  - RelevanciaNodosMejorCamino ("mejorCamino"): el cálculo anterior
 *    (producto del mejor camino), que se conserva para comparar.
 *
 * Las dos trabajan SOLO con las relaciones de la central y de sus nodos
 * directos (ver GestorSubgrafos), que ya están en la caché: no piden nada
 * a la red y no dependen del umbral.
 */
export class EstrategiaRelevanciaNodos {
  /**
   * @param {Entidad} central
   * @param {RepositorioVecindario} cache - con las relaciones ya cargadas.
   * @returns {Map<string, ResultadoRelevanciaNodo>} id → resultado de cada
   *   nodo con fuerza > 0 (también la central, con relevancia 1).
   */
  calcular(central, cache) {
    throw new Error("No implementado");
  }
}
