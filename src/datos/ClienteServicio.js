import { Entidad } from '../modelo/Entidad.js';
import { Periodo } from '../modelo/Periodo.js';
import { Evento } from '../modelo/Evento.js';
import { Imagen } from '../modelo/Imagen.js';
import { FuenteExterna } from '../modelo/FuenteExterna.js';
import { DetalleEntidad } from '../modelo/DetalleEntidad.js';
import { FabricaEntidades } from './FabricaEntidades.js';

/**
 * Lo único del navegador que sabe que existe un servidor. Pide los datos a
 * la API de Python. Las relaciones las devuelve tal cual (las convierte
 * RepositorioVecindario); el detalle de una entidad, ya convertido en un
 * DetalleEntidad.
 *
 * Peticiones:
 *  - la configuración, los tipos, la jerarquía y el índice de nombres, UNA
 *    vez al abrir la página;
 *  - las relaciones de unas entidades (POST /api/relaciones), en trozos de
 *    200 ids como mucho (ver GestorSubgrafos: como mucho 2 tandas por
 *    entidad nueva);
 *  - el detalle de una entidad al seleccionarla.
 */
export class ClienteServicio {
  // Máximo de ids por petición (el mismo límite que el servidor).
  static MAX_IDS_POR_PETICION = 200;

  #urlBase;
  #bytesUltimaRespuesta;

  /**
   * @param {string} urlBase - dirección de la API, normalmente "/api"
   *   (se lee de public/config.json).
   */
  constructor(urlBase) {
    if (typeof urlBase !== "string") {
      throw new Error("ClienteServicio necesita la dirección de la API (un texto).");
    }
    this.#urlBase = urlBase;
    this.#bytesUltimaRespuesta = 0;
  }

  /**
   * @returns {Promise<Object>} { umbralPorDefecto, maxNodos, entidadInicial,
   *   idioma, nombresTipos, etiquetasEntidad }
   */
  async obtenerConfiguracion() {
    return await this.#pedir("/configuracion");
  }

  /**
   * Los tipos de relación que hay en los datos, con sus padres.
   *
   * @returns {Promise<Object[]>} [{ id, padres }]
   */
  async obtenerTipos() {
    return await this.#pedir("/tipos");
  }

  /**
   * El índice para el buscador: todas las entidades, con sus etiquetas y
   * sus propiedades de nombre, en bruto.
   *
   * @returns {Promise<Object[]>} [{ id, etiquetas, propiedades }]
   */
  async obtenerNombres() {
    return await this.#pedir("/nombres");
  }

  /**
   * Cada etiqueta con sus padres (los IS_A), del más cercano al más lejano.
   *
   * @returns {Promise<Object>} { etiqueta: [padres] }
   */
  async obtenerJerarquia() {
    return await this.#pedir("/jerarquia");
  }

  /**
   * TODAS las relaciones de esas entidades (las que se dibujan y las que
   * solo son evidencia) y las entidades de sus extremos, en bruto (ver
   * RepositorioVecindario). Si hay más de 200 ids, se piden en trozos de
   * 200 y se juntan las respuestas en una sola.
   *
   * @param {string[]} ids - ids de las entidades.
   * @returns {Promise<Object>} { ids, entidades, relaciones }
   */
  async obtenerRelaciones(ids) {
    const juntas = { ids: [], entidades: [], relaciones: [] };
    const entidadesVistas = new Set();
    const relacionesVistas = new Set();
    let bytes = 0;
    for (let inicio = 0; inicio < ids.length; inicio = inicio + ClienteServicio.MAX_IDS_POR_PETICION) {
      const trozo = ids.slice(inicio, inicio + ClienteServicio.MAX_IDS_POR_PETICION);
      const respuesta = await this.#pedir("/relaciones", { ids: trozo });
      bytes = bytes + this.#bytesUltimaRespuesta;
      ClienteServicio.#anadirSinRepetir(juntas.ids, null, respuesta.ids);
      ClienteServicio.#anadirSinRepetir(juntas.entidades, entidadesVistas, respuesta.entidades);
      ClienteServicio.#anadirSinRepetir(juntas.relaciones, relacionesVistas, respuesta.relaciones);
    }
    this.#bytesUltimaRespuesta = bytes;
    return juntas;
  }

