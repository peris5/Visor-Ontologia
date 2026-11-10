import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { SimulacionFuerzas } from '../src/vista3d/SimulacionFuerzas.js';
import { CalculadorDisposicion } from '../src/vista3d/CalculadorDisposicion.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';

/*
 * Pruebas de SimulacionFuerzas (src/vista3d/). No necesitan WebGL.
 */

/**
 * Subgrafo de prueba con 10 nodos, varios niveles y una relación doble.
 * Las centralidades están puestas a mano (no hace falta que sean exactas).
 *
 * @returns {Subgrafo}
 */
function crearSubgrafoDePrueba() {
  const tipo = new TipoRelacion("conoce_a", "Conoce a", "#ffffff");
  const otroTipo = new TipoRelacion("autor_de", "Autor de", "#ff0000");
  const central = new Persona({ id: "C" });
  const subgrafo = new Subgrafo(central, 0.3);
  subgrafo.getNodo("C").setCentralidad(1);

  const datos = [
    ["A", Persona, 0.95, 1, 0.6],
    ["B", Organizacion, 0.9, 1, 0.5],
    ["D", ObraDeArte, 0.8, 1, 0.4],
    ["E", Persona, 0.7, 1, 0.3],
    ["F", ObraDeArte, 0.6, 2, 0.2],
    ["G", Organizacion, 0.5, 2, 0.2],
    ["H", Persona, 0.45, 2, 0.1],
    ["I", ObraDeArte, 0.4, 3, 0.1],
    ["J", Persona, 0.35, 3, 0]
  ];
  const entidades = new Map();
  entidades.set("C", central);
  for (let i = 0; i < datos.length; i++) {
    const fila = datos[i];
    const Clase = fila[1];
    const entidad = new Clase({ id: fila[0] });
    entidades.set(fila[0], entidad);
    const nodo = new NodoRelevante(entidad, fila[2], fila[3]);
    nodo.setCentralidad(fila[4]);
    subgrafo.agregarNodo(nodo);
  }

  const relaciones = [
    ["C", "A", 0.95], ["C", "B", 0.9], ["C", "D", 0.8], ["C", "E", 0.7],
    ["A", "B", 0.6], ["A", "F", 0.63], ["B", "G", 0.56], ["D", "H", 0.56],
    ["F", "I", 0.67], ["G", "J", 0.7], ["E", "H", 0.4]
  ];
  for (let i = 0; i < relaciones.length; i++) {
    const fila = relaciones[i];
    subgrafo.agregarRelacion(new Relacion("r" + i, entidades.get(fila[0]), entidades.get(fila[1]), tipo, fila[2]));
  }
  // Segunda relación entre A y F: solo debe crear un muelle.
  subgrafo.agregarRelacion(new Relacion("rDoble", entidades.get("F"), entidades.get("A"), otroTipo, 0.5));
  return subgrafo;
}

/**
 * Ejecuta la simulación hasta que se estabiliza (con un tope por seguridad).
 *
 * @param {SimulacionFuerzas} simulacion
 * @returns {number} pasos dados.
 */
function ejecutarHastaEstabilizar(simulacion) {
  let pasos = 0;
  while (simulacion.paso() && pasos < 10000) {
    pasos = pasos + 1;
  }
  return simulacion.getPasos();
}

/**
 * @returns {number} distancia entre dos posiciones { x, y, z }.
 */
function distancia(a, b) {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) + (a.z - b.z) * (a.z - b.z));
}

/**
 * @returns {number} distancia de una posición al origen.
 */
function distanciaAlOrigen(posicion) {
  return distancia(posicion, { x: 0, y: 0, z: 0 });
}

prueba("Simulación: se estabiliza en 400 pasos o menos", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, new CalculadorDisposicion().calcular(subgrafo));
  comprobar(simulacion.estaActiva(), "al iniciar debe estar activa");
  const pasos = ejecutarHastaEstabilizar(simulacion);
  comprobar(pasos <= 400, "ha necesitado " + pasos + " pasos");
  comprobar(!simulacion.estaActiva(), "al final no debe estar activa");
  comprobarIgual(simulacion.paso(), false, "paso() tras estabilizarse");
});

