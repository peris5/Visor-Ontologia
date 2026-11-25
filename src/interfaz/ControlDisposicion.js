import { ComponenteUI, crear } from './ComponenteUI.js';
import { ModoDisposicion } from '../vista3d/ModoDisposicion.js';

/**
 * Dos botones para elegir cómo se reparten los nodos en el espacio
 * (ModoDisposicion): «Libre» y «Por grupos». El elegido sale
 * marcado (aria-pressed) y debajo hay una ayuda de una línea que explica el
 * modo. En los dos, la distancia al centro sigue siendo la relevancia.
 */
export class ControlDisposicion extends ComponenteUI {
  // [modo, texto del botón, ayuda]
  static OPCIONES = Object.freeze([
    [ModoDisposicion.LIBRE, "Libre", "Las fuerzas reparten los nodos."],
    [ModoDisposicion.POR_GRUPOS, "Por grupos", "Las entidades muy relacionadas entre sí, juntas."]
  ]);

  #modo;
  #botones;
  #ayuda;

  constructor(controlador) {
    super(controlador, "div", "control-disposicion");
    this._elemento.setAttribute("role", "group");
    this._elemento.setAttribute("aria-label", "Disposición de los nodos");
    this.#modo = ModoDisposicion.LIBRE;
    this.#botones = [];
    this.#ayuda = null;
  }

  /** Dibuja el título, los botones y la ayuda. */
  renderizar() {
    this._elemento.textContent = "";
    this.#botones = [];
    const fila = crear("div", { clase: "disposicion-botones" }, []);
    const controlDisposicion = this;
    for (let i = 0; i < ControlDisposicion.OPCIONES.length; i++) {
      const modo = ControlDisposicion.OPCIONES[i][0];
      const boton = crear("button", {
        type: "button",
        "data-modo": modo,
        "aria-pressed": "false",
        texto: ControlDisposicion.OPCIONES[i][1]
      }, []);
      // El navegador llama a la función desde fuera de la clase; por eso se
      // usa la variable controlDisposicion y no "this".
      boton.addEventListener("click", function () {
        controlDisposicion.#onElegir(modo);
      });
      this.#botones.push(boton);
      fila.appendChild(boton);
    }
    this.#ayuda = crear("span", { clase: "ayuda-disposicion" }, []);
    this._elemento.appendChild(crear("span", { clase: "etiqueta-disposicion", texto: "Disposición" }, []));
    this._elemento.appendChild(fila);
    this._elemento.appendChild(this.#ayuda);
    this.setModo(this.#modo);
  }

  /**
   * Marca el modo elegido (sin avisar al controlador).
   *
   * @param {string} modo - un valor de ModoDisposicion.
   */
  setModo(modo) {
    this.#modo = modo;
    for (let i = 0; i < this.#botones.length; i++) {
      const elegido = this.#botones[i].dataset.modo === modo;
      this.#botones[i].setAttribute("aria-pressed", String(elegido));
    }
    if (this.#ayuda !== null) {
      this.#ayuda.textContent = ControlDisposicion.#ayudaDe(modo);
    }
  }

  /**
   * @returns {string} el modo marcado.
   */
  getModo() {
    return this.#modo;
  }

  /** El usuario ha pulsado un modo. */
  #onElegir(modo) {
    this.setModo(modo);
    if (this._controlador !== null) {
      this._controlador.cambiarDisposicion(modo);
    }
  }

  /** La ayuda de un modo. */
  static #ayudaDe(modo) {
    for (let i = 0; i < ControlDisposicion.OPCIONES.length; i++) {
      if (ControlDisposicion.OPCIONES[i][0] === modo) {
        return ControlDisposicion.OPCIONES[i][2];
      }
    }
    return "";
  }
}
