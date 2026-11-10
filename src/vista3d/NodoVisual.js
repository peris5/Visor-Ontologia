import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * «abstract» NodoVisual
 *
 * Representación 3D de un NodoRelevante: una malla (forma + material) y una
 * etiqueta HTML con el nombre. Cada subclase decide su forma y su color
 * (NodoPersona, NodoOrganizacion, NodoObra).
 *
 * Es abstracta: no se puede hacer new NodoVisual(...).
 *
 * Requisitos: RF-18 (un objeto 3D por nodo), RF-19 (forma y color según el
 * tipo), RF-22 (etiqueta con el nombre).
 */
export class NodoVisual {
  // Protegidos (los usan las subclases).
  _malla;
  _etiqueta;
  _tamano;

  // Privados.
  #nodo;
  #etiquetaActiva;
  #visible;

  /**
   * @param {NodoRelevante} nodo
   * @param {number} tamano - escala de la forma (la calcula FabricaNodosVisuales).
   */
  constructor(nodo, tamano) {
    if (new.target === NodoVisual) {
      throw new Error("NodoVisual es una clase abstracta: crea un NodoPersona, un NodoOrganizacion o un NodoObra.");
    }
    this.#nodo = nodo;
    this.#etiquetaActiva = false;
    this.#visible = true;
    this._tamano = tamano;

    const material = new THREE.MeshStandardMaterial({
      color: this._getColor(),
      roughness: 0.45,
      metalness: 0.1
    });
    this._malla = new THREE.Mesh(this._crearGeometria(), material);
    this._malla.scale.setScalar(tamano);
    // Así, cuando en el incremento 3 se haga clic en una malla, se sabrá a qué nodo pertenece.
    this._malla.userData.visual = this;

    this._etiqueta = this.#crearEtiqueta(nodo);
    this._malla.add(this._etiqueta);
  }

  /**
   * @returns {NodoRelevante}
   */
  getNodo() {
    return this.#nodo;
  }

  /**
   * @returns {THREE.Mesh}
   */
  getMalla() {
    return this._malla;
  }

  /**
   * @returns {THREE.Vector3} copia de la posición.
   */
  getPosicion() {
    return this._malla.position.clone();
  }

  /**
   * @returns {boolean}
   */
  getVisible() {
    return this.#visible;
  }

  /**
   * @param {{x:number, y:number, z:number}} posicion
   */
  setPosicion(posicion) {
    this._malla.position.set(posicion.x, posicion.y, posicion.z);
  }

  /**
   * Muestra u oculta el nodo. CSS2DRenderer decide si muestra una etiqueta
   * mirando SOLO la visibilidad de la propia etiqueta (no la de su malla),
   * así que hay que actualizar las dos.
   *
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.#visible = visible;
    this._malla.visible = visible;
    this.#actualizarVisibilidadEtiqueta();
  }

  /**
   * Resalta el nodo: le da brillo y lo hace un 25 % más grande.
   *
   * @param {boolean} activo
   */
  resaltar(activo) {
    if (activo) {
      this._malla.material.emissive.setHex(0x555555);
      this._malla.scale.setScalar(this._tamano * 1.25);
    } else {
      this._malla.material.emissive.setHex(0x000000);
      this._malla.scale.setScalar(this._tamano);
    }
  }

  /**
   * @param {boolean} visible - true para mostrar el nombre.
   */
  mostrarEtiqueta(visible) {
    this.#etiquetaActiva = visible;
    this.#actualizarVisibilidadEtiqueta();
  }

  /**
   * Quita la etiqueta y libera la geometría y el material. Three.js no
   * libera solo la memoria de la tarjeta gráfica: si no se llama a dispose,
   * cada subgrafo nuevo ocuparía más.
   */
  liberar() {
    this._malla.remove(this._etiqueta);
    const elemento = this._etiqueta.element;
    if (elemento.parentNode !== null) {
      elemento.parentNode.removeChild(elemento);
    }
    this._malla.geometry.dispose();
    this._malla.material.dispose();
  }

  /**
   * (Protegido, abstracto) Forma del nodo.
   *
   * @abstract
   * @returns {THREE.BufferGeometry}
   */
  _crearGeometria() {
    throw new Error("No implementado: cada subclase de NodoVisual debe implementar _crearGeometria().");
  }

  /**
   * (Protegido, abstracto) Color del nodo.
   *
   * @abstract
   * @returns {string} "#rrggbb"
   */
  _getColor() {
    throw new Error("No implementado: cada subclase de NodoVisual debe implementar _getColor().");
  }

  /**
   * (Privado) La etiqueta es un <div> con el nombre, un poco por encima de la
   * forma y oculta al principio. La de la entidad central lleva una clase
   * más para destacarla.
   *
   * @param {NodoRelevante} nodo
   * @returns {CSS2DObject}
   */
  #crearEtiqueta(nodo) {
    const elemento = document.createElement("div");
    elemento.className = "etiqueta-nodo";
    if (nodo.getNivel() === 0) {
      elemento.className = "etiqueta-nodo etiqueta-central";
    }
    // textContent (y no innerHTML) para que un nombre nunca se interprete como HTML.
    elemento.textContent = nodo.getEntidad().getNombre();

    const etiqueta = new CSS2DObject(elemento);
    etiqueta.position.set(0, 1.5, 0);
    etiqueta.visible = false;
    return etiqueta;
  }

  /**
   * (Privado) La etiqueta se ve solo si el nodo es visible Y se ha pedido mostrarla.
   */
  #actualizarVisibilidadEtiqueta() {
    let etiquetaVisible = false;
    if (this.#visible && this.#etiquetaActiva) {
      etiquetaVisible = true;
    }
    this._etiqueta.visible = etiquetaVisible;
  }
}
