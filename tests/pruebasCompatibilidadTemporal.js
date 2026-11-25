import { prueba, comprobarIgual } from './miniPruebas.js';
import { CompatibilidadTemporal } from '../src/logica/CompatibilidadTemporal.js';
import { RelevanciaCompuesta } from '../src/logica/RelevanciaCompuesta.js';
import { EvidenciaPareja } from '../src/modelo/EvidenciaPareja.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { Periodo } from '../src/modelo/Periodo.js';
import { Persona } from '../src/modelo/Persona.js';
import { configuracionEscenario } from './escenarioPrototipo.js';

/*
 * Pruebas de CompatibilidadTemporal (src/logica/): τ, ¿respeta el tiempo el
 * camino central → P → Z?
 */

const MENTORIA = new TipoRelacion("Mentorship", "Mentoría", "#000000", ["Relationship"]);
const CREACION = new TipoRelacion("Creation", "Creación", "#000000", ["Event"]);
const PINTURA = new TipoRelacion("Paint", "Pintura", "#000000", ["Creation", "Event"]);
const AMISTAD = new TipoRelacion("Friendship", "Amistad", "#000000", ["Relationship"]);

const A = new Persona({ id: "a" });
const B = new Persona({ id: "b" });

/** Un tramo con un tipo y unos años (o null). */
function tramo(tipo, desde, hasta) {
  let periodo = null;
  if (desde !== null) {
    periodo = { desde: desde, hasta: hasta };
  }
  return new EvidenciaPareja({
    desde: A, hacia: B, fuerza: 1, certeza: 1, tipos: [{ tipo: tipo, rol: null, fuerza: 1 }], tipoPrincipal: tipo,
    periodoPrincipal: periodo, declarada: true, numeroEventos: 0, relaciones: []
  });
}

function crear() {
  return new CompatibilidadTemporal(configuracionEscenario());
}

prueba("CompatibilidadTemporal: una obra del maestro durante la mentoría → 1", function () {
  comprobarIgual(crear().getFactor(tramo(MENTORIA, 1900, 1910), tramo(CREACION, 1905, 1905)), 1, "1905 en 1900–1910");
  comprobarIgual(crear().getFactor(tramo(MENTORIA, 1900, 1910), tramo(CREACION, 1914, 1914)), 1,
    "1914: dentro del margen de 5 años");
  comprobarIgual(crear().getFactor(tramo(MENTORIA, 1900, 1910), tramo(CREACION, 1890, 1890)), 1,
    "antes de la mentoría también vale (antesODurante)");
});

prueba("CompatibilidadTemporal: 35 años después → factorFueraDeTiempo (0,3)", function () {
  comprobarIgual(crear().getFactor(tramo(MENTORIA, 1900, 1910), tramo(CREACION, 1945, 1945)), 0.3, "1945");
  comprobarIgual(crear().getFactor(tramo(MENTORIA, 1900, 1910), tramo(PINTURA, 1945, 1945)), 0.3,
    "también con Paint (hereda de Creation)");
});

prueba("CompatibilidadTemporal: sin fecha → transferenciaSinFecha", function () {
  const configuracion = configuracionEscenario();
  configuracion.transferenciaSinFecha = 0.8;
  const temporal = new CompatibilidadTemporal(configuracion);
  comprobarIgual(temporal.getFactor(tramo(MENTORIA, 1900, 1910), tramo(CREACION, null, null)), 0.8, "sin fecha la obra");
  comprobarIgual(temporal.getFactor(tramo(MENTORIA, null, null), tramo(CREACION, 1905, 1905)), 0.8, "sin fecha la mentoría");
});

prueba("CompatibilidadTemporal: un par que no está en paresTemporales → 1", function () {
  comprobarIgual(crear().getFactor(tramo(AMISTAD, 1900, 1910), tramo(CREACION, 1990, 1990)), 1, "Friendship>Creation");
});

prueba("CompatibilidadTemporal: los años salen del periodo o de la fecha (primer número de 3 o 4 cifras)", function () {
  const tipo = MENTORIA;
  const conPeriodo = new Relacion("r1", A, B, tipo, 0, { periodo: new Periodo("hacia 1902", "1910-05-01", "") });
  const conFecha = new Relacion("r2", A, B, tipo, 0, { fecha: "c. 980" });
  const sinNada = new Relacion("r3", A, B, tipo, 0, {});
  const anios = RelevanciaCompuesta.aniosDe(conPeriodo);
  comprobarIgual(anios.desde + "-" + anios.hasta, "1902-1910", "periodo en texto");
  comprobarIgual(RelevanciaCompuesta.aniosDe(conFecha).desde, 980, "fecha de 3 cifras");
  comprobarIgual(RelevanciaCompuesta.aniosDe(sinNada), null, "sin fechas");
});
