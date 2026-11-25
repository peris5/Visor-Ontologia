import { TablaTransferencia } from './TablaTransferencia.js';
import { PenalizacionGrado } from './PenalizacionGrado.js';
import { CompatibilidadTemporal } from './CompatibilidadTemporal.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { ResultadoRelevanciaNodo } from '../modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * Capa 3 de la relevancia: la DEDUCCIÓN a dos saltos.
 *
 * Los nodos sin evidencia propia con la central (o con muy poca: menos que
 * umbralDirecto) solo entran a través de un nodo DIRECTO P, y lo que se
 * transmite depende de la PAREJA DE TIPOS del camino (tabla T): la obra de
 * tu maestro (Mentoría:maestro > Creación, T = 0,8) dice mucho de ti; la
 * obra de un amigo (Amistad > Creación, T = 0,2), poco.
 *
 * Para cada directo P y cada vecino Z de P que no es la central ni otro directo:
 *
 *   dR = R(P) · F(P,Z) · T̄(c,P → tipo(P,Z)) · fE(Z) · h(P) · τ(c,P,Z)
 *   dC = C(P) · C(P,Z) · δ
 *
 *   R(Z) = 1 − (1 − F(c,Z)·fE(Z)) × Π (1 − dR_k)      F(c,Z) = 0 si Z no tiene evidencia propia
 *   C(Z) = 1 − (1 − C(c,Z))       × Π (1 − dC_k)
 *
 *  - R(P), C(P): fuerza y certeza del padre (ya reforzadas, RefuerzoEntreDirectos);
 *  - h(P): penalización de los intermediarios muy conectados (PenalizacionGrado);
 *  - τ: compatibilidad temporal del camino (CompatibilidadTemporal);
 *  - δ (delta): el descuento por deducir: lo deducido es menos seguro.
 *
 * Nunca se deduce a tres saltos o más: Z tiene que ser vecino de un directo.
 *
 * ¿Por qué un deducido sin evidencia propia nunca supera a su padre? Todos
 * los factores de dR (F, T̄, fE, h, τ) y de dC (C, δ) están en [0, 1], así
 * que dR ≤ R(P) y dC ≤ C(P): con un solo padre, S(Z) = dR · dC ≤ R(P) · C(P)
 * = S(P). Con VARIOS padres, el «o» de probabilidades podría pasar del
 * mejor de ellos (tres maestros de S = 0,9 autores de la misma obra darían
 * ≈ 0,95); para que la regla se cumpla siempre, si un deducido sin
 * evidencia propia supera al mejor padre se le baja la fuerza R hasta
 * igualarlo (S = S del mejor padre). Esto no está en el prototipo y en su
 * ejemplo no cambia nada (allí todos los deducidos tienen un solo padre).
 */
export class DeduccionPorTipos {
  #delta;
  #tabla;
  #penalizacion;
  #temporal;
  #calculador;

  /**
   * @param {Object} configuracion - { delta }
   * @param {TablaTransferencia} tabla - T̄ y factorEntidad.
   * @param {PenalizacionGrado} penalizacion - h.
   * @param {CompatibilidadTemporal} temporal - τ.
   * @param {CalculadorEvidencia} calculador - los textos de la explicación.
   */
  constructor(configuracion, tabla, penalizacion, temporal, calculador) {
    if (!(tabla instanceof TablaTransferencia) || !(penalizacion instanceof PenalizacionGrado) ||
      !(temporal instanceof CompatibilidadTemporal) || !(calculador instanceof CalculadorEvidencia)) {
      throw new Error("DeduccionPorTipos necesita una TablaTransferencia, una PenalizacionGrado, una " +
        "CompatibilidadTemporal y un CalculadorEvidencia.");
    }
    if (typeof configuracion.delta !== "number" || configuracion.delta < 0 || configuracion.delta > 1) {
      throw new Error("En public/relevancia.json, delta debe ser un número entre 0 y 1.");
    }
    this.#delta = configuracion.delta;
    this.#tabla = tabla;
    this.#penalizacion = penalizacion;
    this.#temporal = temporal;
    this.#calculador = calculador;
  }

