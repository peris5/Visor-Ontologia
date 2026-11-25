import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PenalizacionGrado } from '../src/logica/PenalizacionGrado.js';
import { EscenariosPrueba } from '../src/laboratorio/EscenariosPrueba.js';

/*
 * Pruebas de PenalizacionGrado (src/logica/): h, la penalización de los
 * intermediarios muy conectados.
 */

prueba("PenalizacionGrado: con grado ≤ gradoReferencia (10) no penaliza", function () {
  const penalizacion = new PenalizacionGrado({ gradoReferencia: 10 });
  comprobarIgual(penalizacion.getFactorDeGrado(0), 1, "grado 0");
  comprobarIgual(penalizacion.getFactorDeGrado(5), 1, "grado 5");
  comprobarIgual(penalizacion.getFactorDeGrado(10), 1, "grado 10");
  comprobar(penalizacion.getFactorDeGrado(11) < 1, "grado 11 ya penaliza");
});

prueba("PenalizacionGrado: con grado 1000, h = log 12 / log 1002 ≈ 0,36; con 300, ≈ 0,44", function () {
  const penalizacion = new PenalizacionGrado({ gradoReferencia: 10 });
  const h = penalizacion.getFactorDeGrado(1000);
  comprobar(Math.abs(h - Math.log(12) / Math.log(1002)) < 1e-12, "fórmula");
  comprobarIgual(Math.round(h * 100) / 100, 0.36, "≈ 0,36");
  comprobarIgual(Math.round(penalizacion.getFactorDeGrado(300) * 100) / 100, 0.44, "≈ 0,44");
});

/** Joaquín, con 60 obras (Creation), 400 coexpositores (Exposition) y Ana (Mentorship). */
function joaquinProlifico(porTipo) {
  const cache = EscenariosPrueba.cache(EscenariosPrueba.maestroProlifico(true));
  const penalizacion = new PenalizacionGrado({ gradoReferencia: 10, penalizacionPorTipo: porTipo });
  penalizacion.usarRelaciones(cache);
  return { cache: cache, penalizacion: penalizacion, joaquin: cache.entidad("joaquin") };
}

prueba("PenalizacionGrado: con penalizacionPorTipo cuenta solo las entidades unidas por el tipo pedido", function () {
  const p = joaquinProlifico(true);
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, p.cache.getTipo("Creation")), 60, "obras");
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, p.cache.getTipo("Exposition")), 400, "coexpositores");
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, p.cache.getTipo("Mentorship")), 1, "alumnas");
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, p.cache.getTipo("Event")), 0,
    "se compara el tipo exacto: Exposition hereda de Event y no cuenta");
  comprobarIgual(p.penalizacion.getFactor(p.joaquin, p.cache.getTipo("Mentorship")), 1, "con una alumna no penaliza");
});

prueba("PenalizacionGrado: sin penalizacionPorTipo cuenta todas (v3)", function () {
  const p = joaquinProlifico(false);
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, p.cache.getTipo("Creation")), 461, "60 + 400 + Ana");
});

prueba("PenalizacionGrado: los grados se vuelven a contar cuando llegan relaciones nuevas", function () {
  const p = joaquinProlifico(true);
  const tipo = p.cache.getTipo("Mentorship");
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, tipo), 1, "antes");
  p.cache.incorporar({ ids: [], entidades: [EscenariosPrueba.entidad("nueva", ["Person"], "Nueva")],
    relaciones: [EscenariosPrueba.relacion("m9", "joaquin", "nueva", "Mentorship", 2)] });
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, tipo), 2, "después de incorporar");
  p.cache.quitarRelacion("m9|joaquin|nueva");
  comprobarIgual(p.penalizacion.getGrado(p.joaquin, tipo), 1, "y después de quitarla");
});
