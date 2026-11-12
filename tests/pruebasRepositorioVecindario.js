import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { RepositorioDatos } from '../src/datos/RepositorioDatos.js';
import { PaletaColores } from '../src/logica/PaletaColores.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { DATOS_EJEMPLO, vecindarioDesdeDatos } from './utilidadesPruebas.js';

/*
 * Pruebas de RepositorioVecindario (src/datos/). Incluyen las de
 * RepositorioSimulado del incremento 1 (es casi la misma clase), adaptadas
 * al formato del JSON de /api/vecindario.
 */

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
    entidades: [
      { id: "A", tipo: "PERSONA", nombre: "Ana", descripcion: "Pintora", atributos: { nacionalidad: "Española" } },
      { id: "B", tipo: "PERSONA", nombre: "Bruno", descripcion: "", atributos: {} },
      { id: "C", tipo: "OBRA_DE_ARTE", nombre: "Cuadro azul", descripcion: "", atributos: { tecnica: "Óleo" } },
      { id: "D", tipo: "ORGANIZACION", nombre: "Academia", descripcion: "", atributos: {} }
    ],
    relaciones: [
      { id: "r1", origen: "A", destino: "B", tipo: "maestro_de", valor: 0.9 },
      { id: "r2", origen: "B", destino: "C", tipo: "autor_de", valor: 0.7 },
      { id: "r3", origen: "C", destino: "A", tipo: "autor_de", valor: 0.4 },
      { id: "r4", origen: "A", destino: "D", tipo: "miembro_de", valor: 0.5 }
    ],
    tiposRelacion: ["maestro_de", "autor_de", "miembro_de", "conserva"]
  };
}

/**
 * @param {Relacion[]} relaciones
 * @param {string} idRelacion
 * @returns {boolean}
 */
function contieneRelacionConId(relaciones, idRelacion) {
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].getId() === idRelacion) {
      return true;
    }
  }
  return false;
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

prueba("RepositorioVecindario: convierte el JSON en entidades del tipo correcto", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  const ana = await repositorio.obtenerEntidad("A");
  comprobar(ana instanceof Persona, "A debería ser una Persona");
  comprobar((await repositorio.obtenerEntidad("C")) instanceof ObraDeArte, "C debería ser una ObraDeArte");
  comprobar((await repositorio.obtenerEntidad("D")) instanceof Organizacion, "D debería ser una Organizacion");
  comprobarIgual(ana.getNombre(), "Ana", "nombre de A");
  comprobarIgual(ana.getDescripcion(), "Pintora", "descripción de A");
  comprobarIgual(ana.getAtributos().get("nacionalidad"), "Española", "atributo de A");
});

prueba("RepositorioVecindario: obtenerRelaciones devuelve las relaciones en los dos sentidos", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  const relaciones = await repositorio.obtenerRelaciones("A");
  comprobarIgual(relaciones.length, 3, "número de relaciones de A");
  comprobar(contieneRelacionConId(relaciones, "r1"), "debe incluir r1 (A es el origen)");
  comprobar(contieneRelacionConId(relaciones, "r3"), "debe incluir r3 (A es el destino)");
  comprobar(contieneRelacionConId(relaciones, "r4"), "debe incluir r4 (A es el origen)");
});

prueba("RepositorioVecindario: cambiar la lista devuelta no cambia el repositorio", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  const relaciones = await repositorio.obtenerRelaciones("A");
  relaciones.pop();
  comprobarIgual((await repositorio.obtenerRelaciones("A")).length, 3, "siguen siendo 3");
});

prueba("RepositorioVecindario: un solo TipoRelacion por id, con nombre y color", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  const deB = await repositorio.obtenerRelaciones("B");
  const deC = await repositorio.obtenerRelaciones("C");
  let r2 = null;
  let r3 = null;
  for (let i = 0; i < deC.length; i++) {
    if (deC[i].getId() === "r2") {
      r2 = deC[i];
    }
    if (deC[i].getId() === "r3") {
      r3 = deC[i];
    }
  }
  comprobar(r2.getTipo() === r3.getTipo(), "r2 y r3 (autor_de) deben compartir el mismo objeto TipoRelacion");
  comprobar(deB[0].getTipo() !== r2.getTipo(), "tipos distintos son objetos distintos");
  comprobarIgual(r2.getTipo().getNombre(), "Autor de", "nombre legible");
  comprobar(/^#[0-9a-f]{6}$/.test(r2.getTipo().getColor()), "color con formato #rrggbb: " + r2.getTipo().getColor());
});

prueba("RepositorioVecindario: los colores se reparten con los ids en orden alfabético", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  // Orden alfabético de tiposRelacion: autor_de, conserva, maestro_de, miembro_de.
  comprobarIgual((await buscarTipo(repositorio, "autor_de")).getColor(), PaletaColores.colorPara(0), "autor_de, el 1.º");
  comprobarIgual((await buscarTipo(repositorio, "maestro_de")).getColor(), PaletaColores.colorPara(2), "maestro_de, el 3.º");
  comprobarIgual((await buscarTipo(repositorio, "miembro_de")).getColor(), PaletaColores.colorPara(3), "miembro_de, el 4.º");
});

