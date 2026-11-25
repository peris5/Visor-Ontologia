import { FabricaRelevancia } from '../logica/FabricaRelevancia.js';
import { GestorSubgrafos } from '../logica/GestorSubgrafos.js';
import { MedidasRelevancia } from './MedidasRelevancia.js';
import { AnalizadorTipos } from './AnalizadorTipos.js';

/**
 * Mide una muestra de entidades con una configuración, usando LAS MISMAS
 * clases que la aplicación: GestorSubgrafos carga las relaciones (dos tandas
 * por entidad, con la caché) y construye el subgrafo que se dibujaría. Lo
 * que se mide es lo que hace la aplicación.
 *
 * La caché se empieza de nuevo cada ENTIDADES_POR_CACHE entidades: con los
 * datos grandes, toda la muestra en una sola ocuparía demasiada memoria.
 */
export class MedidorMuestra {
  static ENTIDADES_POR_CACHE = 25;

  #cliente;
  #contexto;
  #jerarquia;
  #umbral;
  #maxNodos;

  /**
   * @param {ClienteServicio} cliente
   * @param {Object} contexto - { idioma, nombresTipos, etiquetasEntidad, tipos }
   * @param {Object} jerarquia - etiqueta → padres.
   * @param {number} umbral - con el que se decide quién entra.
   * @param {number} maxNodos - máximo del subgrafo.
   */
  constructor(cliente, contexto, jerarquia, umbral, maxNodos) {
    this.#cliente = cliente;
    this.#contexto = contexto;
    this.#jerarquia = jerarquia;
    this.#umbral = umbral;
    this.#maxNodos = maxNodos;
  }

  /**
   * @param {Object} muestra - la de /api/muestra: { ids, intermediariosIgnorados, eventosJuntados }.
   * @param {Object} configuracion - la de public/relevancia.json.
   * @param {Function} alAvanzar - opcional: recibe cuántas van.
   * @returns {Promise<Object>} el resumen de MedidasRelevancia, con «tipos» (las tablas de AnalizadorTipos).
   */
  async medir(muestra, configuracion, alAvanzar) {
    const ids = muestra.ids;
    const piezas = FabricaRelevancia.crear(configuracion, this.#jerarquia);
    const medidas = new MedidasRelevancia(piezas, configuracion, this.#jerarquia, this.#maxNodos);
    const analizador = new AnalizadorTipos(piezas, configuracion, this.#jerarquia, this.#contexto.etiquetasEntidad);
    let gestor = null;
    for (let i = 0; i < ids.length; i++) {
      if (i % MedidorMuestra.ENTIDADES_POR_CACHE === 0) {
        if (gestor !== null) {
          analizador.anotarCache(gestor.getCache());
        }
        gestor = this.crearGestor(piezas);
      }
      const subgrafo = await gestor.obtenerSubgrafo(ids[i], this.#umbral);
      medidas.anotar(subgrafo, gestor.getResultados(), gestor.getCache(), gestor.getEstadisticas().directos,
        gestor.getMilisegundosUltimoCalculo());
      analizador.anotarCamino(subgrafo.getEntidadCentral(), gestor.getCache());
      if (typeof alAvanzar === "function") {
        await alAvanzar(i + 1);
      }
    }
    if (gestor !== null) {
      analizador.anotarCache(gestor.getCache());
    }
    const resumen = medidas.resumen();
    resumen.tipos = analizador.resumen(muestra);
    return resumen;
  }

  /**
   * Un GestorSubgrafos como el de la aplicación, con la caché vacía.
   *
   * @param {Object} piezas - las de FabricaRelevancia.
   */
  crearGestor(piezas) {
    return new GestorSubgrafos(this.#cliente, piezas.estrategia, piezas.calculador, this.#maxNodos, this.#contexto, true,
      piezas.seleccionador);
  }
}
