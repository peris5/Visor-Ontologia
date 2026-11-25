import { prueba, comprobarIgual, redondear } from './miniPruebas.js';
import { TablaTransferencia } from '../src/logica/TablaTransferencia.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { EvidenciaPareja } from '../src/modelo/EvidenciaPareja.js';
import { FabricaEntidades } from '../src/datos/FabricaEntidades.js';
import { configuracionEscenario, JERARQUIA_ESCENARIO } from './escenarioPrototipo.js';

/*
 * Pruebas de TablaTransferencia (src/logica/): la tabla T con rol y
 * herencia, la T efectiva y factorEntidad.
 */

const ETIQUETAS_ENTIDAD = { Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE" };

const MENTORIA = new TipoRelacion("Mentorship", "Mentoría", "#000000", ["Relationship"]);
const AMISTAD = new TipoRelacion("Friendship", "Amistad", "#000000", ["Relationship"]);
const EXPOSICION = new TipoRelacion("Exposition", "Exposición", "#000000", ["Event"]);
const CREACION = new TipoRelacion("Creation", "Creación", "#000000", ["Event"]);
const PINTURA = new TipoRelacion("Paint", "Pintura", "#000000", ["Creation", "Event"]);
const EMPLEO = new TipoRelacion("Employement", "Empleo", "#000000", ["Professional"]);

function crearTabla() {
  return new TablaTransferencia(configuracionEscenario(), JERARQUIA_ESCENARIO);
}

function persona(id, etiquetas) {
  return FabricaEntidades.crearDesdeNeo4j(etiquetas, { name: id }, id, "es", ETIQUETAS_ENTIDAD);
}

prueba("TablaTransferencia: T con rol y sin rol", function () {
  const tabla = crearTabla();
  comprobarIgual(tabla.getT(MENTORIA, "maestro", CREACION), 0.8, "Mentorship:maestro>Creation");
  comprobarIgual(tabla.getT(MENTORIA, "aprendiz", CREACION), 0.5, "Mentorship:aprendiz>Creation");
  comprobarIgual(tabla.getT(MENTORIA, null, CREACION), 0.8, "sin rol: Mentorship>Creation");
  comprobarIgual(tabla.getT(AMISTAD, "maestro", CREACION), 0.2, "un rol sin clave propia: Friendship>Creation");
});

prueba("TablaTransferencia: T heredada por el segundo tipo (Mentorship:maestro>Paint → 0,8)", function () {
  comprobarIgual(crearTabla().getT(MENTORIA, "maestro", PINTURA), 0.8, "usa Mentorship:maestro>Creation");
  comprobarIgual(crearTabla().getT(MENTORIA, "aprendiz", PINTURA), 0.5, "usa Mentorship:aprendiz>Creation");
});

prueba("TablaTransferencia: T heredada por el primer tipo", function () {
  const tutoria = new TipoRelacion("Tutoria", "Tutoría", "#000000", ["Mentorship", "Relationship"]);
  comprobarIgual(crearTabla().getT(tutoria, "maestro", CREACION), 0.8, "Tutoria (hija de Mentorship):maestro>Creation");
  comprobarIgual(crearTabla().getT(tutoria, null, PINTURA), 0.8, "y con los padres de los dos");
});

prueba("TablaTransferencia: T por defecto", function () {
  comprobarIgual(crearTabla().getT(AMISTAD, null, EMPLEO), 0.3, "Friendship>Employement no está: transferenciaPorDefecto");
});

prueba("TablaTransferencia: getTEfectiva con dos tipos es la media ponderada por su fuerza", function () {
  const luis = persona("luis", ["Person", "Creator", "Painter"]);
  const ana = persona("ana", ["Person", "Creator", "Painter"]);
  // Luis es amigo (0,5) y coexpositor (0,6) de Ana.
  const evidencia = new EvidenciaPareja({
    desde: ana, hacia: luis, fuerza: 0.8, certeza: 1, tipoPrincipal: EXPOSICION, declarada: true, numeroEventos: 0,
    relaciones: [], tipos: [{ tipo: AMISTAD, rol: null, fuerza: 0.5 }, { tipo: EXPOSICION, rol: null, fuerza: 0.6 }]
  });
  // (0,5 × T(Friendship>Creation) + 0,6 × T(Exposition>Creation)) / 1,1 = (0,1 + 0,24) / 1,1
  comprobarIgual(redondear(crearTabla().getTEfectiva(evidencia, CREACION)), redondear(0.34 / 1.1), "media ponderada");
});

prueba("TablaTransferencia: factorEntidad de un Painter (1,0), de una Person sin subtipo (0,6) y sin factor", function () {
  const tabla = crearTabla();
  const sinEtiquetas = FabricaEntidades.crearEntidad(TipoEntidad.PERSONA, { id: "x", propiedades: { name: "X" } });
  comprobarIgual(tabla.getFactorEntidad(persona("a", ["Person", "Creator", "Painter"])), 1, "Painter → Creator → 1,0");
  comprobarIgual(tabla.getFactorEntidad(persona("p", ["Person"])), 0.6, "Person sin subtipo creador → 0,6");
  comprobarIgual(tabla.getFactorEntidad(sinEtiquetas), 1, "ninguna etiqueta con factor → 1");
});