prueba("Simulación: la central queda en el origen", function () {
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(crearSubgrafoDePrueba(), null);
  ejecutarHastaEstabilizar(simulacion);
  const posicion = simulacion.getPosicion("C");
  comprobarIgual(distanciaAlOrigen(posicion), 0, "distancia de la central al origen");
});

prueba("Simulación: cada nodo queda exactamente a distanciaSegunRelevancia(su relevancia)", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, new CalculadorDisposicion().calcular(subgrafo));
  ejecutarHastaEstabilizar(simulacion);
  const nodos = subgrafo.getNodos();
  for (let i = 1; i < nodos.length; i++) {
    const id = nodos[i].getEntidad().getId();
    const esperada = simulacion.distanciaSegunRelevancia(nodos[i].getRelevancia());
    const obtenida = distanciaAlOrigen(simulacion.getPosicion(id));
    comprobar(Math.abs(obtenida - esperada) < 1e-6, "nodo " + id + ": distancia " + obtenida + ", esperada " + esperada);
  }
});

prueba("Simulación: a más relevancia, menor distancia al centro", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, null);
  ejecutarHastaEstabilizar(simulacion);
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < nodos.length; i++) {
    for (let j = 0; j < nodos.length; j++) {
      if (nodos[i].getRelevancia() > nodos[j].getRelevancia()) {
        const distanciaI = distanciaAlOrigen(simulacion.getPosicion(nodos[i].getEntidad().getId()));
        const distanciaJ = distanciaAlOrigen(simulacion.getPosicion(nodos[j].getEntidad().getId()));
        comprobar(distanciaI < distanciaJ, nodos[i].getEntidad().getId() + " es más relevante que " + nodos[j].getEntidad().getId() + " pero está más lejos");
      }
    }
  }
});

prueba("Simulación: una relación fuerte junta más a su pareja que una débil (cúmulos)", function () {
  // Dos parejas que cuelgan del centro con la misma relevancia (0.8):
  // A1–B1 unidas por una relación de 0.95 y A2–B2 por una de 0.35.
  const tipo = new TipoRelacion("t", "T", "#ffffff");
  const central = new Persona({ id: "C" });
  const subgrafo = new Subgrafo(central, 0.3);
  const ids = ["A1", "B1", "A2", "B2"];
  const entidades = new Map();
  for (let i = 0; i < ids.length; i++) {
    const entidad = new Persona({ id: ids[i] });
    entidades.set(ids[i], entidad);
    subgrafo.agregarNodo(new NodoRelevante(entidad, 0.8, 1));
    subgrafo.agregarRelacion(new Relacion("c" + i, central, entidad, tipo, 0.8));
  }
  subgrafo.agregarRelacion(new Relacion("fuerte", entidades.get("A1"), entidades.get("B1"), tipo, 0.95));
  subgrafo.agregarRelacion(new Relacion("debil", entidades.get("A2"), entidades.get("B2"), tipo, 0.35));

  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, null);
  ejecutarHastaEstabilizar(simulacion);
  const distanciaFuerte = distancia(simulacion.getPosicion("A1"), simulacion.getPosicion("B1"));
  const distanciaDebil = distancia(simulacion.getPosicion("A2"), simulacion.getPosicion("B2"));
  comprobar(distanciaFuerte < distanciaDebil, "fuerte: " + distanciaFuerte.toFixed(2) + ", débil: " + distanciaDebil.toFixed(2));
});

