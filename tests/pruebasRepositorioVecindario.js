import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { RepositorioDatos } from '../src/datos/RepositorioDatos.js';
import { PaletaColores } from '../src/logica/PaletaColores.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { VECINDARIO_EJEMPLO, CONTEXTO_PRUEBAS } from './utilidadesPruebas.js';

/*
 * Pruebas de RepositorioVecindario (src/datos/) con el formato de
 * /api/vecindario desde el incremento 3b (entidades en bruto de Neo4j y
 * relaciones derivadas). Incluyen las de RepositorioSimulado del incremento 1.
 */

/**
 * El contexto de las pruebas: idioma, nombres de los tipos, etiquetas de
 * entidad y los tipos que hay en los datos (con sus padres).
 *
 * @returns {Object}
 */
function crearContexto() {
  return {
    idioma: "es",
    nombresTipos: { Mentorship: "Mentoría", Paint: "Pintura", Creation: "Creación", Exposition: "Exposición" },
    etiquetasEntidad: { Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE" },
    tipos: [
      { id: "Mentorship", padres: ["Relationship"] },
      { id: "Paint", padres: ["Creation", "Event"] },
      { id: "Exposition", padres: ["Event"] },
      { id: "Marriage", padres: ["Related", "Relationship"] },
      { id: "STUDENT_OF", padres: [] }
    ]
  };
}

/**
 * Un vecindario pequeño con el formato de /api/vecindario.
 *
 * @returns {Object}
 */
function crearVecindarioDePrueba() {
  return {
    idCentral: "A",
    umbral: 0.3,
    recortado: false,
    relevanciasAsignadas: 3,
    relevanciasReutilizadas: 1,
    entidades: [
      { id: "A", etiquetas: ["Person", "Creator", "Painter"], propiedades: { name: "Ana", lastName: "Roig Peris" } },
      { id: "B", etiquetas: ["Person"], propiedades: { name: "Bruno" } },
      { id: "C", etiquetas: ["HeritageItem"], propiedades: { name_es: "Cuadro azul", name_ca: "Quadre blau",
        dimensions: "10 × 20 cm" } },
      { id: "D", etiquetas: ["Organization"], propiedades: { name_es: "Academia", name_en: "Academy" } }
    ],
    relaciones: [
      { id: "m1|A|B", idIntermedio: "m1", origen: "A", destino: "B", tipo: "Mentorship", padres: ["Relationship"],
        valor: 0.85, roles: { A: "maestra", B: "aprendiz" },
        periodo: { from: "1902", to: "1908", description: "" }, lugar: "Valencia", fecha: null },
      { id: "p1|B|C", idIntermedio: "p1", origen: "B", destino: "C", tipo: "Paint", padres: ["Creation", "Event"],
        valor: 0.9, roles: { B: "autor" }, periodo: null, lugar: null, fecha: "1910" },
      { id: "p2|A|C", idIntermedio: "p2", origen: "A", destino: "C", tipo: "Paint", padres: ["Creation", "Event"],
        valor: 0.9, roles: {}, periodo: null, lugar: null, fecha: null },
      { id: "e1|C|D", idIntermedio: "e1", origen: "C", destino: "D", tipo: "Exposition", padres: ["Event"],
        valor: 0.5, roles: {}, periodo: null, lugar: null, fecha: null }
    ]
  };
}

/**
 * @param {RepositorioVecindario} repositorio
 * @param {string} idRelacion
 * @returns {Promise<Relacion|null>}
 */
async function buscarRelacion(repositorio, idRelacion) {
  const tipos = ["A", "B", "C", "D"];
  for (let i = 0; i < tipos.length; i++) {
    const relaciones = await repositorio.obtenerRelaciones(tipos[i]);
    for (let j = 0; j < relaciones.length; j++) {
      if (relaciones[j].getId() === idRelacion) {
        return relaciones[j];
      }
    }
  }
  return null;
}

/**
 * @param {RepositorioVecindario} repositorio
 * @param {string} idTipo
 * @returns {Promise<TipoRelacion|null>}
 */
async function buscarTipo(repositorio, idTipo) {
  const tipos = await repositorio.obtenerTiposRelacion();
  for (let i = 0; i < tipos.length; i++) {
    if (tipos[i].getId() === idTipo) {
      return tipos[i];
    }
  }
  return null;
}

prueba("RepositorioVecindario: crea entidades del tipo correcto a partir de sus etiquetas", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const ana = await repositorio.obtenerEntidad("A");
  comprobar(ana instanceof Persona, "A debería ser una Persona");
  comprobar((await repositorio.obtenerEntidad("C")) instanceof ObraDeArte, "C debería ser una ObraDeArte");
  comprobar((await repositorio.obtenerEntidad("D")) instanceof Organizacion, "D debería ser una Organizacion");
  comprobarIgual(ana.getNombre(), "Ana Roig Peris", "nombre de A");
  comprobarIgual(ana.getSubtipos().join(","), "Creator,Painter", "subtipos de A");
  comprobarIgual((await repositorio.obtenerEntidad("C")).getDimensiones(), "10 × 20 cm", "dimensiones de C");
  comprobarIgual((await repositorio.obtenerEntidad("D")).getNombre(), "Academia", "nombre de D");
});

