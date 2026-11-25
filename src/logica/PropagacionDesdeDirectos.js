import { TablaTransferencia } from './TablaTransferencia.js';
import { PenalizacionGrado } from './PenalizacionGrado.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { ResultadoRelevanciaNodo } from '../modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * Capas 1 a 3 de la relevancia: UNA SOLA FÓRMULA para todos los nodos, la
 * propagación desde los nodos directos. Para cada X distinto de la central
 * c que sea vecino de c o de algún directo:
 *
 *   R(X) = 1 − (1 − R₀(X)) × Π_Y (1 − fE(Y) · Tr(c,Y → Y,X) · F(Y,X) · fE(X) · h(Y, t))
 *   C(X) = 1 − (1 − C₀(X)) × Π_Y (1 − C(c,Y) · C(Y,X) · δ)
 *
 *   R₀(X) = F(c,X) · fE(X)     C₀(X) = C(c,X)     (0 si X no tiene evidencia con c)
 *
 * con Y = cada directo distinto de X que tiene relación con X, y:
 *  - F y C: fuerza y certeza de cada pareja (CalculadorEvidencia);
 *  - Tr: lo que transmite el primer tramo, con T y τ, y fE: el factor de
 *    entidad (TablaTransferencia);
 *  - h(Y, t): la penalización por grado, con t = tipo principal de Y–X
 *    (PenalizacionGrado);
 *  - δ: el DESCUENTO POR TRANSITIVIDAD, la certeza de que algo vale para la
 *    central por venir de un directo seguro. Vale lo mismo para «amigo de tu
 *    amigo» (cierre triádico, Kossinets y Watts, 2006) que para «obra de tu
 *    maestro».
 *
 * SER DIRECTO SOLO DECIDE QUIÉN TRANSMITE. La fórmula del que recibe es la
 * misma para todos, así que cruzar el umbral de directo no hace bajar a
 * nadie (P10). En la v2, los directos (refuerzo) y los deducidos (deducción)
 * usaban fórmulas distintas, y un nodo que ganaba evidencia y pasaba a ser
 * directo podía bajar.
 *
 * UN SOLO PASO, sin iterar y sin orden: cada nodo recibe de los directos
 * usando la evidencia PROPIA de cada uno, F(c,Y) y C(c,Y), no su valor ya
 * reforzado. Por eso:
 *  - añadir una relación entre dos nodos que no la tenían solo añade
 *    factores (1 − algo) ≤ 1 al producto (P1). Hay dos matices: un contacto
 *    más puede bajar un poco h, y añadir un tipo MÁS FUERTE a una pareja
 *    Y–X que ya tenía relación puede cambiar su tipo principal, y con él la
 *    T del segundo tramo (el prototipo hace lo mismo);
 *  - el primer factor es la evidencia propia: nadie queda por debajo (P2);
 *  - un producto no depende del orden: dos nodos en la misma situación
 *    reciben lo mismo (P9).
 * Nunca se llega a tres saltos, porque solo transmiten los directos.
 *
 * ¿Por qué un nodo sin evidencia propia y con UN SOLO directo Y nunca supera
 * a ese directo? Tr ≤ F(c,Y), porque T ≤ 1 y τ ≤ 1, y los demás factores (F,
 * fE, h, C, δ) están en [0, 1]: R(X) ≤ fE(Y) · F(c,Y) ≤ R(Y) y C(X) ≤ C(Y)
 * (P3). Con varios directos sí puede pasarlo: son varias fuentes
 * independientes que apuntan a lo mismo.
 *
 * ¿Por qué NO un circuito eléctrico? En un circuito la tensión de cada nodo
 * es una MEDIA de la de sus vecinos: conectar un nodo a otro con menos
 * tensión le quita corriente, así que añadir una relación podía BAJAR a
 * alguien. Un «o» de probabilidades solo suma.
 *
 * RECORRIENDO VECINOS. calcular recorre, para cada directo Y, sus vecinos X,
 * y acumula 1 − aportación en un mapa por nodo. No cruza todos los
 * candidatos con todos los directos: la mayoría de esos cruces no tienen
 * relación. El resultado es el mismo (es un producto, el orden no importa) y
 * en la simulación con 25.000 entidades pasa de 290 ms a unos 30 ms de
 * mediana por entidad. calcularReferencia es la fórmula escrita tal cual:
 * solo la usan las pruebas (P0) y el laboratorio, para comprobarlo.
 */
