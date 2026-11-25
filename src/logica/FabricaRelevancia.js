import { EquivalenciasTipos } from './EquivalenciasTipos.js';
import { RelevanciaCompuesta } from './RelevanciaCompuesta.js';
import { CalculadorEvidencia } from './CalculadorEvidencia.js';
import { TablaTransferencia } from './TablaTransferencia.js';
import { CompatibilidadTemporal } from './CompatibilidadTemporal.js';
import { PenalizacionGrado } from './PenalizacionGrado.js';
import { PropagacionDesdeDirectos } from './PropagacionDesdeDirectos.js';
import { SeleccionadorNodos } from './SeleccionadorNodos.js';
import { RelevanciaNodosTresCapas } from './RelevanciaNodosTresCapas.js';
import { RelevanciaNodosMejorCamino } from './RelevanciaNodosMejorCamino.js';

/**
 * Crea y conecta las piezas del cálculo de la relevancia a partir de una
 * configuración (public/relevancia.json). La usan la aplicación, el
 * laboratorio y las pruebas: así las tres calculan con exactamente las
 * mismas clases, montadas igual.
 */
export class FabricaRelevancia {
  /**
   * @param {Object} configuracion - la de public/relevancia.json.
   * @param {Object} jerarquia - etiqueta → padres (de /api/jerarquia). Opcional.
   * @returns {Object} { equivalencias, compuesta, temporal, tabla, calculador, penalizacion, propagacion, seleccionador,
   *   estrategia (la elegida con estrategiaNodos) }
   */
  static crear(configuracion, jerarquia) {
    const equivalencias = new EquivalenciasTipos(configuracion, jerarquia);
    const compuesta = new RelevanciaCompuesta(configuracion, equivalencias);
    const temporal = new CompatibilidadTemporal(configuracion, equivalencias);
    const tabla = new TablaTransferencia(configuracion, jerarquia, temporal, equivalencias);
    const calculador = new CalculadorEvidencia(compuesta, configuracion, tabla);
    const penalizacion = new PenalizacionGrado(configuracion);
    const propagacion = new PropagacionDesdeDirectos(configuracion, tabla, penalizacion, calculador);
    let estrategia = null;
    if (configuracion.estrategiaNodos === "mejorCamino") {
      estrategia = new RelevanciaNodosMejorCamino(calculador);
    } else {
      estrategia = new RelevanciaNodosTresCapas(calculador, propagacion, penalizacion);
    }
    return {
      equivalencias: equivalencias, compuesta: compuesta, temporal: temporal, tabla: tabla, calculador: calculador,
      penalizacion: penalizacion, propagacion: propagacion,
      seleccionador: new SeleccionadorNodos(configuracion.cuotasPorClase), estrategia: estrategia
    };
  }
}
