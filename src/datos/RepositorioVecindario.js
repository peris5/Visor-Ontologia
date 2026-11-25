import { RepositorioDatos } from './RepositorioDatos.js';
import { FabricaEntidades } from './FabricaEntidades.js';
import { TipoRelacion } from '../modelo/TipoRelacion.js';
import { Relacion } from '../modelo/Relacion.js';
import { Periodo } from '../modelo/Periodo.js';
import { PaletaColores } from '../logica/PaletaColores.js';

/**
 * La CACHÉ en memoria de las relaciones que ha enviado el servidor
 * (POST /api/relaciones). Va acumulando lo que llega en cada tanda, y
 * recuerda de qué entidades tiene YA TODAS las relaciones (las que se
 * pidieron): de las demás solo tiene las que comparten con alguna pedida.
 *
 * ConstructorSubgrafo y las estrategias de relevancia le piden entidades y
 * relaciones, pero ninguna de esas peticiones sale a la red: todo está aquí.
 * Así, volver a una entidad ya visitada o mover el umbral no cuesta ninguna
 * petición.
 *
 * Cada respuesta tiene la forma de Neo4j:
 *   {
 *     ids:        [ ids de las entidades pedidas ],
 *     entidades:  [ { id, etiquetas, propiedades } ],              (en bruto)
 *     relaciones: [ { id, idIntermedio, origen, destino, tipo, padres, roles,
 *                     nombre, periodo, lugar, fecha, participantes, participantesPorClase,
 *                     via, dibujable, idsIntermediarios (solo en los eventos juntados) } ]
 *   }
 * (sin relevancias: las calcula el navegador) y para interpretarla hace
 * falta el CONTEXTO, que se recibe al arrancar:
 *   { idioma, nombresTipos, etiquetasEntidad }   (de /api/configuracion)
 *   { tipos: [ { id, padres } ] }               (de /api/tipos)
 */
export class RepositorioVecindario extends RepositorioDatos {
  // Tipo de las aristas sintéticas que añade ConstructorSubgrafo.
  static TIPO_COINCIDENCIAS = "COINCIDENCIAS";

  #entidades;
  #tipos;
  #padresPorTipo;
  #relaciones;
  #relacionesPorEntidad;
  #completas;
  #contexto;
  #version;

  /**
   * @param {Object|null} datosIniciales - una respuesta de /api/relaciones
   *   para empezar, o null para empezar vacío.
   * @param {Object} contexto - { idioma, nombresTipos, etiquetasEntidad, tipos }.
   */
  constructor(datosIniciales, contexto) {
    super();
    if (contexto === undefined || contexto === null || contexto.etiquetasEntidad === undefined) {
      throw new Error("El repositorio necesita el contexto (idioma, nombresTipos, etiquetasEntidad y tipos).");
    }
    this.#contexto = contexto;
    this.#version = 0;
    this.#entidades = new Map();
    this.#relaciones = new Map();
    this.#relacionesPorEntidad = new Map();
    this.#completas = new Set();
    this.#tipos = new Map();
    this.#padresPorTipo = new Map();
    this.#prepararTipos();
    if (datosIniciales !== undefined && datosIniciales !== null) {
      this.incorporar(datosIniciales);
    }
  }

