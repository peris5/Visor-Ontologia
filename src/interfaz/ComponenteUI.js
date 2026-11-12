import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * «abstract» ComponenteUI
 *
 * Base de los componentes 2D de la interfaz (Leyenda, PanelBusqueda,
 * PanelInformacion, ControlUmbral, IndicadorEstado y BarraNavegacion). Cada
 * componente tiene un elemento HTML propio que se añade a la página con
 * montar() y que dibuja renderizar(). Todos reciben el controlador, al que
 * avisan de lo que hace el usuario.
 *
 * Es abstracta: no se puede hacer new ComponenteUI(...).
 *
 * Requisitos: base de RF-23 y RF-24 (leyenda) y de los componentes de
 * exploración del incremento 3; RNF-25 (accesibilidad).
 */
export class ComponenteUI {
  // Protegidos (los usan las subclases).
  _elemento;
  _controlador;

  /**
   * @param {ControladorExploracion|null} controlador - recibe lo que hace el
   *   usuario en el componente (null en algunas pruebas).
   * @param {string} etiquetaHtml - por ejemplo "aside" o "div".
   * @param {string} clase - clase CSS del elemento.
   */
  constructor(controlador, etiquetaHtml, clase) {
    if (new.target === ComponenteUI) {
      throw new Error("ComponenteUI es una clase abstracta: crea una de sus subclases (por ejemplo, Leyenda).");
    }
    this._controlador = controlador;
    this._elemento = crear(etiquetaHtml, { clase: clase }, []);
  }

  /**
   * Añade el componente a la página y lo dibuja.
   *
   * @param {HTMLElement} padre
   */
  montar(padre) {
    padre.appendChild(this._elemento);
    this.renderizar();
  }

  mostrar() {
    this._elemento.hidden = false;
  }

  ocultar() {
    this._elemento.hidden = true;
  }

  /**
   * Dibuja el contenido del componente. Cada subclase lo implementa.
   *
   * @abstract
   */
  renderizar() {
    throw new Error("No implementado: cada subclase de ComponenteUI debe implementar renderizar().");
  }

  /**
   * (Protegido) El símbolo de un tipo de entidad, con la misma forma y el
   * mismo color que en la escena: círculo azul, cuadrado naranja o rombo
   * verde. Lo usan la leyenda, el buscador y el panel de información.
   *
   * @param {string} tipo - un valor de TipoEntidad.
   * @returns {HTMLElement}
   */
  static _crearSimboloEntidad(tipo) {
    let claseDelSimbolo = "simbolo-obra";
    if (tipo === TipoEntidad.PERSONA) {
      claseDelSimbolo = "simbolo-persona";
    } else if (tipo === TipoEntidad.ORGANIZACION) {
      claseDelSimbolo = "simbolo-organizacion";
    }
    // aria-hidden: el símbolo es decorativo; el tipo ya se dice con texto.
    return crear("span", { clase: "simbolo-nodo " + claseDelSimbolo, "aria-hidden": "true" }, []);
  }

  /**
   * (Protegido) Nombre para mostrar de un tipo de entidad.
   *
   * @param {string} tipo - un valor de TipoEntidad.
   * @returns {string}
   */
  static _nombreTipoEntidad(tipo) {
    if (tipo === TipoEntidad.PERSONA) {
      return "Persona";
    }
    if (tipo === TipoEntidad.ORGANIZACION) {
      return "Organización";
    }
    if (tipo === TipoEntidad.OBRA_DE_ARTE) {
      return "Obra de arte";
    }
    return tipo;
  }
}

/**
 * Función auxiliar para crear elementos HTML en una sola llamada.
 *
 * Ejemplo: crear("p", { clase: "nota" }, ["Hola"]) crea <p class="nota">Hola</p>.
 *
 * @param {string} etiqueta - nombre de la etiqueta HTML ("div", "li"...).
 * @param {Object} propiedades - "clase" pone la clase CSS, "texto" el texto y
 *   cualquier otra se pone como atributo HTML (por ejemplo "title").
 * @param {Array<HTMLElement|string>} hijos - elementos o textos que van dentro.
 * @returns {HTMLElement}
 */
export function crear(etiqueta, propiedades, hijos) {
  const elemento = document.createElement(etiqueta);

  if (propiedades !== undefined && propiedades !== null) {
    const nombres = Object.keys(propiedades);
    for (let i = 0; i < nombres.length; i++) {
      const nombre = nombres[i];
      const valor = propiedades[nombre];
      if (nombre === "clase") {
        elemento.className = valor;
      } else if (nombre === "texto") {
        // textContent (y no innerHTML) para que el texto nunca se interprete como HTML.
        elemento.textContent = valor;
      } else {
        elemento.setAttribute(nombre, valor);
      }
    }
  }

  if (hijos !== undefined && hijos !== null) {
    for (let i = 0; i < hijos.length; i++) {
      const hijo = hijos[i];
      if (typeof hijo === "string") {
        elemento.appendChild(document.createTextNode(hijo));
      } else {
        elemento.appendChild(hijo);
      }
    }
  }
  return elemento;
}
