import { EstrategiaRelevanciaNodos } from './EstrategiaRelevanciaNodos.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { RefuerzoEntreDirectos } from './RefuerzoEntreDirectos.js';
import { DeduccionPorTipos } from './DeduccionPorTipos.js';
import { ResultadoRelevanciaNodo } from '../modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * La relevancia ARTÍSTICA de los nodos, en tres capas: mide cuánto ayuda
 * una entidad a entender la trayectoria y la obra de la entidad central.
 * Cada nodo termina con tres números: fuerza R, certeza C y relevancia
 * S = R × C (ver ResultadoRelevanciaNodo).
 *
 *  - Capa 0 (CalculadorEvidencia): la evidencia de cada pareja, vista desde
 *    cada lado, con TODAS sus relaciones y eventos, se dibujen o no.
 *  - Capas 1 y 2 (RefuerzoEntreDirectos): los nodos con evidencia propia
 *    con la central (F × C × fE ≥ umbralDirecto) son los DIRECTOS; los
 *    directos relacionados entre sí se refuerzan, en un solo paso simétrico.
 *  - Capa 3 (DeduccionPorTipos): los vecinos de los directos se DEDUCEN a
 *    dos saltos según la pareja de tipos del camino.
 *
 * Separar fuerza y certeza sigue la idea de la lógica subjetiva de Jøsang:
 * una probabilidad con un grado de incertidumbre, con un operador de
 * DESCUENTO para encadenar a lo largo de un camino (los productos de la
 * deducción) y otro de FUSIÓN para juntar varias fuentes (los «o» de
 * probabilidades).
 *
 * Solo usa las relaciones de la central y de sus directos, que tras las dos
 * tandas de GestorSubgrafos están TODAS en la caché: por eso el grado de
 * cada directo (el de la penalización h) es exacto.
 *
 * Los textos de la explicación nunca dicen que dos personas «se conozcan»
 * si no hay una relación declarada (RNF-23): solo que «coinciden».
 */
export class RelevanciaNodosTresCapas extends EstrategiaRelevanciaNodos {
  #calculador;
  #refuerzo;
  #deduccion;

  /**
   * @param {CalculadorEvidencia} calculador
   * @param {RefuerzoEntreDirectos} refuerzo
   * @param {DeduccionPorTipos} deduccion
   */
  constructor(calculador, refuerzo, deduccion) {
    super();
    if (!(calculador instanceof CalculadorEvidencia) || !(refuerzo instanceof RefuerzoEntreDirectos) ||
      !(deduccion instanceof DeduccionPorTipos)) {
      throw new Error("RelevanciaNodosTresCapas necesita un CalculadorEvidencia, un RefuerzoEntreDirectos y una " +
        "DeduccionPorTipos.");
    }
    this.#calculador = calculador;
    this.#refuerzo = refuerzo;
    this.#deduccion = deduccion;
  }

  calcular(central, cache) {
    const relacionesDeLaCentral = cache.relacionesDe(central.getId());
    const directos = this.#calculador.elegirDirectos(central, relacionesDeLaCentral).directos;

    // Las relaciones de la central y de sus directos: es todo lo que hace
    // falta para las tres capas.
    const todas = [];
    for (let i = 0; i < relacionesDeLaCentral.length; i++) {
      todas.push(relacionesDeLaCentral[i]);
    }
    for (let i = 0; i < directos.length; i++) {
      const delDirecto = cache.relacionesDe(directos[i].getId());
      for (let j = 0; j < delDirecto.length; j++) {
        todas.push(delDirecto[j]);
      }
    }
    const evidencias = this.#calculador.calcularVecinos(todas);
    const refuerzo = this.#refuerzo.calcular(central, directos, evidencias);

    const resultados = new Map();
    resultados.set(central.getId(), new ResultadoRelevanciaNodo({
      entidad: central, fuerza: 1, certeza: 1, origen: OrigenRelevancia.CENTRAL, explicacion: [], padres: [],
      evidenciaPropia: 1
    }));
    for (let i = 0; i < directos.length; i++) {
      const directo = directos[i];
      resultados.set(directo.getId(), this.#resultadoDirecto(central, directo, refuerzo, evidencias));
    }
    const deducidos = this.#deduccion.deducir(central, directos, refuerzo.fuerzas, refuerzo.certezas, evidencias);
    for (const [id, resultado] of deducidos) {
      resultados.set(id, resultado);
    }
    return resultados;
  }

  /**
   * El resultado de un nodo directo: R y C reforzadas, el origen (DECLARADA
   * o COINCIDENCIAS) y la explicación.
   *  - declarada: «Mentoría (su maestro)», o «Amistad · 5 exposiciones juntos»;
   *  - coincidencias: «Coinciden en 3 exposiciones · Amistad con Luis Peris»
   *    (la relación declarada con otro directo que más le transmite).
   */
  #resultadoDirecto(central, directo, refuerzo, evidencias) {
    const evidencia = evidencias.get(central.getId()).get(directo.getId());
    const transmisiones = refuerzo.transmisiones.get(directo.getId());
    const coincidencias = this.#calculador.textoCoincidencias(evidencia);
    const explicacion = [];
    let origen = OrigenRelevancia.COINCIDENCIAS;
    if (evidencia.esDeclarada()) {
      origen = OrigenRelevancia.DECLARADA;
      explicacion.push(this.#calculador.textoDeclaradas(evidencia));
      if (coincidencias !== "") {
        explicacion.push(coincidencias + " juntos");
      }
    } else {
      explicacion.push("Coinciden en " + coincidencias);
      const mejor = this.#mejorRefuerzoDeclarado(directo, transmisiones, evidencias);
      if (mejor !== "") {
        explicacion.push(mejor);
      }
    }
    return new ResultadoRelevanciaNodo({
      entidad: directo,
      fuerza: refuerzo.fuerzas.get(directo.getId()),
      certeza: refuerzo.certezas.get(directo.getId()),
      origen: origen,
      explicacion: explicacion,
      padres: [],
      evidenciaPropia: this.#calculador.valorPropio(evidencia),
      transmisiones: transmisiones
    });
  }

  /**
   * «Amistad con Luis Peris»: la relación DECLARADA con otro directo que
   * más transmite, o "" si no tiene ninguna.
   */
  #mejorRefuerzoDeclarado(directo, transmisiones, evidencias) {
    let mejorTexto = "";
    let mejorPeso = 0;
    const vecinos = evidencias.get(directo.getId());
    for (const [idOtro, peso] of transmisiones) {
      const evidencia = vecinos.get(idOtro);
      if (evidencia.esDeclarada() && peso > mejorPeso) {
        mejorPeso = peso;
        mejorTexto = this.#calculador.textoDeclaradas(evidencia) + " con " + evidencia.getHacia().getNombre();
      }
    }
    return mejorTexto;
  }
}
