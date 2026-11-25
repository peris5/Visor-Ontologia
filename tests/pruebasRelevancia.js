import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { EstrategiaRelevancia } from '../src/logica/EstrategiaRelevancia.js';
import { RelevanciaCompuesta } from '../src/logica/RelevanciaCompuesta.js';
import { Persona } from '../src/modelo/Persona.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { Periodo } from '../src/modelo/Periodo.js';
import { CONFIGURACION_RELEVANCIA } from './utilidadesPruebas.js';

/*
 * Pruebas de RelevanciaCompuesta (src/logica/): la relevancia de UNA
 * relación, r = peso(tipo) × (2/n)^β × f_t.
 */

const MATRIMONIO = new TipoRelacion("Marriage", "Matrimonio", "#000000", ["Related", "Relationship"]);
const EXPOSICION = new TipoRelacion("Exposition", "Exposición", "#000000", ["Event"]);
const PINTURA = new TipoRelacion("Paint", "Pintura", "#000000", ["Creation", "Event"]);
const NUEVO = new TipoRelacion("Commission", "Encargo", "#000000", []);

function crearRelacion(tipo, datos) {
  return new Relacion("r", new Persona({ id: "o" }), new Persona({ id: "d" }), tipo, 0, datos);
}

function crearEstrategia(cambios) {
  const configuracion = Object.assign({}, CONFIGURACION_RELEVANCIA);
  if (cambios !== undefined) {
    Object.assign(configuracion, cambios);
  }
  return new RelevanciaCompuesta(configuracion);
}

prueba("RelevanciaCompuesta: es una EstrategiaRelevancia y la interfaz no está implementada", function () {
  comprobar(crearEstrategia() instanceof EstrategiaRelevancia, "implementa EstrategiaRelevancia");
  let fallo = false;
  try {
    new EstrategiaRelevancia().calcularRelevanciaRelacion(null);
  } catch (error) {
    fallo = true;
  }
  comprobar(fallo, "la interfaz lanza un error");
});

prueba("RelevanciaCompuesta: el peso es el del tipo, el del padre más cercano o el de por defecto", function () {
  const estrategia = crearEstrategia();
  comprobarIgual(estrategia.getPeso(MATRIMONIO), 0.5, "Marriage tiene peso propio");
  comprobarIgual(estrategia.getPeso(PINTURA), 1, "Paint hereda el de Creation");
  comprobarIgual(estrategia.getPeso(NUEVO), 0.4, "un tipo sin peso ni padres: pesoPorDefecto");
});

prueba("RelevanciaCompuesta: buscarPeso dice de dónde sale el peso", function () {
  const estrategia = crearEstrategia();
  const mentoria = new TipoRelacion("Mentorship", "Mentoría", "#000000", ["Relationship"]);
  comprobarIgual(estrategia.buscarPeso(MATRIMONIO).clave, "Marriage", "exacto");
  comprobarIgual(estrategia.buscarPeso(PINTURA).clave, "Creation", "heredado");
  comprobarIgual(estrategia.buscarPeso(mentoria, "aprendiz").clave, "Mentorship.aprendiz", "por rol");
  comprobarIgual(estrategia.buscarPeso(NUEVO).clave, null, "por defecto");
});

prueba("RelevanciaCompuesta: (2/n)^β baja con el número de participantes", function () {
  const reparto = crearEstrategia().getReparto();
  comprobarIgual(reparto.getFactorDeNumero(2), 1, "entre dos");
  comprobarIgual(redondear(reparto.getFactorDeNumero(40)), 0.05, "40 participantes con β = 1");
  const conBeta2 = crearEstrategia({ betaParticipantes: 2 }).getReparto();
  comprobarIgual(redondear(conBeta2.getFactorDeNumero(4)), 0.25, "4 participantes con β = 2");
});

prueba("RelevanciaCompuesta: r = peso × (2/n)^β × f_t y se guarda en la relación", function () {
  const estrategia = crearEstrategia();
  const relacion = crearRelacion(MATRIMONIO, { participantes: 4 });
  const r = estrategia.calcularRelevanciaRelacion(relacion);
  comprobarIgual(redondear(r), 0.25, "0,5 × 2/4 × 1 (sin época, f_t = 1)");
  comprobarIgual(redondear(relacion.getRelevancia()), 0.25, "guardada en la relación");
  const coincidencia = estrategia.calcularRelevanciaRelacion(crearRelacion(EXPOSICION, { participantes: 4 }));
  comprobarIgual(redondear(coincidencia), 0.14, "una coincidencia: 0,7 × 0,2 (el tope) × 1");
});

prueba("RelevanciaCompuesta: el factor de tiempo penaliza lo que queda lejos de la época de la central", function () {
  const estrategia = crearEstrategia({ factorTiempoMinimo: 0.5, tauTiempoAnios: 25, factorTiempoSinFecha: 0.9 });
  const dentro = crearRelacion(EXPOSICION, { fecha: "1905" });
  const lejos = crearRelacion(EXPOSICION, { periodo: new Periodo("1950", "1960", "") });
  const sinFecha = crearRelacion(EXPOSICION, {});
  comprobarIgual(estrategia.getFactorTiempo(lejos), 1, "sin época de la central, f_t = 1");
  estrategia.setEpoca(RelevanciaCompuesta.epocaDe([crearRelacion(EXPOSICION, { periodo: new Periodo("1900", "1910", "") })]));
  comprobarIgual(estrategia.getFactorTiempo(dentro), 1, "dentro de la época");
  comprobarIgual(redondear(estrategia.getFactorTiempo(lejos)), redondear(0.5 + 0.5 * Math.exp(-40 / 25)),
    "40 años después de la época");
  comprobarIgual(estrategia.getFactorTiempo(sinFecha), 0.9, "sin fecha");
  comprobarIgual(estrategia.getFactorTiempo(crearRelacion(MATRIMONIO, { fecha: "1990" })), 1,
    "Marriage hereda de Related, que está en tiposSinTiempo");
});

prueba("RelevanciaCompuesta: la época sale de los años de las relaciones", function () {
  const epoca = RelevanciaCompuesta.epocaDe([
    crearRelacion(EXPOSICION, { fecha: "1910-05-01" }),
    crearRelacion(EXPOSICION, { periodo: new Periodo("1902", "1908", "") }),
    crearRelacion(EXPOSICION, {})
  ]);
  comprobarIgual(epoca.desde, 1902, "desde");
  comprobarIgual(epoca.hasta, 1910, "hasta");
  comprobarIgual(RelevanciaCompuesta.epocaDe([crearRelacion(EXPOSICION, {})]), null, "sin fechas, sin época");
});

prueba("RelevanciaCompuesta: el nodo del mejor camino es el producto (nunca crece)", function () {
  const estrategia = crearEstrategia();
  comprobarIgual(redondear(estrategia.calcularRelevanciaNodo(0.8, 0.5)), 0.4, "0,8 × 0,5");
  comprobar(estrategia.calcularRelevanciaNodo(0.8, 0.9) <= 0.8, "nunca más que el padre");
});

prueba("RelevanciaCompuesta: rechaza una configuración incompleta", function () {
  const malas = [{ pesoPorDefecto: 2 }, { betaParticipantes: 0 }, { tauTiempoAnios: -1 }, { factorTiempoSinFecha: "x" }];
  for (let i = 0; i < malas.length; i++) {
    let fallo = false;
    try {
      crearEstrategia(malas[i]);
    } catch (error) {
      fallo = true;
    }
    comprobar(fallo, "rechaza " + JSON.stringify(malas[i]));
  }
});
