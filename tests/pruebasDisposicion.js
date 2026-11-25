import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { DetectorComunidades } from '../src/logica/DetectorComunidades.js';
import { CalculadorDisposicion } from '../src/vista3d/CalculadorDisposicion.js';
import { SimulacionFuerzas } from '../src/vista3d/SimulacionFuerzas.js';
import { ModoDisposicion } from '../src/vista3d/ModoDisposicion.js';
import { ControlDisposicion } from '../src/interfaz/ControlDisposicion.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';

/*
 * Pruebas de los modos de disposición: DetectorComunidades (src/logica/),
 * CalculadorDisposicion.direccionesObjetivo y la atracción hacia una
 * dirección de SimulacionFuerzas (src/vista3d/), y ControlDisposicion
 * (src/interfaz/).
 *
 * Subgrafo de prueba: dos grupos muy unidos por dentro y unidos entre sí
 * solo por una relación débil, más un nodo suelto.
 *
 *          ┌── grupo de personas ──┐          ┌── grupo de obras ──┐
 *   C ──── P1 ═ P2 ═ P3 (0,9)   P1 ── O1 (0,3)   O1 ═ O2 ═ O3 (0,9)
 *   C ──── M  (organización, solo unida a la central)
 */

function crearSubgrafoConDosGrupos() {
  const tipo = new TipoRelacion("t", "T", "#ffffff");
  const central = new Persona({ id: "C" });
  const subgrafo = new Subgrafo(central, 0.1);
  const entidades = new Map();
  entidades.set("C", central);
  const datos = [["P1", Persona], ["P2", Persona], ["P3", Persona], ["O1", ObraDeArte], ["O2", ObraDeArte],
    ["O3", ObraDeArte], ["M", Organizacion]];
  for (let i = 0; i < datos.length; i++) {
    const Clase = datos[i][1];
    const entidad = new Clase({ id: datos[i][0] });
    entidades.set(datos[i][0], entidad);
    subgrafo.agregarNodo(new NodoRelevante(entidad, 0.8, 1));
  }
  const relaciones = [
    ["C", "P1", 0.9], ["C", "O1", 0.9], ["C", "M", 0.9],
    ["P1", "P2", 0.9], ["P2", "P3", 0.9], ["P1", "P3", 0.9],
    ["O1", "O2", 0.9], ["O2", "O3", 0.9], ["O1", "O3", 0.9],
    ["P1", "O1", 0.3]
  ];
  for (let i = 0; i < relaciones.length; i++) {
    const fila = relaciones[i];
    subgrafo.agregarRelacion(new Relacion("r" + i, entidades.get(fila[0]), entidades.get(fila[1]), tipo, fila[2]));
  }
  return subgrafo;
}

/**
 * @param {{x:number, y:number, z:number}} a
 * @param {{x:number, y:number, z:number}} b
 * @returns {number} producto escalar (1 si apuntan igual, −1 si opuestos).
 */
function productoEscalar(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * @param {{x:number, y:number, z:number}} v
 * @returns {{x:number, y:number, z:number}} el vector con longitud 1.
 */
function normalizar(v) {
  const longitud = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / longitud, y: v.y / longitud, z: v.z / longitud };
}

prueba("DetectorComunidades: encuentra los dos grupos unidos por una relación débil", function () {
  const grupos = new DetectorComunidades().detectar(crearSubgrafoConDosGrupos());
  comprobarIgual(grupos.get("P1"), grupos.get("P2"), "P1 y P2 juntos");
  comprobarIgual(grupos.get("P2"), grupos.get("P3"), "P2 y P3 juntos");
  comprobarIgual(grupos.get("O1"), grupos.get("O2"), "O1 y O2 juntos");
  comprobarIgual(grupos.get("O2"), grupos.get("O3"), "O2 y O3 juntos");
  comprobar(grupos.get("P1") !== grupos.get("O1"), "las personas y las obras, en grupos distintos");
  comprobar(grupos.get("M") !== grupos.get("P1") && grupos.get("M") !== grupos.get("O1"), "M, solo");
});

prueba("DetectorComunidades: la central no participa y los grupos se numeran de mayor a menor", function () {
  const grupos = new DetectorComunidades().detectar(crearSubgrafoConDosGrupos());
  comprobar(!grupos.has("C"), "la central no tiene grupo");
  comprobar(grupos.get("P1") <= 1 && grupos.get("O1") <= 1, "los dos grupos de 3 son el 0 y el 1");
  comprobarIgual(grupos.get("M"), 2, "el nodo suelto, el último");
});

