import { Entidad } from '../modelo/Entidad.js';
import { Periodo } from '../modelo/Periodo.js';
import { Evento } from '../modelo/Evento.js';
import { Imagen } from '../modelo/Imagen.js';
import { FuenteExterna } from '../modelo/FuenteExterna.js';
import { DetalleEntidad } from '../modelo/DetalleEntidad.js';
import { FabricaEntidades } from './FabricaEntidades.js';

/**
 * ClienteServicio
 *
 * Lo único del navegador que sabe que existe un servidor. Pide los datos a
 * la API de Python. Los vecindarios los devuelve tal cual (los convierte
 * RepositorioVecindario); el detalle de una entidad, ya convertido en un
 * DetalleEntidad.
 *
 * Peticiones:
 *  - la configuración, los tipos y el índice de nombres, UNA vez al abrir la página;
 *  - un vecindario cada vez que cambia la entidad central (o baja el umbral);
 *  - el detalle de una entidad al seleccionarla.
 *
 * Requisitos: RNF-17 (el acceso a los datos está separado del resto),
 * RNF-13 (los parámetros van codificados en la URL), RF-39 (tipos).
 */
export class ClienteServicio {
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
   * Los tipos de relación que hay en los datos, con sus padres (RF-39).
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
   * Los datos en bruto alrededor de una entidad (ver RepositorioVecindario).
   *
   * @param {string} idEntidad - id de la entidad central.
   * @param {number} umbral - entre 0 y 1.
   * @returns {Promise<Object>} { idCentral, umbral, recortado, entidades, relaciones,
   *   relevanciasAsignadas, relevanciasReutilizadas }
   */
  async obtenerVecindario(idEntidad, umbral) {
    // URLSearchParams escribe los parámetros con el formato correcto para
    // una URL. encodeURIComponent hace lo mismo con el id, que va dentro de
    // la ruta: así un id con caracteres raros ("/", "?", espacios...) no
    // puede cambiar la petición.
    const parametros = new URLSearchParams();
    parametros.set("umbral", String(umbral));
    const ruta = "/vecindario/" + encodeURIComponent(idEntidad) + "?" + parametros.toString();
    return await this.#pedir(ruta);
  }

  /**
   * El detalle de una entidad (eventos, imágenes, fuentes y ubicación).
   *
   * @param {string} idEntidad
   * @param {Object} contexto - { idioma, etiquetasEntidad } (para los nombres).
   * @returns {Promise<DetalleEntidad>}
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
   * @returns {DetalleEntidad}
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
   * Tamaño de la última respuesta recibida, para la barra de rendimiento
   * («Datos recibidos: X KB»), que se usará en las pruebas de rendimiento
   * del incremento 4.
   *
   * @returns {number} bytes.
   */
  getBytesUltimaRespuesta() {
    return this.#bytesUltimaRespuesta;
  }

  /**
   * (Privado) Hace una petición GET a la API y devuelve el JSON.
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
   * @returns {Promise<Object>}
   */
  async #pedir(ruta) {
    let respuesta = null;
    try {
      respuesta = await fetch(this.#urlBase + ruta);
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
