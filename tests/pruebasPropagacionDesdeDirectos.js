import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { OrigenRelevancia } from '../src/modelo/OrigenRelevancia.js';
import { EscenariosPrueba } from '../src/laboratorio/EscenariosPrueba.js';
import {
  configuracionEscenario, configuracionV3, crearPiezas, cacheEscenario, calcularEscenario, escenarioAna,
  escenarioCirculo, rel
} from './escenarioPrototipo.js';

/*
 * Pruebas de PropagacionDesdeDirectos (src/logica/): capas 1 a 3, una sola
 * fórmula para todos los nodos.
 */

/** Los directos y las evidencias de un escenario, listos para propagar. */
function preparar(escenario, configuracion) {
  const piezas = crearPiezas(configuracion);
  const cache = cacheEscenario(escenario);
  const central = cache.entidad(escenario.central);
  const preparado = piezas.estrategia.preparar(central, cache);
  return { piezas: piezas, central: central, directos: preparado.directos, evidencias: preparado.evidencias };
}

prueba("Propagación: un directo sin relaciones con otros directos se queda con su evidencia propia", function () {
  const resultados = calcularEscenario(escenarioAna());
  // El Taller: Empleo (0,65) × factorEntidad de una organización (0,8).
  comprobarIgual(redondear(resultados.get("taller").getFuerza()), 0.52, "R del Taller");
  comprobarIgual(resultados.get("taller").getCerteza(), 1, "C del Taller");
  comprobarIgual(resultados.get("taller").getPadres().length, 0, "nadie le transmite");
  comprobarIgual(redondear(resultados.get("joaquin").getFuerza()), 0.95, "Joaquín tampoco");
});

prueba("Propagación: el resultado no depende del orden de la lista de directos", function () {
  // Con la v3, en el ejemplo de Ana hay cuatro directos que se transmiten.
  const p = preparar(escenarioAna(), configuracionV3());
  const enOrden = p.piezas.propagacion.calcular(p.central, p.directos, p.evidencias);
  // Barajado fijo (sin azar): al revés y luego cada par intercambiado.
  const barajados = p.directos.slice().reverse();
  for (let i = 0; i + 1 < barajados.length; i = i + 2) {
    const aparte = barajados[i];
    barajados[i] = barajados[i + 1];
    barajados[i + 1] = aparte;
  }
  const desordenado = p.piezas.propagacion.calcular(p.central, barajados, p.evidencias);
  comprobarIgual(desordenado.size, enOrden.size, "los mismos nodos");
  for (const [id, resultado] of enOrden) {
    comprobar(Math.abs(desordenado.get(id).getFuerza() - resultado.getFuerza()) < 1e-12, "R de " + id);
    comprobar(Math.abs(desordenado.get(id).getCerteza() - resultado.getCerteza()) < 1e-12, "C de " + id);
  }
});

prueba("Propagación: un círculo de 25 iguales da 25 valores idénticos", function () {
  const configuraciones = [configuracionEscenario(), configuracionV3()];
  for (let n = 0; n < configuraciones.length; n++) {
    const resultados = calcularEscenario(escenarioCirculo(), configuraciones[n]);
    for (let i = 1; i < 25; i++) {
      comprobar(Math.abs(resultados.get("c" + i).getRelevancia() - resultados.get("c0").getRelevancia()) < 1e-12,
        "c" + i + " vale lo mismo que c0");
    }
  }
});

prueba("Propagación: un nodo a 3 saltos no aparece", function () {
  // La colección donde está «Paseo» (Ana → Joaquín → Paseo → Colección).
  const escenario = escenarioAna();
  escenario.entidades.coleccion = ["Organization", "Colección"];
  escenario.parejas.push({ a: "paseo", b: "coleccion", pruebas: [rel("Exposition", null, null, "coleccion")] });
  const resultados = calcularEscenario(escenario);
  comprobar(resultados.has("paseo"), "Paseo (2 saltos) sí");
  comprobar(!resultados.has("coleccion"), "la colección (3 saltos) no");
});

prueba("Propagación: sin evidencia propia y con un solo directo, nunca supera a ese directo", function () {
  const resultados = calcularEscenario(escenarioAna());
  let comprobados = 0;
  for (const resultado of resultados.values()) {
    if (resultado.esDeducido() && resultado.getEvidenciaPropia() === 0) {
      comprobarIgual(resultado.getPadres().length, 1, "un solo padre");
      const padre = resultados.get(resultado.getPadre().getId());
      comprobar(resultado.getRelevancia() <= padre.getRelevancia(), resultado.getEntidad().getNombre());
      comprobar(resultado.getFuerza() <= padre.getFuerza(), "tampoco en fuerza");
      comprobados = comprobados + 1;
    }
  }
  comprobarIgual(comprobados, 4, "Paseo, Museo, Juan y Retrato");
});

