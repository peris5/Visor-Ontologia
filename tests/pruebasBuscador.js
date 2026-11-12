import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { Buscador } from '../src/logica/Buscador.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';

/*
 * Pruebas de Buscador (src/logica/). El índice de nombres está escrito aquí,
 * con el mismo formato que envía GET /api/nombres.
 */

/**
 * @returns {Object[]} [{ id, nombre, tipo }]
 */
function crearNombresDePrueba() {
  return [
    { id: "p1", nombre: "Pablo Picasso", tipo: TipoEntidad.PERSONA },
    { id: "p2", nombre: "José de Ribera", tipo: TipoEntidad.PERSONA },
    { id: "p3", nombre: "Ana Muñoz", tipo: TipoEntidad.PERSONA },
    { id: "o1", nombre: "Museo del Prado", tipo: TipoEntidad.ORGANIZACION },
    { id: "o2", nombre: "Prado", tipo: TipoEntidad.ORGANIZACION },
    { id: "a1", nombre: "El jardín del Prado", tipo: TipoEntidad.OBRA_DE_ARTE },
    { id: "a2", nombre: "Prado al amanecer", tipo: TipoEntidad.OBRA_DE_ARTE },
    { id: "a3", nombre: "Guernica", tipo: TipoEntidad.OBRA_DE_ARTE }
  ];
}

/**
 * @param {Object[]} resultados
 * @returns {string[]} ids de los resultados, en orden.
 */
function ids(resultados) {
  const lista = [];
  for (let i = 0; i < resultados.length; i++) {
    lista.push(resultados[i].id);
  }
  return lista;
}

prueba("Buscador: no distingue mayúsculas ni tildes («jose» encuentra «José»)", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  comprobar(ids(buscador.buscar("jose", "")).includes("p2"), "jose");
  comprobar(ids(buscador.buscar("JOSÉ DE RIBERA", "")).includes("p2"), "en mayúsculas y con tilde");
  comprobar(ids(buscador.buscar("jardin", "")).includes("a1"), "jardin sin tilde");
});

prueba("Buscador: la ñ se puede escribir como n", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  comprobar(ids(buscador.buscar("munoz", "")).includes("p3"), "munoz encuentra Muñoz");
  comprobar(ids(buscador.buscar("muñoz", "")).includes("p3"), "muñoz también");
});

prueba("Buscador: una y dos letras cambiadas sí, tres no", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  comprobar(ids(buscador.buscar("guernika", "")).includes("a3"), "una letra cambiada (k por c)");
  comprobar(ids(buscador.buscar("gvernika", "")).includes("a3"), "dos letras cambiadas");
  comprobar(!ids(buscador.buscar("gvbrnika", "")).includes("a3"), "tres letras cambiadas: no");
});

prueba("Buscador: errata en una palabra del nombre («picaso» → «Pablo Picasso»)", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  comprobarIgual(ids(buscador.sugerir("picaso", ""))[0], "p1", "picaso");
  comprobarIgual(ids(buscador.sugerir("pablo picaso", ""))[0], "p1", "pablo picaso");
  // Mientras se escribe, con una errata al principio del nombre.
  comprobar(ids(buscador.sugerir("pavlo", "")).includes("p1"), "pavlo (comienzo del nombre)");
});

prueba("Buscador: filtra por tipo", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  const soloObras = buscador.buscar("prado", TipoEntidad.OBRA_DE_ARTE);
  // «Prado al amanecer» empieza por el texto, así que va antes que «El jardín del Prado».
  comprobarIgual(ids(soloObras).join(","), "a2,a1", "solo las obras con «prado»");
  const todos = buscador.buscar("prado", "");
  comprobarIgual(todos.length, 4, "sin filtro: Prado, Museo del Prado, El jardín del Prado y Prado al amanecer");
});

prueba("Buscador: con menos de 2 caracteres no busca", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  comprobarIgual(buscador.buscar("p", "").length, 0, "una letra");
  comprobarIgual(buscador.buscar("   p  ", "").length, 0, "una letra con espacios");
  comprobarIgual(buscador.sugerir("", "").length, 0, "texto vacío");
});

