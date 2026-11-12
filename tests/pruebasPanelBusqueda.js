import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PanelBusqueda } from '../src/interfaz/PanelBusqueda.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';

/*
 * Pruebas de PanelBusqueda (src/interfaz/). El panel se monta en la página
 * (y se quita al terminar) con un doble del controlador.
 */

/**
 * Doble de ControladorExploracion: apunta lo que le pide el buscador y, al
 * buscar, contesta con unas sugerencias fijas (como haría el de verdad).
 */
class ControladorFalsoBusqueda {
  constructor() {
    this.panel = null;
    this.busquedas = [];
    this.seleccionadas = [];
  }

  buscar(texto, tipo) {
    this.busquedas.push(texto + "|" + tipo);
    this.panel.mostrarSugerencias(crearSugerenciasDePrueba(), texto);
  }

  seleccionarEntidad(id) {
    this.seleccionadas.push(id);
  }
}

/**
 * @returns {Object[]}
 */
function crearSugerenciasDePrueba() {
  return [
    { id: "p01", nombre: "Elena Montsalvat", tipo: TipoEntidad.PERSONA },
    { id: "o01", nombre: "Academia de Bellas Artes", tipo: TipoEntidad.ORGANIZACION },
    { id: "a01", nombre: "Retrato de Elena", tipo: TipoEntidad.OBRA_DE_ARTE }
  ];
}

/**
 * @returns {Object} { panel, controlador, padre, campo, lista }
 */
function crearPanelBusqueda() {
  const controlador = new ControladorFalsoBusqueda();
  const panel = new PanelBusqueda(controlador);
  controlador.panel = panel;
  const padre = document.createElement("div");
  document.body.appendChild(padre);
  panel.montar(padre);
  return {
    panel: panel,
    controlador: controlador,
    padre: padre,
    campo: padre.querySelector("input"),
    lista: padre.querySelector("[role=listbox]")
  };
}

/**
 * Simula una tecla pulsada en el campo.
 *
 * @param {HTMLElement} campo
 * @param {string} tecla - por ejemplo "ArrowDown".
 */
function pulsar(campo, tecla) {
  campo.dispatchEvent(new KeyboardEvent("keydown", { key: tecla, bubbles: true }));
}

prueba("PanelBusqueda: muestra las sugerencias con su nombre y su tipo", function () {
  const p = crearPanelBusqueda();
  try {
    p.panel.mostrarSugerencias(crearSugerenciasDePrueba(), "el");
    const opciones = p.lista.querySelectorAll("[role=option]");
    comprobarIgual(opciones.length, 3, "número de sugerencias");
    comprobarIgual(opciones[0].querySelector(".sugerencia-nombre").textContent, "Elena Montsalvat", "nombre");
    comprobarIgual(opciones[0].querySelector(".sugerencia-tipo").textContent, "Persona", "tipo");
    comprobar(opciones[1].querySelector(".simbolo-organizacion") !== null, "símbolo del tipo");
    comprobarIgual(p.lista.hidden, false, "la lista está abierta");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: mensaje cuando no hay resultados", function () {
  const p = crearPanelBusqueda();
  try {
    p.panel.mostrarSugerencias([], "zzzz");
    comprobarIgual(p.lista.textContent, "No se ha encontrado ninguna entidad", "mensaje");
    comprobarIgual(p.lista.hidden, false, "se ve");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: las flechas e Intro eligen la sugerencia correcta", function () {
  const p = crearPanelBusqueda();
  try {
    p.panel.mostrarSugerencias(crearSugerenciasDePrueba(), "el");
    pulsar(p.campo, "ArrowDown");
    pulsar(p.campo, "ArrowDown");
    pulsar(p.campo, "ArrowDown");
    pulsar(p.campo, "ArrowUp");
    pulsar(p.campo, "Enter");
    comprobarIgual(p.controlador.seleccionadas.join(","), "o01", "la segunda");
    comprobarIgual(p.campo.value, "Academia de Bellas Artes", "su nombre queda en el campo");
    comprobarIgual(p.lista.hidden, true, "la lista se cierra");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: Intro sin ninguna marcada elige la primera (y busca si aún no lo había hecho)", function () {
  const p = crearPanelBusqueda();
  try {
    p.campo.value = "elena";
    p.campo.dispatchEvent(new Event("input"));
    // Sin esperar los 150 ms: Intro busca enseguida y elige la primera.
    pulsar(p.campo, "Enter");
    comprobarIgual(p.controlador.busquedas.join(","), "elena|", "búsqueda (tipo \"\" = todos)");
    comprobarIgual(p.controlador.seleccionadas.join(","), "p01", "la primera");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: Escape cierra la lista", function () {
  const p = crearPanelBusqueda();
  try {
    p.panel.mostrarSugerencias(crearSugerenciasDePrueba(), "el");
    pulsar(p.campo, "Escape");
    comprobarIgual(p.lista.hidden, true, "lista cerrada");
    comprobarIgual(p.campo.getAttribute("aria-expanded"), "false", "aria-expanded");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: atributos ARIA del patrón combobox", function () {
  const p = crearPanelBusqueda();
  try {
    comprobarIgual(p.campo.getAttribute("role"), "combobox", "role del campo");
    comprobarIgual(p.campo.getAttribute("aria-controls"), p.lista.id, "aria-controls apunta a la lista");
    comprobarIgual(p.campo.getAttribute("aria-expanded"), "false", "cerrada al principio");
    comprobarIgual(p.campo.getAttribute("maxlength"), "100", "máximo 100 caracteres");
    comprobar(p.padre.querySelector("label[for=\"" + p.campo.id + "\"]") !== null, "el campo tiene su <label>");

    p.panel.mostrarSugerencias(crearSugerenciasDePrueba(), "el");
    comprobarIgual(p.campo.getAttribute("aria-expanded"), "true", "abierta");
    pulsar(p.campo, "ArrowDown");
    const marcada = p.lista.querySelector("[aria-selected=true]");
    comprobar(marcada !== null, "hay una opción con aria-selected");
    comprobarIgual(p.campo.getAttribute("aria-activedescendant"), marcada.id, "aria-activedescendant");
  } finally {
    p.padre.remove();
  }
});

prueba("PanelBusqueda: el desplegable de tipo tiene las cuatro opciones y filtra", function () {
  const p = crearPanelBusqueda();
  try {
    const selector = p.padre.querySelector("select");
    comprobarIgual(selector.options.length, 4, "Todos, Personas, Organizaciones y Obras de arte");
    p.campo.value = "elena";
    selector.value = TipoEntidad.OBRA_DE_ARTE;
    selector.dispatchEvent(new Event("change"));
    comprobarIgual(p.controlador.busquedas.join(","), "elena|OBRA_DE_ARTE", "al cambiar el tipo se busca otra vez");
  } finally {
    p.padre.remove();
  }
});