export class PropagacionDesdeDirectos {
  #delta;
  #tabla;
  #penalizacion;
  #calculador;

  /**
   * @param {Object} configuracion - { delta }
   * @param {TablaTransferencia} tabla - Tr y factorEntidad.
   * @param {PenalizacionGrado} penalizacion - h.
   * @param {CalculadorEvidencia} calculador - la evidencia propia de cada nodo.
   */
  constructor(configuracion, tabla, penalizacion, calculador) {
    if (!(tabla instanceof TablaTransferencia) || !(penalizacion instanceof PenalizacionGrado) ||
      !(calculador instanceof CalculadorEvidencia)) {
      throw new Error("PropagacionDesdeDirectos necesita una TablaTransferencia, una PenalizacionGrado y un " +
        "CalculadorEvidencia.");
    }
    if (typeof configuracion.delta !== "number" || configuracion.delta < 0 || configuracion.delta > 1) {
      throw new Error("En public/relevancia.json, delta debe ser un número entre 0 y 1.");
    }
    this.#delta = configuracion.delta;
    this.#tabla = tabla;
    this.#penalizacion = penalizacion;
    this.#calculador = calculador;
  }

  /**
   * @param {Entidad} central
   * @param {Entidad[]} directos
   * @param {Map<string, Map<string, EvidenciaPareja>>} evidencias - dirigidas,
   *   idDesde → (idHacia → evidencia), con «desde» = la central y cada directo.
   * @returns {Map<string, ResultadoRelevanciaNodo>} sin la central; los de fuerza > 0.
   */
  calcular(central, directos, evidencias) {
    const deLaCentral = PropagacionDesdeDirectos.#vecinosDe(evidencias, central);
    const acumulado = new Map();
    for (const [idX, propia] of deLaCentral) {
      const inicial = this.#inicial(propia);
      acumulado.set(idX, { entidad: propia.getHacia(), restoR: 1 - inicial.fuerza, restoC: 1 - inicial.certeza,
        aportaciones: [] });
    }
    for (let i = 0; i < directos.length; i++) {
      const y = directos[i];
      const primerTramo = deLaCentral.get(y.getId());
      for (const [idX, segundoTramo] of PropagacionDesdeDirectos.#vecinosDe(evidencias, y)) {
        if (idX !== central.getId()) {
          if (!acumulado.has(idX)) {
            acumulado.set(idX, { entidad: segundoTramo.getHacia(), restoR: 1, restoC: 1, aportaciones: [] });
          }
          const nodo = acumulado.get(idX);
          const aportacion = this.aportacion(primerTramo, segundoTramo);
          nodo.restoR = nodo.restoR * (1 - aportacion.fuerza);
          nodo.restoC = nodo.restoC * (1 - aportacion.certeza);
          nodo.aportaciones.push({ padre: y, fuerza: aportacion.fuerza });
        }
      }
    }
    return this.#empaquetar(directos, deLaCentral, acumulado);
  }

  /**
   * La misma fórmula escrita tal cual: cada candidato contra todos los
   * directos. Mucho más lenta; solo para comprobar calcular (P0).
   */
  calcularReferencia(central, directos, evidencias) {
    const deLaCentral = PropagacionDesdeDirectos.#vecinosDe(evidencias, central);
    const candidatos = new Map();
    for (const [idX, propia] of deLaCentral) {
      candidatos.set(idX, propia.getHacia());
    }
    for (let i = 0; i < directos.length; i++) {
      for (const [idX, evidencia] of PropagacionDesdeDirectos.#vecinosDe(evidencias, directos[i])) {
        if (idX !== central.getId()) {
          candidatos.set(idX, evidencia.getHacia());
        }
      }
    }
    const acumulado = new Map();
    for (const [idX, x] of candidatos) {
      let r0 = 0;
      let c0 = 0;
      if (deLaCentral.has(idX)) {
        const inicial = this.#inicial(deLaCentral.get(idX));
        r0 = inicial.fuerza;
        c0 = inicial.certeza;
      }
      let productoR = 1;
      let productoC = 1;
      const aportaciones = [];
      for (let i = 0; i < directos.length; i++) {
        const y = directos[i];
        const vecinosDeY = PropagacionDesdeDirectos.#vecinosDe(evidencias, y);
        if (y.getId() !== idX && vecinosDeY.has(idX)) {
          const aportacion = this.aportacion(deLaCentral.get(y.getId()), vecinosDeY.get(idX));
          productoR = productoR * (1 - aportacion.fuerza);
          productoC = productoC * (1 - aportacion.certeza);
          aportaciones.push({ padre: y, fuerza: aportacion.fuerza });
        }
      }
      acumulado.set(idX, { entidad: x, restoR: (1 - r0) * productoR, restoC: (1 - c0) * productoC,
        aportaciones: aportaciones });
    }
    return this.#empaquetar(directos, deLaCentral, acumulado);
  }

