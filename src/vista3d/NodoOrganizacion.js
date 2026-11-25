import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/** Una organización se dibuja como un CUBO NARANJA. */
export class NodoOrganizacion extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} cubo de lado 1,6.
   */
  _crearGeometria() {
    return new THREE.BoxGeometry(1.6, 1.6, 1.6);
  }

  _getColor() {
    return "#f5a623";
  }
}
