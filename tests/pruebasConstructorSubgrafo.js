import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { OrigenRelevancia } from '../src/modelo/OrigenRelevancia.js';
import {
  configuracionEscenario, contextoEscenario, crearPiezas, JERARQUIA_ESCENARIO, construirDatos, escenarioAna, evento
} from './escenarioPrototipo.js';
import { CONTEXTO_PRUEBAS, crearRelevanciaPruebas, relacionesDesdeDatos } from './utilidadesPruebas.js';

/*
 * Pruebas de ConstructorSubgrafo (src/logica/), con el escenario de Ana del
 * prototipo y algún añadido:
 *  - Sofía solo coincide con Ana en 5 exposiciones de 11 participantes (más
 *    de las que se dibujan): es directa (F × C ≈ 0,07), pero sin ninguna
 *    arista dibujable.
 *  - Tomás solo coincide con Luis en una exposición de 12: es deducido, sin
 *    arista dibujable con su padre (Luis).
 */

function crearConstructor(umbral, maxNodos, mostrarDeducidos) {
  const escenario = escenarioAna();
  escenario.entidades.sofia = ["Creator", "Sofía Vidal"];
  escenario.entidades.tomas = ["Person", "Tomás Roig"];
  const deSofia = [];
  for (let i = 0; i < 5; i++) {
    deSofia.push(evento("Exposition", 11));
  }
  escenario.parejas.push({ a: "ana", b: "sofia", pruebas: deSofia });
  escenario.parejas.push({ a: "luis", b: "tomas", pruebas: [evento("Exposition", 12)] });
  const cache = new RepositorioVecindario(construirDatos(escenario), contextoEscenario());
  const piezas = crearPiezas(configuracionEscenario(), JERARQUIA_ESCENARIO);
  return new ConstructorSubgrafo(cache, piezas.estrategia, piezas.calculador, umbral, maxNodos, mostrarDeducidos);
}

function sinteticas(subgrafo) {
  const lista = [];
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].esSintetica()) {
      lista.push(relaciones[i]);
    }
  }
  return lista;
}

prueba("Constructor: la central siempre está, con relevancia 1 y nivel 0", async function () {
  const subgrafo = await crearConstructor(1, 150).construir("ana");
  comprobarIgual(subgrafo.getNumeroNodos(), 1, "con umbral 1 solo la central");
  comprobarIgual(subgrafo.getNodo("ana").getRelevancia(), 1, "relevancia");
  comprobarIgual(subgrafo.getNodo("ana").getNivel(), 0, "nivel");
});

prueba("Constructor: aplica el umbral a S y guarda el origen de cada nodo", async function () {
  const subgrafo = await crearConstructor(0.3, 150).construir("ana");
  comprobar(subgrafo.contieneEntidad("paseo"), "Paseo (0,53) entra");
  comprobar(subgrafo.contieneEntidad("museo"), "el Museo (0,31) también");
  comprobar(!subgrafo.contieneEntidad("retrato"), "Retrato (0,17) no");
  comprobar(subgrafo.contieneEntidad("marta"), "Marta entra por su S (0,34), aunque su R sea 0,60");
  comprobarIgual(subgrafo.getNodo("paseo").getOrigen(), OrigenRelevancia.DEDUCIDA, "Paseo es deducido");
  comprobarIgual(subgrafo.getNodo("paseo").getNivel(), 2, "a dos saltos");
  comprobarIgual(subgrafo.getNodo("marta").getOrigen(), OrigenRelevancia.COINCIDENCIAS, "Marta: coincidencias");
});

prueba("Constructor: solo se dibujan las relaciones dibujables entre nodos incluidos", async function () {
  const subgrafo = await crearConstructor(0, 150).construir("ana");
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    comprobar(relaciones[i].esDibujable(), relaciones[i].getId() + " es dibujable");
    comprobar(relaciones[i].getParticipantes() <= 10, relaciones[i].getId() + " no es de un evento grande");
  }
  const marta = subgrafo.getEvidencia("ana", "marta");
  comprobarIgual(marta.getRelaciones().length, 3, "pero la evidencia de Ana y Marta tiene sus 3 exposiciones");
  comprobar(!marta.esDeclarada(), "sin relación declarada (se dibuja discontinua)");
});

prueba("Constructor: la arista sintética aparece solo cuando hace falta", async function () {
  const subgrafo = await crearConstructor(0, 150).construir("ana");
  const lista = sinteticas(subgrafo);
  const pares = [];
  for (let i = 0; i < lista.length; i++) {
    pares.push(lista[i].getOrigen().getId() + "-" + lista[i].getDestino().getId());
    comprobarIgual(lista[i].getTipo().getId(), "COINCIDENCIAS", "tipo COINCIDENCIAS");
    comprobarIgual(lista[i].getTipo().getNombre(), "Coincidencias en eventos", "nombre del tipo");
  }
  pares.sort();
  comprobarIgual(pares.join(","), "ana-sofia,luis-tomas", "Sofía hacia la central y Tomás hacia su padre");
  const sofia = lista[0];
  comprobarIgual(sofia.getTexto(), "Coinciden en 5 eventos", "texto");
  comprobarIgual(redondear(sofia.getRelevancia()), redondear(subgrafo.getEvidencia("ana", "sofia").getValor()),
    "su valor es la evidencia de la pareja");
});

