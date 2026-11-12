import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { ClienteServicio } from '../src/datos/ClienteServicio.js';

/*
 * Pruebas de ClienteServicio (src/datos/). Desde el incremento 3 solo pide
 * datos (convertirSubgrafo ya no existe: la conversión la hace
 * RepositorioVecindario, que tiene sus propias pruebas).
 *
 * Para no necesitar el servidor, cada prueba cambia un momento la función
 * fetch del navegador por un DOBLE DE PRUEBA que apunta la URL pedida y
 * contesta lo que la prueba quiere. Al terminar se deja la de verdad.
 */

/**
 * Ejecuta la prueba con un fetch falso.
 *
 * @param {number} codigo - código HTTP de la respuesta (200, 404...).
 * @param {string} cuerpo - texto de la respuesta.
 * @param {Function} pruebaConFetch - async function (urlsPedidas) { ... }
 */
async function conFetchFalso(codigo, cuerpo, pruebaConFetch) {
  const fetchDeVerdad = window.fetch;
  const urlsPedidas = [];
  window.fetch = async function (url) {
    urlsPedidas.push(url);
    return new Response(cuerpo, { status: codigo, headers: { "Content-Type": "application/json" } });
  };
  try {
    await pruebaConFetch(urlsPedidas);
  } finally {
    window.fetch = fetchDeVerdad;
  }
}

/**
 * @param {Function} funcionAsincrona
 * @returns {Promise<string>} el mensaje del error, o "" si no hubo error.
 */
async function mensajeDeError(funcionAsincrona) {
  try {
    await funcionAsincrona();
  } catch (error) {
    return error.message;
  }
  return "";
}

prueba("ClienteServicio: obtenerVecindario pide la ruta con el id codificado y el umbral", async function () {
  await conFetchFalso(200, "{\"idCentral\":\"p01\"}", async function (urlsPedidas) {
    const cliente = new ClienteServicio("/api");
    const datos = await cliente.obtenerVecindario("p 01/x", 0.35);
    comprobarIgual(urlsPedidas[0], "/api/vecindario/p%2001%2Fx?umbral=0.35", "URL");
    comprobarIgual(datos.idCentral, "p01", "devuelve el JSON tal cual");
  });
});

prueba("ClienteServicio: obtenerConfiguracion y obtenerNombres piden sus rutas", async function () {
  await conFetchFalso(200, "[]", async function (urlsPedidas) {
    const cliente = new ClienteServicio("/api");
    await cliente.obtenerConfiguracion();
    await cliente.obtenerNombres();
    comprobarIgual(urlsPedidas.join(","), "/api/configuracion,/api/nombres", "URL");
  });
});

prueba("ClienteServicio: un 404 con detail lanza ese mensaje", async function () {
  await conFetchFalso(404, "{\"detail\":\"No existe la entidad P99\"}", async function () {
    const cliente = new ClienteServicio("/api");
    const mensaje = await mensajeDeError(function () {
      return cliente.obtenerVecindario("P99", 0.3);
    });
    comprobarIgual(mensaje, "No existe la entidad P99", "mensaje");
  });
});

prueba("ClienteServicio: un 5xx sin JSON es «No se puede conectar con el servidor»", async function () {
  await conFetchFalso(502, "Bad gateway", async function () {
    const cliente = new ClienteServicio("/api");
    const mensaje = await mensajeDeError(function () {
      return cliente.obtenerNombres();
    });
    comprobarIgual(mensaje, "No se puede conectar con el servidor", "mensaje");
  });
});

prueba("ClienteServicio: si fetch falla (sin red) es «No se puede conectar con el servidor»", async function () {
  const fetchDeVerdad = window.fetch;
  window.fetch = async function () {
    throw new TypeError("Failed to fetch");
  };
  try {
    const mensaje = await mensajeDeError(function () {
      return new ClienteServicio("/api").obtenerConfiguracion();
    });
    comprobarIgual(mensaje, "No se puede conectar con el servidor", "mensaje");
  } finally {
    window.fetch = fetchDeVerdad;
  }
});

