import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { PropiedadesRelevancia } from '../src/laboratorio/PropiedadesRelevancia.js';
import { configuracionEscenario, configuracionV3 } from './escenarioPrototipo.js';
import { CONFIGURACION_RELEVANCIA } from './utilidadesPruebas.js';

/*
 * Las propiedades P0–P16 de la relevancia, las mismas que comprueba
 * propiedades() de docs/prototipo_relevancia_v4.mjs. Están en
 * src/laboratorio/PropiedadesRelevancia.js (las usa también el laboratorio).
 */

/** La lista de propiedades como un mapa clave → { ok, detalle }. */
function porClave(lista) {
  const mapa = new Map();
  for (let i = 0; i < lista.length; i++) {
    mapa.set(lista[i].clave, lista[i]);
  }
  return mapa;
}

const CON_LA_V4 = new PropiedadesRelevancia(configuracionEscenario(), true).comprobar();
for (let i = 0; i < CON_LA_V4.length; i++) {
  const propiedad = CON_LA_V4[i];
  prueba("Propiedades: " + propiedad.clave + ", " + propiedad.nombre, function () {
    comprobar(propiedad.ok, propiedad.detalle);
  });
}

prueba("Propiedades: son 17 y se cumplen también con los valores de public/relevancia.json", function () {
  comprobarIgual(CON_LA_V4.length, 17, "P0 a P16");
  const lista = new PropiedadesRelevancia(CONFIGURACION_RELEVANCIA, true).comprobar();
  for (let i = 0; i < lista.length; i++) {
    comprobar(lista[i].ok, lista[i].clave + ": " + lista[i].detalle);
  }
});

prueba("Propiedades: los números de P11 a P16 son los del prototipo", function () {
  const mapa = porClave(CON_LA_V4);
  comprobarIgual(mapa.get("P11").detalle, "Paseo con 400 coexpositores 0.32 · sin ellos 0.32", "P11");
  comprobarIgual(mapa.get("P12").detalle, "200 obras propias: maestro sí, alumnas 12/12", "P12");
  comprobarIgual(mapa.get("P13").detalle, "certeza Huerta–Marina 0.08 · Huerta–Galería 1.00", "P13");
  comprobarIgual(mapa.get("P14").detalle, "exponer juntas 0.14 y 0.14 · mentoría 0.95 y 0.95", "P14");
  comprobarIgual(mapa.get("P15").detalle, "una vez 0.140 · duplicado 0.140 · otro día 0.200", "P15");
  comprobarIgual(mapa.get("P16").detalle, "2 registrados: fuerza 0.140, certeza 0.080 · 100 registrados: fuerza 0.014",
    "P16");
});

prueba("Propiedades: todas se siguen cumpliendo con ρ ∈ {0,3; 0,5; 0,7} y δ ∈ {0,4; 0,5; 0,7; 0,9}", function () {
  const resultado = new PropiedadesRelevancia(configuracionEscenario(), true).robustez();
  comprobarIgual(resultado.combinaciones, 12, "combinaciones");
  for (let i = 0; i < resultado.fallos.length; i++) {
    const fallo = resultado.fallos[i];
    comprobar(false, fallo.clave + " falla con ρ = " + fallo.rho + " y δ = " + fallo.delta + ": " + fallo.detalle);
  }
});

prueba("Propiedades: con los cambios de la v4 apagados, P0–P10 pasan y P11–P16 fallan (como en la v3)", function () {
  const mapa = porClave(new PropiedadesRelevancia(configuracionV3(), false).comprobar());
  for (let i = 0; i <= 16; i++) {
    const propiedad = mapa.get("P" + i);
    comprobarIgual(propiedad.ok, i <= 10, "P" + i + " (" + propiedad.detalle + ")");
  }
  comprobarIgual(mapa.get("P11").detalle, "Paseo con 400 coexpositores 0.22 · sin ellos 0.32", "P11 baja, como en la v3");
});
