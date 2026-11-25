import relacionesEjemplo from './relacionesEjemplo.json';
import configuracionServidor from '../servidor/configuracion.json';
import configuracionRelevancia from '../public/relevancia.json';
import { RelevanciaCompuesta } from '../src/logica/RelevanciaCompuesta.js';
import { CalculadorEvidencia } from '../src/logica/CalculadorEvidencia.js';
import { TablaTransferencia } from '../src/logica/TablaTransferencia.js';
import { PenalizacionGrado } from '../src/logica/PenalizacionGrado.js';
import { CompatibilidadTemporal } from '../src/logica/CompatibilidadTemporal.js';
import { RefuerzoEntreDirectos } from '../src/logica/RefuerzoEntreDirectos.js';
import { DeduccionPorTipos } from '../src/logica/DeduccionPorTipos.js';
import { RelevanciaNodosTresCapas } from '../src/logica/RelevanciaNodosTresCapas.js';

/*
 * Funciones de ayuda compartidas por las pruebas del navegador.
 *
 * relacionesEjemplo.json lo genera el servidor (servidor/datos/
 * generar_datos_ejemplo.py): los tipos de /api/tipos, la jerarquía de
 * /api/jerarquia y TODAS las entidades y relaciones derivadas, con el mismo
 * formato que envía /api/relaciones (sin relevancias: las calcula el
 * navegador). Vite permite importar un archivo JSON como si fuera un módulo.
 */

/** Todas las entidades y relaciones de los datos de ejemplo. */
export const RELACIONES_EJEMPLO = relacionesEjemplo;

/** La jerarquía de etiquetas (como /api/jerarquia). */
export const JERARQUIA_PRUEBAS = relacionesEjemplo.jerarquia;

/** Los parámetros de la relevancia de verdad (public/relevancia.json). */
export const CONFIGURACION_RELEVANCIA = configuracionRelevancia;

/**
 * El contexto con que el navegador interpreta los datos: lo mismo que
 * Aplicacion prepara con /api/configuracion y /api/tipos.
 */
export const CONTEXTO_PRUEBAS = {
  idioma: configuracionServidor.idioma,
  nombresTipos: configuracionServidor.nombresTipos,
  etiquetasEntidad: configuracionServidor.etiquetasEntidad,
  tipos: relacionesEjemplo.tipos
};

/** Etiqueta de Neo4j de cada TipoEntidad, para escribir datos de prueba cortos. */
const ETIQUETA_DE_TIPO = {
  PERSONA: "Person",
  ORGANIZACION: "Organization",
  OBRA_DE_ARTE: "HeritageItem"
};

/**
 * Las piezas de la relevancia en tres capas, con la configuración de
 * public/relevancia.json (o la que se indique) y la jerarquía de los datos.
 *
 * @returns {Object} { estrategia, calculador }
 */
export function crearRelevanciaPruebas(configuracion) {
  let config = configuracionRelevancia;
  if (configuracion !== undefined) {
    config = configuracion;
  }
  const tabla = new TablaTransferencia(config, JERARQUIA_PRUEBAS);
  const calculador = new CalculadorEvidencia(new RelevanciaCompuesta(config), config, tabla);
  const penalizacion = new PenalizacionGrado(config);
  const estrategia = new RelevanciaNodosTresCapas(calculador, new RefuerzoEntreDirectos(config, tabla, penalizacion),
    new DeduccionPorTipos(config, tabla, penalizacion, new CompatibilidadTemporal(config), calculador));
  return { estrategia: estrategia, calculador: calculador };
}

/**
 * Convierte unos datos de prueba cortos:
 *   { entidades: [ { id, tipo: "PERSONA", nombre } ],
 *     relaciones: [ [id, origen, destino, tipo, participantes (opcional, 2)] ] }
 * en una respuesta con el formato de /api/relaciones, con todas las
 * entidades como pedidas (completas).
 *
 * @returns {Object} { ids, entidades, relaciones }
 */
