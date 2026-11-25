import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { CalculadorEvidencia } from '../src/logica/CalculadorEvidencia.js';
import {
  configuracionEscenario, configuracionV3, contextoEscenario, crearPiezas, relacionDePrueba, entidadDePrueba
} from './escenarioPrototipo.js';

/*
 * Pruebas de CalculadorEvidencia (src/logica/): la capa 0, la evidencia de
 * cada pareja con TODAS sus relaciones, vista desde un lado.
 *
 * Las que necesitan coincidencias fuertes usan la v3 (sin tope): lo que
 * comprueban es cómo se combinan, no cuánto vale cada una (eso está en
 * pruebasRepartoParticipantes.js).
 */

const PINTOR = ["Person", "Creator", "Painter"];

/** Una caché con dos pintores (a y b), una obra y un museo, y esas relaciones. */
function crearCache(relaciones) {
  return new RepositorioVecindario({
    ids: ["a", "b", "obra", "museo"],
    entidades: [
      entidadDePrueba("a", PINTOR, "Ana Ferrer"),
      entidadDePrueba("b", PINTOR, "Bea Roig"),
      entidadDePrueba("obra", ["HeritageItem"], "Huerta"),
      entidadDePrueba("museo", ["Organization"], "Museo")
    ],
    relaciones: relaciones
  }, contextoEscenario());
}

function crearCalculador(configuracion) {
  let config = configuracionEscenario();
  if (configuracion !== undefined) {
    config = configuracion;
  }
  return crearPiezas(config).calculador;
}

/** Las relaciones de la caché entre dos entidades. */
function entre(cache, idUno, idOtro) {
  const resultado = [];
  const relaciones = cache.relacionesDe(idUno);
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].getOtroExtremo(cache.entidad(idUno)).getId() === idOtro) {
      resultado.push(relaciones[i]);
    }
  }
  return resultado;
}

/** La evidencia de «hacia» vista desde «desde». */
function evidencia(calculador, cache, desde, hacia) {
  return calculador.calcular(cache.entidad(desde), cache.entidad(hacia), entre(cache, desde, hacia));
}

prueba("CalculadorEvidencia: una relación declarada da certeza 1", function () {
  const cache = crearCache([relacionDePrueba("m", "a", "b", "Mentorship", 2)]);
  const ev = evidencia(crearCalculador(), cache, "a", "b");
  comprobarIgual(ev.getCerteza(), 1, "certeza");
  comprobar(ev.esDeclarada(), "declarada");
  comprobarIgual(redondear(ev.getValor()), 0.95, "F × C = 0,95 × 1");
});

prueba("CalculadorEvidencia: 3 coincidencias de 2 participantes dan certeza 1 − 0,6³ = 0,784 sin tope (v3) y " +
  "1 − 0,92³ = 0,221 con él", function () {
  const cache = crearCache([relacionDePrueba("e1", "a", "b", "Exposition", 2), relacionDePrueba("e2", "a", "b", "Exposition", 2),
    relacionDePrueba("e3", "a", "b", "Exposition", 2)]);
  comprobarIgual(redondear(evidencia(crearCalculador(), cache, "a", "b").getCerteza()), redondear(1 - Math.pow(0.92, 3)),
    "con tope: cada una, 0,4 × 0,2");
  const ev = evidencia(crearCalculador(configuracionV3()), cache, "a", "b");
  comprobarIgual(redondear(ev.getCerteza()), 0.784, "certeza");
  comprobar(!ev.esDeclarada(), "solo coincidencias");
  comprobarIgual(ev.getNumeroEventos(), 3, "número de eventos");
});

