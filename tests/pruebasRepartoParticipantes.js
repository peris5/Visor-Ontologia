import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { RepartoParticipantes } from '../src/logica/RepartoParticipantes.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import {
  configuracionEscenario, configuracionV3, contextoEscenario, relacionDePrueba, entidadDePrueba
} from './escenarioPrototipo.js';

/*
 * Pruebas de RepartoParticipantes (src/logica/): entre cuántos se reparte una
 * relación, qué es coincidencia, el tope y lo que no se reparte.
 */

const PINTOR = ["Person", "Creator", "Painter"];
// Tres artistas, ocho obras y la galería: 12 entidades.
const POR_CLASE = { PERSONA: 3, OBRA_DE_ARTE: 8, ORGANIZACION: 1 };

/** La relación entre dos entidades (a, b: pintoras; obra, otra: obras; galeria) de un evento. */
function relacion(origen, destino, tipo, participantes, extra) {
  const cache = new RepositorioVecindario({
    ids: [],
    entidades: [entidadDePrueba("a", PINTOR, "Ana"), entidadDePrueba("b", ["Person"], "Bea"),
      entidadDePrueba("obra", ["HeritageItem"], "Obra"), entidadDePrueba("otra", ["HeritageItem"], "Otra"),
      entidadDePrueba("galeria", ["Organization"], "Galería")],
    relaciones: [relacionDePrueba("e", origen, destino, tipo, participantes, extra)]
  }, contextoEscenario());
  return cache.relacionesDe(origen)[0];
}

function v4() {
  return new RepartoParticipantes(configuracionEscenario());
}

function v3() {
  return new RepartoParticipantes(configuracionV3());
}

prueba("Reparto: entre dos personas n cuenta solo personas; entre persona y obra, todas", function () {
  const entrePersonas = relacion("a", "b", "Exposition", 12, { participantesPorClase: POR_CLASE });
  const personaObra = relacion("a", "obra", "Exposition", 12, { participantesPorClase: POR_CLASE });
  comprobarIgual(v4().getParticipantes(entrePersonas), 3, "dos personas (también Painter y Person sin subtipo)");
  comprobarIgual(v4().getParticipantes(personaObra), 12, "persona y obra");
  comprobarIgual(v3().getParticipantes(entrePersonas), 12, "apagado: todas");
  comprobarIgual(v4().getParticipantes(relacion("a", "b", "Exposition", 12)), 12, "si no se sabe, todas");
});

prueba("Reparto: en un evento todo es coincidencia salvo lo que une con el lugar", function () {
  const viaLugar = { via: { galeria: "OCURRED_AT", a: "PARTICIPATES_IN", obra: "IS_EXPOSED" } };
  comprobar(v4().esCoincidencia(relacion("a", "b", "Exposition", 12)), "dos personas");
  comprobar(v4().esCoincidencia(relacion("obra", "otra", "Exposition", 12)), "dos obras del mismo evento");
  comprobar(v4().esCoincidencia(relacion("a", "otra", "Exposition", 12)), "un artista y la obra de otro");
  comprobar(!v4().esCoincidencia(relacion("obra", "galeria", "Exposition", 12, viaLugar)), "la obra y la galería");
  comprobar(!v4().esCoincidencia(relacion("a", "galeria", "Exposition", 12, viaLugar)), "la artista y la galería");
  comprobar(!v4().esCoincidencia(relacion("a", "b", "Creation", 2)), "Creation hereda de Event, pero no está en la lista");
  comprobar(!v4().esCoincidencia(relacion("a", "b", "Friendship", 2)), "una Relationship");
  comprobar(v3().esCoincidencia(relacion("a", "b", "Exposition", 12)), "apagado: solo dos personas...");
  comprobar(!v3().esCoincidencia(relacion("obra", "otra", "Exposition", 12)), "...y no dos obras");
});

prueba("Reparto: una coincidencia nunca vale más que el tope, y con muchos registrados vale 2/n", function () {
  comprobarIgual(v4().getFactor(relacion("a", "b", "Exposition", 2)), 0.2, "2 registrados: el tope");
  comprobarIgual(v4().getFactor(relacion("a", "b", "Exposition", 10)), 0.2, "10 registrados: justo el tope");
  comprobarIgual(redondear(v4().getFactor(relacion("a", "b", "Exposition", 100))), 0.02, "100 registrados: 2/100");
  comprobarIgual(redondear(v3().getFactor(relacion("a", "b", "Exposition", 4))), 0.5, "sin tope: 2/4");
});

prueba("Reparto: lo declarado entre personas sigue siendo (2/n)^β", function () {
  comprobarIgual(v4().getFactor(relacion("a", "b", "Mentorship", 2)), 1, "una Relationship entre dos");
  comprobarIgual(redondear(v4().getFactor(relacion("a", "b", "Creation", 4))), 0.5, "4 coautores");
});

prueba("Reparto: lo que une con el lugar no se reparte", function () {
  const extra = { via: { galeria: "OCURRED_AT" }, participantesPorClase: POR_CLASE };
  comprobarIgual(v4().getFactor(relacion("obra", "galeria", "Exposition", 12, extra)), 1, "la obra y la galería");
  comprobarIgual(redondear(v3().getFactor(relacion("obra", "galeria", "Exposition", 12, extra))), redondear(2 / 12),
    "apagado: 2/n");
});

prueba("Reparto: rechaza un tope que no es un número entre 0 y 1", function () {
  const malos = [2, -1, "x"];
  for (let i = 0; i < malos.length; i++) {
    const configuracion = configuracionEscenario();
    configuracion.topeCoincidencia = malos[i];
    let fallo = false;
    try {
      new RepartoParticipantes(configuracion);
    } catch (error) {
      fallo = true;
    }
    comprobar(fallo, "rechaza " + malos[i]);
  }
});
