import { prueba, comprobarIgual } from './miniPruebas.js';
import { HistorialNavegacion } from '../src/logica/HistorialNavegacion.js';

/*
 * Pruebas de HistorialNavegacion (src/logica/).
 */

prueba("Historial: apila y vuelve en orden (el último primero)", function () {
  const historial = new HistorialNavegacion();
  historial.registrar("p01");
  historial.registrar("o02");
  historial.registrar("a03");
  comprobarIgual(historial.volver(), "a03", "primero el último");
  comprobarIgual(historial.volver(), "o02", "después el anterior");
  comprobarIgual(historial.volver(), "p01", "y al final el primero");
});

prueba("Historial: no apila dos veces seguidas el mismo id", function () {
  const historial = new HistorialNavegacion();
  historial.registrar("p01");
  historial.registrar("p01");
  historial.registrar("o02");
  historial.registrar("p01");
  comprobarIgual(historial.volver(), "p01", "el último");
  comprobarIgual(historial.volver(), "o02", "el anterior");
  comprobarIgual(historial.volver(), "p01", "p01 solo una vez al principio");
  comprobarIgual(historial.volver(), null, "ya no queda nada");
});

prueba("Historial: volver con la pila vacía da null", function () {
  comprobarIgual(new HistorialNavegacion().volver(), null, "pila vacía");
});

prueba("Historial: puedeVolver", function () {
  const historial = new HistorialNavegacion();
  comprobarIgual(historial.puedeVolver(), false, "al principio");
  historial.registrar("p01");
  comprobarIgual(historial.puedeVolver(), true, "con una entidad");
  historial.volver();
  comprobarIgual(historial.puedeVolver(), false, "después de volver");
});

prueba("Historial: limpiar lo borra todo", function () {
  const historial = new HistorialNavegacion();
  historial.registrar("p01");
  historial.registrar("o02");
  historial.limpiar();
  comprobarIgual(historial.puedeVolver(), false, "puedeVolver");
  comprobarIgual(historial.volver(), null, "volver");
});