prueba("RepositorioVecindario: mismo color para el mismo tipo en dos vecindarios distintos", async function () {
  const primero = new RepositorioVecindario(crearVecindarioDePrueba());
  // Otro vecindario con otras entidades y relaciones, en otro orden, y en el
  // que maestro_de no es el primer tipo que aparece.
  const segundo = new RepositorioVecindario({
    idCentral: "X",
    umbral: 0.5,
    recortado: false,
    entidades: [
      { id: "X", tipo: "ORGANIZACION", nombre: "Museo", descripcion: "", atributos: {} },
      { id: "Y", tipo: "PERSONA", nombre: "Yago", descripcion: "", atributos: {} }
    ],
    relaciones: [
      { id: "r9", origen: "X", destino: "Y", tipo: "conserva", valor: 0.8 },
      { id: "r8", origen: "Y", destino: "X", tipo: "maestro_de", valor: 0.6 }
    ],
    tiposRelacion: ["conserva", "miembro_de", "autor_de", "maestro_de"]
  });
  const tipos = ["maestro_de", "autor_de", "conserva", "miembro_de"];
  for (let i = 0; i < tipos.length; i++) {
    const enElPrimero = await buscarTipo(primero, tipos[i]);
    const enElSegundo = await buscarTipo(segundo, tipos[i]);
    comprobarIgual(enElSegundo.getColor(), enElPrimero.getColor(), "color de " + tipos[i]);
  }
});

prueba("RepositorioVecindario: sin la lista tiposRelacion usa los tipos de sus relaciones", async function () {
  const datos = crearVecindarioDePrueba();
  delete datos.tiposRelacion;
  const repositorio = new RepositorioVecindario(datos);
  const tipos = await repositorio.obtenerTiposRelacion();
  comprobarIgual(tipos.length, 3, "autor_de, maestro_de y miembro_de");
  comprobarIgual(tipos[0].getId(), "autor_de", "ordenados por id");
});

prueba("RepositorioVecindario: obtenerEntidad con un id inexistente devuelve null", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  comprobarIgual(await repositorio.obtenerEntidad("no_existe"), null, "entidad inexistente");
});

prueba("RepositorioVecindario: todos los métodos devuelven una Promise", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  const resultadoBuscar = repositorio.buscarEntidades("a", null, 10);
  const resultadoObtener = repositorio.obtenerEntidad("A");
  const resultadoRelaciones = repositorio.obtenerRelaciones("A");
  const resultadoTipos = repositorio.obtenerTiposRelacion();
  comprobar(resultadoBuscar instanceof Promise, "buscarEntidades debe devolver una Promise");
  comprobar(resultadoObtener instanceof Promise, "obtenerEntidad debe devolver una Promise");
  comprobar(resultadoRelaciones instanceof Promise, "obtenerRelaciones debe devolver una Promise");
  comprobar(resultadoTipos instanceof Promise, "obtenerTiposRelacion debe devolver una Promise");
  await resultadoBuscar;
  await resultadoObtener;
  await resultadoRelaciones;
  await resultadoTipos;
});

prueba("RepositorioVecindario: buscarEntidades filtra por subcadena, tipo y límite", async function () {
  const repositorio = new RepositorioVecindario(crearVecindarioDePrueba());
  comprobarIgual((await repositorio.buscarEntidades("U", null, null)).length, 2, "nombres con 'u' (Bruno, Cuadro azul)");
  comprobarIgual((await repositorio.buscarEntidades("", TipoEntidad.PERSONA, null)).length, 2, "número de personas");
  comprobarIgual((await repositorio.buscarEntidades("", null, 1)).length, 1, "con límite 1");
});

prueba("RepositorioVecindario: una relación con una entidad que no está da error", function () {
  const datos = crearVecindarioDePrueba();
  datos.relaciones.push({ id: "r9", origen: "A", destino: "Z", tipo: "maestro_de", valor: 0.5 });
  let huboError = false;
  try {
    new RepositorioVecindario(datos);
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
  comprobar(new RepositorioVecindario(crearVecindarioDePrueba()) instanceof RepositorioDatos, "implementa RepositorioDatos");
});

prueba("RepositorioVecindario: los datos de ejemplo se cargan sin errores", async function () {
  const repositorio = new RepositorioVecindario(vecindarioDesdeDatos(DATOS_EJEMPLO, "p01", 0));
  const todas = await repositorio.buscarEntidades("", null, null);
  const tipos = await repositorio.obtenerTiposRelacion();
  comprobarIgual(todas.length, DATOS_EJEMPLO.entidades.length, "número de entidades");
  comprobar(tipos.length >= 5, "debe haber al menos 5 tipos de relación");
});
