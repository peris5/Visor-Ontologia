import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RelevanciaNodosMejorCamino } from '../src/logica/RelevanciaNodosMejorCamino.js';
import { GestorSubgrafos } from '../src/logica/GestorSubgrafos.js';
import { OrigenRelevancia } from '../src/modelo/OrigenRelevancia.js';
import { SelectorInteraccion } from '../src/vista3d/SelectorInteraccion.js';
import { PanelInformacion } from '../src/interfaz/PanelInformacion.js';
import {
  configuracionEscenario, configuracionV3, crearPiezas, cacheEscenario, escenarioTiempo
} from './escenarioPrototipo.js';
import { ClienteFalso, CONTEXTO_PRUEBAS, crearRelevanciaPruebas } from './utilidadesPruebas.js';

/*
 * Pruebas de RelevanciaNodosTresCapas (src/logica/) con el escenario de Ana
 * de los prototipos (β = 1 y factor de tiempo 1 en todo). Los valores
 * esperados son los de node docs/prototipo_relevancia_v4.mjs y, con los
 * cambios de la v4 apagados, los de node docs/prototipo_relevancia_v3.mjs.
 */

// [id, S, R, C, origen]
const TABLA_V4 = [
  ["huerta", 1.000, 1.000, 1.000, OrigenRelevancia.DECLARADA],
  ["joaquin", 0.950, 0.950, 1.000, OrigenRelevancia.DECLARADA],
  ["luis", 0.624, 0.624, 1.000, OrigenRelevancia.DECLARADA],
  ["paseo", 0.532, 0.760, 0.700, OrigenRelevancia.DEDUCIDA],
  ["taller", 0.520, 0.520, 1.000, OrigenRelevancia.DECLARADA],
  ["museo", 0.314, 0.448, 0.700, OrigenRelevancia.DEDUCIDA],
  ["marta", 0.233, 0.310, 0.751, OrigenRelevancia.DEDUCIDA],
  ["retrato", 0.133, 0.189, 0.700, OrigenRelevancia.DEDUCIDA],
  ["juan", 0.118, 0.169, 0.700, OrigenRelevancia.DEDUCIDA],
  ["pedro", 0.093, 0.130, 0.720, OrigenRelevancia.DEDUCIDA]
];

const TABLA_V3 = [
  ["huerta", 1.000, 1.000, 1.000, OrigenRelevancia.DECLARADA],
  ["joaquin", 0.950, 0.950, 1.000, OrigenRelevancia.DECLARADA],
  ["luis", 0.789, 0.789, 1.000, OrigenRelevancia.DECLARADA],
  ["taller", 0.520, 0.520, 1.000, OrigenRelevancia.DECLARADA],
  ["marta", 0.496, 0.610, 0.813, OrigenRelevancia.COINCIDENCIAS],
  ["paseo", 0.532, 0.760, 0.700, OrigenRelevancia.DEDUCIDA],
  ["museo", 0.314, 0.448, 0.700, OrigenRelevancia.DEDUCIDA],
  ["retrato", 0.207, 0.295, 0.700, OrigenRelevancia.DEDUCIDA],
  ["juan", 0.118, 0.169, 0.700, OrigenRelevancia.DEDUCIDA],
  ["pedro", 0.108, 0.150, 0.720, OrigenRelevancia.DEDUCIDA]
];

function calcularEscenario(configuracion) {
  let config = configuracionEscenario();
  if (configuracion !== undefined) {
    config = configuracion;
  }
  const piezas = crearPiezas(config);
  const cache = cacheEscenario();
  return { resultados: piezas.estrategia.calcular(cache.entidad("ana"), cache), piezas: piezas, cache: cache };
}

function comprobarTabla(resultados, tabla) {
  comprobarIgual(resultados.size, tabla.length + 1, "los 10 nodos y la central");
  for (let i = 0; i < tabla.length; i++) {
    const fila = tabla[i];
    const resultado = resultados.get(fila[0]);
    comprobar(resultado !== undefined, "falta " + fila[0]);
    comprobar(Math.abs(resultado.getRelevancia() - fila[1]) <= 0.005,
      fila[0] + ": S = " + resultado.getRelevancia().toFixed(3) + " en lugar de " + fila[1]);
    comprobar(Math.abs(resultado.getFuerza() - fila[2]) <= 0.005,
      fila[0] + ": R = " + resultado.getFuerza().toFixed(3) + " en lugar de " + fila[2]);
    comprobar(Math.abs(resultado.getCerteza() - fila[3]) <= 0.005,
      fila[0] + ": C = " + resultado.getCerteza().toFixed(3) + " en lugar de " + fila[3]);
    comprobarIgual(resultado.getOrigen(), fila[4], "origen de " + fila[0]);
  }
  comprobarIgual(resultados.get("ana").getOrigen(), OrigenRelevancia.CENTRAL, "la central");
}

prueba("Tres capas: el escenario de Ana da la tabla del prototipo v4 (S, R y C ± 0,005)", function () {
  comprobarTabla(calcularEscenario().resultados, TABLA_V4);
});

prueba("Tres capas: con los cambios de la v4 apagados, da la tabla de la v3", function () {
  comprobarTabla(calcularEscenario(configuracionV3()).resultados, TABLA_V3);
});

/** Los ids que entran con umbral 0,3 (sin la central), en orden. */
async function losQueEntran(configuracion) {
  const escenario = calcularEscenario(configuracion);
  const subgrafo = await new ConstructorSubgrafo(escenario.cache, escenario.piezas.estrategia,
    escenario.piezas.calculador, 0.3, 150, true, escenario.piezas.seleccionador).construir("ana");
  const ids = [];
  const nodos = subgrafo.getNodos();
  for (let i = 1; i < nodos.length; i++) {
    ids.push(nodos[i].getEntidad().getId());
  }
  return ids.join(",");
}

