import { RepositorioDatos } from './RepositorioDatos.js';
import { FabricaEntidades } from './FabricaEntidades.js';
import { TipoRelacion } from '../modelo/TipoRelacion.js';
import { Relacion } from '../modelo/Relacion.js';
import { Periodo } from '../modelo/Periodo.js';
import { PaletaColores } from '../logica/PaletaColores.js';

/**
 * RepositorioVecindario implements RepositorioDatos
 *
 * Repositorio EN MEMORIA con el vecindario que ha enviado el servidor
 * (GET /api/vecindario/{id}). ConstructorSubgrafo le pide entidades y
 * relaciones como antes, pero ninguna de esas peticiones sale a la red:
 * todos los datos ya están aquí. Así, construir un subgrafo cuesta UNA sola
 * petición al servidor en lugar de una por cada nodo que se expande.
 *
 * Desde el incremento 3b el vecindario tiene la forma de Neo4j:
 *   {
 *     idCentral, umbral, recortado, relevanciasAsignadas, relevanciasReutilizadas,
 *     entidades:  [ { id, etiquetas, propiedades } ],              (en bruto)
 *     relaciones: [ { id, idIntermedio, origen, destino, tipo, padres,
 *                     valor, roles, periodo, lugar, fecha } ]       (derivadas)
 *   }
 * y para interpretarlo hace falta el CONTEXTO, que se recibe al arrancar:
 *   { idioma, nombresTipos, etiquetasEntidad }   (de /api/configuracion)
 *   { tipos: [ { id, padres } ] }               (de /api/tipos)
 *
 * Requisitos: RNF-17 (acceso a datos separado); RF-20 y RF-39 (da nombre y
 * color a los tipos de relación, que no se conocen de antemano).
 */
export class RepositorioVecindario extends RepositorioDatos {
  #entidades;
  #tipos;
  #relaciones;
  #relacionesPorEntidad;
  #contexto;

  /**
   * @param {Object} datosVecindario - el JSON de /api/vecindario.
   * @param {Object} contexto - { idioma, nombresTipos, etiquetasEntidad, tipos }.
   */
  constructor(datosVecindario, contexto) {
    super();
    if (datosVecindario === undefined || datosVecindario === null) {
      throw new Error("El repositorio necesita los datos de un vecindario.");
    }
    if (!Array.isArray(datosVecindario.entidades) || !Array.isArray(datosVecindario.relaciones)) {
      throw new Error("El vecindario debe tener una lista 'entidades' y una lista 'relaciones'.");
    }
    if (contexto === undefined || contexto === null || contexto.etiquetasEntidad === undefined) {
      throw new Error("El repositorio necesita el contexto (idioma, nombresTipos, etiquetasEntidad y tipos).");
    }
    this.#contexto = contexto;

    // El orden importa: las relaciones necesitan las entidades y los tipos.
    this.#entidades = this.#cargarEntidades(datosVecindario.entidades);
    this.#tipos = this.#descubrirTipos(datosVecindario.relaciones);
    this.#relaciones = this.#cargarRelaciones(datosVecindario.relaciones);
    this.#relacionesPorEntidad = new Map();
    this.#indexar();
  }

  /**
   * Búsqueda simple: nombres que contienen el texto, sin distinguir
   * mayúsculas. (La búsqueda del buscador de la página, tolerante a
   * erratas, la hace Buscador sobre el índice de nombres.)
   *
   * @param {string} texto - "" devuelve todas.
   * @param {string|null} tipo - un valor de TipoEntidad, o null para todos.
   * @param {number|null} limite - máximo de resultados, o null para sin límite.
   * @returns {Promise<Entidad[]>}
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
      if (this.#cumpleLaBusqueda(entidad, textoEnMinusculas, tipo)) {
        resultados.push(entidad);
      }
    }
    return resultados;
  }

  /**
   * @param {string} id
   * @returns {Promise<Entidad|null>} la entidad, o null si no está en el vecindario.
   */
  async obtenerEntidad(id) {
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
   * @returns {Promise<Relacion[]>} lista vacía si la entidad no está.
   */
  async obtenerRelaciones(idEntidad) {
    // Se devuelve una copia para que quien la reciba no pueda cambiar el
    // índice sin querer.
    const relacionesDeLaEntidad = [];
    if (this.#relacionesPorEntidad.has(idEntidad)) {
      const delIndice = this.#relacionesPorEntidad.get(idEntidad);
      for (let i = 0; i < delIndice.length; i++) {
        relacionesDeLaEntidad.push(delIndice[i]);
      }
    }
    return relacionesDeLaEntidad;
  }

  /**
   * @returns {Promise<TipoRelacion[]>} todos los tipos, ordenados por id.
   */
  async obtenerTiposRelacion() {
    const listaDeTipos = [];
    for (const tipo of this.#tipos.values()) {
      listaDeTipos.push(tipo);
    }
    return listaDeTipos;
  }

  /**
   * (Privado) Prepara relacionesPorEntidad: para cada entidad, las
   * relaciones en las que participa (como origen o como destino), en el
   * orden en que llegaron. Se hace UNA vez; sin el índice, obtenerRelaciones
   * tendría que recorrer todas las relaciones cada vez que se expande un nodo.
   */
  #indexar() {
    for (let i = 0; i < this.#relaciones.length; i++) {
      const relacion = this.#relaciones[i];
      const idOrigen = relacion.getOrigen().getId();
      const idDestino = relacion.getDestino().getId();
      this.#apuntarEnElIndice(idOrigen, relacion);
      // Una relación de una entidad consigo misma solo se apunta una vez.
      if (idDestino !== idOrigen) {
        this.#apuntarEnElIndice(idDestino, relacion);
      }
    }
  }