prueba("CalculadorEvidencia: multiplexidad, 10 exposiciones de 4 suman menos con ρ = 0,5 que con ρ = 1", function () {
  const relaciones = [];
  for (let i = 0; i < 10; i++) {
    relaciones.push(relacionDePrueba("e" + i, "a", "b", "Exposition", 4));
  }
  const cache = crearCache(relaciones);
  const conRho = evidencia(crearCalculador(configuracionV3()), cache, "a", "b");
  const configuracion = configuracionV3();
  configuracion.rho = 1;
  const sinRho = evidencia(crearCalculador(configuracion), cache, "a", "b");
  comprobar(conRho.getFuerza() < sinRho.getFuerza(), "ρ = 0,5: " + conRho.getFuerza().toFixed(3) + " < ρ = 1: " +
    sinRho.getFuerza().toFixed(3));
  // Con ρ = 1, 1 − 0,65^10; con ρ = 0,5, cada prueba vale la mitad que la anterior.
  comprobarIgual(redondear(sinRho.getFuerza()), redondear(1 - Math.pow(0.65, 10)), "sin descuento");
  let producto = 1;
  for (let k = 0; k < 10; k++) {
    producto = producto * (1 - 0.35 * Math.pow(0.5, k));
  }
  comprobarIgual(redondear(conRho.getFuerza()), redondear(1 - producto), "con descuento");
});

prueba("CalculadorEvidencia: el rol del otro cambia el peso según el sentido", function () {
  const cache = crearCache([relacionDePrueba("m", "a", "b", "Mentorship", 2, { roles: { a: "Alumna", b: "Maestro" } })]);
  const calculador = crearCalculador();
  const desdeLaAlumna = evidencia(calculador, cache, "a", "b");
  const desdeElMaestro = evidencia(calculador, cache, "b", "a");
  comprobarIgual(redondear(desdeLaAlumna.getFuerza()), 0.95, "visto desde la alumna, el otro es su maestro: 0,95");
  comprobarIgual(redondear(desdeElMaestro.getFuerza()), 0.6, "visto desde el maestro, el otro es su alumna: 0,60");
  comprobarIgual(desdeLaAlumna.getRolPrincipal(), "maestro", "rol normalizado");
  comprobarIgual(desdeElMaestro.getRolPrincipal(), "aprendiz", "rol normalizado");
});

prueba("CalculadorEvidencia: «tipos» guarda todos los tipos con su fuerza", function () {
  const relaciones = [relacionDePrueba("f", "a", "b", "Friendship", 2)];
  for (let i = 0; i < 5; i++) {
    relaciones.push(relacionDePrueba("e" + i, "a", "b", "Exposition", 4));
  }
  relaciones[1].fecha = "1906";
  const ev = evidencia(crearCalculador(configuracionV3()), crearCache(relaciones), "a", "b");
  const tipos = ev.getTipos();
  comprobarIgual(tipos.length, 2, "Amistad y Exposición");
  const porId = {};
  for (let i = 0; i < tipos.length; i++) {
    porId[tipos[i].tipo.getId()] = tipos[i].fuerza;
    if (tipos[i].tipo.getId() === "Exposition") {
      comprobarIgual(tipos[i].periodos.length, 5, "los periodos de las 5 exposiciones");
      comprobarIgual(tipos[i].periodos[0].desde, 1906, "el de la que tiene fecha");
      comprobarIgual(tipos[i].periodos[1], null, "null en las que no tienen");
    }
  }
  comprobarIgual(redondear(porId.Friendship), 0.5, "Amistad");
  comprobarIgual(Math.round(porId.Exposition * 1000) / 1000, 0.542, "5 exposiciones con ρ = 0,5");
  comprobarIgual(ev.getTipoPrincipal().getId(), "Exposition", "el principal es el de mayor fuerza");
  comprobarIgual(redondear(ev.getFuerza()), redondear(1 - (1 - porId.Friendship) * (1 - porId.Exposition)),
    "F combina los tipos sin descuento");
  comprobarIgual(ev.getRelaciones().length, 6, "guarda las 6 relaciones");
});

prueba("CalculadorEvidencia: si dos tipos empatan, el principal no depende del orden de llegada", function () {
  const amistad = relacionDePrueba("f", "a", "b", "Friendship", 2);
  const matrimonio = relacionDePrueba("g", "a", "b", "Marriage", 2);
  const calculador = crearCalculador();
  comprobarIgual(evidencia(calculador, crearCache([amistad, matrimonio]), "a", "b").getTipoPrincipal().getId(),
    "Friendship", "en un orden");
  comprobarIgual(evidencia(calculador, crearCache([matrimonio, amistad]), "a", "b").getTipoPrincipal().getId(),
    "Friendship", "y en el otro");
});

