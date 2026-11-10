import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { FabricaNodosVisuales } from '../src/vista3d/FabricaNodosVisuales.js';
import { NodoVisual } from '../src/vista3d/NodoVisual.js';
import { NodoPersona } from '../src/vista3d/NodoPersona.js';
import { NodoOrganizacion } from '../src/vista3d/NodoOrganizacion.js';
import { NodoObra } from '../src/vista3d/NodoObra.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';

/*
 * Pruebas de FabricaNodosVisuales y NodoVisual (src/vista3d/).
 * Crean mallas de Three.js, pero no dibujan: no necesitan WebGL.
 */

/**
 * @param {Entidad} entidad
 * @param {number} centralidad
 * @returns {NodoRelevante}
 */
function crearNodo(entidad, centralidad) {
  const nodo = new NodoRelevante(entidad, 0.8, 1);
  nodo.setCentralidad(centralidad);
  return nodo;
}

prueba("Fábrica 3D: cada tipo de entidad da su subclase", function () {
  const fabrica = new FabricaNodosVisuales();
  const persona = fabrica.crear(crearNodo(new Persona({ id: "p" }), 0.5));
  const organizacion = fabrica.crear(crearNodo(new Organizacion({ id: "o" }), 0.5));
  const obra = fabrica.crear(crearNodo(new ObraDeArte({ id: "a" }), 0.5));
  comprobar(persona instanceof NodoPersona, "una Persona debería dar un NodoPersona");
  comprobar(organizacion instanceof NodoOrganizacion, "una Organizacion debería dar un NodoOrganizacion");
  comprobar(obra instanceof NodoObra, "una ObraDeArte debería dar un NodoObra");
  comprobarIgual(persona.getMalla().material.color.getHexString(), "4c8bf5", "color de la persona");
  comprobarIgual(organizacion.getMalla().material.color.getHexString(), "f5a623", "color de la organización");
  comprobarIgual(obra.getMalla().material.color.getHexString(), "2bb673", "color de la obra");
});

prueba("Fábrica 3D: tamaño 0,45 con centralidad 0 y 1,8 con centralidad 1", function () {
  const fabrica = new FabricaNodosVisuales();
  const pequeno = fabrica.crear(crearNodo(new Persona({ id: "p1" }), 0));
  const grande = fabrica.crear(crearNodo(new Persona({ id: "p2" }), 1));
  const intermedio = fabrica.crear(crearNodo(new Persona({ id: "p3" }), 0.25));
  comprobarIgual(redondear(pequeno.getMalla().scale.x), 0.45, "centralidad 0");
  comprobarIgual(redondear(grande.getMalla().scale.x), 1.8, "centralidad 1");
  comprobarIgual(redondear(intermedio.getMalla().scale.x), redondear(0.45 + 1.35 * 0.5), "centralidad 0.25 (√0.25 = 0.5)");
});

prueba("Fábrica 3D: no se puede instanciar NodoVisual (es abstracta)", function () {
  let huboError = false;
  try {
    new NodoVisual(crearNodo(new Persona({ id: "p" }), 0.5), 1);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "new NodoVisual(...) debería lanzar un error");
});

prueba("Fábrica 3D: las tres geometrías son distintas", function () {
  const fabrica = new FabricaNodosVisuales();
  const tipoPersona = fabrica.crear(crearNodo(new Persona({ id: "p" }), 0.5)).getMalla().geometry.type;
  const tipoOrganizacion = fabrica.crear(crearNodo(new Organizacion({ id: "o" }), 0.5)).getMalla().geometry.type;
  const tipoObra = fabrica.crear(crearNodo(new ObraDeArte({ id: "a" }), 0.5)).getMalla().geometry.type;
  comprobarIgual(tipoPersona, "SphereGeometry", "geometría de la persona");
  comprobarIgual(tipoOrganizacion, "BoxGeometry", "geometría de la organización");
  comprobarIgual(tipoObra, "OctahedronGeometry", "geometría de la obra");
});

prueba("NodoVisual: la malla apunta a su NodoVisual y la etiqueta sigue a la visibilidad", function () {
  const visual = new FabricaNodosVisuales().crear(crearNodo(new Persona({ id: "p", nombre: "Pepa" }), 0.5));
  const malla = visual.getMalla();
  comprobar(malla.userData.visual === visual, "userData.visual debe ser el NodoVisual");
  const etiqueta = malla.children[0];
  comprobarIgual(etiqueta.element.textContent, "Pepa", "texto de la etiqueta");
  comprobarIgual(etiqueta.visible, false, "la etiqueta empieza oculta");
  visual.mostrarEtiqueta(true);
  comprobarIgual(etiqueta.visible, true, "mostrarEtiqueta(true)");
  visual.setVisible(false);
  comprobarIgual(etiqueta.visible, false, "al ocultar el nodo se oculta la etiqueta");
  visual.setVisible(true);
  comprobarIgual(etiqueta.visible, true, "al volver a mostrar el nodo vuelve la etiqueta");
});

prueba("NodoVisual: resaltar da brillo y agranda un 25 %", function () {
  const visual = new FabricaNodosVisuales().crear(crearNodo(new Persona({ id: "p" }), 1));
  visual.resaltar(true);
  comprobarIgual(visual.getMalla().material.emissive.getHex(), 0x555555, "brillo al resaltar");
  comprobarIgual(redondear(visual.getMalla().scale.x), redondear(1.8 * 1.25), "tamaño al resaltar");
  visual.resaltar(false);
  comprobarIgual(visual.getMalla().material.emissive.getHex(), 0x000000, "sin brillo");
  comprobarIgual(redondear(visual.getMalla().scale.x), 1.8, "tamaño normal");
});
