import { ComponenteUI, crear } from './ComponenteUI.js';

/**
 * ControlUmbral extends ComponenteUI
 *
 * El deslizador del umbral de relevancia, de 0,05 en 0,05, con su valor a
 * la vista. Mientras se arrastra solo cambia el número que se ve; el
 * subgrafo se recalcula al SOLTAR (evento "change"), para no rehacer la
 * escena decenas de veces por segundo.
 *
 * Requisitos: RF-13 (cambiar el umbral), RNF-25 (se maneja con las flechas
 * del teclado, tiene su etiqueta).
 */
export class ControlUmbral extends ComponenteUI {
  static ID_DESLIZADOR = "deslizadorUmbral";
  static ID_AYUDA = "ayudaUmbral";

  #valor;
  #minimo;
  #maximo;
  #deslizador;
  #textoValor;

  /**
   * @param {ControladorExploracion} controlador
   */
  constructor(controlador) {
    super(controlador, "div", "control-umbral");
    this.#minimo = 0.05;
    this.#maximo = 1;
    this.#valor = 0.3;
    this.#deslizador = null;
    this.#textoValor = null;
  }

  /**
   * Dibuja la etiqueta, el valor, el deslizador y la ayuda.
   */
  renderizar() {
    this._elemento.textContent = "";
    this.#textoValor = crear("output", { clase: "valor-umbral", for: ControlUmbral.ID_DESLIZADOR }, []);
    this.#deslizador = crear("input", {
      id: ControlUmbral.ID_DESLIZADOR,
      type: "range",
      min: String(this.#minimo),
      max: String(this.#maximo),
      step: "0.05",
      "aria-describedby": ControlUmbral.ID_AYUDA
    }, []);

    this._elemento.appendChild(crear("label", { for: ControlUmbral.ID_DESLIZADOR, clase: "etiqueta-umbral" }, [
      "Umbral de relevancia: ",
      this.#textoValor
    ]));
    this._elemento.appendChild(this.#deslizador);
    this._elemento.appendChild(crear("span", { id: ControlUmbral.ID_AYUDA, clase: "ayuda-umbral", texto: "más alto, menos nodos" }, []));

    const controlUmbral = this;
    // Mientras se arrastra: solo se actualiza el número.
    this.#deslizador.addEventListener("input", function () {
      controlUmbral.#mostrarValor(Number(controlUmbral.#deslizador.value));
    });
    // Al soltar: se recalcula.
    this.#deslizador.addEventListener("change", function () {
      controlUmbral.#onCambio();
    });
    this.setValor(this.#valor);
  }

  /**
   * Pone el deslizador en un valor (sin avisar al controlador).
   *
   * @param {number} valor - se acota entre el mínimo (0,05) y el máximo (1).
   */
  setValor(valor) {
    let valorAcotado = valor;
    if (typeof valorAcotado !== "number" || Number.isNaN(valorAcotado)) {
      valorAcotado = this.#valor;
    }
    if (valorAcotado < this.#minimo) {
      valorAcotado = this.#minimo;
    }
    if (valorAcotado > this.#maximo) {
      valorAcotado = this.#maximo;
    }
    this.#valor = valorAcotado;
    if (this.#deslizador !== null) {
      this.#deslizador.value = String(valorAcotado);
      this.#mostrarValor(valorAcotado);
    }
  }

  /**
   * (Privado) El usuario ha soltado el deslizador: se avisa al controlador.
   */
  #onCambio() {
    this.#valor = Number(this.#deslizador.value);
    this.#mostrarValor(this.#valor);
    if (this._controlador !== null) {
      this._controlador.cambiarUmbral(this.#valor);
    }
  }

  /**
   * (Privado) Escribe el valor con dos decimales y coma: 0.3 → "0,30".
   *
   * @param {number} valor
   */
  #mostrarValor(valor) {
    this.#textoValor.textContent = valor.toFixed(2).replace(".", ",");
  }
}
