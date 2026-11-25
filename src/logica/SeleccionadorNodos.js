/**
 * Qué nodos pueden entrar en el subgrafo y en qué orden (E3). Lo usan
 * ConstructorSubgrafo (que aplica después el umbral y el máximo) y
 * GestorSubgrafos (para elegir el umbral inicial con los mismos nodos).
 *
 *  - ORDEN: relevancia S de mayor a menor; a igualdad, certeza C de mayor a
 *    menor; a igualdad, por id. Así el corte de los 150 no depende del orden
 *    en que llegan los datos. (Dos S se consideran iguales si se diferencian
 *    en menos de 1e-12, que es error de redondeo.)
 *  - CUOTAS POR CLASE (cuotasPorClase): como mucho N nodos de cada clase de
 *    entidad, por ejemplo { "OBRA_DE_ARTE": 50 }. Una obra propia vale 1, más
 *    que el maestro (0,95): en los artistas prolíficos las 150 plazas se
 *    llenaban de obras (eran el 69 % de lo dibujado) y solo entraba el 61 %
 *    de los alumnos. Se recorre la lista ya ordenada y se salta un nodo cuya
 *    clase ya llegó a su cuota: se quedan las obras de más S. La central no
 *    cuenta. Sin cuotas ({}) se comporta como la v3.
 */
export class SeleccionadorNodos {
  static TOLERANCIA = 1e-12;

  #cuotas;

  /**
   * @param {Object} cuotasPorClase - opcional: TipoEntidad → máximo de nodos.
   */
  constructor(cuotasPorClase) {
    this.#cuotas = new Map();
    if (cuotasPorClase !== undefined && cuotasPorClase !== null) {
      for (const clase of Object.keys(cuotasPorClase)) {
        const cuota = cuotasPorClase[clase];
        if (!Number.isInteger(cuota) || cuota < 0) {
          throw new Error("En public/relevancia.json, cuotasPorClase debe tener números enteros (" + clase + ").");
        }
        this.#cuotas.set(clase, cuota);
      }
    }
  }

  /**
   * Los nodos que pueden entrar, ya ordenados y con las cuotas aplicadas, sin
   * la central. Los deducidos, si no se muestran, se quitan ANTES de aplicar
   * las cuotas, para que su sitio lo ocupen otros.
   *
   * Aplicar después un umbral y un máximo da lo mismo que aplicarlos a la
   * vez: la cuota solo mira a los nodos que van delante.
   *
   * @param {Map<string, ResultadoRelevanciaNodo>} resultados
   * @param {string} idCentral
   * @param {boolean} mostrarDeducidos
   * @returns {ResultadoRelevanciaNodo[]}
   */
  elegibles(resultados, idCentral, mostrarDeducidos) {
    const ordenados = [];
    for (const [id, resultado] of resultados) {
      const seMuestra = mostrarDeducidos || !resultado.esDeducido();
      if (id !== idCentral && seMuestra) {
        ordenados.push(resultado);
      }
    }
    ordenados.sort(SeleccionadorNodos.comparar);
    const porClase = new Map();
    const lista = [];
    for (let i = 0; i < ordenados.length; i++) {
      const clase = ordenados[i].getEntidad().getTipo();
      let puestos = 0;
      if (porClase.has(clase)) {
        puestos = porClase.get(clase);
      }
      const llena = this.#cuotas.has(clase) && puestos >= this.#cuotas.get(clase);
      if (!llena) {
        porClase.set(clase, puestos + 1);
        lista.push(ordenados[i]);
      }
    }
    return lista;
  }

  /** Para ordenar: S de mayor a menor, después C de mayor a menor y después id. */
  static comparar(a, b) {
    if (Math.abs(b.getRelevancia() - a.getRelevancia()) > SeleccionadorNodos.TOLERANCIA) {
      return b.getRelevancia() - a.getRelevancia();
    }
    if (Math.abs(b.getCerteza() - a.getCerteza()) > SeleccionadorNodos.TOLERANCIA) {
      return b.getCerteza() - a.getCerteza();
    }
    if (a.getEntidad().getId() < b.getEntidad().getId()) {
      return -1;
    }
    return 1;
  }
}
