import { ComponenteUI, crear } from './ComponenteUI.js';

/**
 * IndicadorEstado extends ComponenteUI
 *
 * El aviso de abajo: «Cargando…» mientras se prepara un subgrafo, o el
 * mensaje de error en rojo (con un botón para cerrarlo) si algo ha fallado.
 *
 * role="status" y aria-live="polite": los lectores de pantalla anuncian el
 * texto cuando cambia, sin interrumpir lo que estuvieran leyendo.
 *
 * Requisitos: RF-14 (aviso de carga), RF-15 (aviso de error), RNF-25.
 */
export class IndicadorEstado extends ComponenteUI {
  #texto;
  #botonCerrar;

  /**
   * @param {ControladorExploracion|null} controlador - no lo usa (solo muestra).
   */
  constructor(controlador) {
    super(controlador, "div", "indicador-estado");
    this._elemento.setAttribute("role", "status");
    this._elemento.setAttribute("aria-live", "polite");
    this.#texto = null;
    this.#botonCerrar = null;
  }

  /**
   * Dibuja el texto y el botón de cerrar (el indicador empieza oculto).
   */
  renderizar() {
    this._elemento.textContent = "";
    this.#texto = crear("span", { clase: "estado-texto" }, []);
    this.#botonCerrar = crear("button", {
      type: "button",
      clase: "boton-cerrar",
      "aria-label": "Cerrar el aviso",
      texto: "×"
    }, []);
    const indicadorEstado = this;
    this.#botonCerrar.addEventListener("click", function () {
      indicadorEstado.ocultarEstado();
    });
    this._elemento.appendChild(this.#texto);
    this._elemento.appendChild(this.#botonCerrar);
    this.ocultarEstado();
  }

  /**
   * Muestra «Cargando…».
   */
  mostrarCarga() {
    this._elemento.className = "indicador-estado estado-cargando";
    this.#texto.textContent = "Cargando…";
    this.#botonCerrar.hidden = true;
    this._elemento.hidden = false;
  }

  /**
   * Muestra un error en rojo, con el botón para cerrarlo.
   *
   * @param {string} mensaje
   */
  mostrarError(mensaje) {
    this._elemento.className = "indicador-estado estado-error";
    this.#texto.textContent = mensaje;
    this.#botonCerrar.hidden = false;
    this._elemento.hidden = false;
  }

  /**
   * Oculta el indicador.
   */
  ocultarEstado() {
    this._elemento.hidden = true;
    this.#texto.textContent = "";
  }
}