  /**
   * Añade los elementos a la lista sin repetir. Con vistos, se comparan por
   * su id (entidades y relaciones); sin él, por su valor (ids).
   */
  static #anadirSinRepetir(lista, vistos, elementos) {
    if (!Array.isArray(elementos)) {
      return;
    }
    for (let i = 0; i < elementos.length; i++) {
      const elemento = elementos[i];
      if (vistos === null) {
        if (!lista.includes(elemento)) {
          lista.push(elemento);
        }
      } else if (!vistos.has(elemento.id)) {
        vistos.add(elemento.id);
        lista.push(elemento);
      }
    }
  }

  /**
   * El detalle de una entidad (eventos, imágenes, fuentes y ubicación).
   *
   * @param {Object} contexto - { idioma, etiquetasEntidad } (para los nombres).
   */
  async obtenerDetalle(idEntidad, contexto) {
    const json = await this.#pedir("/detalle/" + encodeURIComponent(idEntidad));
    return ClienteServicio.convertirDetalle(json, contexto);
  }

  /**
   * Convierte el JSON de /api/detalle en un DetalleEntidad. Es estático (no
   * usa la red) para poder probarlo sin servidor. Los nombres de los lugares
   * y de los participantes se eligen en el idioma del contexto.
   *
   * @param {Object} json - { id, eventos, imagenes, fuentes, ubicacion }
   * @param {Object} contexto - { idioma, etiquetasEntidad }
   */
  static convertirDetalle(json, contexto) {
    const idioma = contexto.idioma;
    const eventos = [];
    for (let i = 0; i < json.eventos.length; i++) {
      const datos = json.eventos[i];
      const participantes = [];
      for (let j = 0; j < datos.participantes.length; j++) {
        const otra = datos.participantes[j];
        const entidad = FabricaEntidades.crearDesdeNeo4j(otra.etiquetas, otra.propiedades, otra.id, idioma,
          contexto.etiquetasEntidad);
        participantes.push(entidad.getNombre());
      }
      eventos.push(new Evento({
        id: datos.id,
        tipo: datos.tipo,
        padres: datos.padres,
        nombre: Entidad.nombreEnIdioma(datos.propiedades, idioma),
        rol: datos.rol,
        periodo: Periodo.desdePropiedades(datos.periodo),
        lugar: Entidad.nombreEnIdioma(datos.lugar, idioma),
        fecha: datos.fecha,
        participantes: participantes,
        sinRelacion: datos.sinRelacion
      }));
    }
    const imagenes = [];
    for (let i = 0; i < json.imagenes.length; i++) {
      const datos = json.imagenes[i];
      imagenes.push(new Imagen(datos.propiedades.url, datos.propiedades.caption, datos.orden));
    }
    const fuentes = [];
    for (let i = 0; i < json.fuentes.length; i++) {
      const datos = json.fuentes[i];
      let actualizada = datos.dateUpdated;
      if (typeof actualizada !== "string" || actualizada === "") {
        actualizada = datos.propiedades.lastUpdated;
      }
      fuentes.push(new FuenteExterna({
        nombre: datos.propiedades.name,
        tipo: datos.tipo,
        url: datos.propiedades.url,
        actualizada: actualizada,
        idExterno: datos.externalId
      }));
    }
    const ubicacion = [];
    for (let i = 0; i < json.ubicacion.length; i++) {
      ubicacion.push(Entidad.nombreEnIdioma(json.ubicacion[i], idioma));
    }
    return new DetalleEntidad(json.id, eventos, imagenes, fuentes, ubicacion);
  }

  /**
   * Tamaño de la última respuesta recibida (en obtenerRelaciones, la suma de
   * todos sus trozos), para la barra de rendimiento («Datos recibidos: X KB»).
   */
  getBytesUltimaRespuesta() {
    return this.#bytesUltimaRespuesta;
  }

  /**
   * Hace una petición a la API y devuelve el JSON: GET si no hay cuerpo;
   * POST con el cuerpo en JSON si lo hay.
   *
   * Errores:
   *  - Si el servidor no contesta, "No se puede conectar con el servidor".
   *  - Si contesta con un error y un "detail" (por ejemplo, 404 "No existe
   *    la entidad P99"), se lanza ese mensaje.
   *  - Durante el desarrollo, si el servidor Python está parado, el que
   *    contesta es el proxy de Vite, con un error 5xx y sin JSON. Ese caso
   *    también es "No se puede conectar con el servidor".
   *
   * @param {string} ruta - lo que va detrás de urlBase, p. ej. "/salud".
   * @param {Object} cuerpo - opcional: lo que se envía en un POST.
   */
  async #pedir(ruta, cuerpo) {
    let respuesta = null;
    try {
      if (cuerpo === undefined) {
        respuesta = await fetch(this.#urlBase + ruta);
      } else {
        respuesta = await fetch(this.#urlBase + ruta, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo)
        });
      }
    } catch (error) {
      throw new Error("No se puede conectar con el servidor");
    }

    // Primero se lee el texto (para medir cuánto ocupa) y después se
    // convierte a objetos con JSON.parse. TextEncoder cuenta los bytes de
    // verdad: una letra con tilde ocupa 2 bytes en UTF-8.
    let datos = null;
    try {
      const texto = await respuesta.text();
      this.#bytesUltimaRespuesta = new TextEncoder().encode(texto).length;
      datos = JSON.parse(texto);
    } catch (error) {
      datos = null;
    }

    if (respuesta.ok && datos !== null) {
      return datos;
    }
    if (datos !== null && typeof datos.detail === "string") {
      throw new Error(datos.detail);
    }
    if (respuesta.status >= 500) {
      throw new Error("No se puede conectar con el servidor");
    }
    throw new Error("La petición no es válida (código " + respuesta.status + ")");
  }
}
