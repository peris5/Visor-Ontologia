/**
 * Configuracion
 *
 * Lee los ajustes de la aplicación (el objeto CONFIGURACION de config.js)
 * y da un valor por defecto a los que falten o no sean válidos.
 * Así el resto del código no tiene que comprobar nada.
 *
 * Requisitos: RNF-16.
 */
class Configuracion {
  static ORIGEN_POR_DEFECTO = "simulado";
  static URL_POR_DEFECTO = "";
  static UMBRAL_POR_DEFECTO = 0.3;
  static MAX_NODOS_POR_DEFECTO = 150;
  static ENTIDAD_INICIAL_POR_DEFECTO = "";

  #datos;

  constructor() {
    // Mientras no se llame a cargar, todos los getters dan el valor por defecto.
    this.#datos = {};
  }

  /**
   * @param {Object} datos - normalmente la variable global CONFIGURACION.
   */
  cargar(datos) {
    if (datos === undefined || datos === null || typeof datos !== "object") {
      throw new Error("La configuración debe ser un objeto (revisa config.js).");
    }
    this.#datos = datos;
  }

  /**
   * @returns {string} "simulado" o el origen indicado.
   */
  getOrigenDatos() {
    return this.#leerTexto("origenDatos", Configuracion.ORIGEN_POR_DEFECTO);
  }

  /**
   * @returns {string} dirección del servicio de la BD real.
   */
  getUrlServicio() {
    return this.#leerTexto("urlServicio", Configuracion.URL_POR_DEFECTO);
  }

  /**
   * @returns {number} umbral entre 0 y 1 (0.3 si falta o no es válido).
   */
  getUmbralPorDefecto() {
    const umbral = this.#datos.umbralPorDefecto;
    if (typeof umbral !== "number" || Number.isNaN(umbral)) {
      return Configuracion.UMBRAL_POR_DEFECTO;
    }
    if (umbral < 0 || umbral > 1) {
      return Configuracion.UMBRAL_POR_DEFECTO;
    }
    return umbral;
  }

  /**
   * @returns {number} número entero mayor que 0 (150 si falta o no es válido).
   */
  getMaxNodos() {
    const maximo = this.#datos.maxNodos;
    if (!Number.isInteger(maximo) || maximo < 1) {
      return Configuracion.MAX_NODOS_POR_DEFECTO;
    }
    return maximo;
  }

  /**
   * @returns {string} id de la entidad que se muestra al empezar ("" si no hay).
   */
  getEntidadInicial() {
    return this.#leerTexto("entidadInicial", Configuracion.ENTIDAD_INICIAL_POR_DEFECTO);
  }

  /**
   * (Privado) Lee un campo de texto; si no es un texto, devuelve el valor por defecto.
   *
   * @param {string} nombreDelCampo
   * @param {string} valorPorDefecto
   * @returns {string}
   */
  #leerTexto(nombreDelCampo, valorPorDefecto) {
    const valor = this.#datos[nombreDelCampo];
    if (typeof valor !== "string") {
      return valorPorDefecto;
    }
    return valor;
  }
}
