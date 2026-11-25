import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import {
  configuracionEscenario, crearPiezas, JERARQUIA_ESCENARIO, cacheEscenario, escenarioAna, escenarioCirculo
} from './escenarioPrototipo.js';

/*
 * Pruebas de RefuerzoEntreDirectos (src/logica/): las capas 1 y 2.
 */

/** Los directos y las evidencias de un escenario, listos para el refuerzo. */
function preparar(escenario) {
  const piezas = crearPiezas(configuracionEscenario(), JERARQUIA_ESCENARIO);
  const cache = cacheEscenario(escenario);
  const central = cache.entidad(escenario.central);
  const directos = piezas.calculador.elegirDirectos(central, cache.relacionesDe(central.getId())).directos;
  let todas = cache.relacionesDe(central.getId());
  for (let i = 0; i < directos.length; i++) {
    todas = todas.concat(cache.relacionesDe(directos[i].getId()));
  }
  return { piezas: piezas, central: central, directos: directos,
    evidencias: piezas.calculador.calcularVecinos(todas) };
}

prueba("RefuerzoEntreDirectos: un directo sin relaciones con otros directos se queda con su evidencia propia", function () {
  const p = preparar(escenarioAna());
  const resultado = p.piezas.refuerzo.calcular(p.central, p.directos, p.evidencias);
  // El Taller: Empleo (0,65) × factorEntidad de una organización (0,8).
  comprobarIgual(redondear(resultado.fuerzas.get("taller")), 0.52, "R del Taller");
  comprobarIgual(resultado.certezas.get("taller"), 1, "C del Taller");
  comprobarIgual(resultado.transmisiones.get("taller").size, 0, "no transmite con nadie");
  comprobarIgual(redondear(resultado.fuerzas.get("joaquin")), 0.95, "Joaquín tampoco");
});

prueba("RefuerzoEntreDirectos: el resultado no depende del orden de la lista de directos", function () {
  const p = preparar(escenarioAna());
  const enOrden = p.piezas.refuerzo.calcular(p.central, p.directos, p.evidencias);
  // Barajado fijo (sin azar, para que la prueba sea siempre igual): al revés
  // y luego cada par intercambiado.
  const barajados = [];
  for (let i = p.directos.length - 1; i >= 0; i--) {
    barajados.push(p.directos[i]);
  }
  for (let i = 0; i + 1 < barajados.length; i = i + 2) {
    const aparte = barajados[i];
    barajados[i] = barajados[i + 1];
    barajados[i + 1] = aparte;
  }
  const desordenado = p.piezas.refuerzo.calcular(p.central, barajados, p.evidencias);
  for (let i = 0; i < p.directos.length; i++) {
    const id = p.directos[i].getId();
    comprobarIgual(desordenado.fuerzas.get(id), enOrden.fuerzas.get(id), "R de " + id);
    comprobarIgual(desordenado.certezas.get(id), enOrden.certezas.get(id), "C de " + id);
  }
});

prueba("RefuerzoEntreDirectos: un círculo de 25 iguales da 25 valores idénticos", function () {
  const p = preparar(escenarioCirculo());
  const resultado = p.piezas.refuerzo.calcular(p.central, p.directos, p.evidencias);
  const primero = resultado.fuerzas.get("c0") * resultado.certezas.get("c0");
  for (let i = 1; i < 25; i++) {
    const id = "c" + i;
    comprobar(Math.abs(resultado.fuerzas.get(id) * resultado.certezas.get(id) - primero) < 1e-12,
      id + " vale lo mismo que c0");
  }
});

prueba("RefuerzoEntreDirectos: Marta (solo coincidencias) se refuerza por su amistad con Luis", function () {
  const p = preparar(escenarioAna());
  const resultado = p.piezas.refuerzo.calcular(p.central, p.directos, p.evidencias);
  const propia = p.evidencias.get("ana").get("marta");
  comprobar(resultado.fuerzas.get("marta") > propia.getFuerza(), "R sube");
  comprobar(resultado.certezas.get("marta") > propia.getCerteza(), "C sube por el cierre triádico");
  comprobarIgual(redondear(resultado.certezas.get("marta")), redondear(1 - (1 - propia.getCerteza()) * 0.7),
    "C = 1 − (1 − C(c,Marta)) × (1 − 1 × 1 × κ)");
});
