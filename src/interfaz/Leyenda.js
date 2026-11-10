import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * Leyenda extends ComponenteUI
 *
 * Explica qué significa lo que se ve en la escena 3D. Muestra SOLO los tipos
 * presentes en el grafo actual, con cuántos hay de cada uno:
 *  - los tipos de nodo, con un símbolo de su forma y su color;
 *  - los tipos de relación, con una línea de su color, de más a menos
 *    frecuentes (a igualdad, por nombre);
 *  - qué significan el tamaño y la distancia al centro.
 *
 * En este incremento es solo informativa; en el 3 tendrá casillas para filtrar.
 *
 * Requisitos: RF-23 (leyenda de nodos y relaciones), RF-24 (solo lo presente).
 */
export class Leyenda extends ComponenteUI {
  // Orden fijo en el que se muestran los tipos de nodo.
  static ORDEN_TIPOS_NODO = [TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION, TipoEntidad.OBRA_DE_ARTE];

  #nodos;
  #relaciones;

  /**
   * @param {Object|null} controlador - null en este incremento.
   */
  constructor(controlador) {
    super(controlador, "aside", "leyenda");
    this.#nodos = null;
    this.#relaciones = null;
  }

  /**
   * Dibuja la estructura fija de la leyenda (títulos, tamaño y explicación).
   * Las listas de tipos se rellenan con actualizar().
   */
  renderizar() {
    this._elemento.textContent = "";
    this.#nodos = crear("ul", { clase: "leyenda-lista leyenda-nodos" }, []);
    this.#relaciones = crear("ul", { clase: "leyenda-lista leyenda-relaciones" }, []);

    this._elemento.appendChild(crear("h2", { texto: "Leyenda" }, []));
    this._elemento.appendChild(crear("h3", { texto: "Entidades" }, []));
    this._elemento.appendChild(this.#nodos);
    this._elemento.appendChild(crear("h3", { texto: "Relaciones" }, []));
    this._elemento.appendChild(this.#relaciones);
    this._elemento.appendChild(crear("h3", { texto: "Tamaño" }, []));
    this._elemento.appendChild(this.#crearExplicacionTamano());
    this._elemento.appendChild(crear("p", {
      clase: "leyenda-nota",
      texto: "La distancia al nodo central indica la relevancia: cuanto más cerca, más relevante. El tamaño indica la centralidad."
    }, []));
  }

  /**
   * Rellena la leyenda con los tipos del grafo actual.
   *
   * @param {Object} datos - { nodos: [{ tipo, cantidad }], relaciones: [{ tipo: TipoRelacion, cantidad }] }
   */
  actualizar(datos) {
    if (this.#nodos === null) {
      this.renderizar();
    }
    this.#actualizarNodos(datos.nodos);
    this.#actualizarRelaciones(datos.relaciones);
  }

  /**
   * (Privado) Lista de tipos de nodo presentes, en el orden fijo.
   *
   * @param {Object[]} nodos - [{ tipo, cantidad }]
   */
  #actualizarNodos(nodos) {
    this.#nodos.textContent = "";
    for (let t = 0; t < Leyenda.ORDEN_TIPOS_NODO.length; t++) {
      const tipo = Leyenda.ORDEN_TIPOS_NODO[t];
      for (let i = 0; i < nodos.length; i++) {
        if (nodos[i].tipo === tipo && nodos[i].cantidad > 0) {
          const simbolo = crear("span", { clase: "simbolo-nodo " + Leyenda.#claseDelSimbolo(tipo), "aria-hidden": "true" }, []);
          this.#nodos.appendChild(this.#crearElemento(simbolo, Leyenda.#nombreDelTipo(tipo), nodos[i].cantidad));
        }
      }
    }
  }

  /**
   * (Privado) Lista de tipos de relación presentes, de más a menos frecuentes.
   *
   * @param {Object[]} relaciones - [{ tipo: TipoRelacion, cantidad }]
   */
  #actualizarRelaciones(relaciones) {
    this.#relaciones.textContent = "";
    const presentes = [];
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].cantidad > 0) {
        presentes.push(relaciones[i]);
      }
    }
    if (presentes.length === 0) {
      this.#relaciones.appendChild(crear("li", { clase: "leyenda-vacia", texto: "No hay relaciones en el grafo." }, []));
      return;
    }

    presentes.sort(Leyenda.#compararRelaciones);
    for (let i = 0; i < presentes.length; i++) {
      const tipo = presentes[i].tipo;
      const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
      linea.style.backgroundColor = tipo.getColor();
      this.#relaciones.appendChild(this.#crearElemento(linea, tipo.getNombre(), presentes[i].cantidad));
    }
  }

  /**
   * (Privado) Un elemento de la lista: símbolo, nombre y cantidad.
   *
   * @param {HTMLElement} simbolo
   * @param {string} nombre
   * @param {number} cantidad
   * @returns {HTMLElement}
   */
  #crearElemento(simbolo, nombre, cantidad) {
    return crear("li", {}, [
      simbolo,
      crear("span", { clase: "leyenda-nombre", texto: nombre }, []),
      crear("span", { clase: "leyenda-cantidad", texto: String(cantidad) }, [])
    ]);
  }

  /**
   * (Privado) Un círculo pequeño y uno grande para explicar el tamaño.
   *
   * @returns {HTMLElement}
   */
  #crearExplicacionTamano() {
    return crear("ul", { clase: "leyenda-lista leyenda-tamano" }, [
      crear("li", {}, [
        crear("span", { clase: "simbolo-tamano simbolo-pequeno", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Menos conectado" }, [])
      ]),
      crear("li", {}, [
        crear("span", { clase: "simbolo-tamano simbolo-grande", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Más conectado" }, [])
      ])
    ]);
  }

  /**
   * (Privado) Para ordenar de más a menos frecuente y, a igualdad, por nombre.
   *
   * @param {Object} a - { tipo, cantidad }
   * @param {Object} b - { tipo, cantidad }
   * @returns {number}
   */
  static #compararRelaciones(a, b) {
    if (a.cantidad !== b.cantidad) {
      return b.cantidad - a.cantidad;
    }
    return a.tipo.getNombre().localeCompare(b.tipo.getNombre(), "es");
  }

  /**
   * (Privado) Clase CSS del símbolo: círculo azul, cuadrado naranja o rombo verde.
   *
   * @param {string} tipo
   * @returns {string}
   */
  static #claseDelSimbolo(tipo) {
    if (tipo === TipoEntidad.PERSONA) {
      return "simbolo-persona";
    }
    if (tipo === TipoEntidad.ORGANIZACION) {
      return "simbolo-organizacion";
    }
    return "simbolo-obra";
  }

  /**
   * (Privado) Nombre para mostrar de un tipo de entidad.
   *
   * @param {string} tipo
   * @returns {string}
   */
  static #nombreDelTipo(tipo) {
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
