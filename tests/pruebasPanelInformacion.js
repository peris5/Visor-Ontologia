import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PanelInformacion } from '../src/interfaz/PanelInformacion.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Periodo } from '../src/modelo/Periodo.js';
import { Evento } from '../src/modelo/Evento.js';
import { Imagen } from '../src/modelo/Imagen.js';
import { FuenteExterna } from '../src/modelo/FuenteExterna.js';
import { DetalleEntidad } from '../src/modelo/DetalleEntidad.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';

/*
 * Pruebas de PanelInformacion (src/interfaz/).
 *
 *   Elena (central, pintora) ──Paint 0.9──▶ Retrato
 *   Elena (maestra) ──Mentorship 0.85── Luis (aprendiz), 1902–1908, Valencia
 *   Elena ──Friendship 0.75── Luis          (dos relaciones entre el mismo par)
 */

const NOMBRES_TIPOS = { Paint: "Pintura", Mentorship: "Mentoría", Friendship: "Amistad", Painter: "Pintor/a",
  Creator: "Creador/a", Book: "Libro", Work: "Trabajo" };

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
  const elena = new Persona({ id: "n1", propiedades: { name: "Elena", lastName: "Ferrando Peris", apodo: "La Ferrando" },
    subtipos: ["Creator", "Painter"] });
  const luis = new Persona({ id: "n2", propiedades: { name: "Luis", lastName: "Peris" } });
  const retrato = new ObraDeArte({ id: "n3", propiedades: { name_es: "Retrato", dimensions: "60 × 40 cm" } });
  const subgrafo = new Subgrafo(elena, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(retrato, 0.9, 1));
  subgrafo.agregarNodo(new NodoRelevante(luis, 0.85, 1));
  subgrafo.getNodo("n1").setCentralidad(1);
  subgrafo.agregarRelacion(new Relacion("p|n1|n3", elena, retrato, new TipoRelacion("Paint", "Pintura", "#4c8bf5",
    ["Creation", "Event"]), 0.9));
  subgrafo.agregarRelacion(new Relacion("m|n1|n2", elena, luis, new TipoRelacion("Mentorship", "Mentoría", "#f5a623",
    ["Relationship"]), 0.85, {
    idIntermedio: "m", roles: { n1: "maestra", n2: "aprendiz" }, periodo: new Periodo("1902", "1908", ""),
    lugar: "Valencia", fecha: null }));
  subgrafo.agregarRelacion(new Relacion("a|n1|n2", elena, luis, new TipoRelacion("Friendship", "Amistad", "#00ff00",
    ["Relationship"]), 0.75));

  const controlador = new ControladorFalsoInformacion();
  const panel = new PanelInformacion(controlador, { nombresTipos: NOMBRES_TIPOS });
  const padre = document.createElement("div");
  panel.montar(padre);
  return { panel: panel, controlador: controlador, padre: padre, subgrafo: subgrafo };
}

/**
 * Un detalle de Elena: nacimiento, defunción, un trabajo, una imagen y una fuente.
 *
 * @returns {DetalleEntidad}
 */
function crearDetalle() {
  const eventos = [
    new Evento({ id: "e1", tipo: "Birth", padres: ["Event"], periodo: new Periodo("1861", "1861", ""),
      lugar: "Gandía", fecha: "1861", participantes: [], sinRelacion: true }),
    new Evento({ id: "e2", tipo: "Death", padres: ["Event"], periodo: new Periodo("1932", "1932", ""),
      lugar: "Valencia", fecha: "", participantes: [], sinRelacion: true }),
    new Evento({ id: "e3", tipo: "Work", padres: ["Event"], nombre: "Trabajo en el Museo", rol: "restauradora",
      periodo: new Periodo("1900", "1905", ""), lugar: "", fecha: "", participantes: ["Museo de Bellas Artes"] })
  ];
  const imagenes = [new Imagen("https://example.org/imagenes/n1.jpg", "Retrato de Elena", 1)];
  const fuentes = [new FuenteExterna({ nombre: "Diccionario de pintores", tipo: "Book", url: "https://example.org/libro",
    actualizada: "2026-07-15", idExterno: "REF-1" })];
  return new DetalleEntidad("n1", eventos, imagenes, fuentes, ["Gandía", "Valencia", "España"]);
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

prueba("PanelInformacion: nombre, tipo con subtipos, atributos y relaciones de una entidad", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("n1");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  comprobarIgual(p.padre.querySelector("h2").textContent, "Elena Ferrando Peris", "nombre");
  comprobarIgual(p.padre.querySelector(".informacion-tipo").textContent, "Persona · Pintor/a · Creador/a",
    "tipo y subtipos traducidos, del más específico al más general");
  comprobar(p.padre.querySelector(".simbolo-persona") !== null, "símbolo del tipo");

  const datos = leerDatos(p.padre);
  comprobarIgual(datos["Apodo"], "La Ferrando", "una propiedad que el modelo no conoce también se ve");
  comprobarIgual(datos["Relevancia"], "100 %", "relevancia");
  comprobarIgual(datos["Nivel"], "Entidad central", "nivel");
  comprobarIgual(datos["Relaciones en el subgrafo"], "3", "número de relaciones");

  const relaciones = p.padre.querySelectorAll(".boton-relacion");
  comprobarIgual(relaciones.length, 3, "sus relaciones");
  comprobar(relaciones[0].textContent.includes("Pintura"), "primero la más relevante");
  comprobar(relaciones[1].textContent.includes("Luis Peris (aprendiz)"), "la otra entidad con su rol");
  relaciones[2].click();
  comprobarIgual(p.controlador.llamadas.join(","), "relacion:a|n1|n2", "al pulsar una relación se selecciona");
});