prueba("DetectorComunidades: es determinista", function () {
  const primera = new DetectorComunidades().detectar(crearSubgrafoConDosGrupos());
  const segunda = new DetectorComunidades().detectar(crearSubgrafoConDosGrupos());
  for (const id of primera.keys()) {
    comprobarIgual(segunda.get(id), primera.get(id), "grupo de " + id);
  }
});

prueba("CalculadorDisposicion: en modo libre ningún nodo tiene dirección", function () {
  const direcciones = new CalculadorDisposicion().direccionesObjetivo(crearSubgrafoConDosGrupos(), ModoDisposicion.LIBRE, null);
  comprobarIgual(direcciones.size, 0, "ninguna dirección");
});

prueba("CalculadorDisposicion: por grupos, una dirección por grupo y los sueltos libres", function () {
  const subgrafo = crearSubgrafoConDosGrupos();
  const grupos = new DetectorComunidades().detectar(subgrafo);
  const direcciones = new CalculadorDisposicion().direccionesObjetivo(subgrafo, ModoDisposicion.POR_GRUPOS, grupos);
  comprobar(direcciones.get("P1") === direcciones.get("P3"), "el mismo grupo, la misma dirección");
  comprobar(direcciones.get("P1") !== direcciones.get("O1"), "grupos distintos, direcciones distintas");
  comprobar(!direcciones.has("M"), "el nodo suelto queda libre");
  const longitud = Math.sqrt(productoEscalar(direcciones.get("P1"), direcciones.get("P1")));
  comprobar(Math.abs(longitud - 1) < 1e-9, "dirección de longitud 1");
});

prueba("SimulacionFuerzas: con direcciones objetivo, cada nodo acaba en su zona sin cambiar su distancia", function () {
  const subgrafo = crearSubgrafoConDosGrupos();
  const calculador = new CalculadorDisposicion();
  const simulacion = new SimulacionFuerzas();
  simulacion.iniciar(subgrafo, calculador.calcular(subgrafo));
  const grupos = new DetectorComunidades().detectar(subgrafo);
  const direcciones = calculador.direccionesObjetivo(subgrafo, ModoDisposicion.POR_GRUPOS, grupos);
  simulacion.setDireccionesObjetivo(direcciones);
  while (simulacion.paso()) {
    // Se avanza hasta que se estabiliza.
  }
  // M está solo en su grupo: no tiene dirección y no se comprueba.
  const ids = ["P1", "P2", "P3", "O1", "O2", "O3"];
  for (let i = 0; i < ids.length; i++) {
    const posicion = simulacion.getPosicion(ids[i]);
    const parecido = productoEscalar(normalizar(posicion), direcciones.get(ids[i]));
    comprobar(parecido > 0.7, ids[i] + " está en su zona (parecido " + parecido.toFixed(2) + ")");
    const distancia = Math.sqrt(productoEscalar(posicion, posicion));
    comprobar(Math.abs(distancia - simulacion.distanciaSegunRelevancia(0.8)) < 1e-6, ids[i] + " sigue a su distancia");
  }
});

prueba("ControlDisposicion: dos botones (Libre y Por grupos), el elegido marcado y avisa al controlador", function () {
  const elegidos = [];
  const controlador = {
    cambiarDisposicion: function (modo) {
      elegidos.push(modo);
    }
  };
  const control = new ControlDisposicion(controlador);
  const padre = document.createElement("div");
  control.montar(padre);
  const botones = padre.querySelectorAll("button[data-modo]");
  comprobarIgual(botones.length, 2, "dos botones");
  comprobar(!padre.textContent.includes("Por tipo"), "ya no está «Por tipo»");
  comprobarIgual(padre.querySelector("[aria-pressed=true]").textContent, "Libre", "al principio, libre");
  botones[1].click();
  comprobarIgual(elegidos.join(","), "POR_GRUPOS", "avisa al controlador");
  comprobarIgual(padre.querySelector("[aria-pressed=true]").textContent, "Por grupos", "marca el elegido");
  comprobar(padre.textContent.includes("muy relacionadas"), "muestra la ayuda del modo");
  control.setModo(ModoDisposicion.LIBRE);
  comprobarIgual(padre.querySelector("[aria-pressed=true]").textContent, "Libre", "setModo cambia la marca");
});