prueba("Tres capas: con umbral 0,3 entran exactamente los seis primeros (Marta ya no)", async function () {
  comprobarIgual(await losQueEntran(configuracionEscenario()), "huerta,joaquin,luis,paseo,taller,museo", "v4");
});

prueba("Tres capas: con los cambios de la v4 apagados entran siete (también Marta)", async function () {
  comprobarIgual(await losQueEntran(configuracionV3()), "huerta,joaquin,luis,paseo,taller,marta,museo", "v3");
});

prueba("Tres capas: explicaciones de los tres orígenes", function () {
  const resultados = calcularEscenario().resultados;
  comprobarIgual(resultados.get("joaquin").getTextoExplicacion(), "Mentoría (su maestro)", "declarada con rol");
  comprobarIgual(resultados.get("luis").getTextoExplicacion(), "Amistad · 5 exposiciones juntos", "declarada con eventos");
  comprobarIgual(calcularEscenario(configuracionV3()).resultados.get("marta").getTextoExplicacion(),
    "Coinciden en 3 exposiciones · Amistad con Luis Peris", "coincidencias");
  comprobarIgual(resultados.get("marta").getTextoExplicacion(),
    "Amistad de Luis Peris (Amistad) · Coinciden en 3 exposiciones", "deducida que además coincide");
  comprobarIgual(resultados.get("paseo").getTextoExplicacion(), "Creación de Joaquín Mestre (su maestro)", "deducida");
  comprobarIgual(resultados.get("paseo").getPadre().getId(), "joaquin", "padre de Paseo");
});

prueba("Tres capas: evidencia propia y suelo (P2)", function () {
  const resultados = calcularEscenario(configuracionV3()).resultados;
  const marta = resultados.get("marta");
  // Evidencia propia (v3): F ≈ 0,533 y C = 1 − 0,733 × 0,867 × 0,98 ≈ 0,377 → ≈ 0,201.
  comprobarIgual(Math.round(marta.getEvidenciaPropia() * 1000) / 1000, 0.201, "Marta: evidencia propia");
  comprobar(marta.getRelevancia() > marta.getEvidenciaPropia(), "Luis la refuerza");
  comprobarIgual(resultados.get("paseo").getEvidenciaPropia(), 0, "Paseo no tiene evidencia propia");
});

prueba("Mejor camino: se conserva el cálculo anterior (producto del mejor camino)", function () {
  const piezas = crearPiezas(configuracionEscenario());
  const cache = cacheEscenario();
  const resultados = new RelevanciaNodosMejorCamino(piezas.calculador).calcular(cache.entidad("ana"), cache);
  comprobarIgual(redondear(resultados.get("joaquin").getRelevancia()), 0.95, "Joaquín: 0,95");
  comprobarIgual(redondear(resultados.get("paseo").getRelevancia()), 0.95, "Paseo: 0,95 × 1 (la obra del maestro vale igual)");
  comprobarIgual(redondear(resultados.get("luis").getRelevancia()), 0.5, "Luis: solo su mejor relación (Amistad, 0,5)");
  comprobarIgual(redondear(resultados.get("pedro").getRelevancia()), 0.25, "Pedro: 0,5 × 0,5 por Luis");
  comprobarIgual(resultados.get("pedro").getOrigen(), OrigenRelevancia.DEDUCIDA, "a dos saltos");
  comprobarIgual(resultados.get("marta").getCerteza(), 1, "sin certeza (C = 1)");
});

/** ¿El texto dice que dos personas se conocen? (RNF-23: no se puede, hay personas vivas.) */
function diceQueSeConocen(texto) {
  const minusculas = texto.toLowerCase();
  return minusculas.includes("se conocen") || minusculas.includes("conoce");
}

prueba("Ningún texto de la etiqueta ni del panel dice «conoce» o «se conocen» (RNF-23)", async function () {
  const textos = [];
  // El escenario del prototipo y los datos de ejemplo de verdad.
  const escenario = calcularEscenario();
  const subgrafos = [await new ConstructorSubgrafo(escenario.cache, escenario.piezas.estrategia,
    escenario.piezas.calculador, 0, 150).construir("ana")];
  const conTardia = cacheEscenario(escenarioTiempo());
  subgrafos.push(await new ConstructorSubgrafo(conTardia, escenario.piezas.estrategia, escenario.piezas.calculador, 0,
    150).construir("ana"));
  const piezas = crearRelevanciaPruebas();
  const gestor = new GestorSubgrafos(new ClienteFalso(), piezas.estrategia, piezas.calculador, 150, CONTEXTO_PRUEBAS);
  const centrales = ["ana_ferrer", "n1", "n2", "n121", "n146", "luis_peris"];
  for (let i = 0; i < centrales.length; i++) {
    subgrafos.push(await gestor.obtenerSubgrafo(centrales[i], 0));
  }
  for (let s = 0; s < subgrafos.length; s++) {
    const subgrafo = subgrafos[s];
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      textos.push(SelectorInteraccion.textoDeNodo(nodos[i]));
      const panel = new PanelInformacion(null, CONTEXTO_PRUEBAS);
      const padre = document.createElement("div");
      panel.montar(padre);
      panel.mostrarEntidad(nodos[i].getEntidad(), nodos[i], subgrafo);
      textos.push(padre.textContent);
    }
    const relaciones = subgrafo.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      textos.push(SelectorInteraccion.textoDeRelacion(relaciones[i]));
    }
  }
  comprobar(textos.length > 100, "se han revisado " + textos.length + " textos");
  for (let i = 0; i < textos.length; i++) {
    comprobar(!diceQueSeConocen(textos[i]), "dice que se conocen: «" + textos[i].substring(0, 120) + "»");
  }
});