prueba("PanelInformacion: «Cargando…» y después el detalle (vida, eventos, imágenes y fuentes)", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("n1");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  comprobarIgual(p.padre.querySelector(".detalle-cargando").textContent, "Cargando…", "mientras llega el detalle");

  p.panel.mostrarDetalle("n1", crearDetalle());
  comprobarIgual(p.padre.querySelector(".detalle-cargando"), null, "ya no está cargando");
  const datos = leerDatos(p.padre);
  comprobarIgual(datos["Nacimiento"], "1861, Gandía", "nacimiento: fecha y lugar");
  comprobarIgual(datos["Defunción"], "1932, Valencia", "defunción: periodo y lugar");
  comprobarIgual(datos["Ubicación"], "Gandía, Valencia, España", "ubicación");

  const eventos = p.padre.querySelectorAll(".informacion-eventos li");
  comprobarIgual(eventos.length, 1, "solo los otros eventos (no nacimiento ni defunción)");
  comprobarIgual(eventos[0].textContent,
    "Trabajo: Trabajo en el Museo · 1900–1905 · como restauradora · con Museo de Bellas Artes", "evento");

  const imagen = p.padre.querySelector(".informacion-imagenes img");
  comprobarIgual(imagen.getAttribute("alt"), "Retrato de Elena", "texto alternativo = caption");
  comprobarIgual(imagen.getAttribute("src"), "https://example.org/imagenes/n1.jpg", "url");

  const fuente = p.padre.querySelector(".informacion-fuentes li");
  comprobarIgual(fuente.textContent, "Fuente: Diccionario de pintores (Libro), actualizada el 15/07/2026", "fuente");
  comprobarIgual(fuente.querySelector("a").getAttribute("href"), "https://example.org/libro", "con enlace");
});

prueba("PanelInformacion: el detalle de otra entidad se ignora y un error se avisa dentro del panel", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("n1");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  p.panel.mostrarDetalle("n9", crearDetalle());
  comprobar(p.padre.querySelector(".detalle-cargando") !== null, "sigue cargando: ese detalle no es suyo");
  p.panel.mostrarErrorDetalle("n1", "No se puede conectar con el servidor");
  comprobarIgual(p.padre.querySelector(".detalle-error").textContent,
    "No se ha podido cargar el detalle: No se puede conectar con el servidor", "aviso");
  comprobarIgual(p.padre.querySelector("h2").textContent, "Elena Ferrando Peris", "el resto del panel sigue");
});

prueba("PanelInformacion: «Explorar su red» solo si no es la central", function () {
  const p = crearPanelInformacion();
  const central = p.subgrafo.getNodo("n1");
  p.panel.mostrarEntidad(central.getEntidad(), central, p.subgrafo);
  comprobarIgual(p.padre.querySelector(".boton-explorar"), null, "la central no tiene el botón");

  const otro = p.subgrafo.getNodo("n3");
  p.panel.mostrarEntidad(otro.getEntidad(), otro, p.subgrafo);
  const boton = p.padre.querySelector(".boton-explorar");
  comprobar(boton !== null, "los demás sí");
  comprobarIgual(leerDatos(p.padre)["Nivel"], "Relación directa", "nivel 1");
  comprobarIgual(leerDatos(p.padre)["Dimensiones"], "60 × 40 cm", "dimensiones de la obra");
  boton.click();
  comprobarIgual(p.controlador.llamadas.join(","), "navegar:n3", "navega a esa entidad");
});

prueba("PanelInformacion: tipo, roles, periodo y lugar de una relación", function () {
  const p = crearPanelInformacion();
  const mentoria = p.subgrafo.getRelaciones()[1];
  p.panel.mostrarRelacion(mentoria, p.subgrafo);
  comprobarIgual(p.padre.querySelector("h2").textContent, "Mentoría", "tipo");
  comprobarIgual(p.padre.querySelector(".informacion-extremos").textContent,
    "Elena Ferrando Peris (maestra) → Luis Peris (aprendiz)", "extremos con sus roles");
  const datos = leerDatos(p.padre);
  comprobarIgual(datos["Periodo"], "1902–1908", "periodo");
  comprobarIgual(datos["Lugar"], "Valencia", "lugar");
  comprobarIgual(datos["Relevancia"], "85 % (asignada según el tipo de relación)", "relevancia");
  comprobar(p.padre.textContent.includes("Otras relaciones entre estas dos entidades"), "avisa de la amistad");
  p.padre.querySelectorAll(".boton-nodo")[1].click();
  comprobarIgual(p.controlador.llamadas.join(","), "nodo:n2", "al pulsar un extremo se selecciona su nodo");
});

prueba("PanelInformacion: se cierra con la × y es una región aria-live", function () {
  const p = crearPanelInformacion();
  const nodo = p.subgrafo.getNodo("n1");
  p.panel.mostrarEntidad(nodo.getEntidad(), nodo, p.subgrafo);
  const panel = p.padre.firstChild;
  comprobarIgual(panel.hidden, false, "visible");
  comprobarIgual(p.padre.querySelector("[aria-live]").getAttribute("aria-live"), "polite", "aria-live");
  p.padre.querySelector(".boton-cerrar").click();
  comprobarIgual(panel.hidden, true, "cerrado");
});
