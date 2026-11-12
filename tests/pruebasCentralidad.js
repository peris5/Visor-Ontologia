import { prueba, comprobarIgual } from './miniPruebas.js';
import { CalculadorCentralidad } from '../src/logica/CalculadorCentralidad.js';
import { Persona } from '../src/modelo/Persona.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';

/*
 * Pruebas de CalculadorCentralidad (src/logica/), recuperadas del incremento 1.
 *
 * Subgrafo hecho a mano:
 *   A ──0.5── B ──0.5── C        D (sin relaciones)
 *
 * Sumas: A = 0.5, B = 1.0, C = 0.5, D = 0.  Máximo = 1.0
 * Centralidad: A = 0.5, B = 1, C = 0.5, D = 0
 */

prueba("Centralidad: valores exactos en un subgrafo hecho a mano", function () {
  const entidadA = new Persona({ id: "A" });
  const entidadB = new Persona({ id: "B" });
  const entidadC = new Persona({ id: "C" });
  const entidadD = new Persona({ id: "D" });
  const tipo = new TipoRelacion("pareja", "Pareja", "#000000");

  const subgrafo = new Subgrafo(entidadA, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(entidadB, 0.5, 1));
  subgrafo.agregarNodo(new NodoRelevante(entidadC, 0.25, 2));
  subgrafo.agregarNodo(new NodoRelevante(entidadD, 0.4, 1));
  subgrafo.agregarRelacion(new Relacion("r1", entidadA, entidadB, tipo, 0.5));
  subgrafo.agregarRelacion(new Relacion("r2", entidadB, entidadC, tipo, 0.5));

  const calculador = new CalculadorCentralidad();
  const centralidad = calculador.calcular(subgrafo);

  comprobarIgual(centralidad.get("A"), 0.5, "centralidad de A");
  comprobarIgual(centralidad.get("B"), 1, "centralidad de B (la máxima)");
  comprobarIgual(centralidad.get("C"), 0.5, "centralidad de C");
  comprobarIgual(centralidad.get("D"), 0, "centralidad de D (sin relaciones)");
});

prueba("Centralidad: si no hay relaciones, todos valen 0", function () {
  const entidadA = new Persona({ id: "A" });
  const entidadB = new Persona({ id: "B" });
  const subgrafo = new Subgrafo(entidadA, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(entidadB, 0.5, 1));

  const centralidad = new CalculadorCentralidad().calcular(subgrafo);

  comprobarIgual(centralidad.get("A"), 0, "centralidad de A");
  comprobarIgual(centralidad.get("B"), 0, "centralidad de B");
});