  /**
   * Los nodos deducidos.
   *
   * @param {Entidad} central
   * @param {Entidad[]} directos
   * @param {Map<string, number>} fuerzas - R de cada directo (RefuerzoEntreDirectos).
   * @param {Map<string, number>} certezas - C de cada directo.
   * @param {Map<string, Map<string, EvidenciaPareja>>} evidencias - dirigidas (idDesde → idHacia → evidencia).
   * @returns {Map<string, ResultadoRelevanciaNodo>} los deducidos con fuerza > 0.
   */
  deducir(central, directos, fuerzas, certezas, evidencias) {
    const idCentral = central.getId();
    const esDirecto = new Set();
    for (let i = 0; i < directos.length; i++) {
      esDirecto.add(directos[i].getId());
    }
    let deLaCentral = new Map();
    if (evidencias.has(idCentral)) {
      deLaCentral = evidencias.get(idCentral);
    }

    // id de cada deducido → { entidad, aportaciones: [{ padre, dR, dC, transmite, sPadre, texto }] }
    const candidatos = new Map();
    for (let i = 0; i < directos.length; i++) {
      const padre = directos[i];
      const idPadre = padre.getId();
      let vecinos = new Map();
      if (evidencias.has(idPadre)) {
        vecinos = evidencias.get(idPadre);
      }
      const primerTramo = deLaCentral.get(idPadre);
      const h = this.#penalizacion.getFactor(padre, vecinos.size);
      const rPadre = fuerzas.get(idPadre);
      const cPadre = certezas.get(idPadre);
      for (const [idHijo, segundoTramo] of vecinos) {
        if (idHijo !== idCentral && !esDirecto.has(idHijo)) {
          const hijo = segundoTramo.getHacia();
          const transmite = segundoTramo.getFuerza() *
            this.#tabla.getTEfectiva(primerTramo, segundoTramo.getTipoPrincipal()) *
            this.#tabla.getFactorEntidad(hijo) * h * this.#temporal.getFactor(primerTramo, segundoTramo);
          if (!candidatos.has(idHijo)) {
            candidatos.set(idHijo, { entidad: hijo, aportaciones: [] });
          }
          candidatos.get(idHijo).aportaciones.push({
            padre: padre,
            dR: rPadre * transmite,
            dC: cPadre * segundoTramo.getCerteza() * this.#delta,
            transmite: transmite,
            sPadre: rPadre * cPadre,
            texto: segundoTramo.getTipoPrincipal().getNombre() + " de " + padre.getNombre() + " (" +
              this.#calculador.textoVinculo(primerTramo) + ")"
          });
        }
      }
    }

    const resultados = new Map();
    for (const [idHijo, candidato] of candidatos) {
      const resultado = this.#crearResultado(candidato, deLaCentral.get(idHijo));
      if (resultado.getFuerza() > 0) {
        resultados.set(idHijo, resultado);
      }
    }
    return resultados;
  }

  /**
   * El ResultadoRelevanciaNodo de un deducido: combina sus aportaciones con
   * su evidencia propia (si tiene). Los padres y la explicación van de más a
   * menos aportación; si coincide también con la central, se añaden esas
   * coincidencias.
   *
   * @param {EvidenciaPareja|undefined} propia - Z visto desde la central, si tiene.
   */
  #crearResultado(candidato, propia) {
    let rPropia = 0;
    let cPropia = 0;
    if (propia !== undefined) {
      rPropia = propia.getFuerza() * this.#tabla.getFactorEntidad(candidato.entidad);
      cPropia = propia.getCerteza();
    }
    const aportaciones = [];
    for (let i = 0; i < candidato.aportaciones.length; i++) {
      aportaciones.push(candidato.aportaciones[i]);
    }
    aportaciones.sort(function (a, b) {
      return b.dR - a.dR;
    });
    let productoR = 1 - rPropia;
    let productoC = 1 - cPropia;
    let mejorPadre = 0;
    const padres = [];
    const explicacion = [];
    const transmisiones = new Map();
    for (let i = 0; i < aportaciones.length; i++) {
      const aportacion = aportaciones[i];
      productoR = productoR * (1 - aportacion.dR);
      productoC = productoC * (1 - aportacion.dC);
      if (aportacion.sPadre > mejorPadre) {
        mejorPadre = aportacion.sPadre;
      }
      padres.push(aportacion.padre);
      explicacion.push(aportacion.texto);
      transmisiones.set(aportacion.padre.getId(), aportacion.transmite);
    }
    let fuerza = 1 - productoR;
    const certeza = 1 - productoC;
    // Nunca por encima del mejor padre si no tiene evidencia propia (ver la explicación de la clase).
    if (rPropia === 0 && certeza > 0 && fuerza * certeza > mejorPadre) {
      fuerza = mejorPadre / certeza;
    }
    if (propia !== undefined) {
      const coincidencias = this.#calculador.textoCoincidencias(propia);
      if (coincidencias !== "") {
        explicacion.push("Coinciden en " + coincidencias);
      }
    }
    return new ResultadoRelevanciaNodo({
      entidad: candidato.entidad,
      fuerza: fuerza,
      certeza: certeza,
      origen: OrigenRelevancia.DEDUCIDA,
      explicacion: explicacion,
      padres: padres,
      evidenciaPropia: rPropia * cPropia,
      transmisiones: transmisiones
    });
  }
}