prueba("Propagación: con δ = 0, la certeza de un nodo sin evidencia propia es 0", function () {
  const configuracion = configuracionEscenario();
  configuracion.delta = 0;
  const resultados = calcularEscenario(escenarioAna(), configuracion);
  comprobarIgual(resultados.get("paseo").getCerteza(), 0, "Paseo: C = 0");
  comprobarIgual(resultados.get("paseo").getRelevancia(), 0, "y S = 0 (no entra con ningún umbral)");
  comprobar(resultados.get("paseo").getFuerza() > 0, "aunque su fuerza no sea 0");
  comprobar(resultados.get("pedro").getCerteza() > 0, "Pedro sí tiene certeza (coincide con Ana en una exposición)");
});

prueba("Propagación: continuidad, ganar coincidencias y cruzar el umbral de directo nunca baja a nadie", function () {
  // La secuencia de P10, con la v3 (sin tope): Pedro pasa de deducido a directo por el camino.
  const pasos = [[], [12], [8], [4], [3], [3, 4], [2, 2, 2]];
  const origenes = new Set();
  let anterior = -1;
  for (let i = 0; i < pasos.length; i++) {
    const pedro = calcularEscenario(EscenariosPrueba.pedroCoincide(pasos[i]), configuracionV3()).get("pedro");
    origenes.add(pedro.getOrigen());
    comprobar(pedro.getRelevancia() >= anterior - 1e-9, "paso " + i + ": " + pedro.getRelevancia().toFixed(3) +
      " no baja de " + anterior.toFixed(3));
    anterior = pedro.getRelevancia();
  }
  comprobar(origenes.has(OrigenRelevancia.DEDUCIDA) && origenes.has(OrigenRelevancia.COINCIDENCIAS),
    "en el camino ha cruzado el umbral de directo");
});

prueba("Propagación: un nodo con dos padres junta lo que le transmiten los dos", function () {
  const soloLuis = calcularEscenario(escenarioAna()).get("retrato");
  // «Retrato» también es obra de Joaquín (coautor).
  const escenario = escenarioAna();
  escenario.parejas.push({ a: "joaquin", b: "retrato", pruebas: [rel("Creation")] });
  const resultados = calcularEscenario(escenario);
  const conDos = resultados.get("retrato");
  comprobar(conDos.getRelevancia() > soloLuis.getRelevancia(), "más que solo por Luis");
  comprobar(conDos.getRelevancia() > resultados.get("paseo").getRelevancia(), "y más que solo por Joaquín (como Paseo)");
  comprobarIgual(conDos.getPadres().length, 2, "dos padres");
  comprobarIgual(conDos.getExplicacion().length, 2, "una línea por padre");
  comprobarIgual(conDos.getPadre().getId(), "joaquin", "el primero es el que más aporta");
});

prueba("Propagación: Marta (solo coincidencias) gana fuerza y certeza por su amistad con Luis", function () {
  const configuraciones = [configuracionEscenario(), configuracionV3()];
  for (let i = 0; i < configuraciones.length; i++) {
    const p = preparar(escenarioAna(), configuraciones[i]);
    const propia = p.evidencias.get("ana").get("marta");
    const marta = p.piezas.propagacion.calcular(p.central, p.directos, p.evidencias).get("marta");
    comprobar(marta.getFuerza() > propia.getFuerza(), "R sube");
    // Solo Luis (C = 1 con Ana y con Marta) le transmite: C = 1 − (1 − C₀) × (1 − δ).
    comprobarIgual(redondear(marta.getCerteza()), redondear(1 - (1 - propia.getCerteza()) * 0.3), "C por transitividad");
  }
});

prueba("Propagación: un vecino con muy poca evidencia y sin padres también aparece", function () {
  // Antes solo salían los directos y los deducidos por alguno.
  const escenario = escenarioAna();
  escenario.entidades.tomas = ["Person", "Tomás Roig"];
  escenario.parejas.push({ a: "ana", b: "tomas", pruebas: [EscenariosPrueba.evento("Exposition", 50)] });
  const tomas = calcularEscenario(escenario).get("tomas");
  comprobarIgual(tomas.getOrigen(), OrigenRelevancia.DEDUCIDA, "no llega a directo");
  comprobarIgual(tomas.getPadre(), null, "sin padres");
  comprobarIgual(tomas.getTextoExplicacion(), "Coinciden en 1 exposición", "explicación");
});
