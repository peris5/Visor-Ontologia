/**
 * ClienteServicio
 *
 * Lo único del navegador que sabe que existe un servidor. Desde el
 * incremento 3 SOLO pide datos a la API de Python y devuelve el JSON tal
 * cual: no construye nada. Quien convierte el JSON en objetos del modelo es
 * RepositorioVecindario, y quien construye el subgrafo es ConstructorSubgrafo.
 *
 * Solo hay tres peticiones:
 *  - la configuración y el índice de nombres, UNA vez al abrir la página;
 *  - un vecindario cada vez que cambia la entidad central (o baja el umbral).
 *
 * Requisitos: RNF-17 (el acceso a los datos está separado del resto),
 * RNF-13 (los parámetros van codificados en la URL).
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
   * @returns {Promise<Object>} { umbralPorDefecto, maxNodos, entidadInicial }
   */
  async obtenerConfiguracion() {
    return await this.#pedir("/configuracion");
  }

  /**
   * El índice para el buscador: todas las entidades, solo con id, nombre y tipo.
   *
   * @returns {Promise<Object[]>} [{ id, nombre, tipo }]
   */
  async obtenerNombres() {
    return await this.#pedir("/nombres");
  }

  /**
   * Los datos en bruto alrededor de una entidad (ver RepositorioVecindario).
   *
   * @param {string} idEntidad - id de la entidad central.
   * @param {number} umbral - entre 0 y 1.
   * @returns {Promise<Object>} { idCentral, umbral, recortado, entidades, relaciones, tiposRelacion }
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
