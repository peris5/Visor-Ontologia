import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PaletaColores } from '../src/logica/PaletaColores.js';

/*
 * Pruebas de PaletaColores (src/logica/), recuperadas del incremento 1.
 */

prueba("Paleta: los colores tienen el formato #rrggbb", function () {
  const formatoDeColor = /^#[0-9a-f]{6}$/;
  for (let indice = 0; indice < 50; indice++) {
    const color = PaletaColores.colorPara(indice);
    comprobar(formatoDeColor.test(color), "color del índice " + indice + ": " + color);
  }
});

prueba("Paleta: índices distintos dan colores distintos", function () {
  const coloresVistos = [];
  for (let indice = 0; indice < 50; indice++) {
    const color = PaletaColores.colorPara(indice);
    comprobar(!coloresVistos.includes(color), "el color " + color + " del índice " + indice + " está repetido");
    coloresVistos.push(color);
  }
});

prueba("Paleta: la asignación es determinista", function () {
  const ids = ["maestro_de", "pareja", "autor_de"];
  const primeraVez = PaletaColores.asignar(ids);
  const segundaVez = PaletaColores.asignar(ids);
  for (let i = 0; i < ids.length; i++) {
    comprobarIgual(primeraVez.get(ids[i]), segundaVez.get(ids[i]), "color de " + ids[i]);
  }
  comprobarIgual(primeraVez.get("maestro_de"), PaletaColores.colorPara(0), "el primero usa el color 0");
});

prueba("Paleta: un índice no válido da error", function () {
  let huboError = false;
  try {
    PaletaColores.colorPara(-1);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "colorPara(-1) debería lanzar un error");
});

prueba("Paleta: los mismos colores que daba el servidor Python en el incremento 2", function () {
  // La versión Python tenía esta prueba al revés (comprobaba que daba los
  // colores de JavaScript). Así sabemos que, al volver al navegador, los
  // colores siguen siendo exactamente los mismos.
  const coloresEsperados = ["#b62020", "#2fda61", "#a95ae2", "#b6a320", "#2fbeda", "#e25aa4", "#45b620", "#362fda"];
  for (let indice = 0; indice < coloresEsperados.length; indice++) {
    comprobarIgual(PaletaColores.colorPara(indice), coloresEsperados[indice], "color del índice " + indice);
  }
});
