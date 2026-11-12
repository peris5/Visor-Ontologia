import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PanelInformacion } from '../src/interfaz/PanelInformacion.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';

/*
 * Pruebas de PanelInformacion (src/interfaz/).
 *
 *   P01 (central) ──autor_de 0.9──▶ A03 ──restaurador_de 0.6──▶ P01
 *   (dos relaciones entre el mismo par)
 */

/**
 * Doble de ControladorExploracion: apunta lo que le pide el panel.
 */
class ControladorFalsoInformacion {
  constructor() {
    this.llamadas = [];
  }

  navegarA(id) {
    this.llamadas.push("navegar:" + id);
  }

  seleccionarRelacion(relacion) {
    this.llamadas.push("relacion:" + relacion.getId());
  }

  seleccionarNodo(nodo) {
    this.llamadas.push("nodo:" + nodo.getEntidad().getId());
  }
}

/**
 * @returns {Object} { panel, controlador, padre, subgrafo }
 */
function crearPanelInformacion() {
  const pintora = new Persona({ id: "P01", nombre: "Elena Montsalvat", descripcion: "Pintora de retratos.", atributos: { nacionalidad: "Española", fechaNacimiento: "1861", vacio: "" } });
  const cuadro = new ObraDeArte({ id: "A03", nombre: "Retrato de Elena", atributos: { tecnica: "Óleo" } });
  const subgrafo = new Subgrafo(pintora, 0.3);
  const nodoCuadro = new NodoRelevante(cuadro, 0.9, 1);
  nodoCuadro.setCentralidad(0.5);
  subgrafo.agregarNodo(nodoCuadro);
  subgrafo.getNodo("P01").setCentralidad(1);
  subgrafo.agregarRelacion(new Relacion("R07", pintora, cuadro, new TipoRelacion("autor_de", "Autor de", "#4c8bf5"), 0.9));
  subgrafo.agregarRelacion(new Relacion("R08", cuadro, pintora, new TipoRelacion("restaurador_de", "Restaurador de", "#f5a623"), 0.6));

  const controlador = new ControladorFalsoInformacion();
  const panel = new PanelInformacion(controlador);
  const padre = document.createElement("div");
  panel.montar(padre);
  return { panel: panel, controlador: controlador, padre: padre, subgrafo: subgrafo };
}

/**
 * @param {HTMLElement} padre
 * @returns {Object} nombre de cada dato (<dt>) → su valor (<dd>).
 */
function leerDatos(padre) {
  const datos = {};
  const nombres = padre.querySelectorAll("dt");
  for (let i = 0; i < nombres.length; i++) {
    datos[nombres[i].textContent] = nombres[i].nextElementSibling.textContent;
  }
  return datos;
}

prueba("PanelInformacion: nombre, tipo, atributos y relaciones de una entidad", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("P01");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  comprobarIgual(p.padre.querySelector("h2").textContent, "Elena Montsalvat", "nombre");
  comprobarIgual(p.padre.querySelector(".informacion-tipo").textContent, "Persona", "tipo");
  comprobar(p.padre.querySelector(".simbolo-persona") !== null, "símbolo del tipo");
  comprobarIgual(p.padre.querySelector(".informacion-descripcion").textContent, "Pintora de retratos.", "descripción");

  const datos = leerDatos(p.padre);
  comprobarIgual(datos["Nacionalidad"], "Española", "atributo nacionalidad");
  comprobarIgual(datos["Nacimiento"], "1861", "atributo fecha de nacimiento");
  comprobar(datos["Vacio"] === undefined, "los atributos sin valor no se muestran");
  comprobarIgual(datos["Relevancia"], "100 %", "relevancia");
  comprobarIgual(datos["Nivel"], "Entidad central", "nivel");
  comprobarIgual(datos["Relaciones en el subgrafo"], "2", "número de relaciones");

  const relaciones = p.padre.querySelectorAll(".boton-relacion");
  comprobarIgual(relaciones.length, 2, "sus relaciones");
  comprobar(relaciones[0].textContent.includes("Autor de"), "primero la más relevante");
  comprobar(relaciones[0].textContent.includes("Retrato de Elena"), "con la otra entidad");
  relaciones[1].click();
  comprobarIgual(p.controlador.llamadas.join(","), "relacion:R08", "al pulsar una relación se selecciona");
});

prueba("PanelInformacion: «Explorar su red» solo si no es la central", function () {
  const p = crearPanelInformacion();
  const central = p.subgrafo.getNodo("P01");
  p.panel.mostrarEntidad(central.getEntidad(), central, p.subgrafo);
  comprobarIgual(p.padre.querySelector(".boton-explorar"), null, "la central no tiene el botón");

  const otro = p.subgrafo.getNodo("A03");
  p.panel.mostrarEntidad(otro.getEntidad(), otro, p.subgrafo);
  const boton = p.padre.querySelector(".boton-explorar");
  comprobar(boton !== null, "los demás sí");
  comprobarIgual(leerDatos(p.padre)["Nivel"], "Relación directa", "nivel 1");
  boton.click();
  comprobarIgual(p.controlador.llamadas.join(","), "navegar:A03", "navega a esa entidad");
});

prueba("PanelInformacion: tipo, origen y destino de una relación", function () {
  const p = crearPanelInformacion();
  const relacion = p.subgrafo.getRelaciones()[1];
  p.panel.mostrarRelacion(relacion, p.subgrafo);
  comprobarIgual(p.padre.querySelector("h2").textContent, "Restaurador de", "tipo");
  const extremos = p.padre.querySelectorAll(".boton-nodo");
  comprobarIgual(extremos[0].textContent, "Retrato de Elena", "origen");
  comprobarIgual(extremos[1].textContent, "Elena Montsalvat", "destino");
  comprobarIgual(leerDatos(p.padre)["Relevancia"], "60 %", "relevancia");
  comprobar(p.padre.textContent.includes("Otras relaciones entre estas dos entidades"), "avisa de la otra relación del par");
  extremos[1].click();
  comprobarIgual(p.controlador.llamadas.join(","), "nodo:P01", "al pulsar un extremo se selecciona su nodo");
});

prueba("PanelInformacion: se cierra con la × y es una región aria-live", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("P01");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  const panel = p.padre.firstChild;
  comprobarIgual(panel.hidden, false, "visible");
  comprobarIgual(p.padre.querySelector("[aria-live]").getAttribute("aria-live"), "polite", "aria-live");
  p.padre.querySelector(".boton-cerrar").click();
  comprobarIgual(panel.hidden, true, "cerrado");
});
