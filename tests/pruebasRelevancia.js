import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { EstrategiaRelevancia } from '../src/logica/EstrategiaRelevancia.js';
import { RelevanciaDesdeBD } from '../src/logica/RelevanciaDesdeBD.js';
import { Persona } from '../src/modelo/Persona.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';

/*
 * Pruebas de la estrategia RelevanciaDesdeBD (src/logica/).
 * Recuperadas del incremento 1 (los mismos casos que tenían en Python).
 */

/**
 * Crea una relación cualquiera con el valor indicado.
 *
 * @param {*} valor
 * @returns {Relacion}
 */
function crearRelacionConValor(valor) {
  const origen = new Persona({ id: "o" });
  const destino = new Persona({ id: "d" });
  const tipo = new TipoRelacion("pareja", "Pareja", "#000000");
  return new Relacion("r", origen, destino, tipo, valor);
}

prueba("Relevancia: la de una relación es el valor de la BD", function () {
  const estrategia = new RelevanciaDesdeBD();
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor(0.7)), 0.7, "valor 0.7");
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor(0)), 0, "valor 0");
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor(1)), 1, "valor 1");
});

prueba("Relevancia: la de un nodo es el producto", function () {
  const estrategia = new RelevanciaDesdeBD();
  comprobarIgual(redondear(estrategia.calcularRelevanciaNodo(0.9, 0.5)), 0.45, "0.9 × 0.5");
  comprobarIgual(redondear(estrategia.calcularRelevanciaNodo(1, 0.8)), 0.8, "1 × 0.8");
});

prueba("Relevancia: los valores fuera de [0, 1] se acotan", function () {
  const estrategia = new RelevanciaDesdeBD();
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor(1.4)), 1, "valor 1.4");
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor(-0.2)), 0, "valor -0.2");
  comprobarIgual(estrategia.calcularRelevanciaRelacion(crearRelacionConValor("hola")), 0, "valor que no es un número");
});

prueba("Relevancia: la interfaz EstrategiaRelevancia no está implementada", function () {
  const interfaz = new EstrategiaRelevancia();
  let huboError = false;
  try {
    interfaz.calcularRelevanciaNodo(1, 1);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "debería lanzar un error");
});