prueba("RepositorioVecindario: obtenerRelaciones devuelve las relaciones en los dos sentidos", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const relaciones = await repositorio.obtenerRelaciones("C");
  comprobarIgual(relaciones.length, 3, "número de relaciones de C");
  const copia = await repositorio.obtenerRelaciones("C");
  copia.pop();
  comprobarIgual((await repositorio.obtenerRelaciones("C")).length, 3, "cambiar la lista devuelta no cambia el repositorio");
});

prueba("RepositorioVecindario: las relaciones llevan valor, roles, periodo, lugar y fecha", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const mentoria = await buscarRelacion(repositorio, "m1|A|B");
  comprobarIgual(mentoria.getValor(), 0.85, "valor (la relevancia asignada)");
  comprobarIgual(mentoria.getIdIntermedio(), "m1", "id del intermediario");
  comprobarIgual(mentoria.getRol(mentoria.getOrigen()), "maestra", "rol del origen");
  comprobarIgual(mentoria.getRol(mentoria.getDestino()), "aprendiz", "rol del destino");
  comprobarIgual(mentoria.getPeriodo().getTexto(), "1902–1908", "periodo");
  comprobarIgual(mentoria.getLugar(), "Valencia", "lugar");
  const pintura = await buscarRelacion(repositorio, "p1|B|C");
  comprobarIgual(pintura.getFecha(), "1910", "fecha");
  comprobarIgual(pintura.getPeriodo(), null, "sin periodo");
  comprobarIgual(pintura.getRol(pintura.getDestino()), "", "la obra no tiene rol");
});

prueba("RepositorioVecindario: un solo TipoRelacion por id, con nombre, padres y familia", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const p1 = await buscarRelacion(repositorio, "p1|B|C");
  const p2 = await buscarRelacion(repositorio, "p2|A|C");
  comprobar(p1.getTipo() === p2.getTipo(), "las dos pinturas comparten el mismo objeto TipoRelacion");
  comprobarIgual(p1.getTipo().getNombre(), "Pintura", "nombre traducido");
  comprobarIgual(p1.getTipo().getPadres().join(","), "Creation,Event", "padres");
  comprobarIgual(p1.getTipo().getFamilia(), "Creation", "familia");
  comprobarIgual(p1.getTipo().getNombreFamilia(), "Creación", "nombre de la familia");
  comprobar(/^#[0-9a-f]{6}$/.test(p1.getTipo().getColor()), "color con formato #rrggbb");
});

prueba("RepositorioVecindario: los colores se reparten sobre todos los tipos en orden alfabético", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  // Orden alfabético de los tipos del contexto: Exposition, Marriage, Mentorship, Paint, STUDENT_OF.
  comprobarIgual((await buscarTipo(repositorio, "Exposition")).getColor(), PaletaColores.colorPara(0), "Exposition, el 1.º");
  comprobarIgual((await buscarTipo(repositorio, "Mentorship")).getColor(), PaletaColores.colorPara(2), "Mentorship, el 3.º");
  comprobarIgual((await buscarTipo(repositorio, "Paint")).getColor(), PaletaColores.colorPara(3), "Paint, el 4.º");
});

