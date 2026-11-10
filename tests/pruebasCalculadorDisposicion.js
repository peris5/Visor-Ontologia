import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { CalculadorDisposicion } from '../src/vista3d/CalculadorDisposicion.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';

/*
 * Pruebas de CalculadorDisposicion (src/vista3d/).
 *
 *   C ── A (0.9) ── X (0.72, nivel 2) ── Z (0.5, nivel 3)
 *   C ── B (0.6)
 *   C ── D (0.4)
 */

/**
 * @returns {Subgrafo}
 */
function crearSubgrafoDePrueba() {
  const tipo = new TipoRelacion("t", "T", "#ffffff");
  const central = new Persona({ id: "C" });
  const entidades = new Map();
  entidades.set("C", central);
  const subgrafo = new Subgrafo(central, 0.3);
  const datos = [["A", 0.9, 1], ["B", 0.6, 1], ["D", 0.4, 1], ["X", 0.72, 2], ["Z", 0.5, 3]];
  for (let i = 0; i < datos.length; i++) {
    const entidad = new ObraDeArte({ id: datos[i][0] });
    entidades.set(datos[i][0], entidad);
    subgrafo.agregarNodo(new NodoRelevante(entidad, datos[i][1], datos[i][2]));
  }
  const relaciones = [["C", "A", 0.9], ["C", "B", 0.6], ["C", "D", 0.4], ["A", "X", 0.8], ["X", "Z", 0.7]];
  for (let i = 0; i < relaciones.length; i++) {
    const fila = relaciones[i];
    subgrafo.agregarRelacion(new Relacion("r" + i, entidades.get(fila[0]), entidades.get(fila[1]), tipo, fila[2]));
  }
  return subgrafo;
}

prueba("Disposición: la central está en el origen", function () {
  const posiciones = new CalculadorDisposicion().calcular(crearSubgrafoDePrueba());
  comprobarIgual(posiciones.get("C").length(), 0, "distancia de la central al origen");
});

prueba("Disposición: los de nivel 1 están a 6 + (1 − r) · 14", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const posiciones = new CalculadorDisposicion().calcular(subgrafo);
  const ids = ["A", "B", "D"];
  for (let i = 0; i < ids.length; i++) {
    const relevancia = subgrafo.getNodo(ids[i]).getRelevancia();
    const esperada = 6 + (1 - relevancia) * 14;
    const obtenida = posiciones.get(ids[i]).length();
    comprobar(Math.abs(obtenida - esperada) < 1e-9, ids[i] + ": " + obtenida + ", esperada " + esperada);
  }
});

prueba("Disposición: todos los nodos tienen posición", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const posiciones = new CalculadorDisposicion().calcular(subgrafo);
  const nodos = subgrafo.getNodos();
  comprobarIgual(posiciones.size, nodos.length, "número de posiciones");
  for (let i = 0; i < nodos.length; i++) {
    const posicion = posiciones.get(nodos[i].getEntidad().getId());
    comprobar(posicion !== undefined, "falta la posición de " + nodos[i].getEntidad().getId());
    comprobar(!Number.isNaN(posicion.x) && !Number.isNaN(posicion.y) && !Number.isNaN(posicion.z), "posición no válida");
  }
});

prueba("Disposición: los niveles siguientes quedan alrededor de su padre", function () {
  const posiciones = new CalculadorDisposicion().calcular(crearSubgrafoDePrueba());
  // X (relevancia 0.72) a 3 + 0.28 · 6 = 4.68 de A.
  const distanciaXA = posiciones.get("X").distanceTo(posiciones.get("A"));
  comprobar(Math.abs(distanciaXA - 4.68) < 1e-9, "distancia de X a su padre A: " + distanciaXA);
  comprobar(posiciones.get("X").length() > posiciones.get("A").length() - 1, "X debería quedar hacia fuera de A");
});

prueba("Disposición: dos llamadas dan el mismo resultado", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const primera = new CalculadorDisposicion().calcular(subgrafo);
  const segunda = new CalculadorDisposicion().calcular(subgrafo);
  for (const id of primera.keys()) {
    comprobar(primera.get(id).equals(segunda.get(id)), "la posición de " + id + " ha cambiado");
  }
});
