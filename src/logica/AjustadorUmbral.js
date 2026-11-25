/**
 * Elige el umbral con el que se abre una entidad para que salgan MÁS O
 * MENOS el mismo número de nodos (nodosObjetivo), sea cual sea la entidad:
 * una muy conectada se abre con un umbral alto y una poco conectada, con
 * uno bajo. Después el usuario puede moverlo con el deslizador.
 *
 * ¿Cómo sabe cuántos nodos saldrían con cada umbral sin construir un
 * subgrafo para cada uno? Le basta con la relevancia de cada nodo (el
 * producto de su mejor camino desde la central): con un umbral u entran
 * la central y los nodos de relevancia mayor que u, como mucho maxNodos.
 * Le llegan solo los que pueden entrar, con las cuotas ya aplicadas
 * (SeleccionadorNodos).
 *
 * Solo prueba los valores que tiene el deslizador (de 0,05 en 0,05) y se
 * queda con el que da un número de nodos más cercano al objetivo. Si dos
 * quedan igual de cerca, el más alto (menos nodos, más ligero). Un umbral
 * que deja SOLA a la central no se elige si otro da algún nodo: en un artista
 * con 50 obras de S = 1 y un objetivo de 30, «1 nodo» quedaba más cerca que
 * «51 nodos» y la página se abría vacía.
 */
export class AjustadorUmbral {
  static MINIMO = 0.05;
  static MAXIMO = 1;
  // En centésimas, para no acumular errores de redondeo (0,05 · 3 ≠ 0,15).
  static PASO_CENTESIMAS = 5;

  #nodosObjetivo;

  /**
   * @param {number} nodosObjetivo - entero mayor que 0.
   */
  constructor(nodosObjetivo) {
    if (!Number.isInteger(nodosObjetivo) || nodosObjetivo < 1) {
      throw new Error("El número de nodos objetivo debe ser un entero mayor que 0.");
    }
    this.#nodosObjetivo = nodosObjetivo;
  }

  getNodosObjetivo() {
    return this.#nodosObjetivo;
  }

  /**
   * Elige el umbral.
   *
   * @param {number[]} relevancias - la relevancia de cada nodo SIN contar
   *   la central (que siempre entra).
   * @param {number} umbralMinimo - el umbral más bajo que se puede elegir
   *   (el del vecindario con el que se han calculado las relevancias: por
   *   debajo podrían faltar nodos).
   * @param {number} maxNodos - máximo de nodos del subgrafo.
   * @returns {{umbral: number, nodos: number}} el umbral elegido y cuántos
   *   nodos saldrán con él.
   */
  elegir(relevancias, umbralMinimo, maxNodos) {
    let mejorUmbral = AjustadorUmbral.MAXIMO;
    let mejorNodos = this.contarNodos(relevancias, mejorUmbral, maxNodos);
    let mejorDiferencia = Math.abs(mejorNodos - this.#nodosObjetivo);

    // Del más alto al más bajo: así, en caso de empate se queda el más alto
    // (solo se cambia si el nuevo está ESTRICTAMENTE más cerca).
    const desde = Math.round(AjustadorUmbral.MAXIMO * 100) - AjustadorUmbral.PASO_CENTESIMAS;
    const hasta = Math.round(AjustadorUmbral.MINIMO * 100);
    for (let centesimas = desde; centesimas >= hasta; centesimas = centesimas - AjustadorUmbral.PASO_CENTESIMAS) {
      const umbral = centesimas / 100;
      if (umbral < umbralMinimo) {
        break;
      }
      const nodos = this.contarNodos(relevancias, umbral, maxNodos);
      const diferencia = Math.abs(nodos - this.#nodosObjetivo);
      const dejaDeEstarSola = mejorNodos === 1 && nodos > 1;
      if (diferencia < mejorDiferencia || dejaDeEstarSola) {
        mejorUmbral = umbral;
        mejorNodos = nodos;
        mejorDiferencia = diferencia;
      }
    }
    return { umbral: mejorUmbral, nodos: mejorNodos };
  }

  /**
   * Cuántos nodos tendría el subgrafo con un umbral: la central más los
   * nodos de relevancia mayor que el umbral, como mucho maxNodos.
   *
   * @param {number[]} relevancias - sin la central.
   */
  contarNodos(relevancias, umbral, maxNodos) {
    let nodos = 1;
    for (let i = 0; i < relevancias.length; i++) {
      if (relevancias[i] > umbral) {
        nodos = nodos + 1;
      }
    }
    if (nodos > maxNodos) {
      return maxNodos;
    }
    return nodos;
  }
}
