import { RelevanciaCompuesta } from '../src/logica/RelevanciaCompuesta.js';
import { CalculadorEvidencia } from '../src/logica/CalculadorEvidencia.js';
import { TablaTransferencia } from '../src/logica/TablaTransferencia.js';
import { PenalizacionGrado } from '../src/logica/PenalizacionGrado.js';
import { CompatibilidadTemporal } from '../src/logica/CompatibilidadTemporal.js';
import { RefuerzoEntreDirectos } from '../src/logica/RefuerzoEntreDirectos.js';
import { DeduccionPorTipos } from '../src/logica/DeduccionPorTipos.js';
import { RelevanciaNodosTresCapas } from '../src/logica/RelevanciaNodosTresCapas.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';

/*
 * Los escenarios de docs/prototipo_relevancia_v2.mjs (variante V2),
 * construidos para las pruebas (sin servidor): el de Ana (escenarioAna) y
 * los de las propiedades P1–P9 (propiedades()).
 *
 * Un escenario se describe igual que en el prototipo: { central, entidades:
 * { id: [clase, nombre] }, parejas: [{ a, b, pruebas }] }, con pruebas
 * declaradas (rel) o coincidencias en eventos (evento). construirDatos lo
 * convierte en una respuesta de /api/relaciones.
 *
 * El factor de tiempo f_t vale 1 en todas las relaciones (como en el
 * prototipo): las que tienen fecha caen dentro de la época de la central y
 * factorTiempoSinFecha = 1.
 */

/** El perfil artístico de public/relevancia.json, con f_t = 1 en todo. */
export function configuracionEscenario() {
  return {
    perfil: "artistico",
    estrategiaNodos: "tresCapas",
    pesosRelevancia: {
      Creation: 1.00, Mentorship: 0.95, coworking: 0.85, Fund: 0.85,
      Exposition: 0.70, Employement: 0.65, Professional: 0.60, Work: 0.60,
      Friendship: 0.50, Marriage: 0.50, Related: 0.45, Filiation: 0.45,
      Wedding: 0.20, Event: 0.30
    },
    pesoPorDefecto: 0.40,
    pesosPorRol: { "Mentorship.maestro": 0.95, "Mentorship.aprendiz": 0.60 },
    rolesEquivalentes: {
      maestro: ["maestro", "maestra", "mestre", "mestra", "teacher", "master"],
      aprendiz: ["aprendiz", "alumno", "alumna", "discípulo", "discípula", "deixeble", "student", "apprentice"]
    },
    betaParticipantes: 1,
    factorTiempoMinimo: 0.5,
    tauTiempoAnios: 25,
    factorTiempoSinFecha: 1,
    tiposSinTiempo: ["Creation", "Mentorship", "Related"],
    tablaTransferencia: {
      "Mentorship:maestro>Creation": 0.8, "Mentorship:aprendiz>Creation": 0.5,
      "Mentorship:maestro>Mentorship": 0.6, "Mentorship:aprendiz>Mentorship": 0.3,
      "Mentorship>Creation": 0.8, "Mentorship>Mentorship": 0.6,
      "Creation>Exposition": 0.8, "coworking>Creation": 0.6, "Marriage>Creation": 0.5,
      "Employement>Employement": 0.5, "Exposition>Creation": 0.4, "Friendship>Friendship": 0.4,
      "Exposition>Exposition": 0.3, "Friendship>Marriage": 0.3, "Friendship>Creation": 0.2
    },
    transferenciaPorDefecto: 0.3,
    factorEntidad: { Creator: 1.0, HeritageItem: 1.0, Organization: 0.8, Person: 0.6 },
    tiposCoincidencia: ["Exposition", "Work", "Wedding", "Event"],
    probabilidadCoincidencia: 0.4,
    rho: 0.5,
    cierreTriadico: 0.3,
    delta: 0.7,
    gradoReferencia: 10,
    paresTemporales: {
      "Mentorship>Creation": "antesODurante", "Mentorship>Mentorship": "solapa",
      "Employement>Employement": "solapa", "Friendship>Marriage": "solapa"
    },
    margenAnios: 5,
    factorFueraDeTiempo: 0.3,
    transferenciaSinFecha: 1.0,
    umbralDirecto: 0.05,
    maxDirectos: 1000,
    mostrarDeducidosPorDefecto: true,
    opacidadMinima: 0.25
  };
}

/** Las etiquetas de las entidades con sus padres (como /api/jerarquia). */
export const JERARQUIA_ESCENARIO = {
  Painter: ["Creator", "Person"],
  Creator: ["Person"],
  Person: [],
  Organization: [],
  HeritageItem: [],
  Paint: ["Creation", "Event"],
  Creation: ["Event"],
  Exposition: ["Event"],
  Event: []
};