prueba("CalculadorEvidencia: Creation no es coincidencia aunque herede de Event; obra y museo tampoco", function () {
  const cache = crearCache([
    relacionDePrueba("expo", "a", "b", "Exposition", 4),
    relacionDePrueba("expo", "obra", "museo", "Exposition", 4, { via: { obra: "IS_EXPOSED", museo: "OCURRED_AT" } }),
    relacionDePrueba("crea", "a", "b", "Creation", 3)
  ]);
  const calculador = crearCalculador();
  const relaciones = entre(cache, "a", "b");
  const exposicion = [];
  const creacion = [];
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].getTipo().getId() === "Creation") {
      creacion.push(relaciones[i]);
    } else {
      exposicion.push(relaciones[i]);
    }
  }
  const a = cache.entidad("a");
  const b = cache.entidad("b");
  comprobar(calculador.calcular(a, b, exposicion).getCerteza() < 1, "dos pintores en una exposición: coincidencia");
  comprobarIgual(calculador.calcular(a, b, creacion).getCerteza(), 1,
    "dos coautores de una Creation: declarada (se compara el tipo exacto)");
  comprobarIgual(evidencia(calculador, cache, "obra", "museo").getCerteza(), 1, "la obra y el museo: declarada");
});

prueba("CalculadorEvidencia: elige los directos por F × C × fE ≥ umbralDirecto y respeta maxDirectos", function () {
  const cache = crearCache([
    relacionDePrueba("m", "a", "b", "Mentorship", 2),
    relacionDePrueba("crea", "a", "obra", "Creation", 2),
    relacionDePrueba("e40", "a", "museo", "Exposition", 40)
  ]);
  const eleccion = crearCalculador().elegirDirectos(cache.entidad("a"), cache.relacionesDe("a"));
  const ids = [];
  for (let i = 0; i < eleccion.directos.length; i++) {
    ids.push(eleccion.directos[i].getId());
  }
  comprobarIgual(ids.join(","), "obra,b", "de mayor a menor; el museo (0,035 × 0,8) no llega a 0,05");
  const configuracion = configuracionEscenario();
  configuracion.maxDirectos = 1;
  const recortada = crearCalculador(configuracion).elegirDirectos(cache.entidad("a"), cache.relacionesDe("a"));
  comprobarIgual(recortada.directos.length, 1, "solo uno");
  comprobarIgual(recortada.descartados, 1, "uno descartado");
});

prueba("CalculadorEvidencia: los textos (coincidencias, declaradas y vínculo)", function () {
  comprobarIgual(CalculadorEvidencia.contar(1, "exposición"), "1 exposición", "singular");
  comprobarIgual(CalculadorEvidencia.contar(3, "exposición"), "3 exposiciones", "plural en -ón");
  comprobarIgual(CalculadorEvidencia.contar(2, "evento"), "2 eventos", "plural en vocal");
  const calculador = crearCalculador();
  const coincidencias = crearCache([relacionDePrueba("e1", "a", "b", "Exposition", 2),
    relacionDePrueba("e2", "a", "b", "Exposition", 5)]);
  const soloCoincidencias = evidencia(calculador, coincidencias, "a", "b");
  comprobarIgual(calculador.textoCoincidencias(soloCoincidencias), "2 exposiciones", "coincidencias");
  comprobarIgual(calculador.textoDeclaradas(soloCoincidencias), "", "sin declaradas");
  comprobarIgual(calculador.textoVinculo(soloCoincidencias), "coinciden en 2 exposiciones", "vínculo sin declaradas");
  const mentoria = crearCache([relacionDePrueba("m", "a", "b", "Mentorship", 2, { roles: { b: "mestre" } })]);
  const conRol = evidencia(calculador, mentoria, "a", "b");
  comprobarIgual(calculador.textoDeclaradas(conRol), "Mentoría (su maestro)", "declarada con rol");
  comprobarIgual(calculador.textoVinculo(conRol), "su maestro", "vínculo con rol");
  const dosVinculos = crearCache([relacionDePrueba("m", "a", "b", "Mentorship", 2, { roles: { b: "mestre" } }),
    relacionDePrueba("k", "a", "b", "coworking", 2)]);
  comprobarIgual(calculador.textoVinculo(evidencia(calculador, dosVinculos, "a", "b")), "su maestro, Colaboración",
    "se dicen todos los tipos declarados: el que hace entrar a un deducido puede no ser el más fuerte");
});