prueba("ClienteServicio: mide los bytes de la última respuesta", async function () {
  // "ñ" ocupa 2 bytes en UTF-8: {"a":"ñ"} son 10 bytes.
  await conFetchFalso(200, "{\"a\":\"ñ\"}", async function () {
    const cliente = new ClienteServicio("/api");
    await cliente.obtenerConfiguracion();
    comprobarIgual(cliente.getBytesUltimaRespuesta(), 10, "bytes");
  });
});

prueba("ClienteServicio: ya no tiene los métodos del incremento 2", function () {
  const cliente = new ClienteServicio("/api");
  comprobar(typeof cliente.obtenerSubgrafo === "undefined", "obtenerSubgrafo");
  comprobar(typeof cliente.buscarEntidades === "undefined", "buscarEntidades");
  comprobar(typeof ClienteServicio.convertirSubgrafo === "undefined", "convertirSubgrafo");
});

prueba("ClienteServicio: obtenerTipos pide su ruta", async function () {
  await conFetchFalso(200, "[{\"id\":\"Marriage\",\"padres\":[\"Related\"]}]", async function (urlsPedidas) {
    const tipos = await new ClienteServicio("/api").obtenerTipos();
    comprobarIgual(urlsPedidas[0], "/api/tipos", "URL");
    comprobarIgual(tipos[0].id, "Marriage", "devuelve el JSON tal cual");
  });
});

prueba("ClienteServicio: convertirDetalle crea eventos, imágenes, fuentes y ubicación", function () {
  const contexto = { idioma: "ca", etiquetasEntidad: { Person: "PERSONA", Organization: "ORGANIZACION" } };
  const detalle = ClienteServicio.convertirDetalle({
    id: "n1",
    eventos: [{
      id: "e1", tipo: "Birth", padres: ["Event"], sinRelacion: true, rol: null,
      propiedades: { name_es: "Nacimiento de Ana", name_ca: "Naixement d'Ana" },
      periodo: { from: "1861", to: "1861", description: "" },
      lugar: { name_es: "Játiva", name_ca: "Xàtiva" }, fecha: "1861",
      participantes: [{ id: "n9", etiquetas: ["Organization"], propiedades: { name_ca: "Museu" } }]
    }],
    imagenes: [{ id: "i1", propiedades: { url: "https://example.org/imagenes/i1.jpg", caption: "Ana" }, orden: 1 }],
    fuentes: [{ id: "f1", etiquetas: ["ExternalSource", "Book"], tipo: "Book",
      propiedades: { name: "Diccionario", url: "", lastUpdated: "1998-01-01" }, dateUpdated: null, externalId: "REF-1" }],
    ubicacion: [{ name_es: "Valencia", name_ca: "València" }, { name_es: "España", name_ca: "Espanya" }]
  }, contexto);
  const evento = detalle.getEventos()[0];
  comprobarIgual(evento.getTipo(), "Birth", "tipo del evento");
  comprobarIgual(evento.getNombre(), "Naixement d'Ana", "nombre en el idioma del contexto");
  comprobarIgual(evento.getLugar(), "Xàtiva", "lugar en el idioma del contexto");
  comprobarIgual(evento.getCuando(), "1861", "cuándo");
  comprobarIgual(evento.getParticipantes().join(","), "Museu", "participantes");
  comprobar(evento.esSinRelacion(), "nacimiento: sin relación");
  comprobarIgual(detalle.getImagenes()[0].getPie(), "Ana", "imagen");
  comprobarIgual(detalle.getFuentes()[0].getTipo(), "Book", "subtipo de la fuente");
  comprobarIgual(detalle.getFuentes()[0].getActualizada(), "1998-01-01", "sin dateUpdated, la de la fuente");
  comprobarIgual(detalle.getUbicacion().join(", "), "València, Espanya", "ubicación");
});
