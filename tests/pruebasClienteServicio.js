import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { ClienteServicio } from '../src/datos/ClienteServicio.js';

/*
 * Pruebas de ClienteServicio (src/datos/).
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
  window.fetch = async function (url, opciones) {
    urlsPedidas.push(url);
    if (opciones !== undefined) {
      urlsPedidas.opciones = opciones;
      if (urlsPedidas.cuerpos === undefined) {
        urlsPedidas.cuerpos = [];
      }
      urlsPedidas.cuerpos.push(JSON.parse(opciones.body));
    }
    let texto = cuerpo;
    if (typeof cuerpo === "function") {
      texto = cuerpo(opciones);
    }
    return new Response(texto, { status: codigo, headers: { "Content-Type": "application/json" } });
  };
  try {
    await pruebaConFetch(urlsPedidas);
  } finally {
    window.fetch = fetchDeVerdad;
  }
}

/**
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

prueba("ClienteServicio: obtenerRelaciones hace un POST con los ids en JSON", async function () {
  const respuesta = "{\"ids\":[\"p 01/x\"],\"entidades\":[{\"id\":\"p 01/x\"}],\"relaciones\":[]}";
  await conFetchFalso(200, respuesta, async function (urlsPedidas) {
    const cliente = new ClienteServicio("/api");
    const datos = await cliente.obtenerRelaciones(["p 01/x"]);
    comprobarIgual(urlsPedidas[0], "/api/relaciones", "URL");
    comprobarIgual(urlsPedidas.opciones.method, "POST", "método");
    comprobarIgual(urlsPedidas.cuerpos[0].ids[0], "p 01/x", "el id va en el cuerpo, sin cambiar");
    comprobarIgual(datos.entidades[0].id, "p 01/x", "devuelve el JSON");
  });
});

prueba("ClienteServicio: obtenerRelaciones parte las listas en trozos de 200 y junta las respuestas", async function () {
  const ids = [];
  for (let i = 0; i < 450; i++) {
    ids.push("n" + i);
  }
  // Cada respuesta trae sus ids, la entidad compartida «comun» y una relación por trozo.
  function responder(opciones) {
    const cuerpo = JSON.parse(opciones.body);
    return JSON.stringify({ ids: cuerpo.ids, entidades: [{ id: "comun" }, { id: cuerpo.ids[0] }],
      relaciones: [{ id: "r" + cuerpo.ids[0] }] });
  }
  await conFetchFalso(200, responder, async function (urlsPedidas) {
    const datos = await new ClienteServicio("/api").obtenerRelaciones(ids);
    comprobarIgual(urlsPedidas.length, 3, "3 peticiones");
    comprobarIgual(urlsPedidas.cuerpos[0].ids.length + "," + urlsPedidas.cuerpos[1].ids.length + "," +
      urlsPedidas.cuerpos[2].ids.length, "200,200,50", "trozos de 200 como mucho");
    comprobarIgual(datos.ids.length, 450, "todos los ids");
    comprobarIgual(datos.entidades.length, 4, "la entidad compartida, una sola vez");
    comprobarIgual(datos.relaciones.length, 3, "una relación por trozo");
  });
});

prueba("ClienteServicio: obtenerJerarquia pide su ruta", async function () {
  await conFetchFalso(200, "{\"Painter\":[\"Creator\",\"Person\"]}", async function (urlsPedidas) {
    const jerarquia = await new ClienteServicio("/api").obtenerJerarquia();
    comprobarIgual(urlsPedidas[0], "/api/jerarquia", "URL");
    comprobarIgual(jerarquia.Painter[0], "Creator", "devuelve el JSON tal cual");
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
      return cliente.obtenerRelaciones(["P99"]);
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

prueba("ClienteServicio: ya no tiene los métodos de los incrementos anteriores", function () {
  const cliente = new ClienteServicio("/api");
  comprobar(typeof cliente.obtenerVecindario === "undefined", "obtenerVecindario");
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
