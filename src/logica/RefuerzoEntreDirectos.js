import { TablaTransferencia } from './TablaTransferencia.js';
import { PenalizacionGrado } from './PenalizacionGrado.js';

/**
 * Capas 1 y 2 de la relevancia: los nodos DIRECTOS (los que tienen evidencia
 * propia con la central) y el REFUERZO SIMÉTRICO entre ellos.
 *
 * Si dos contactos directos de la central están relacionados entre sí, cada
 * uno hace más relevante al otro: el amigo de Ana que además es amigo de su
 * coexpositora hace a esa coexpositora más importante para Ana.
 *
 *   R(X) = 1 − (1 − F(c,X)·fE(X)) × Π_Y (1 − F(c,Y)·fE(Y) · F(Y,X) · T̄(c,Y → tipo(Y,X)) · fE(X) · h(Y))
 *   C(X) = 1 − (1 − C(c,X))       × Π_Y (1 − C(c,Y) · C(Y,X) · κ)
 *
 * con Y = cada OTRO directo que tiene relación con X, y:
 *  - F y C: fuerza y certeza de cada pareja (CalculadorEvidencia);
 *  - fE: factorEntidad; T̄: transferencia efectiva (TablaTransferencia);
 *  - h(Y): penalización de los intermediarios muy conectados (PenalizacionGrado);
 *  - κ: el CIERRE TRIÁDICO (cierreTriadico): ser amigo de alguien que
 *    conoces hace más probable que te conozca (Kossinets y Watts, 2006).
 *
 * Cada directo recibe de TODOS los demás con los que tiene relación usando
 * la evidencia PROPIA del otro (F(c,Y), C(c,Y)), no su valor ya reforzado.
 * Es UN SOLO PASO, sin iterar y sin orden. Por eso:
 *  - añadir una relación solo añade un factor (1 − algo) ≤ 1 al producto:
 *    nadie baja (P1);
 *  - el primer factor es la evidencia propia: nadie queda por debajo (P2);
 *  - el resultado no depende del orden de la lista: dos nodos en la misma
 *    situación reciben lo mismo (P9).
 *
 * ¿Por qué NO un circuito eléctrico (la versión anterior)? En un circuito la
 * tensión de cada nodo es una MEDIA de la de sus vecinos: conectar un nodo a
 * otro con menos tensión le quita corriente. Así, añadir una relación podía
 * BAJAR a alguien (en el ejemplo, Luis pasaba de 0,76 a 0,72 por ser amigo
 * de Marta), y el resultado dependía de vueltas y tolerancias. Un modo de
 * «o» de probabilidades solo suma.
 */
export class RefuerzoEntreDirectos {
  #tabla;
  #penalizacion;
  #cierreTriadico;

  /**
   * @param {Object} configuracion - { cierreTriadico }
   * @param {TablaTransferencia} tabla - T̄ y factorEntidad.
   * @param {PenalizacionGrado} penalizacion - h.
   */
  constructor(configuracion, tabla, penalizacion) {
    if (!(tabla instanceof TablaTransferencia) || !(penalizacion instanceof PenalizacionGrado)) {
      throw new Error("RefuerzoEntreDirectos necesita una TablaTransferencia y una PenalizacionGrado.");
    }
    if (typeof configuracion.cierreTriadico !== "number" || configuracion.cierreTriadico < 0 ||
      configuracion.cierreTriadico > 1) {
      throw new Error("En public/relevancia.json, cierreTriadico debe ser un número entre 0 y 1.");
    }
    this.#tabla = tabla;
    this.#penalizacion = penalizacion;
    this.#cierreTriadico = configuracion.cierreTriadico;
  }

  /**
   * @param {Entidad} central
   * @param {Entidad[]} directos
   * @param {Map<string, Map<string, EvidenciaPareja>>} evidencias - dirigidas:
   *   idDesde → (idHacia → evidencia); con todas las relaciones de cada
   *   directo, así evidencias.get(id).size es su grado exacto.
   * @returns {Object} { fuerzas: Map<id, R>, certezas: Map<id, C>,
   *   transmisiones: Map<id, Map<idOtro, peso>> }. La transmisión de una
   *   pareja de directos es el mayor de los dos sentidos de
   *   F(Y,X) · T̄ · fE(X) · h(Y) (el peso de su muelle en el dibujo).
   */
  calcular(central, directos, evidencias) {
    const deLaCentral = evidencias.get(central.getId());
    const esDirecto = new Map();
    for (let i = 0; i < directos.length; i++) {
      esDirecto.set(directos[i].getId(), directos[i]);
    }
    const fuerzas = new Map();
    const certezas = new Map();
    const transmisiones = new Map();
    for (let i = 0; i < directos.length; i++) {
      transmisiones.set(directos[i].getId(), new Map());
    }

    for (let i = 0; i < directos.length; i++) {
      const x = directos[i];
      const idX = x.getId();
      const propiaX = deLaCentral.get(idX);
      const fEX = this.#tabla.getFactorEntidad(x);
      let productoR = 1 - propiaX.getFuerza() * fEX;
      let productoC = 1 - propiaX.getCerteza();
      let vecinosDeX = new Map();
      if (evidencias.has(idX)) {
        vecinosDeX = evidencias.get(idX);
      }
      // Solo los otros directos relacionados con X (recorrer sus vecinos es
      // más rápido que probar todos los directos, y el orden da igual).
      for (const idY of vecinosDeX.keys()) {
        if (idY !== idX && esDirecto.has(idY)) {
          const y = esDirecto.get(idY);
          const deYaX = evidencias.get(idY).get(idX);
          const propiaY = deLaCentral.get(idY);
          const transmite = deYaX.getFuerza() * this.#tabla.getTEfectiva(propiaY, deYaX.getTipoPrincipal()) * fEX *
            this.#penalizacion.getFactor(y, evidencias.get(idY).size);
          productoR = productoR * (1 - propiaY.getFuerza() * this.#tabla.getFactorEntidad(y) * transmite);
          productoC = productoC * (1 - propiaY.getCerteza() * deYaX.getCerteza() * this.#cierreTriadico);
          RefuerzoEntreDirectos.#apuntarMayor(transmisiones, idX, idY, transmite);
          RefuerzoEntreDirectos.#apuntarMayor(transmisiones, idY, idX, transmite);
        }
      }
      fuerzas.set(idX, 1 - productoR);
      certezas.set(idX, 1 - productoC);
    }
    return { fuerzas: fuerzas, certezas: certezas, transmisiones: transmisiones };
  }

  /** Guarda el peso de la pareja si es mayor que el que había. */
  static #apuntarMayor(transmisiones, idUno, idOtro, peso) {
    const delUno = transmisiones.get(idUno);
    if (!delUno.has(idOtro) || peso > delUno.get(idOtro)) {
      delUno.set(idOtro, peso);
    }
  }
}