  /**
   * Añade una respuesta de /api/relaciones. Lo que ya estaba no se repite.
   * Las entidades pedidas (ids) quedan marcadas como completas.
   *
   * @param {Object} datos - { ids, entidades, relaciones }
   */
  incorporar(datos) {
    if (datos === undefined || datos === null || !Array.isArray(datos.entidades) ||
      !Array.isArray(datos.relaciones)) {
      throw new Error("Las relaciones recibidas deben tener una lista 'entidades' y una lista 'relaciones'.");
    }
    this.#cargarEntidades(datos.entidades);
    this.#anadirTiposNuevos(datos.relaciones);
    for (let i = 0; i < datos.relaciones.length; i++) {
      if (!this.#relaciones.has(datos.relaciones[i].id)) {
        this.anadirRelacion(this.#crearRelacion(datos.relaciones[i]));
      }
    }
    if (Array.isArray(datos.ids)) {
      for (let i = 0; i < datos.ids.length; i++) {
        this.#completas.add(datos.ids[i]);
      }
    }
  }

  /**
   * Añade una relación ya creada (si no estaba). La usan incorporar y la
   * prueba de monotonía del laboratorio, que después la quita.
   *
   * @param {Relacion} relacion
   */
  anadirRelacion(relacion) {
    if (this.#relaciones.has(relacion.getId())) {
      return;
    }
    this.#version = this.#version + 1;
    this.#relaciones.set(relacion.getId(), relacion);
    this.#apuntarEnElIndice(relacion.getOrigen().getId(), relacion);
    if (relacion.getDestino().getId() !== relacion.getOrigen().getId()) {
      this.#apuntarEnElIndice(relacion.getDestino().getId(), relacion);
    }
  }

  /**
   * Quita una relación de la caché (solo la usa el laboratorio).
   */
  quitarRelacion(idRelacion) {
    if (!this.#relaciones.has(idRelacion)) {
      return;
    }
    this.#version = this.#version + 1;
    const relacion = this.#relaciones.get(idRelacion);
    this.#relaciones.delete(idRelacion);
    this.#quitarDelIndice(relacion.getOrigen().getId(), relacion);
    this.#quitarDelIndice(relacion.getDestino().getId(), relacion);
  }

  /**
   * Cambia cada vez que se añade o se quita una relación. Quien guarda algo
   * calculado con las relaciones (PenalizacionGrado) sabe así cuándo
   * olvidarlo.
   *
   * @returns {number}
   */
  getVersion() {
    return this.#version;
  }

  /**
   * @returns {Relacion[]} todas las relaciones que hay en la caché (para el laboratorio).
   */
  todasLasRelaciones() {
    const lista = [];
    for (const relacion of this.#relaciones.values()) {
      lista.push(relacion);
    }
    return lista;
  }

  /**
   * @returns {boolean} true si ya se tienen TODAS las relaciones de la entidad.
   */
  tieneCompletas(idEntidad) {
    return this.#completas.has(idEntidad);
  }

  /**
   * @returns {Entidad|null} la entidad (sin esperar), o null si no está.
   */
  entidad(id) {
    if (this.#entidades.has(id)) {
      return this.#entidades.get(id);
    }
    return null;
  }

  /**
   * Las relaciones de la entidad que hay en la caché (todas, si
   * tieneCompletas), sin esperar.
   *
   * @returns {Relacion[]} copia.
   */
  relacionesDe(idEntidad) {
    const copia = [];
    if (this.#relacionesPorEntidad.has(idEntidad)) {
      const delIndice = this.#relacionesPorEntidad.get(idEntidad);
      for (let i = 0; i < delIndice.length; i++) {
        copia.push(delIndice[i]);
      }
    }
    return copia;
  }

  /**
   * @returns {TipoRelacion|null} el tipo con ese id (también COINCIDENCIAS).
   */
  getTipo(idTipo) {
    if (this.#tipos.has(idTipo)) {
      return this.#tipos.get(idTipo);
    }
    return null;
  }

  /**
   * Búsqueda simple: nombres que contienen el texto, sin distinguir
   * mayúsculas. (La búsqueda del buscador de la página, tolerante a
   * erratas, la hace Buscador sobre el índice de nombres.)
   *
   * @param {string} texto - "" devuelve todas.
   * @param {string|null} tipo - un valor de TipoEntidad, o null para todos.
   * @param {number|null} limite - máximo de resultados, o null para sin límite.
   */
  async buscarEntidades(texto, tipo, limite) {
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
      if (RepositorioVecindario.#cumpleLaBusqueda(entidad, textoEnMinusculas, tipo)) {
        resultados.push(entidad);
      }
    }
    return resultados;
  }

  /**
   * @returns {Promise<Entidad|null>} la entidad, o null si no está en la caché.
   */
  async obtenerEntidad(id) {
    return this.entidad(id);
  }

  /**
   * Relaciones donde la entidad es el origen O el destino.
   *
   * @returns {Promise<Relacion[]>} lista vacía si la entidad no está.
   */
  async obtenerRelaciones(idEntidad) {
    return this.relacionesDe(idEntidad);
  }

  /**
   * @returns {Promise<TipoRelacion[]>} todos los tipos, ordenados por id.
   */
  async obtenerTiposRelacion() {
    const ids = [];
    for (const id of this.#tipos.keys()) {
      ids.push(id);
    }
    ids.sort();
    const lista = [];
    for (let i = 0; i < ids.length; i++) {
      lista.push(this.#tipos.get(ids[i]));
    }
    return lista;
  }

  /** Añade la relación a la lista de esa entidad en el índice. */
  #apuntarEnElIndice(idEntidad, relacion) {
    if (!this.#relacionesPorEntidad.has(idEntidad)) {
      this.#relacionesPorEntidad.set(idEntidad, []);
    }
    this.#relacionesPorEntidad.get(idEntidad).push(relacion);
  }

