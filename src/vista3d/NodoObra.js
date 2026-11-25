import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/** Una obra de arte se dibuja como un OCTAEDRO VERDE. */
export class NodoObra extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} octaedro de radio 1,3.
   */
  _crearGeometria() {
    return new THREE.OctahedronGeometry(1.3);
  }

  _getColor() {
    return "#2bb673";
  }
}
