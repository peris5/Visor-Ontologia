/**
 * RepositorioSimulado implements RepositorioDatos
 *
 * Repositorio que lee datos de ejemplo guardados en memoria en lugar de la
 * base de datos real. Simula la espera de la red con un pequeño retardo,
 * para que la aplicación se comporte como lo hará con la BD real.
 *
 * Formato de los datos (ver src/datos/datosEjemplo.js):
 *   {
 *     entidades: [ { id, tipo, nombre, descripcion, ...campos propios } ],
 *     relaciones: [ [id, idOrigen, idDestino, idTipoRelacion, valor] ]
 *   }
 *
 * Requisitos: RNF-17; RF-20 y RF-39 (descubre los tipos y les da color).
 */
class RepositorioSimulado extends RepositorioDatos {
  #entidades;
  #tipos;
  #relaciones;
  #retardoMs;

  /**
   * @param {Object} datos - datos con el formato de arriba (p. ej. DATOS_EJEMPLO).
   * @param {number} retardoMs - milisegundos de espera simulada (0 en las pruebas).
   */
  constructor(datos, retardoMs) {
    super();
    if (datos === undefined || datos === null) {
      throw new Error("El repositorio simulado necesita unos datos.");
    }
    if (!Array.isArray(datos.entidades) || !Array.isArray(datos.relaciones)) {
      throw new Error("Los datos deben tener una lista 'entidades' y una lista 'relaciones'.");
    }

    this.#retardoMs = 0;
    if (typeof retardoMs === "number" && retardoMs > 0) {
      this.#retardoMs = retardoMs;
    }

    // El orden importa: las relaciones necesitan las entidades y los tipos.
    this.#entidades = this.#cargarEntidades(datos.entidades);
    this.#tipos = this.#descubrirTipos(datos.relaciones);
    this.#relaciones = this.#cargarRelaciones(datos.relaciones);
  }

  /**
   * Búsqueda simple: nombres que contienen el texto, sin distinguir
   * mayúsculas. (Actualizar en el incremento 3.)
   *
   * @param {string} texto - "" devuelve todas.
   * @param {string|null} tipo - un valor de TipoEntidad, o null para todos.
   * @param {number|null} limite - máximo de resultados, o null para sin límite.
   * @returns {Promise<Entidad[]>}
   */
  async buscarEntidades(texto, tipo, limite) {
    await this.#esperar();

    let textoEnMinusculas = "";
    if (typeof texto === "string") {
      textoEnMinusculas = texto.toLowerCase();
    }
    let hayLimite = false;
    if (typeof limite === "number" && limite > 0) {
      hayLimite = true;
    }

    const resultados = [];
    for (const entidad of this.#entidades.values()) {
      if (hayLimite && resultados.length >= limite) {
        break;
      }
      if (this.#cumpleLaBusqueda(entidad, textoEnMinusculas, tipo)) {
        resultados.push(entidad);
      }
    }
    return resultados;
  }

  /**
   * @param {string} id
   * @returns {Promise<Entidad|null>} la entidad, o null si no existe.
   */
  async obtenerEntidad(id) {
    await this.#esperar();
    if (this.#entidades.has(id)) {
      return this.#entidades.get(id);
    }
    return null;
  }

  /**
   * Relaciones donde la entidad es el origen O el destino
   * (el grafo se recorre en los dos sentidos).
   *
   * @param {string} idEntidad
   * @returns {Promise<Relacion[]>} lista vacía si la entidad no existe.
   */
  async obtenerRelaciones(idEntidad) {
    await this.#esperar();
    const relacionesDeLaEntidad = [];
    for (let i = 0; i < this.#relaciones.length; i++) {
      const relacion = this.#relaciones[i];
      const esElOrigen = relacion.getOrigen().getId() === idEntidad;
      const esElDestino = relacion.getDestino().getId() === idEntidad;
      if (esElOrigen || esElDestino) {
        relacionesDeLaEntidad.push(relacion);
      }
    }
    return relacionesDeLaEntidad;
  }

  /**
   * @returns {Promise<TipoRelacion[]>} tipos descubiertos, en orden de aparición.
   */
  async obtenerTiposRelacion() {
    await this.#esperar();
    const listaDeTipos = [];
    for (const tipo of this.#tipos.values()) {
      listaDeTipos.push(tipo);
    }
    return listaDeTipos;
  }