prueba("Simulación: ningún par de nodos se solapa teniendo en cuenta su tamaño", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, new CalculadorDisposicion().calcular(subgrafo));
  ejecutarHastaEstabilizar(simulacion);

  // Radio de la esfera que envuelve cada forma, con el tamaño de
  // FabricaNodosVisuales (0,45 + 1,35 · √centralidad). El cubo de lado 1,6
  // llega a 0,8 · √3 ≈ 1,39 del centro; el octaedro, a 1,3; la esfera, a 1.
  const nodos = subgrafo.getNodos();
  const radios = [];
  for (let i = 0; i < nodos.length; i++) {
    const tamano = 0.45 + 1.35 * Math.sqrt(nodos[i].getCentralidad());
    radios.push(tamano * 1.39);
  }
  for (let i = 0; i < nodos.length; i++) {
    for (let j = i + 1; j < nodos.length; j++) {
      const idI = nodos[i].getEntidad().getId();
      const idJ = nodos[j].getEntidad().getId();
      const separacion = distancia(simulacion.getPosicion(idI), simulacion.getPosicion(idJ));
      comprobar(separacion > radios[i] + radios[j], idI + " y " + idJ + " se solapan (distancia " + separacion.toFixed(2) + ")");
    }
  }
});

prueba("Simulación: funciona sin posiciones iniciales", function () {
  const subgrafo = crearSubgrafoDePrueba();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, null);
  ejecutarHastaEstabilizar(simulacion);
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < nodos.length; i++) {
    const posicion = simulacion.getPosicion(nodos[i].getEntidad().getId());
    comprobar(posicion !== null, "falta la posición de " + nodos[i].getEntidad().getId());
    comprobar(!Number.isNaN(posicion.x) && !Number.isNaN(posicion.y) && !Number.isNaN(posicion.z), "posición no válida");
  }
});

prueba("Simulación: no crea muelles para las relaciones de la central", function () {
  // Solo hay relaciones con la central: sin muelles, los dos nodos de igual
  // relevancia solo se repelen. Si hubiera muelles (longitud 3 para 0.95),
  // la central tiraría de ellos; como no los hay, se separan al máximo que
  // permite la repulsión.
  const tipo = new TipoRelacion("t", "T", "#ffffff");
  const central = new Persona({ id: "C" });
  const entidadA = new Persona({ id: "A" });
  const entidadB = new Persona({ id: "B" });
  const subgrafo = new Subgrafo(central, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(entidadA, 0.95, 1));
  subgrafo.agregarNodo(new NodoRelevante(entidadB, 0.95, 1));
  subgrafo.agregarRelacion(new Relacion("r1", central, entidadA, tipo, 0.95));
  subgrafo.agregarRelacion(new Relacion("r2", central, entidadB, tipo, 0.95));

  // Con repulsión 0 y sin muelles, nada se mueve: cada nodo se queda en su
  // posición inicial (ya colocada en su radio).
  const simulacion = new SimulacionFuerzas({ repulsion: 0 });
  const posicionesIniciales = new Map();
  posicionesIniciales.set("A", { x: 1, y: 0, z: 0 });
  posicionesIniciales.set("B", { x: 0, y: 0, z: 1 });
  simulacion.iniciar(subgrafo, posicionesIniciales);
  ejecutarHastaEstabilizar(simulacion);
  const radio = simulacion.distanciaSegunRelevancia(0.95);
  const posicionA = simulacion.getPosicion("A");
  const posicionB = simulacion.getPosicion("B");
  comprobar(Math.abs(posicionA.x - radio) < 1e-9 && Math.abs(posicionA.z) < 1e-9, "A se ha movido: algo tira de él");
  comprobar(Math.abs(posicionB.z - radio) < 1e-9 && Math.abs(posicionB.x) < 1e-9, "B se ha movido: algo tira de él");
});

prueba("Simulación: distanciaSegunRelevancia = 6 + (1 − r) · 40", function () {
  const simulacion = new SimulacionFuerzas();
  comprobarIgual(simulacion.distanciaSegunRelevancia(1), 6, "relevancia 1");
  comprobarIgual(simulacion.distanciaSegunRelevancia(0), 46, "relevancia 0");
  comprobarIgual(simulacion.distanciaSegunRelevancia(0.5), 26, "relevancia 0.5");
});
