import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/**
 * NodoObra extends NodoVisual
 *
 * Una obra de arte se dibuja como un OCTAEDRO VERDE.
 *
 * Requisitos: RF-19, RNF-26.
 */
export class NodoObra extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} octaedro de radio 1,3.
   */
  _crearGeometria() {
    return new THREE.OctahedronGeometry(1.3);
  }

  /**
   * @returns {string}
   */
  _getColor() {
    return "#2bb673";
  }
}