  /**
   * (Privado) Añade la relación a la lista de esa entidad en el índice.
   *
   * @param {string} idEntidad
   * @param {Relacion} relacion
   */
  #apuntarEnElIndice(idEntidad, relacion) {
    if (!this.#relacionesPorEntidad.has(idEntidad)) {
      this.#relacionesPorEntidad.set(idEntidad, []);
    }
    this.#relacionesPorEntidad.get(idEntidad).push(relacion);
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
   * (Privado) Crea las entidades a partir de sus etiquetas y propiedades
   * (FabricaEntidades.crearDesdeNeo4j) y las guarda por id.
   *
   * @param {Object[]} listaDeDatos - [{ id, etiquetas, propiedades }]
   * @returns {Map<string, Entidad>}
   */
  #cargarEntidades(listaDeDatos) {
    const entidades = new Map();
    for (let i = 0; i < listaDeDatos.length; i++) {
      const datos = listaDeDatos[i];
      const entidad = FabricaEntidades.crearDesdeNeo4j(datos.etiquetas, datos.propiedades, datos.id,
        this.#contexto.idioma, this.#contexto.etiquetasEntidad);
      if (entidades.has(entidad.getId())) {
        throw new Error("Hay dos entidades con el mismo id: " + entidad.getId() + ".");
      }
      entidades.set(entidad.getId(), entidad);
    }
    return entidades;
  }

  /**
   * (Privado) Crea UN TipoRelacion por id, con su nombre, sus padres y su color.
   *
   * ¿Por qué los colores se reparten sobre TODOS los tipos (los de
   * /api/tipos) y ordenados alfabéticamente? PaletaColores.asignar da el
   * color 0 al primer id, el 1 al segundo... Si se usaran solo los tipos de
   * este vecindario, o en el orden en que aparecen, un mismo tipo saldría de
   * colores distintos según la entidad. Con la lista completa y ordenada, un
   * tipo tiene siempre el mismo color. Si un tipo no estuviera en esa lista
   * (por ejemplo, porque apareció después), se añade.
   *
   * @param {Object[]} listaDeRelaciones
   * @returns {Map<string, TipoRelacion>} ordenado por id.
   */
  #descubrirTipos(listaDeRelaciones) {
    // Paso 1: ids y padres de todos los tipos conocidos y de los de las relaciones.
    const padresPorId = new Map();
    if (Array.isArray(this.#contexto.tipos)) {
      for (let i = 0; i < this.#contexto.tipos.length; i++) {
        const tipo = this.#contexto.tipos[i];
        padresPorId.set(tipo.id, tipo.padres);
      }
    }
    for (let i = 0; i < listaDeRelaciones.length; i++) {
      const relacion = listaDeRelaciones[i];
      if (!padresPorId.has(relacion.tipo)) {
        padresPorId.set(relacion.tipo, relacion.padres);
      }
    }
    const idsDeTipos = [];
    for (const idTipo of padresPorId.keys()) {
      idsDeTipos.push(idTipo);
    }

    // Paso 2: orden alfabético. sort() sin función ordena los textos por
    // sus caracteres, de la "A" a la "z".
    idsDeTipos.sort();

    // Paso 3: un color para cada uno y el objeto TipoRelacion.
    const coloresPorId = PaletaColores.asignar(idsDeTipos);
    const nombresTipos = this.#contexto.nombresTipos;
    const tipos = new Map();
    for (let i = 0; i < idsDeTipos.length; i++) {
      const idTipo = idsDeTipos[i];
      const nombre = TipoRelacion.nombrar(idTipo, nombresTipos);
      const padres = padresPorId.get(idTipo);
      const sinNombreDeFamilia = new TipoRelacion(idTipo, nombre, "", padres);
      const nombreFamilia = TipoRelacion.nombrar(sinNombreDeFamilia.getFamilia(), nombresTipos);
      tipos.set(idTipo, new TipoRelacion(idTipo, nombre, coloresPorId.get(idTipo), padres, nombreFamilia));
    }
    return tipos;
  }

  /**
   * (Privado) Convierte cada relación del JSON en una Relacion.
   *
   * @param {Object[]} listaDeRelaciones
   * @returns {Relacion[]}
   */
  #cargarRelaciones(listaDeRelaciones) {
    const relaciones = [];
    for (let i = 0; i < listaDeRelaciones.length; i++) {
      relaciones.push(this.#crearRelacion(listaDeRelaciones[i]));
    }
    return relaciones;
  }

  /**
   * (Privado) Crea una Relacion comprobando que sus entidades existen.
   *
   * @param {Object} datos - { id, idIntermedio, origen, destino, tipo, valor, roles, periodo, lugar, fecha }
   * @returns {Relacion}
   */
  #crearRelacion(datos) {
    if (!this.#entidades.has(datos.origen)) {
      throw new Error("La relación " + datos.id + " usa una entidad que no existe: " + datos.origen + ".");
    }
    if (!this.#entidades.has(datos.destino)) {
      throw new Error("La relación " + datos.id + " usa una entidad que no existe: " + datos.destino + ".");
    }
    const origen = this.#entidades.get(datos.origen);
    const destino = this.#entidades.get(datos.destino);
    const tipo = this.#tipos.get(datos.tipo);
    return new Relacion(datos.id, origen, destino, tipo, datos.valor, {
      idIntermedio: datos.idIntermedio,
      roles: datos.roles,
      periodo: Periodo.desdePropiedades(datos.periodo),
      lugar: datos.lugar,
      fecha: datos.fecha
    });
  }
}