  /**
   * Lo que un directo Y aporta a un nodo X.
   *
   * @param {EvidenciaPareja} primerTramo - Y visto desde la central.
   * @param {EvidenciaPareja} segundoTramo - X visto desde Y.
   * @returns {Object} { fuerza: fE(Y) · Tr · F(Y,X) · fE(X) · h(Y, t), certeza: C(c,Y) · C(Y,X) · δ }
   */
  aportacion(primerTramo, segundoTramo) {
    const y = segundoTramo.getDesde();
    return {
      fuerza: this.#tabla.getFactorEntidad(y) * this.#tabla.getTransmision(primerTramo, segundoTramo) *
        segundoTramo.getFuerza() * this.#tabla.getFactorEntidad(segundoTramo.getHacia()) *
        this.#penalizacion.getFactor(y, segundoTramo.getTipoPrincipal()),
      certeza: primerTramo.getCerteza() * segundoTramo.getCerteza() * this.#delta
    };
  }

  /** R₀ y C₀ de un vecino de la central. */
  #inicial(propia) {
    return { fuerza: propia.getFuerza() * this.#tabla.getFactorEntidad(propia.getHacia()), certeza: propia.getCerteza() };
  }

  /**
   * Los ResultadoRelevanciaNodo. Los padres, de más a menos aportación (a
   * igual aportación, por id: así no depende del orden de los directos).
   */
  #empaquetar(directos, deLaCentral, acumulado) {
    const esDirecto = new Set();
    for (let i = 0; i < directos.length; i++) {
      esDirecto.add(directos[i].getId());
    }
    const resultados = new Map();
    for (const [idX, nodo] of acumulado) {
      const fuerza = 1 - nodo.restoR;
      if (fuerza > 0) {
        nodo.aportaciones.sort(PropagacionDesdeDirectos.#compararAportaciones);
        const padres = [];
        const transmisiones = new Map();
        for (let i = 0; i < nodo.aportaciones.length; i++) {
          padres.push(nodo.aportaciones[i].padre);
          transmisiones.set(nodo.aportaciones[i].padre.getId(), nodo.aportaciones[i].fuerza);
        }
        let evidenciaPropia = 0;
        let origen = OrigenRelevancia.DEDUCIDA;
        if (deLaCentral.has(idX)) {
          const propia = deLaCentral.get(idX);
          evidenciaPropia = this.#calculador.valorPropio(propia);
          if (esDirecto.has(idX)) {
            origen = OrigenRelevancia.COINCIDENCIAS;
            if (propia.esDeclarada()) {
              origen = OrigenRelevancia.DECLARADA;
            }
          }
        }
        resultados.set(idX, new ResultadoRelevanciaNodo({
          entidad: nodo.entidad, fuerza: fuerza, certeza: 1 - nodo.restoC, origen: origen, explicacion: [],
          padres: padres, evidenciaPropia: evidenciaPropia, transmisiones: transmisiones
        }));
      }
    }
    return resultados;
  }

  static #compararAportaciones(a, b) {
    if (b.fuerza !== a.fuerza) {
      return b.fuerza - a.fuerza;
    }
    if (a.padre.getId() < b.padre.getId()) {
      return -1;
    }
    return 1;
  }

  /** La evidencia de cada vecino vista desde la entidad (vacío si no hay). */
  static #vecinosDe(evidencias, entidad) {
    if (evidencias.has(entidad.getId())) {
      return evidencias.get(entidad.getId());
    }
    return new Map();
  }
}
