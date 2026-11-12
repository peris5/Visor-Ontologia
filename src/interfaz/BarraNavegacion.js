import { ComponenteUI, crear } from './ComponenteUI.js';

/**
 * BarraNavegacion extends ComponenteUI
 *
 * Los botones «← Volver» (a la entidad anterior; deshabilitado si no hay
 * historial) y «Vista inicial» (vuelve a colocar la cámara).
 *
 * Atajos de teclado: Alt + ← para volver e Inicio para la vista inicial.
 * No funcionan mientras se escribe en un campo (el buscador, el desplegable
 * o el deslizador), porque allí esas teclas ya tienen otro uso (Inicio
 * lleva al principio del texto o al mínimo del deslizador).
 *
 * Requisitos: RF-27 (vista inicial), RF-31 (volver), RNF-25 (teclado).
 */
export class BarraNavegacion extends ComponenteUI {
  #botonVolver;

  /**
   * @param {ControladorExploracion} controlador
   */
  constructor(controlador) {
    super(controlador, "nav", "barra-navegacion");
    this._elemento.setAttribute("aria-label", "Navegación");
    this.#botonVolver = null;

    // Los atajos se escuchan en toda la página. El navegador llama a la
    // función desde fuera de la clase, y dentro de una función normal "this"
    // ya no es la barra; por eso la guardamos antes en una variable.
    const barraNavegacion = this;
    document.addEventListener("keydown", function (evento) {
      barraNavegacion.#onTecla(evento);
    });
  }

  /**
   * Dibuja los dos botones.
   */
  renderizar() {
    this._elemento.textContent = "";
    this.#botonVolver = crear("button", {
      type: "button",
      clase: "boton-volver",
      "aria-keyshortcuts": "Alt+ArrowLeft",
      title: "Volver a la entidad anterior (Alt + ←)",
      texto: "← Volver"
    }, []);
    this.#botonVolver.disabled = true;
    const botonVista = crear("button", {
      type: "button",
      clase: "boton-vista-inicial",
      "aria-keyshortcuts": "Home",
      title: "Volver a la vista inicial (Inicio)",
      texto: "Vista inicial"
    }, []);

    const barraNavegacion = this;
    this.#botonVolver.addEventListener("click", function () {
      barraNavegacion.#onVolver();
    });
    botonVista.addEventListener("click", function () {
      barraNavegacion.#onRestablecerVista();
    });
    this._elemento.appendChild(this.#botonVolver);
    this._elemento.appendChild(botonVista);
  }

  /**
   * @param {boolean} habilitado - true si hay alguna entidad a la que volver.
   */
  setHabilitadoVolver(habilitado) {
    this.#botonVolver.disabled = !habilitado;
  }

  /**
   * (Privado) Botón «← Volver» o Alt + ←.
   */
  #onVolver() {
    if (this.#botonVolver.disabled || this._controlador === null) {
      return;
    }
    this._controlador.volver();
  }

  /**
   * (Privado) Botón «Vista inicial» o tecla Inicio.
   */
  #onRestablecerVista() {
    if (this._controlador !== null) {
      this._controlador.restablecerVista();
    }
  }

  /**
   * (Privado) Atajos de teclado.
   *
   * @param {KeyboardEvent} evento
   */
  #onTecla(evento) {
    if (BarraNavegacion.#seEstaEscribiendo()) {
      return;
    }
    if (evento.altKey && evento.key === "ArrowLeft") {
      // preventDefault: Alt + ← es también «atrás» del navegador, y así no
      // se sale de la página.
      evento.preventDefault();
      this.#onVolver();
    } else if (evento.key === "Home" && !evento.altKey && !evento.ctrlKey && !evento.metaKey) {
      evento.preventDefault();
      this.#onRestablecerVista();
    }
  }

  /**
   * (Privado) ¿Tiene el foco un campo donde se escribe o se elige algo?
   *
   * @returns {boolean}
   */
  static #seEstaEscribiendo() {
    const elemento = document.activeElement;
    if (elemento === null) {
      return false;
    }
    const etiqueta = elemento.tagName;
    // Las casillas de la leyenda también son <input>, pero en ellas no se
    // escribe: allí los atajos sí funcionan.
    if (etiqueta === "INPUT" && elemento.type === "checkbox") {
      return false;
    }
    return etiqueta === "INPUT" || etiqueta === "SELECT" || etiqueta === "TEXTAREA";
  }
}
