import { prueba, comprobarIgual } from './miniPruebas.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';

/*
 * Pruebas de TipoRelacion (src/modelo/): familia y nombres.
 */

const NOMBRES_TIPOS = { Marriage: "Matrimonio", Related: "Parentesco", Mentorship: "Mentoría" };

prueba("TipoRelacion: la familia es el padre más alto por debajo de la raíz", function () {
  comprobarIgual(new TipoRelacion("Marriage", "", "", ["Related", "Relationship"]).getFamilia(), "Related", "Marriage");
  comprobarIgual(new TipoRelacion("Paint", "", "", ["Creation", "Event"]).getFamilia(), "Creation", "Paint");
  comprobarIgual(new TipoRelacion("Mentorship", "", "", ["Relationship"]).getFamilia(), "Mentorship",
    "con un solo padre, el propio tipo");
  comprobarIgual(new TipoRelacion("STUDENT_OF", "", "", []).getFamilia(), "STUDENT_OF", "sin padres, el propio tipo");
  comprobarIgual(new TipoRelacion("Relationship", "", "").getFamilia(), "Relationship", "sin la lista de padres");
});

prueba("TipoRelacion: nombre traducido con nombresTipos", function () {
  comprobarIgual(TipoRelacion.nombrar("Marriage", NOMBRES_TIPOS), "Matrimonio", "Marriage");
  comprobarIgual(TipoRelacion.nombrar("Mentorship", NOMBRES_TIPOS), "Mentoría", "Mentorship");
  const matrimonio = new TipoRelacion("Marriage", "Matrimonio", "#ff0000", ["Related", "Relationship"], "Parentesco");
  comprobarIgual(matrimonio.getNombreFamilia(), "Parentesco", "nombre de la familia");
});

prueba("TipoRelacion: nombre automático de los tipos nuevos (Apprenticeship, STUDENT_OF)", function () {
  comprobarIgual(TipoRelacion.nombrar("Apprenticeship", NOMBRES_TIPOS), "Apprenticeship", "Apprenticeship");
  comprobarIgual(TipoRelacion.nombrar("STUDENT_OF", NOMBRES_TIPOS), "Student of", "STUDENT_OF");
  comprobarIgual(TipoRelacion.nombreDesdeId("HeritageItem"), "Heritage item", "HeritageItem");
  comprobarIgual(TipoRelacion.nombreDesdeId("coworking"), "Coworking", "coworking");
  comprobarIgual(TipoRelacion.nombreDesdeId("maestro_de"), "Maestro de", "maestro_de");
  // Sin nombre de familia, el automático.
  comprobarIgual(new TipoRelacion("Apprenticeship", "", "", ["Professional", "Relationship"]).getNombreFamilia(),
    "Professional", "nombre automático de la familia");
});
