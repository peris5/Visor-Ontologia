import { TipoEntidad } from '../modelo/TipoEntidad.js';
import { NodoPersona } from './NodoPersona.js';
import { NodoOrganizacion } from './NodoOrganizacion.js';
import { NodoObra } from './NodoObra.js';

/**
 * FabricaNodosVisuales
 *
 * Crea el NodoVisual que corresponde a cada NodoRelevante (patrón Fábrica):
 * la subclase según el tipo de entidad y el tamaño según su centralidad.
 * Así EscenaGrafo no tiene que saber qué clase concreta usar.
 *
 * Requisitos: RF-18 (un objeto 3D por nodo), RF-19 (forma según el tipo),
 * RF-37 (tamaño según la centralidad).
 */
export class FabricaNodosVisuales {
  #tamanoMinimo;
  #tamanoMaximo;

  constructor() {
    this.#tamanoMinimo = 0.45;
    this.#tamanoMaximo = 1.8;
  }

  /**
   * @param {NodoRelevante} nodo
   * @returns {NodoVisual}
   */
  crear(nodo) {
    const tamano = this.#calcularTamano(nodo.getCentralidad());
    const tipo = nodo.getEntidad().getTipo();
    if (tipo === TipoEntidad.PERSONA) {
      return new NodoPersona(nodo, tamano);
    }
    if (tipo === TipoEntidad.ORGANIZACION) {
      return new NodoOrganizacion(nodo, tamano);
    }
    if (tipo === TipoEntidad.OBRA_DE_ARTE) {
      return new NodoObra(nodo, tamano);
    }
    throw new Error("No hay forma 3D para el tipo de entidad \"" + tipo + "\".");
  }

  /**
   * (Privado) Tamaño = mínimo + (máximo − mínimo) · √centralidad.
   *
   * ¿Por qué la raíz cuadrada? La centralidad está normalizada con el nodo
   * más conectado (que vale 1, casi siempre la central), así que la mayoría
   * de los nodos tienen valores pequeños (0,1, 0,2...). Con una escala lineal
   * casi todos serían diminutos al lado del central. La raíz cuadrada "estira"
   * los valores pequeños (√0,1 ≈ 0,32; √0,25 = 0,5) y deja igual el 0 y el 1,
   * así las diferencias entre nodos poco conectados también se ven.
   *
   * @param {number} centralidad - entre 0 y 1.
   * @returns {number}
   */
  #calcularTamano(centralidad) {
    let centralidadAcotada = centralidad;
    if (typeof centralidadAcotada !== "number" || Number.isNaN(centralidadAcotada) || centralidadAcotada < 0) {
      centralidadAcotada = 0;
    }
    if (centralidadAcotada > 1) {
      centralidadAcotada = 1;
    }
    return this.#tamanoMinimo + (this.#tamanoMaximo - this.#tamanoMinimo) * Math.sqrt(centralidadAcotada);
  }
}
