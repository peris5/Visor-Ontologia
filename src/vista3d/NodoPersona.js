import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/**
 * Una persona se dibuja como una ESFERA AZUL. Cada tipo tiene una forma
 * distinta, no solo un color, para que se distingan también sin ver los
 * colores (por ejemplo, personas con daltonismo).
 */
export class NodoPersona extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} esfera de radio 1.
   */
  _crearGeometria() {
    return new THREE.SphereGeometry(1, 32, 16);
  }

  _getColor() {
    return "#4c8bf5";
  }
}
