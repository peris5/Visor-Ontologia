import { PanelBusqueda } from './PanelBusqueda.js';
import { PanelInformacion } from './PanelInformacion.js';
import { ControlUmbral } from './ControlUmbral.js';
import { Leyenda } from './Leyenda.js';
import { IndicadorEstado } from './IndicadorEstado.js';
import { BarraNavegacion } from './BarraNavegacion.js';
import { EstadoCarga } from '../logica/EstadoCarga.js';

/**
 * InterfazUsuario
 *
 * Patrón FACHADA: es la única puerta de entrada a la interfaz 2D. El
 * controlador solo habla con ella (mostrarEntidad, mostrarError...) y ella
 * reparte el trabajo entre los componentes. Así el controlador no tiene
 * que saber cuántos paneles hay ni cómo se llaman, y se pueden cambiar los
 * paneles sin tocar el controlador.
 *
 * Composición (◆): crea y tiene sus seis componentes.
 *
 * La página (index.html) tiene unas zonas vacías marcadas con data-zona;
 * inicializar() monta cada componente en la suya:
 *   superior: buscador, umbral y navegación · izquierda: leyenda ·
 *   derecha: información · estado: aviso de carga y de error.
 *
 * Requisitos: RF-01 a RF-07, RF-13 a RF-15, RF-23, RF-27 a RF-33 (a través
 * de sus componentes); RNF-09 y RNF-25.
 */
export class InterfazUsuario {
  #panelBusqueda;
  #panelInformacion;
  #controlUmbral;
  #leyenda;
  #indicadorEstado;
  #barraNavegacion;

  constructor() {
    this.#panelBusqueda = null;
    this.#panelInformacion = null;
    this.#controlUmbral = null;
    this.#leyenda = null;
    this.#indicadorEstado = null;
    this.#barraNavegacion = null;
  }

  /**
   * Crea los componentes y los monta en las zonas de la página.
   *
   * @param {HTMLElement} raiz - el elemento que contiene las zonas (data-zona).
   * @param {ControladorExploracion} controlador
   */
  inicializar(raiz, controlador) {
    this.#panelBusqueda = new PanelBusqueda(controlador);
    this.#controlUmbral = new ControlUmbral(controlador);
    this.#barraNavegacion = new BarraNavegacion(controlador);
    this.#leyenda = new Leyenda(controlador);
    this.#panelInformacion = new PanelInformacion(controlador);
    this.#indicadorEstado = new IndicadorEstado(controlador);

    const superior = InterfazUsuario.#zona(raiz, "superior");
    this.#panelBusqueda.montar(superior);
    this.#controlUmbral.montar(superior);
    this.#barraNavegacion.montar(superior);
    this.#leyenda.montar(InterfazUsuario.#zona(raiz, "izquierda"));
    this.#panelInformacion.montar(InterfazUsuario.#zona(raiz, "derecha"));
    this.#indicadorEstado.montar(InterfazUsuario.#zona(raiz, "estado"));
  }

  /**
   * @param {Entidad} entidad
   * @param {NodoRelevante} nodo
   * @param {Subgrafo} subgrafo
   */
  mostrarEntidad(entidad, nodo, subgrafo) {
    this.#panelInformacion.mostrarEntidad(entidad, nodo, subgrafo);
  }

  /**
   * @param {Relacion} relacion
   * @param {Subgrafo} subgrafo
   */
  mostrarRelacion(relacion, subgrafo) {
    this.#panelInformacion.mostrarRelacion(relacion, subgrafo);
  }

  /**
   * @param {Object[]} lista - [{ id, nombre, tipo }]
   * @param {string} texto - lo que se ha buscado.
   */
  mostrarSugerencias(lista, texto) {
    this.#panelBusqueda.mostrarSugerencias(lista, texto);
  }

  /**
   * CARGANDO → «Cargando…»; LISTO o INACTIVO → se oculta el aviso.
   * ERROR no hace nada aquí: el mensaje llega con mostrarError.
   *
   * @param {string} estado - un valor de EstadoCarga.
   */
  mostrarEstado(estado) {
    if (estado === EstadoCarga.CARGANDO) {
      this.#indicadorEstado.mostrarCarga();
    } else if (estado === EstadoCarga.LISTO || estado === EstadoCarga.INACTIVO) {
      this.#indicadorEstado.ocultarEstado();
    }
  }

  /**
   * @param {string} mensaje
   */
  mostrarError(mensaje) {
    this.#indicadorEstado.mostrarError(mensaje);
  }

  /**
   * @param {boolean} habilitado
   */
  setHabilitadoVolver(habilitado) {
    this.#barraNavegacion.setHabilitadoVolver(habilitado);
  }

  /**
   * @param {number} valor
   */
  setUmbral(valor) {
    this.#controlUmbral.setValor(valor);
  }

  /**
   * @param {Object} datos - ver Leyenda.actualizar.
   */
  actualizarLeyenda(datos) {
    this.#leyenda.actualizar(datos);
  }

  /**
   * (Privado) La zona de la página con ese nombre (data-zona="...").
   *
   * @param {HTMLElement} raiz
   * @param {string} nombre
   * @returns {HTMLElement}
   */
  static #zona(raiz, nombre) {
    const zona = raiz.querySelector("[data-zona=\"" + nombre + "\"]");
    if (zona === null) {
      throw new Error("Falta en la página la zona \"" + nombre + "\" (data-zona).");
    }
    return zona;
  }
}
