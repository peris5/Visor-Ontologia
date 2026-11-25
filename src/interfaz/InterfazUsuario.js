import { PanelBusqueda } from './PanelBusqueda.js';
import { PanelInformacion } from './PanelInformacion.js';
import { ControlUmbral } from './ControlUmbral.js';
import { Leyenda } from './Leyenda.js';
import { IndicadorEstado } from './IndicadorEstado.js';
import { BarraNavegacion } from './BarraNavegacion.js';
import { ControlDisposicion } from './ControlDisposicion.js';
import { EstadoCarga } from '../logica/EstadoCarga.js';

/**
 * Es la única puerta de entrada a la interfaz 2D. El
 * controlador solo habla con ella (mostrarEntidad, mostrarError...) y ella
 * reparte el trabajo entre los componentes. Así el controlador no tiene
 * que saber cuántos paneles hay ni cómo se llaman, y se pueden cambiar los
 * paneles sin tocar el controlador.
 *
 * La página (index.html) tiene unas zonas vacías marcadas con data-zona;
 * inicializar() monta cada componente en la suya:
 *   superior: buscador, umbral, disposición y navegación · izquierda: leyenda ·
 *   derecha: información · estado: aviso de carga y de error.
 */
export class InterfazUsuario {
  #panelBusqueda;
  #panelInformacion;
  #controlUmbral;
  #leyenda;
  #indicadorEstado;
  #barraNavegacion;
  #controlDisposicion;

  constructor() {
    this.#panelBusqueda = null;
    this.#panelInformacion = null;
    this.#controlUmbral = null;
    this.#leyenda = null;
    this.#indicadorEstado = null;
    this.#barraNavegacion = null;
    this.#controlDisposicion = null;
  }

  /**
   * Crea los componentes y los monta en las zonas de la página.
   *
   * @param {HTMLElement} raiz - el elemento que contiene las zonas (data-zona).
   * @param {Object} contexto - { idioma, nombresTipos, ... } (para los
   *   nombres de los tipos en el panel de información).
   */
  inicializar(raiz, controlador, contexto) {
    this.#panelBusqueda = new PanelBusqueda(controlador);
    this.#controlUmbral = new ControlUmbral(controlador);
    this.#barraNavegacion = new BarraNavegacion(controlador);
    this.#controlDisposicion = new ControlDisposicion(controlador);
    this.#leyenda = new Leyenda(controlador);
    this.#panelInformacion = new PanelInformacion(controlador, contexto);
    this.#indicadorEstado = new IndicadorEstado(controlador);

    const superior = InterfazUsuario.#zona(raiz, "superior");
    this.#panelBusqueda.montar(superior);
    this.#controlUmbral.montar(superior);
    this.#controlDisposicion.montar(superior);
    this.#barraNavegacion.montar(superior);
    this.#leyenda.montar(InterfazUsuario.#zona(raiz, "izquierda"));
    this.#panelInformacion.montar(InterfazUsuario.#zona(raiz, "derecha"));
    this.#indicadorEstado.montar(InterfazUsuario.#zona(raiz, "estado"));
  }

  mostrarEntidad(entidad, nodo, subgrafo) {
    this.#panelInformacion.mostrarEntidad(entidad, nodo, subgrafo);
  }

  /** El detalle de una entidad (eventos, imágenes, fuentes) ha llegado. */
  mostrarDetalle(idEntidad, detalle) {
    this.#panelInformacion.mostrarDetalle(idEntidad, detalle);
  }

  /** No se ha podido obtener el detalle de una entidad. */
  mostrarErrorDetalle(idEntidad, mensaje) {
    this.#panelInformacion.mostrarErrorDetalle(idEntidad, mensaje);
  }

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

  mostrarError(mensaje) {
    this.#indicadorEstado.mostrarError(mensaje);
  }

  setHabilitadoVolver(habilitado) {
    this.#barraNavegacion.setHabilitadoVolver(habilitado);
  }

  setUmbral(valor) {
    this.#controlUmbral.setValor(valor);
  }

  /**
   * @param {string} modo - el modo de disposición elegido (ModoDisposicion).
   */
  setModoDisposicion(modo) {
    this.#controlDisposicion.setModo(modo);
  }

  /**
   * @param {Object} datos - ver Leyenda.actualizar.
   */
  actualizarLeyenda(datos) {
    this.#leyenda.actualizar(datos);
  }

  /** La zona de la página con ese nombre (data-zona="..."). */
  static #zona(raiz, nombre) {
    const zona = raiz.querySelector("[data-zona=\"" + nombre + "\"]");
    if (zona === null) {
      throw new Error("Falta en la página la zona \"" + nombre + "\" (data-zona).");
    }
    return zona;
  }
}