export function relacionesDesdeDatos(datos) {
  const entidades = [];
  const ids = [];
  for (let i = 0; i < datos.entidades.length; i++) {
    const entidad = datos.entidades[i];
    const propiedades = {};
    if (entidad.tipo === "PERSONA") {
      propiedades.name = entidad.nombre;
    } else {
      propiedades.name_es = entidad.nombre;
    }
    entidades.push({ id: entidad.id, etiquetas: [ETIQUETA_DE_TIPO[entidad.tipo]], propiedades: propiedades });
    ids.push(entidad.id);
  }
  const relaciones = [];
  for (let i = 0; i < datos.relaciones.length; i++) {
    const fila = datos.relaciones[i];
    let participantes = 2;
    if (typeof fila[4] === "number") {
      participantes = fila[4];
    }
    relaciones.push({
      id: fila[0], idIntermedio: fila[0], origen: fila[1], destino: fila[2], tipo: fila[3], padres: [],
      roles: {}, nombre: "", periodo: null, lugar: null, fecha: null, participantes: participantes,
      dibujable: participantes <= 10
    });
  }
  return { ids: ids, entidades: entidades, relaciones: relaciones };
}

/**
 * Lo que respondería el servidor a POST /api/relaciones con esos ids: las
 * relaciones en las que participa alguna de ellas y las entidades de sus
 * extremos. Sirve de doble de prueba del servidor.
 *
 * @param {Object} todo - todas las entidades y relaciones (p. ej. RELACIONES_EJEMPLO).
 * @param {string[]} ids
 * @returns {Object} { ids, entidades, relaciones }
 */
export function relacionesComoElServidor(todo, ids) {
  const pedidas = new Set(ids);
  const encontradas = new Set(ids);
  const relaciones = [];
  for (let i = 0; i < todo.relaciones.length; i++) {
    const relacion = todo.relaciones[i];
    if (pedidas.has(relacion.origen) || pedidas.has(relacion.destino)) {
      relaciones.push(relacion);
      encontradas.add(relacion.origen);
      encontradas.add(relacion.destino);
    }
  }
  const entidades = [];
  for (let i = 0; i < todo.entidades.length; i++) {
    if (encontradas.has(todo.entidades[i].id)) {
      entidades.push(todo.entidades[i]);
    }
  }
  const copiaIds = [];
  for (let i = 0; i < ids.length; i++) {
    copiaIds.push(ids[i]);
  }
  return { ids: copiaIds, entidades: entidades, relaciones: relaciones };
}

/**
 * Doble de prueba de ClienteServicio: responde como el servidor con unos
 * datos y cuenta las peticiones (y cuántos ids lleva cada una). Igual que el
 * cliente de verdad, parte las listas largas en trozos de 200 ids.
 */
export class ClienteFalso {
  constructor(todo) {
    this.todo = RELACIONES_EJEMPLO;
    if (todo !== undefined) {
      this.todo = todo;
    }
    this.peticiones = 0;
    this.tandas = 0;
    this.idsPorPeticion = [];
    this.detallesPedidos = 0;
  }

  async obtenerRelaciones(ids) {
    this.tandas = this.tandas + 1;
    const juntas = { ids: [], entidades: [], relaciones: [] };
    for (let inicio = 0; inicio < ids.length; inicio = inicio + 200) {
      const trozo = ids.slice(inicio, inicio + 200);
      this.peticiones = this.peticiones + 1;
      this.idsPorPeticion.push(trozo.length);
      const respuesta = relacionesComoElServidor(this.todo, trozo);
      for (let i = 0; i < respuesta.ids.length; i++) {
        juntas.ids.push(respuesta.ids[i]);
      }
      for (let i = 0; i < respuesta.entidades.length; i++) {
        juntas.entidades.push(respuesta.entidades[i]);
      }
      for (let i = 0; i < respuesta.relaciones.length; i++) {
        juntas.relaciones.push(respuesta.relaciones[i]);
      }
    }
    return juntas;
  }

  async obtenerDetalle(idEntidad, contexto) {
    this.detallesPedidos = this.detallesPedidos + 1;
    return { idEntidad: idEntidad, contexto: contexto };
  }

  getBytesUltimaRespuesta() {
    return 1234;
  }
}
