/*
 * Mini sistema de pruebas para ejecutar en el navegador (sin librerías).
 *
 * Uso (en cada archivo de pruebas):
 *   import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
 *
 *   prueba("nombre de la prueba", function () {
 *     comprobar(2 + 2 === 4, "2 + 2 debería ser 4");
 *     comprobarIgual(sumar(2, 2), 4, "sumar(2, 2)");
 *   });
 *
 * Las pruebas pueden ser asíncronas: prueba("...", async function () { ... await ... });
 *
 * Funcionamiento: prueba() solo apunta la prueba en una lista. Al final,
 * tests/ejecutarPruebas.js (que importa todos los archivos de pruebas)
 * llama a ejecutarPruebas(), que las ejecuta una a una y pinta
 * el resultado. Una comprobación que falla lanza un error; si la prueba
 * termina sin errores, es correcta.
 */

// Lista de pruebas apuntadas: cada elemento es { nombre, funcion }.
const listaDePruebasRegistradas = [];

/**
 * Apunta una prueba para ejecutarla después.
 *
 * @param {string} nombre
 * @param {Function} funcion - normal o async.
 */
export function prueba(nombre, funcion) {
  listaDePruebasRegistradas.push({ nombre: nombre, funcion: funcion });
}

/**
 * Falla (lanza un error) si la condición no se cumple.
 *
 * @param {boolean} condicion
 * @param {string} mensaje - qué se esperaba.
 */
export function comprobar(condicion, mensaje) {
  if (!condicion) {
    throw new Error(mensaje);
  }
}

/**
 * Falla si los dos valores no son exactamente iguales (===).
 *
 * @param {*} obtenido - lo que ha dado el código.
 * @param {*} esperado - lo que debería dar.
 * @param {string} mensaje - qué se está comprobando.
 */
export function comprobarIgual(obtenido, esperado, mensaje) {
  if (obtenido !== esperado) {
    throw new Error(mensaje + " → obtenido: " + String(obtenido) + ", esperado: " + String(esperado));
  }
}

/**
 * Redondea a 6 decimales. Los ordenadores guardan los decimales con un
 * pequeño error (0.1 + 0.2 da 0.30000000000000004), así que para comparar
 * resultados con decimales redondeamos antes.
 *
 * @param {number} numero
 * @returns {number}
 */
export function redondear(numero) {
  return Math.round(numero * 1000000) / 1000000;
}

/**
 * Ejecuta todas las pruebas una detrás de otra y devuelve sus resultados.
 *
 * @returns {Promise<Object[]>} lista de { nombre, correcta, mensaje }.
 */
export async function ejecutarTodasLasPruebas() {
  const resultados = [];
  for (let i = 0; i < listaDePruebasRegistradas.length; i++) {
    const pruebaActual = listaDePruebasRegistradas[i];
    try {
      // await funciona tanto si la prueba es async como si no.
      await pruebaActual.funcion();
      resultados.push({ nombre: pruebaActual.nombre, correcta: true, mensaje: "" });
    } catch (error) {
      resultados.push({ nombre: pruebaActual.nombre, correcta: false, mensaje: error.message });
    }
  }
  return resultados;
}

/**
 * Ejecuta las pruebas y pinta el resultado en pruebas.html.
 */
export async function ejecutarPruebas() {
  const resultados = await ejecutarTodasLasPruebas();
  mostrarResumen(resultados);
  mostrarListaDeResultados(resultados);
}

/**
 * Pinta arriba "X de Y pruebas correctas".
 *
 * @param {Object[]} resultados
 */
function mostrarResumen(resultados) {
  let numeroDeCorrectas = 0;
  for (let i = 0; i < resultados.length; i++) {
    if (resultados[i].correcta) {
      numeroDeCorrectas = numeroDeCorrectas + 1;
    }
  }
  const elementoResumen = document.getElementById("resumenPruebas");
  elementoResumen.textContent = numeroDeCorrectas + " de " + resultados.length + " pruebas correctas";
  if (numeroDeCorrectas === resultados.length) {
    elementoResumen.className = "resumen-pruebas todas-correctas";
  } else {
    elementoResumen.className = "resumen-pruebas hay-fallos";
  }
}

/**
 * Pinta cada prueba: verde si es correcta, roja con el mensaje si falla.
 *
 * @param {Object[]} resultados
 */
function mostrarListaDeResultados(resultados) {
  const lista = document.getElementById("listaPruebas");
  for (let i = 0; i < resultados.length; i++) {
    const resultado = resultados[i];
    const elemento = document.createElement("li");
    if (resultado.correcta) {
      elemento.className = "prueba-correcta";
      elemento.textContent = "✔ " + resultado.nombre;
    } else {
      elemento.className = "prueba-fallida";
      elemento.textContent = "✘ " + resultado.nombre + " — " + resultado.mensaje;
    }
    lista.appendChild(elemento);
  }
}