  #quitarDelIndice(idEntidad, relacion) {
    const lista = this.#relacionesPorEntidad.get(idEntidad);
    const posicion = lista.indexOf(relacion);
    if (posicion >= 0) {
      lista.splice(posicion, 1);
    }
  }

  /** ¿La entidad cumple el tipo y contiene el texto en su nombre? */
  static #cumpleLaBusqueda(entidad, textoEnMinusculas, tipo) {
    if (tipo !== null && tipo !== undefined && entidad.getTipo() !== tipo) {
      return false;
    }
    return entidad.getNombre().toLowerCase().includes(textoEnMinusculas);
  }

  /**
   * Crea las entidades nuevas a partir de sus etiquetas y propiedades
   * (FabricaEntidades.crearDesdeNeo4j). Las que ya estaban se conservan (así
   * cada entidad es siempre el mismo objeto).
   */
  #cargarEntidades(listaDeDatos) {
    for (let i = 0; i < listaDeDatos.length; i++) {
      const datos = listaDeDatos[i];
      if (!this.#entidades.has(datos.id)) {
        const entidad = FabricaEntidades.crearDesdeNeo4j(datos.etiquetas, datos.propiedades, datos.id,
          this.#contexto.idioma, this.#contexto.etiquetasEntidad);
        this.#entidades.set(entidad.getId(), entidad);
      }
    }
  }

  /**
   * Crea UN TipoRelacion por id, con su nombre, sus padres y su color, para
   * todos los tipos de /api/tipos y el de las aristas sintéticas
   * (COINCIDENCIAS).
   *
   * ¿Por qué los colores se reparten sobre TODOS los tipos y ordenados
   * alfabéticamente? PaletaColores.asignar da el color 0 al primer id, el 1
   * al segundo... Si se usaran solo los tipos de una entidad, o en el orden
   * en que aparecen, un mismo tipo saldría de colores distintos según la
   * entidad. Con la lista completa y ordenada, un tipo tiene siempre el
   * mismo color.
   */
  #prepararTipos() {
    if (Array.isArray(this.#contexto.tipos)) {
      for (let i = 0; i < this.#contexto.tipos.length; i++) {
        this.#padresPorTipo.set(this.#contexto.tipos[i].id, this.#contexto.tipos[i].padres);
      }
    }
    this.#padresPorTipo.set(RepositorioVecindario.TIPO_COINCIDENCIAS, []);
    this.#crearTiposQueFaltan();
  }

  /**
   * Si llega un tipo que no estaba en /api/tipos (por ejemplo, porque
   * apareció después), se añade. Los tipos que ya existían no cambian de
   * color ni de objeto.
   */
  #anadirTiposNuevos(listaDeRelaciones) {
    let hayNuevos = false;
    for (let i = 0; i < listaDeRelaciones.length; i++) {
      const relacion = listaDeRelaciones[i];
      if (!this.#padresPorTipo.has(relacion.tipo)) {
        this.#padresPorTipo.set(relacion.tipo, relacion.padres);
        hayNuevos = true;
      }
    }
    if (hayNuevos) {
      this.#crearTiposQueFaltan();
    }
  }

  /** Crea los TipoRelacion que aún no existen (colores sobre la lista completa y ordenada). */
  #crearTiposQueFaltan() {
    const ids = [];
    for (const id of this.#padresPorTipo.keys()) {
      ids.push(id);
    }
    // sort() sin función ordena los textos por sus caracteres, de la "A" a la "z".
    ids.sort();
    const colores = PaletaColores.asignar(ids);
    const nombresTipos = this.#contexto.nombresTipos;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!this.#tipos.has(id)) {
        const nombre = TipoRelacion.nombrar(id, nombresTipos);
        const padres = this.#padresPorTipo.get(id);
        const sinNombreDeFamilia = new TipoRelacion(id, nombre, "", padres);
        const nombreFamilia = TipoRelacion.nombrar(sinNombreDeFamilia.getFamilia(), nombresTipos);
        this.#tipos.set(id, new TipoRelacion(id, nombre, colores.get(id), padres, nombreFamilia));
      }
    }
  }

  /**
   * Crea una Relacion comprobando que sus entidades existen. Su valor de
   * partida es 0: la relevancia la calcula RelevanciaCompuesta.
   */
  #crearRelacion(datos) {
    if (!this.#entidades.has(datos.origen)) {
      throw new Error("La relación " + datos.id + " usa una entidad que no existe: " + datos.origen + ".");
    }
    if (!this.#entidades.has(datos.destino)) {
      throw new Error("La relación " + datos.id + " usa una entidad que no existe: " + datos.destino + ".");
    }
    return new Relacion(datos.id, this.#entidades.get(datos.origen), this.#entidades.get(datos.destino),
      this.#tipos.get(datos.tipo), 0, {
        idIntermedio: datos.idIntermedio,
        roles: datos.roles,
        nombre: datos.nombre,
        periodo: Periodo.desdePropiedades(datos.periodo),
        lugar: datos.lugar,
        fecha: datos.fecha,
        participantes: datos.participantes,
        participantesPorClase: datos.participantesPorClase,
        via: datos.via,
        idsIntermediarios: datos.idsIntermediarios,
        dibujable: datos.dibujable
      });
  }
}