/** Los tipos de relación con sus padres (como /api/tipos). */
export const TIPOS_ESCENARIO = [
  { id: "Creation", padres: ["Event"] },
  { id: "Employement", padres: ["Professional", "Relationship"] },
  { id: "Event", padres: [] },
  { id: "Exposition", padres: ["Event"] },
  { id: "Friendship", padres: ["Relationship"] },
  { id: "Marriage", padres: ["Related", "Relationship"] },
  { id: "Mentorship", padres: ["Relationship"] },
  { id: "Paint", padres: ["Creation", "Event"] },
  { id: "Work", padres: ["Event"] },
  { id: "coworking", padres: ["Professional", "Relationship"] }
];

/** El contexto con que se interpretan los datos (como en Aplicacion). */
export function contextoEscenario() {
  return {
    idioma: "es",
    nombresTipos: {
      Friendship: "Amistad", Mentorship: "Mentoría", Employement: "Empleo", Marriage: "Matrimonio",
      Creation: "Creación", Paint: "Pintura", Exposition: "Exposición", Event: "Evento", Work: "Trabajo",
      coworking: "Colaboración", COINCIDENCIAS: "Coincidencias en eventos"
    },
    etiquetasEntidad: { Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE" },
    tipos: TIPOS_ESCENARIO
  };
}

const PADRES = {};
for (let i = 0; i < TIPOS_ESCENARIO.length; i++) {
  PADRES[TIPOS_ESCENARIO[i].id] = TIPOS_ESCENARIO[i].padres;
}

/**
 * Una relación derivada con el formato de /api/relaciones.
 *
 * @param {Object} extra - opcional: { roles: { id: rol }, periodo: { from, to }, fecha, dibujable }
 */
export function relacionDePrueba(id, origen, destino, tipo, participantes, extra) {
  let datos = {};
  if (extra !== undefined && extra !== null) {
    datos = extra;
  }
  let padres = [];
  if (Array.isArray(PADRES[tipo])) {
    padres = PADRES[tipo];
  }
  let seDibuja = participantes <= 10;
  if (typeof datos.dibujable === "boolean") {
    seDibuja = datos.dibujable;
  }
  let idA = origen;
  let idB = destino;
  if (idB < idA) {
    idA = destino;
    idB = origen;
  }
  let roles = {};
  if (datos.roles !== undefined) {
    roles = datos.roles;
  }
  let periodo = null;
  if (datos.periodo !== undefined) {
    periodo = datos.periodo;
  }
  let fecha = null;
  if (datos.fecha !== undefined) {
    fecha = datos.fecha;
  }
  return {
    id: id + "|" + idA + "|" + idB, idIntermedio: id, origen: idA, destino: idB, tipo: tipo, padres: padres,
    roles: roles, nombre: "", periodo: periodo, lugar: null, fecha: fecha, participantes: participantes,
    dibujable: seDibuja
  };
}

/** Una entidad en bruto (como /api/relaciones). */
export function entidadDePrueba(id, etiquetas, nombre) {
  const propiedades = {};
  if (etiquetas[0] === "Person") {
    const partes = nombre.split(" ");
    propiedades.name = partes[0];
    if (partes.length > 1) {
      propiedades.lastName = partes.slice(1).join(" ");
    }
  } else {
    propiedades.name_es = nombre;
  }
  return { id: id, etiquetas: etiquetas, propiedades: propiedades };
}

// Las clases del prototipo → etiquetas de la base de datos.
const ETIQUETAS_DE_CLASE = {
  Creator: ["Person", "Creator", "Painter"],
  Person: ["Person"],
  Organization: ["Organization"],
  HeritageItem: ["HeritageItem"]
};

/** Una prueba declarada (rel del prototipo). */
export function rel(tipo, roles, periodo) {
  const prueba = { tipo: tipo, participantes: 2 };
  if (roles !== undefined && roles !== null) {
    prueba.roles = roles;
  }
  if (periodo !== undefined && periodo !== null) {
    prueba.periodo = periodo;
  }
  return prueba;
}

/** Una coincidencia en un evento (evento del prototipo). */
export function evento(tipo, participantes) {
  return { tipo: tipo, participantes: participantes };
}

/**
 * Un escenario del prototipo como una respuesta de /api/relaciones con
 * TODAS las entidades marcadas como completas.
 */
export function construirDatos(escenario) {
  const entidades = [];
  const ids = [];
  for (const id of Object.keys(escenario.entidades)) {
    const datos = escenario.entidades[id];
    entidades.push(entidadDePrueba(id, ETIQUETAS_DE_CLASE[datos[0]], datos[1]));
    ids.push(id);
  }
  const relaciones = [];
  let numero = 0;
  for (let i = 0; i < escenario.parejas.length; i++) {
    const pareja = escenario.parejas[i];
    for (let j = 0; j < pareja.pruebas.length; j++) {
      const prueba = pareja.pruebas[j];
      numero = numero + 1;
      const extra = {};
      if (prueba.roles !== undefined) {
        extra.roles = prueba.roles;
      }
      if (prueba.periodo !== undefined) {
        extra.periodo = { from: String(prueba.periodo.desde), to: String(prueba.periodo.hasta) };
      }
      relaciones.push(relacionDePrueba("p" + numero, pareja.a, pareja.b, prueba.tipo, prueba.participantes, extra));
    }
  }
  return { ids: ids, entidades: entidades, relaciones: relaciones };
}

function repetir(prueba, veces) {
  const lista = [];
  for (let i = 0; i < veces; i++) {
    lista.push(prueba);
  }
  return lista;
}

/** El ejemplo de Ana Ferrer (escenarioAna del prototipo). */
export function escenarioAna() {
  const e = {
    central: "ana",
    entidades: {
      ana: ["Creator", "Ana Ferrer"], luis: ["Creator", "Luis Peris"], marta: ["Creator", "Marta Soler"],
      pedro: ["Person", "Pedro Navarro"], juan: ["Creator", "Juan Ribes"], joaquin: ["Creator", "Joaquín Mestre"],
      taller: ["Organization", "Taller Valencia"], museo: ["Organization", "Museo de la Ciudad"],
      retrato: ["HeritageItem", "Retrato"], paseo: ["HeritageItem", "Paseo"], huerta: ["HeritageItem", "Huerta"]
    },
    parejas: []
  };
  const luis = [rel("Friendship")].concat(repetir(evento("Exposition", 4), 5));
  e.parejas.push({ a: "ana", b: "luis", pruebas: luis });
  e.parejas.push({ a: "ana", b: "marta", pruebas: [evento("Exposition", 3), evento("Exposition", 6), evento("Exposition", 40)] });
  e.parejas.push({ a: "ana", b: "taller", pruebas: [rel("Employement")] });
  e.parejas.push({ a: "ana", b: "pedro", pruebas: [evento("Exposition", 12)] });
  e.parejas.push({ a: "ana", b: "joaquin", pruebas: [rel("Mentorship", { ana: "aprendiz", joaquin: "maestro" },
    { desde: 1900, hasta: 1910 })] });
  e.parejas.push({ a: "ana", b: "huerta", pruebas: [rel("Creation")] });
  e.parejas.push({ a: "luis", b: "marta", pruebas: [rel("Friendship")] });
  e.parejas.push({ a: "luis", b: "pedro", pruebas: [rel("Marriage")] });
  e.parejas.push({ a: "luis", b: "retrato", pruebas: [rel("Creation")] });
  e.parejas.push({ a: "taller", b: "juan", pruebas: [rel("Employement")] });
  e.parejas.push({ a: "joaquin", b: "paseo", pruebas: [rel("Creation", null, { desde: 1905, hasta: 1905 })] });
  e.parejas.push({ a: "huerta", b: "museo", pruebas: [rel("Exposition")] });
  return e;
}

/** Una copia del escenario sin la pareja a–b (P1). */
export function copiaSinPareja(escenario, a, b) {
  const copia = { central: escenario.central, entidades: escenario.entidades, parejas: [] };
  for (let i = 0; i < escenario.parejas.length; i++) {
    const par = escenario.parejas[i];
    const esLaQuitada = (par.a === a && par.b === b) || (par.a === b && par.b === a);
    if (!esLaQuitada) {
      copia.parejas.push(par);
    }
  }
  return copia;
}

/** Diez exposiciones con X frente a cuatro tipos distintos de vínculo con Y (P4). */
export function escenarioDiversidad() {
  const e = { central: "ana", entidades: { ana: ["Creator", "Ana"], x: ["Creator", "Equis"], y: ["Creator", "Ye"] },
    parejas: [] };
  e.parejas.push({ a: "ana", b: "x", pruebas: [rel("Friendship")].concat(repetir(evento("Exposition", 4), 10)) });
  e.parejas.push({ a: "ana", b: "y", pruebas: [rel("Friendship"), evento("Exposition", 4), rel("coworking"),
    evento("Work", 2)] });
  return e;
}

/** Un compañero de un taller pequeño frente a uno de una academia de 300 (P5). */
export function escenarioHub() {
  const e = { central: "ana", entidades: { ana: ["Creator", "Ana"], tallerPequeno: ["Organization", "Taller pequeño"],
    academia: ["Organization", "Academia"], companeroTaller: ["Creator", "Compañero del taller"],
    companeroAcademia: ["Creator", "Compañero de la academia"] }, parejas: [] };
  e.parejas.push({ a: "ana", b: "tallerPequeno", pruebas: [rel("Employement")] });
  e.parejas.push({ a: "ana", b: "academia", pruebas: [rel("Employement")] });
  e.parejas.push({ a: "tallerPequeno", b: "companeroTaller", pruebas: [rel("Employement")] });
  for (let i = 0; i < 4; i++) {
    e.entidades["t" + i] = ["Creator", "T" + i];
    e.parejas.push({ a: "tallerPequeno", b: "t" + i, pruebas: [rel("Employement")] });
  }
  e.parejas.push({ a: "academia", b: "companeroAcademia", pruebas: [rel("Employement")] });
  for (let i = 0; i < 300; i++) {
    e.entidades["a" + i] = ["Creator", "A" + i];
    e.parejas.push({ a: "academia", b: "a" + i, pruebas: [rel("Employement")] });
  }
  return e;
}

/** Joaquín como centro: tiene 40 alumnos, Ana entre ellos (P6). */
export function escenarioMaestro() {
  const e = escenarioAna();
  const copia = { central: "joaquin", entidades: e.entidades, parejas: e.parejas.slice() };
  for (let i = 0; i < 39; i++) {
    copia.entidades["alumno" + i] = ["Creator", "Alumno " + i];
    const roles = { joaquin: "maestro" };
    roles["alumno" + i] = "aprendiz";
    copia.parejas.push({ a: "joaquin", b: "alumno" + i, pruebas: [rel("Mentorship", roles)] });
  }
  return copia;
}

/** Dos obras del maestro: «Paseo», durante la mentoría, y «Tardía», 35 años después (P7). */
export function escenarioTiempo() {
  const e = escenarioAna();
  e.entidades.tardia = ["HeritageItem", "Tardía"];
  e.parejas.push({ a: "joaquin", b: "tardia", pruebas: [rel("Creation", null, { desde: 1945, hasta: 1945 })] });
  return e;
}

/** Un maestro y un círculo de 25 contactos flojos (solo coincidencias), todos amigos entre sí (P9). */
export function escenarioCirculo() {
  const e = { central: "ana", entidades: { ana: ["Creator", "Ana"], joaquin: ["Creator", "Joaquín"] }, parejas: [] };
  e.parejas.push({ a: "ana", b: "joaquin", pruebas: [rel("Mentorship", { ana: "aprendiz", joaquin: "maestro" })] });
  for (let i = 0; i < 25; i++) {
    e.entidades["c" + i] = ["Creator", "C" + i];
    e.parejas.push({ a: "ana", b: "c" + i, pruebas: [evento("Exposition", 6), evento("Exposition", 8)] });
    for (let j = 0; j < i; j++) {
      e.parejas.push({ a: "c" + j, b: "c" + i, pruebas: [rel("Friendship")] });
    }
  }
  return e;
}

/**
 * Las piezas de la relevancia en tres capas con una configuración.
 *
 * @returns {Object} { estrategia, calculador, tabla, penalizacion, temporal, refuerzo, deduccion, compuesta }
 */
export function crearPiezas(configuracion, jerarquia) {
  const compuesta = new RelevanciaCompuesta(configuracion);
  const tabla = new TablaTransferencia(configuracion, jerarquia);
  const calculador = new CalculadorEvidencia(compuesta, configuracion, tabla);
  const penalizacion = new PenalizacionGrado(configuracion);
  const temporal = new CompatibilidadTemporal(configuracion);
  const refuerzo = new RefuerzoEntreDirectos(configuracion, tabla, penalizacion);
  const deduccion = new DeduccionPorTipos(configuracion, tabla, penalizacion, temporal, calculador);
  const estrategia = new RelevanciaNodosTresCapas(calculador, refuerzo, deduccion);
  return { estrategia: estrategia, calculador: calculador, tabla: tabla, penalizacion: penalizacion,
    temporal: temporal, refuerzo: refuerzo, deduccion: deduccion, compuesta: compuesta };
}

/** La caché con un escenario completo (por defecto, el de Ana). */
export function cacheEscenario(escenario) {
  let e = escenario;
  if (e === undefined) {
    e = escenarioAna();
  }
  return new RepositorioVecindario(construirDatos(e), contextoEscenario());
}

/**
 * Calcula un escenario con una configuración (por defecto, la del perfil).
 *
 * @returns {Map<string, ResultadoRelevanciaNodo>}
 */
export function calcularEscenario(escenario, configuracion) {
  let config = configuracion;
  if (config === undefined) {
    config = configuracionEscenario();
  }
  const piezas = crearPiezas(config, JERARQUIA_ESCENARIO);
  const cache = cacheEscenario(escenario);
  return piezas.estrategia.calcular(cache.entidad(escenario.central), cache);
}
