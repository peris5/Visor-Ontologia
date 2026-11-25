import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Representación 3D de un NodoRelevante: una malla (forma + material) y una
 * etiqueta HTML con el nombre. Cada subclase decide su forma y su color
 * (NodoPersona, NodoOrganizacion, NodoObra).
 *
 * Es abstracta: no se puede hacer new NodoVisual(...).
 */
export class NodoVisual {
  // Opacidad de un nodo con certeza 0 (opacidadMinima de public/relevancia.json).
  static #opacidadMinima = 0.25;

  /**
   * Cambia la opacidad mínima (la de certeza 0) para los nodos que se creen después.
   *
   * @param {number} valor - entre 0 y 1.
   */
  static setOpacidadMinima(valor) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, opacidadMinima debe ser un número entre 0 y 1.");
    }
    NodoVisual.#opacidadMinima = valor;
  }

  static getOpacidadMinima() {
    return NodoVisual.#opacidadMinima;
  }

  /**
   * La opacidad según la CERTEZA C del nodo, de forma continua:
   *     opacidad = opacidadMinima + (1 − opacidadMinima) × C
   * Los nodos con relación declarada (C = 1) quedan opacos; los que solo
   * coinciden o son deducidos, más transparentes cuanto menos se sabe.
   * Es estático para poder probarlo sin WebGL.
   *
   * @param {NodoRelevante} nodo
   */
  static opacidadDe(nodo) {
    let certeza = 1;
    const resultado = nodo.getResultado();
    if (resultado !== null) {
      certeza = resultado.getCerteza();
    }
    return NodoVisual.#opacidadMinima + (1 - NodoVisual.#opacidadMinima) * certeza;
  }

  // Protegidos (los usan las subclases).
  _malla;
  _etiqueta;
  _tamano;

  // Privados.
  #nodo;
  #etiquetaActiva;
  #visible;

  /**
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

    // La opacidad depende de la CERTEZA (ver opacidadDe): lo que solo se
    // supone (coincidencias, deducciones) se ve más transparente. Los
    // deducidos llevan además el nombre en cursiva (no depende solo del
    // color, RNF-26).
    const opacidad = NodoVisual.opacidadDe(nodo);
    const material = new THREE.MeshStandardMaterial({
      color: this._getColor(),
      roughness: 0.45,
      metalness: 0.1,
      transparent: opacidad < 1,
      opacity: opacidad
    });
    this._malla = new THREE.Mesh(this._crearGeometria(), material);
    this._malla.scale.setScalar(tamano);
    // Así, al hacer clic en una malla (SelectorInteraccion), se sabe a qué nodo pertenece.
    this._malla.userData.visual = this;

    this._etiqueta = this.#crearEtiqueta(nodo);
    this._malla.add(this._etiqueta);
  }

  getNodo() {
    return this.#nodo;
  }

  getMalla() {
    return this._malla;
  }

  /**
   * @returns {THREE.Vector3} copia de la posición.
   */
  getPosicion() {
    return this._malla.position.clone();
  }

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
   */
  setVisible(visible) {
    this.#visible = visible;
    this._malla.visible = visible;
    this.#actualizarVisibilidadEtiqueta();
  }

  /** Resalta el nodo: le da brillo y lo hace un 25 % más grande. */
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

  /** (Protegido, abstracto) Forma del nodo. */
  _crearGeometria() {
    throw new Error("No implementado: cada subclase de NodoVisual debe implementar _crearGeometria().");
  }

  /**
   * (Protegido, abstracto) Color del nodo.
   *
   * @returns {string} "#rrggbb"
   */
  _getColor() {
    throw new Error("No implementado: cada subclase de NodoVisual debe implementar _getColor().");
  }

  /**
   * La etiqueta es un <div> con el nombre, un poco por encima de la
   * forma y oculta al principio. La de la entidad central lleva una clase
   * más para destacarla.
   */
  #crearEtiqueta(nodo) {
    const elemento = document.createElement("div");
    elemento.className = "etiqueta-nodo";
    if (nodo.getNivel() === 0) {
      elemento.className = "etiqueta-nodo etiqueta-central";
    } else if (nodo.esDeducido()) {
      elemento.className = "etiqueta-nodo etiqueta-deducido";
    }
    // textContent (y no innerHTML) para que un nombre nunca se interprete como HTML.
    elemento.textContent = nodo.getEntidad().getNombre();

    const etiqueta = new CSS2DObject(elemento);
    etiqueta.position.set(0, 1.5, 0);
    etiqueta.visible = false;
    return etiqueta;
  }

  /** La etiqueta se ve solo si el nodo es visible Y se ha pedido mostrarla. */
  #actualizarVisibilidadEtiqueta() {
    let etiquetaVisible = false;
    if (this.#visible && this.#etiquetaActiva) {
      etiquetaVisible = true;
    }
    this._etiqueta.visible = etiquetaVisible;
  }
}
