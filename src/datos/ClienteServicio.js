import { FabricaEntidades } from './FabricaEntidades.js';
import { TipoRelacion } from '../modelo/TipoRelacion.js';
import { Relacion } from '../modelo/Relacion.js';
import { NodoRelevante } from '../modelo/NodoRelevante.js';
import { Subgrafo } from '../modelo/Subgrafo.js';

/**
 * ClienteServicio
 *
 * Lo único del navegador que sabe que existe un servidor. Pide los datos a
 * la API de Python y convierte el JSON que recibe en objetos del modelo
 * (Entidad, Relacion, Subgrafo...), que son los que usa el resto de la página.
 *
 * El subgrafo llega ya construido: el navegador hace UNA sola petición por
 * subgrafo, en lugar de una por cada nodo que se expande.
 *
 * Requisitos: RNF-17 (el acceso a los datos está separado del resto).
 */
export class ClienteServicio {
  #urlBase;

  /**
   * @param {string} urlBase - dirección de la API, normalmente "/api"
   *   (se lee de public/config.json).
   */
  constructor(urlBase) {
    if (typeof urlBase !== "string") {
      throw new Error("ClienteServicio necesita la dirección de la API (un texto).");
    }
    this.#urlBase = urlBase;
  }

  /**
   * @returns {Promise<Object>} { umbralPorDefecto, entidadInicial }
   */
  async obtenerConfiguracion() {
    return await this.#pedir("/configuracion");
  }

  /**
   * Busca entidades por nombre. Cada una se devuelve solo con id, nombre y tipo.
   *
   * @param {string} texto - "" para todas.
   * @param {string|null} tipo - un valor de TipoEntidad, o null para todos.
   * @param {number|null} limite - máximo de resultados, o null para el del servidor.
   * @returns {Promise<Entidad[]>}
   */
  async buscarEntidades(texto, tipo, limite) {
    const parametros = new URLSearchParams();
    if (typeof texto === "string" && texto !== "") {
      parametros.set("texto", texto);
    }
    if (typeof tipo === "string" && tipo !== "") {
      parametros.set("tipo", tipo);
    }
    if (typeof limite === "number") {
      parametros.set("limite", String(limite));
    }
    const lista = await this.#pedir("/entidades?" + parametros.toString());

    const entidades = [];
    for (let i = 0; i < lista.length; i++) {
      const datos = lista[i];
      entidades.push(FabricaEntidades.crearEntidad(datos.tipo, datos));
    }
    return entidades;
  }

  /**
   * Pide al servidor el subgrafo ya construido y lo convierte al modelo.
   *
   * @param {string} idEntidad - id de la entidad central.
   * @param {number} umbral - entre 0 y 1.
   * @returns {Promise<Subgrafo>}
   */
  async obtenerSubgrafo(idEntidad, umbral) {
    const ruta = "/subgrafo/" + encodeURIComponent(idEntidad) + "?umbral=" + String(umbral);
    const json = await this.#pedir(ruta);
    return ClienteServicio.convertirSubgrafo(json);
  }

  /**
   * Convierte el JSON de /api/subgrafo en objetos del modelo.
   * Es estático (no usa la red) para poder probarlo sin servidor.
   *
   *  - Las entidades se crean con FabricaEntidades (subclase según el tipo).
   *  - Se crea UN solo TipoRelacion por id, aunque lo usen muchas relaciones:
   *    así la leyenda puede contar las relaciones de cada tipo.
   *  - Los nodos guardan la relevancia, el nivel y la centralidad que
   *    calculó el servidor.
   *
   * @param {Object} json - con el formato de servidor/api/conversor_json.py.
   * @returns {Subgrafo}
   */
  static convertirSubgrafo(json) {
    const entidadesPorId = ClienteServicio.#crearEntidades(json.nodos);
    if (!entidadesPorId.has(json.idCentral)) {
      throw new Error("El subgrafo recibido no contiene su entidad central (" + json.idCentral + ").");
    }

    // El subgrafo crea él mismo el nodo central (relevancia 1, nivel 0).
    const subgrafo = new Subgrafo(entidadesPorId.get(json.idCentral), json.umbral);
    for (let i = 0; i < json.nodos.length; i++) {
      const datosDelNodo = json.nodos[i];
      const idEntidad = datosDelNodo.entidad.id;
      if (idEntidad !== json.idCentral) {
        const nodo = new NodoRelevante(entidadesPorId.get(idEntidad), datosDelNodo.relevancia, datosDelNodo.nivel);
        subgrafo.agregarNodo(nodo);
      }
      subgrafo.getNodo(idEntidad).setCentralidad(datosDelNodo.centralidad);
    }

    const tiposPorId = new Map();
    for (let i = 0; i < json.relaciones.length; i++) {
      const datosDeLaRelacion = json.relaciones[i];
      const tipo = ClienteServicio.#obtenerTipo(tiposPorId, datosDeLaRelacion.tipo);
      const origen = entidadesPorId.get(datosDeLaRelacion.origen);
      const destino = entidadesPorId.get(datosDeLaRelacion.destino);
      const relacion = new Relacion(datosDeLaRelacion.id, origen, destino, tipo, datosDeLaRelacion.relevancia);
      subgrafo.agregarRelacion(relacion);
    }
    return subgrafo;
  }

  /**
   * (Privado) Crea las entidades de los nodos y las guarda por id.
   *
   * @param {Object[]} listaDeNodos
   * @returns {Map<string, Entidad>}
   */
  static #crearEntidades(listaDeNodos) {
    const entidadesPorId = new Map();
    for (let i = 0; i < listaDeNodos.length; i++) {
      const datosDeLaEntidad = listaDeNodos[i].entidad;
      const entidad = FabricaEntidades.crearEntidad(datosDeLaEntidad.tipo, datosDeLaEntidad);
      entidadesPorId.set(entidad.getId(), entidad);
    }
    return entidadesPorId;
  }

  /**
   * (Privado) Devuelve el TipoRelacion de ese id; si aún no existe, lo crea.
   *
   * @param {Map<string, TipoRelacion>} tiposPorId
   * @param {Object} datosDelTipo - { id, nombre, color }
   * @returns {TipoRelacion}
   */
  static #obtenerTipo(tiposPorId, datosDelTipo) {
    if (!tiposPorId.has(datosDelTipo.id)) {
      tiposPorId.set(datosDelTipo.id, new TipoRelacion(datosDelTipo.id, datosDelTipo.nombre, datosDelTipo.color));
    }
    return tiposPorId.get(datosDelTipo.id);
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

    let datos = null;
    try {
      datos = await respuesta.json();
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
