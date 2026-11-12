import { prueba, comprobarIgual } from './miniPruebas.js';
import { FiltroVisualizacion } from '../src/logica/FiltroVisualizacion.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';

/*
 * Pruebas de FiltroVisualizacion (src/logica/).
 *
 *   P (persona, la central) ──autor_de──▶ A (obra) ◀──conserva── O (organización)
 */

/**
 * @returns {Object} entidades, nodos, tipos y relaciones de prueba.
 */
function crearElementosDelFiltro() {
  const persona = new Persona({ id: "P", nombre: "Pintora" });
  const obra = new ObraDeArte({ id: "A", nombre: "Cuadro" });
  const organizacion = new Organizacion({ id: "O", nombre: "Museo" });
  const autorDe = new TipoRelacion("autor_de", "Autor de", "#ff0000");
  const conserva = new TipoRelacion("conserva", "Conserva", "#00ff00");
  return {
    nodoPersona: new NodoRelevante(persona, 1, 0),
    nodoObra: new NodoRelevante(obra, 0.9, 1),
    nodoOrganizacion: new NodoRelevante(organizacion, 0.7, 2),
    autorDe: autorDe,
    conserva: conserva,
    relacionAutor: new Relacion("r1", persona, obra, autorDe, 0.9),
    relacionConserva: new Relacion("r2", organizacion, obra, conserva, 0.8)
  };
}

prueba("Filtro: al principio todo es visible", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  comprobarIgual(filtro.esVisibleNodo(e.nodoObra, "P"), true, "obra");
  comprobarIgual(filtro.esVisibleNodo(e.nodoOrganizacion, "P"), true, "organización");
  comprobarIgual(filtro.esVisibleRelacion(e.relacionAutor, "P"), true, "autor_de");
  comprobarIgual(filtro.esVisibleRelacion(e.relacionConserva, "P"), true, "conserva");
  comprobarIgual(filtro.esTipoNodoActivo(TipoEntidad.PERSONA), true, "tipo persona activo");
  comprobarIgual(filtro.esTipoRelacionActivo(e.autorDe), true, "tipo autor_de activo");
});

prueba("Filtro: ocultar y volver a mostrar un tipo de nodo", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  filtro.alternarTipoNodo(TipoEntidad.OBRA_DE_ARTE);
  comprobarIgual(filtro.esVisibleNodo(e.nodoObra, "P"), false, "obra oculta");
  comprobarIgual(filtro.esVisibleNodo(e.nodoOrganizacion, "P"), true, "la organización se sigue viendo");
  filtro.alternarTipoNodo(TipoEntidad.OBRA_DE_ARTE);
  comprobarIgual(filtro.esVisibleNodo(e.nodoObra, "P"), true, "obra visible otra vez");
});

prueba("Filtro: la central se ve aunque su tipo esté oculto", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  filtro.alternarTipoNodo(TipoEntidad.PERSONA);
  comprobarIgual(filtro.esTipoNodoActivo(TipoEntidad.PERSONA), false, "tipo persona inactivo");
  comprobarIgual(filtro.esVisibleNodo(e.nodoPersona, "P"), true, "la central (persona) se ve");
  comprobarIgual(filtro.esVisibleRelacion(e.relacionAutor, "P"), true, "y sus relaciones también");
});

prueba("Filtro: una relación no se ve si se oculta su tipo o uno de sus extremos", function () {
  const e = crearElementosDelFiltro();
  const porTipo = new FiltroVisualizacion();
  porTipo.alternarTipoRelacion(e.conserva);
  comprobarIgual(porTipo.esVisibleRelacion(e.relacionConserva, "P"), false, "tipo conserva oculto");
  comprobarIgual(porTipo.esVisibleRelacion(e.relacionAutor, "P"), true, "autor_de se sigue viendo");

  const porExtremo = new FiltroVisualizacion();
  porExtremo.alternarTipoNodo(TipoEntidad.ORGANIZACION);
  comprobarIgual(porExtremo.esVisibleRelacion(e.relacionConserva, "P"), false, "su origen (organización) está oculto");
  comprobarIgual(porExtremo.esTipoRelacionActivo(e.conserva), true, "pero el tipo sigue activo");
});

prueba("Filtro: ocultar por id funciona con otro objeto TipoRelacion del mismo id", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  filtro.alternarTipoRelacion(e.autorDe);
  // Otro subgrafo crea su propio objeto «Autor de»: sigue oculto.
  const autorDeDeOtroSubgrafo = new TipoRelacion("autor_de", "Autor de", "#ff0000");
  comprobarIgual(filtro.esTipoRelacionActivo(autorDeDeOtroSubgrafo), false, "mismo id, otro objeto");
});

prueba("Filtro: «Todas» y «Ninguna» (setTipoRelacionActivo)", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  filtro.setTipoRelacionActivo(e.autorDe, false);
  filtro.setTipoRelacionActivo(e.conserva, false);
  filtro.setTipoRelacionActivo(e.conserva, false);
  comprobarIgual(filtro.esTipoRelacionActivo(e.autorDe), false, "Ninguna: autor_de");
  comprobarIgual(filtro.esTipoRelacionActivo(e.conserva), false, "Ninguna: conserva");
  filtro.setTipoRelacionActivo(e.autorDe, true);
  filtro.setTipoRelacionActivo(e.conserva, true);
  comprobarIgual(filtro.esTipoRelacionActivo(e.autorDe), true, "Todas: autor_de");
  comprobarIgual(filtro.esTipoRelacionActivo(e.conserva), true, "Todas: conserva (ocultado dos veces, se muestra con una)");
});

prueba("Filtro: restablecer vuelve a mostrarlo todo", function () {
  const filtro = new FiltroVisualizacion();
  const e = crearElementosDelFiltro();
  filtro.alternarTipoNodo(TipoEntidad.OBRA_DE_ARTE);
  filtro.alternarTipoRelacion(e.autorDe);
  filtro.restablecer();
  comprobarIgual(filtro.esVisibleNodo(e.nodoObra, "P"), true, "obra");
  comprobarIgual(filtro.esVisibleRelacion(e.relacionAutor, "P"), true, "autor_de");
});