prueba("Constructor: desmarcar «Mostrar deducidos» los quita", async function () {
  const con = await crearConstructor(0, 150, true).construir("ana");
  const sin = await crearConstructor(0, 150, false).construir("ana");
  let deducidosCon = 0;
  const nodosCon = con.getNodos();
  for (let i = 0; i < nodosCon.length; i++) {
    if (nodosCon[i].esDeducido()) {
      deducidosCon = deducidosCon + 1;
    }
  }
  comprobar(deducidosCon > 0, "con la casilla marcada hay deducidos");
  const nodosSin = sin.getNodos();
  for (let i = 0; i < nodosSin.length; i++) {
    comprobar(!nodosSin[i].esDeducido(), nodosSin[i].getEntidad().getNombre() + " no es deducido");
  }
  comprobarIgual(sin.getNumeroNodos(), con.getNumeroNodos() - deducidosCon, "solo faltan los deducidos");
});

prueba("Constructor: los deducidos se quitan ANTES de aplicar el máximo", async function () {
  // Con 7 nodos como máximo y los deducidos ocultos, entran los 6 directos de
  // más relevancia (si se quitasen después, Paseo ocuparía un sitio).
  const subgrafo = await crearConstructor(0, 7, false).construir("ana");
  comprobarIgual(subgrafo.getNumeroNodos(), 7, "7 nodos");
  comprobar(subgrafo.contieneEntidad("sofia"), "el 6.º directo (Sofía) entra");
});

prueba("Constructor: ordena y corta por S (un deducido con más S pasa delante de un directo)", async function () {
  // Con 6 nodos entran la central y los 5 de mayor S: Huerta (1), Joaquín
  // (0,95), Luis (0,79), Paseo (0,53, deducido) y el Taller (0,52).
  const subgrafo = await crearConstructor(0, 6).construir("ana");
  const esperados = ["huerta", "joaquin", "luis", "paseo", "taller"];
  for (let i = 0; i < esperados.length; i++) {
    comprobar(subgrafo.contieneEntidad(esperados[i]), "falta " + esperados[i]);
  }
  comprobar(!subgrafo.contieneEntidad("marta"), "Marta (0,34) se queda fuera");
});

prueba("Constructor: un solo muelle por pareja, con el peso de lo que transmite", async function () {
  const subgrafo = await crearConstructor(0, 150).construir("ana");
  const muelles = subgrafo.getMuelles();
  const vistos = new Set();
  const peso = {};
  for (let i = 0; i < muelles.length; i++) {
    const idA = muelles[i].nodoA.getEntidad().getId();
    const idB = muelles[i].nodoB.getEntidad().getId();
    comprobar(idA !== "ana" && idB !== "ana", "ningún muelle con la central");
    let clave = idA + "|" + idB;
    if (idB < idA) {
      clave = idB + "|" + idA;
    }
    comprobar(!vistos.has(clave), "un solo muelle para " + clave);
    vistos.add(clave);
    peso[clave] = muelles[i].peso;
  }
  // Entre dos directos: el mayor de los dos sentidos de F(Y,X) · T̄ · fE · h.
  // Luis → Marta: 0,5 × T̄(Amistad 0,5 y Exposición 0,542 → Amistad) × 1 × 1;
  // Marta → Luis: 0,5 × T(Exposition>Friendship) = 0,3 → 0,15 (menos).
  const tLuis = (0.5 * 0.4 + 0.5423 * 0.3) / (0.5 + 0.5423);
  comprobar(Math.abs(peso["luis|marta"] - 0.5 * tLuis) < 0.001, "Luis–Marta: " + peso["luis|marta"]);
  // Entre un deducido y su padre: F(P,Z) · T̄ · fE(Z) · h(P) · τ = 1 × 0,8 × 1 × 1 × 1.
  comprobar(Math.abs(peso["joaquin|paseo"] - 0.8) < 0.001, "Joaquín–Paseo: " + peso["joaquin|paseo"]);
  // Luis–Pedro: Matrimonio (0,5) × T̄(→ Matrimonio) 0,3 × fE(Pedro) 0,6.
  comprobar(Math.abs(peso["luis|pedro"] - 0.09) < 0.001, "Luis–Pedro: " + peso["luis|pedro"]);
});

prueba("Constructor: como mucho 150 nodos, los más relevantes", async function () {
  const datos = { entidades: [{ id: "c", tipo: "PERSONA", nombre: "Central" }], relaciones: [] };
  for (let i = 0; i < 300; i++) {
    datos.entidades.push({ id: "v" + i, tipo: "PERSONA", nombre: "Vecina " + i });
    let tipo = "Friendship";
    if (i < 10) {
      tipo = "Mentorship";
    }
    datos.relaciones.push(["r" + i, "c", "v" + i, tipo]);
  }
  const cache = new RepositorioVecindario(relacionesDesdeDatos(datos), CONTEXTO_PRUEBAS);
  const piezas = crearRelevanciaPruebas();
  const subgrafo = await new ConstructorSubgrafo(cache, piezas.estrategia, piezas.calculador, 0, 150).construir("c");
  comprobarIgual(subgrafo.getNumeroNodos(), 150, "150 nodos");
  for (let i = 0; i < 10; i++) {
    comprobar(subgrafo.contieneEntidad("v" + i), "las mentoras (más relevantes) están");
  }
});

prueba("Constructor: calcula la centralidad de cada nodo", async function () {
  const subgrafo = await crearConstructor(0.3, 150).construir("ana");
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < nodos.length; i++) {
    comprobar(nodos[i].getCentralidad() >= 0 && nodos[i].getCentralidad() <= 1, "centralidad entre 0 y 1");
  }
  comprobar(subgrafo.getNodo("ana").getCentralidad() > 0, "la central está conectada");
});

prueba("Constructor: una entidad que no está en la caché da error", async function () {
  let fallo = false;
  try {
    await crearConstructor(0.3, 150).construir("no_existe");
  } catch (error) {
    fallo = true;
  }
  comprobar(fallo, "debería fallar");
});
