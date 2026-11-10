import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/**
 * NodoPersona extends NodoVisual
 *
 * Una persona se dibuja como una ESFERA AZUL. Cada tipo tiene una forma
 * distinta, no solo un color, para que se distingan también sin ver los
 * colores (por ejemplo, personas con daltonismo).
 *
 * Requisitos: RF-19, RNF-26.
 */
export class NodoPersona extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} esfera de radio 1.
   */
  _crearGeometria() {
    return new THREE.SphereGeometry(1, 32, 16);
  }

  /**
   * @returns {string}
   */
  _getColor() {
    return "#4c8bf5";
  }
}
