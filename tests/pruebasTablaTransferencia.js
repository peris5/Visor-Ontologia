import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { CompatibilidadTemporal } from '../src/logica/CompatibilidadTemporal.js';
import { TablaTransferencia } from '../src/logica/TablaTransferencia.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { EvidenciaPareja } from '../src/modelo/EvidenciaPareja.js';
import { FabricaEntidades } from '../src/datos/FabricaEntidades.js';
import { configuracionEscenario, JERARQUIA_ESCENARIO } from './escenarioPrototipo.js';

/*
 * Pruebas de TablaTransferencia (src/logica/): la tabla T con rol y
 * herencia, la transmisión Tr y factorEntidad.
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

prueba("TablaTransferencia: buscarT dice de dónde sale el valor", function () {
  const tabla = crearTabla();
  comprobarIgual(tabla.buscarT(MENTORIA, "maestro", PINTURA).clave, "Mentorship:maestro>Creation", "heredada con rol");
  comprobarIgual(tabla.buscarT(AMISTAD, null, EMPLEO).clave, null, "por defecto");
});

/** Un tramo con esos tipos ({ tipo, rol, fuerza, periodos }). */
function tramo(tipos, periodo) {
  return new EvidenciaPareja({
    desde: persona("ana", ["Person", "Creator", "Painter"]), hacia: persona("luis", ["Person", "Creator", "Painter"]),
    fuerza: 0.8, certeza: 1, tipoPrincipal: tipos[0].tipo, periodoPrincipal: periodo, declarada: true, numeroEventos: 0,
    relaciones: [], tipos: tipos
  });
}

prueba("TablaTransferencia: getTransmision con dos tipos es el noisy-OR de sus partes y añadir uno nunca la baja", function () {
  const tabla = crearTabla();
  const obra = tramo([{ tipo: CREACION, rol: null, fuerza: 1 }], null);
  // Luis es amigo (0,5) y coexpositor (0,6) de Ana: partes 0,5 × 0,2 y 0,6 × 0,4.
  const amigo = { tipo: AMISTAD, rol: null, fuerza: 0.5 };
  const coexpositor = { tipo: EXPOSICION, rol: null, fuerza: 0.6 };
  const soloAmigo = tabla.getTransmision(tramo([amigo], null), obra);
  const soloCoexpositor = tabla.getTransmision(tramo([coexpositor], null), obra);
  const losDos = tabla.getTransmision(tramo([amigo, coexpositor], null), obra);
  comprobarIgual(redondear(losDos), redondear(1 - (1 - 0.1) * (1 - 0.24)), "noisy-OR de 0,1 y 0,24");
  comprobar(losDos >= soloAmigo && losDos >= soloCoexpositor, "nunca menos que cada uno por separado");
});

prueba("TablaTransferencia: cada tipo del primer tramo transmite con su propio factor de tiempo", function () {
  const configuracion = configuracionEscenario();
  const tabla = new TablaTransferencia(configuracion, JERARQUIA_ESCENARIO, new CompatibilidadTemporal(configuracion));
  const obraTardia = tramo([{ tipo: CREACION, rol: null, fuerza: 1 }], { desde: 1945, hasta: 1945 });
  const mentoria = { tipo: MENTORIA, rol: "maestro", fuerza: 0.95, periodos: [{ desde: 1900, hasta: 1910 }] };
  const amistad = { tipo: AMISTAD, rol: null, fuerza: 0.5, periodos: [{ desde: 1900, hasta: 1910 }] };
  comprobarIgual(redondear(tabla.getTransmision(tramo([mentoria], null), obraTardia)), redondear(0.95 * 0.8 * 0.3),
    "la mentoría, fuera de tiempo");
  comprobarIgual(redondear(tabla.getTransmision(tramo([mentoria, amistad], null), obraTardia)),
    redondear(1 - (1 - 0.95 * 0.8 * 0.3) * (1 - 0.5 * 0.2)), "a la amistad no le afecta el tiempo");
});

prueba("TablaTransferencia: factorEntidad de un Painter (1,0), de una Person sin subtipo (0,6) y sin factor", function () {
  const tabla = crearTabla();
  const sinEtiquetas = FabricaEntidades.crearEntidad(TipoEntidad.PERSONA, { id: "x", propiedades: { name: "X" } });
  comprobarIgual(tabla.getFactorEntidad(persona("a", ["Person", "Creator", "Painter"])), 1, "Painter → Creator → 1,0");
  comprobarIgual(tabla.getFactorEntidad(persona("p", ["Person"])), 0.6, "Person sin subtipo creador → 0,6");
  comprobarIgual(tabla.getFactorEntidad(sinEtiquetas), 1, "ninguna etiqueta con factor → 1");
});