prueba("RepositorioVecindario: mismo color para el mismo tipo en dos vecindarios distintos", async function () {
  const primero = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const segundo = new RepositorioVecindario({
    idCentral: "X", umbral: 0.5, recortado: false,
    entidades: [
      { id: "X", etiquetas: ["Person"], propiedades: { name: "Xavi" } },
      { id: "Y", etiquetas: ["Person"], propiedades: { name: "Yago" } }
    ],
    relaciones: [
      { id: "s|X|Y", idIntermedio: "s", origen: "X", destino: "Y", tipo: "STUDENT_OF", padres: [], valor: 0.5,
        roles: {}, periodo: null, lugar: null, fecha: null },
      { id: "m9|X|Y", idIntermedio: "m9", origen: "X", destino: "Y", tipo: "Mentorship", padres: ["Relationship"],
        valor: 0.85, roles: {}, periodo: null, lugar: null, fecha: null }
    ]
  }, crearContexto());
  const tipos = ["Mentorship", "Paint", "Exposition", "STUDENT_OF"];
  for (let i = 0; i < tipos.length; i++) {
    comprobarIgual((await buscarTipo(segundo, tipos[i])).getColor(), (await buscarTipo(primero, tipos[i])).getColor(),
      "color de " + tipos[i]);
  }
});

prueba("RepositorioVecindario: un tipo nuevo (sin nombre en la configuración) tiene nombre automático", async function () {
  const datos = crearVecindarioDePrueba();
  datos.relaciones.push({ id: "c1|A|D", idIntermedio: "c1", origen: "A", destino: "D", tipo: "Apprenticeship",
    padres: ["Professional", "Relationship"], valor: 0.55, roles: {}, periodo: null, lugar: null, fecha: null });
  const repositorio = new RepositorioVecindario(datos, crearContexto());
  const tipo = await buscarTipo(repositorio, "Apprenticeship");
  comprobarIgual(tipo.getNombre(), "Apprenticeship", "nombre automático");
  comprobarIgual(tipo.getFamilia(), "Professional", "familia");
  comprobarIgual(tipo.getNombreFamilia(), "Professional", "nombre automático de la familia");
});

prueba("RepositorioVecindario: obtenerEntidad con un id inexistente devuelve null", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  comprobarIgual(await repositorio.obtenerEntidad("no_existe"), null, "entidad inexistente");
});

prueba("RepositorioVecindario: todos los métodos devuelven una Promise", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  const resultados = [repositorio.buscarEntidades("a", null, 10), repositorio.obtenerEntidad("A"),
    repositorio.obtenerRelaciones("A"), repositorio.obtenerTiposRelacion()];
  for (let i = 0; i < resultados.length; i++) {
    comprobar(resultados[i] instanceof Promise, "el método " + i + " debe devolver una Promise");
    await resultados[i];
  }
});

prueba("RepositorioVecindario: buscarEntidades filtra por subcadena, tipo y límite", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto());
  comprobarIgual((await repositorio.buscarEntidades("U", null, null)).length, 2, "nombres con 'u' (Bruno, Cuadro azul)");
  comprobarIgual((await repositorio.buscarEntidades("", TipoEntidad.PERSONA, null)).length, 2, "número de personas");
  comprobarIgual((await repositorio.buscarEntidades("", null, 1)).length, 1, "con límite 1");
});

prueba("RepositorioVecindario: una relación con una entidad que no está da error", function () {
  const datos = crearVecindarioDePrueba();
  datos.relaciones.push({ id: "z|A|Z", idIntermedio: "z", origen: "A", destino: "Z", tipo: "Paint", padres: [],
    valor: 0.5, roles: {}, periodo: null, lugar: null, fecha: null });
  let huboError = false;
  try {
    new RepositorioVecindario(datos, crearContexto());
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "debería lanzar un error");
});

prueba("RepositorioVecindario: la interfaz RepositorioDatos no está implementada", async function () {
  const interfaz = new RepositorioDatos();
  let huboError = false;
  try {
    await interfaz.obtenerEntidad("A");
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "obtenerEntidad de la interfaz debería fallar");
  comprobar(new RepositorioVecindario(crearVecindarioDePrueba(), crearContexto()) instanceof RepositorioDatos,
    "implementa RepositorioDatos");
});

prueba("RepositorioVecindario: el vecindario que envía el servidor se carga sin errores", async function () {
  const repositorio = new RepositorioVecindario(VECINDARIO_EJEMPLO, CONTEXTO_PRUEBAS);
  const todas = await repositorio.buscarEntidades("", null, null);
  comprobarIgual(todas.length, VECINDARIO_EJEMPLO.entidades.length, "número de entidades");
  const nombres = [];
  const tipos = await repositorio.obtenerTiposRelacion();
  for (let i = 0; i < tipos.length; i++) {
    nombres.push(tipos[i].getNombre());
  }
  comprobar(nombres.includes("Matrimonio"), "Matrimonio");
  comprobar(nombres.includes("Apprenticeship"), "Apprenticeship (tipo de prueba, nombre automático)");
  comprobar(nombres.includes("Student of"), "Student of (relación directa de prueba)");
});
