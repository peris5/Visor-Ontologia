import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';

/**
 * NodoOrganizacion extends NodoVisual
 *
 * Una organización se dibuja como un CUBO NARANJA.
 *
 * Requisitos: RF-19, RNF-26.
 */
export class NodoOrganizacion extends NodoVisual {
  /**
   * @returns {THREE.BufferGeometry} cubo de lado 1,6.
   */
  _crearGeometria() {
    return new THREE.BoxGeometry(1.6, 1.6, 1.6);
  }

  /**
   * @returns {string}
   */
  _getColor() {
    return "#f5a623";
  }
}
