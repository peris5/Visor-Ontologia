import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PenalizacionGrado } from '../src/logica/PenalizacionGrado.js';

/*
 * Pruebas de PenalizacionGrado (src/logica/): h, la penalización de los
 * intermediarios muy conectados.
 */

prueba("PenalizacionGrado: con grado ≤ gradoReferencia (10) no penaliza", function () {
  const penalizacion = new PenalizacionGrado({ gradoReferencia: 10 });
  comprobarIgual(penalizacion.getFactor(null, 0), 1, "grado 0");
  comprobarIgual(penalizacion.getFactor(null, 5), 1, "grado 5");
  comprobarIgual(penalizacion.getFactor(null, 10), 1, "grado 10");
  comprobar(penalizacion.getFactor(null, 11) < 1, "grado 11 ya penaliza");
});

prueba("PenalizacionGrado: con grado 1000, h = log 12 / log 1002 ≈ 0,36", function () {
  const h = new PenalizacionGrado({ gradoReferencia: 10 }).getFactor(null, 1000);
  comprobar(Math.abs(h - Math.log(12) / Math.log(1002)) < 1e-12, "fórmula");
  comprobarIgual(Math.round(h * 100) / 100, 0.36, "≈ 0,36");
});