prueba("Buscador: primero la coincidencia exacta y después las que empiezan por el texto", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  const resultado = ids(buscador.buscar("prado", ""));
  comprobarIgual(resultado[0], "o2", "exacta: «Prado»");
  comprobarIgual(resultado[1], "a2", "empieza por el texto: «Prado al amanecer»");
  // Después, los que tienen una palabra que empieza por el texto, por orden alfabético.
  comprobarIgual(resultado[2], "a1", "«El jardín del Prado»");
  comprobarIgual(resultado[3], "o1", "«Museo del Prado»");
});

prueba("Buscador: las erratas van después de las coincidencias", function () {
  const nombres = [
    { id: "x1", nombre: "Casa", tipo: TipoEntidad.OBRA_DE_ARTE },
    { id: "x2", nombre: "Caza", tipo: TipoEntidad.OBRA_DE_ARTE }
  ];
  const resultado = ids(new Buscador(nombres).buscar("caza", ""));
  comprobarIgual(resultado.join(","), "x2,x1", "Caza (exacta) antes que Casa (errata)");
});

prueba("Buscador: respeta los máximos (8 sugerencias y 50 resultados)", function () {
  const nombres = [];
  for (let i = 1; i <= 60; i++) {
    let numero = String(i);
    if (i < 10) {
      numero = "0" + numero;
    }
    nombres.push({ id: "n" + numero, nombre: "Retrato " + numero, tipo: TipoEntidad.OBRA_DE_ARTE });
  }
  const buscador = new Buscador(nombres);
  comprobarIgual(buscador.sugerir("retrato", "").length, 8, "sugerencias");
  comprobarIgual(buscador.buscar("retrato", "").length, 50, "resultados");
  comprobarIgual(buscador.buscar("retrato", "")[0].id, "n01", "a igual puntuación, por orden alfabético");
});

prueba("Buscador: un texto de más de 100 caracteres se recorta y no da error", function () {
  const buscador = new Buscador(crearNombresDePrueba());
  let texto = "prado ";
  for (let i = 0; i < 50; i++) {
    texto = texto + "x";
  }
  const resultado = buscador.buscar(texto + texto, "");
  comprobar(Array.isArray(resultado), "devuelve una lista");
});

prueba("Buscador: los resultados solo tienen id, nombre y tipo", function () {
  const resultado = new Buscador(crearNombresDePrueba()).buscar("guernica", "");
  comprobarIgual(Object.keys(resultado[0]).join(","), "id,nombre,tipo", "campos");
  comprobarIgual(resultado[0].nombre, "Guernica", "el nombre original, con mayúsculas");
});

prueba("Buscador: distanciaEdicion", function () {
  const buscador = new Buscador([]);
  comprobarIgual(buscador.distanciaEdicion("casa", "caza"), 1, "casa / caza");
  comprobarIgual(buscador.distanciaEdicion("gato", "pato"), 1, "gato / pato");
  comprobarIgual(buscador.distanciaEdicion("", "abc"), 3, "texto vacío / abc");
  comprobarIgual(buscador.distanciaEdicion("kitten", "sitting"), 3, "kitten / sitting");
  comprobarIgual(buscador.distanciaEdicion("igual", "igual"), 0, "iguales");
});

prueba("Buscador: encuentra por el nombre en otro idioma y por el apellido", function () {
  const buscador = new Buscador([
    { id: "o1", nombre: "Museo del Mar", tipo: TipoEntidad.ORGANIZACION,
      nombresAlternativos: ["Museo del Mar", "Museu de la Mar", "Sea Museum"] },
    { id: "p1", nombre: "Elena Ferrando Peris", tipo: TipoEntidad.PERSONA,
      nombresAlternativos: ["Elena Ferrando Peris", "Elena", "Ferrando Peris"] }
  ]);
  comprobarIgual(ids(buscador.sugerir("museu de la mar", "")).join(","), "o1", "en valenciano");
  comprobarIgual(ids(buscador.sugerir("sea museum", "")).join(","), "o1", "en inglés");
  comprobarIgual(buscador.sugerir("sea museum", "")[0].nombre, "Museo del Mar", "se muestra el nombre del idioma configurado");
  comprobarIgual(ids(buscador.sugerir("peris", "")).join(","), "p1", "por el apellido");
  comprobarIgual(ids(buscador.sugerir("ferrando peris", "")).join(","), "p1", "por los apellidos completos");
});