  /**
   * (Privado) Simula la latencia de la red esperando retardoMs milisegundos.
   *
   * @returns {Promise<void>}
   */
  #esperar() {
    const milisegundos = this.#retardoMs;
    return new Promise(function (resolver) {
      setTimeout(resolver, milisegundos);
    });
  }

  /**
   * (Privado) ¿La entidad cumple el tipo y contiene el texto en su nombre?
   *
   * @param {Entidad} entidad
   * @param {string} textoEnMinusculas
   * @param {string|null} tipo
   * @returns {boolean}
   */
  #cumpleLaBusqueda(entidad, textoEnMinusculas, tipo) {
    if (tipo !== null && tipo !== undefined && entidad.getTipo() !== tipo) {
      return false;
    }
    const nombreEnMinusculas = entidad.getNombre().toLowerCase();
    return nombreEnMinusculas.includes(textoEnMinusculas);
  }

  /**
   * (Privado) Crea las entidades con la fábrica y las guarda por id.
   *
   * @param {Object[]} listaDeDatos
   * @returns {Map<string, Entidad>}
   */
  #cargarEntidades(listaDeDatos) {
    const entidades = new Map();
    for (let i = 0; i < listaDeDatos.length; i++) {
      const datosDeLaEntidad = listaDeDatos[i];
      const entidad = FabricaEntidades.crearEntidad(datosDeLaEntidad.tipo, datosDeLaEntidad);
      if (entidades.has(entidad.getId())) {
        throw new Error("Hay dos entidades con el mismo id: " + entidad.getId() + ".");
      }
      entidades.set(entidad.getId(), entidad);
    }
    return entidades;
  }

  /**
   * (Privado) Descubre los tipos de relación mirando qué tipos aparecen en
   * las relaciones. El nombre sale del id y el color de la paleta.
   *
   * @param {Array[]} listaDeRelaciones - filas [id, origen, destino, tipo, valor].
   * @returns {Map<string, TipoRelacion>}
   */
  #descubrirTipos(listaDeRelaciones) {
    // Paso 1: lista de ids de tipo sin repetir, en orden de aparición.
    const idsDeTipos = [];
    for (let i = 0; i < listaDeRelaciones.length; i++) {
      const idTipo = listaDeRelaciones[i][3];
      if (!idsDeTipos.includes(idTipo)) {
        idsDeTipos.push(idTipo);
      }
    }

    // Paso 2: un color para cada uno y el objeto TipoRelacion.
    const coloresPorId = PaletaColores.asignar(idsDeTipos);
    const tipos = new Map();
    for (let i = 0; i < idsDeTipos.length; i++) {
      const idTipo = idsDeTipos[i];
      const nombre = TipoRelacion.nombreDesdeId(idTipo);
      const color = coloresPorId.get(idTipo);
      tipos.set(idTipo, new TipoRelacion(idTipo, nombre, color));
    }
    return tipos;
  }

  /**
   * (Privado) Convierte cada fila [id, origen, destino, tipo, valor] en una Relacion.
   *
   * @param {Array[]} listaDeRelaciones
   * @returns {Relacion[]}
   */
  #cargarRelaciones(listaDeRelaciones) {
    const relaciones = [];
    for (let i = 0; i < listaDeRelaciones.length; i++) {
      const fila = listaDeRelaciones[i];
      relaciones.push(this.#crearRelacionDesdeFila(fila));
    }
    return relaciones;
  }

  /**
   * (Privado) Crea una Relacion a partir de una fila, comprobando que sus
   * entidades existen.
   *
   * @param {Array} fila - [id, idOrigen, idDestino, idTipo, valor]
   * @returns {Relacion}
   */
  #crearRelacionDesdeFila(fila) {
    if (!Array.isArray(fila) || fila.length !== 5) {
      throw new Error("Cada relación debe ser una lista [id, origen, destino, tipo, valor].");
    }
    const idRelacion = fila[0];
    const idOrigen = fila[1];
    const idDestino = fila[2];
    const idTipo = fila[3];
    const valor = fila[4];

    if (!this.#entidades.has(idOrigen)) {
      throw new Error("La relación " + idRelacion + " usa una entidad que no existe: " + idOrigen + ".");
    }
    if (!this.#entidades.has(idDestino)) {
      throw new Error("La relación " + idRelacion + " usa una entidad que no existe: " + idDestino + ".");
    }
    const origen = this.#entidades.get(idOrigen);
    const destino = this.#entidades.get(idDestino);
    const tipo = this.#tipos.get(idTipo);
    return new Relacion(idRelacion, origen, destino, tipo, valor);
  }
}
