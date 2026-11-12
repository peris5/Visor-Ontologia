import vecindarioEjemplo from './vecindarioEjemplo.json';
import configuracionServidor from '../servidor/configuracion.json';

/*
 * Funciones de ayuda compartidas por las pruebas del navegador.
 *
 * vecindarioEjemplo.json lo genera el servidor (servidor/datos/
 * generar_datos_ejemplo.py): los tipos de /api/tipos y el vecindario
 * COMPLETO (umbral 0) de la entidad inicial, con el mismo formato que envía
 * /api/vecindario y con las relevancias ya asignadas. Vite permite
 * importar un archivo JSON como si fuera un módulo.
 */

/**
 * El vecindario completo de la entidad inicial (n1), tal como lo envía el servidor.
 */
export const VECINDARIO_EJEMPLO = vecindarioEjemplo.vecindario;

/**
 * El contexto con que el navegador interpreta los datos: lo mismo que
 * Aplicacion prepara con /api/configuracion y /api/tipos.
 */
export const CONTEXTO_PRUEBAS = {
  idioma: configuracionServidor.idioma,
  nombresTipos: configuracionServidor.nombresTipos,
  etiquetasEntidad: configuracionServidor.etiquetasEntidad,
  tipos: vecindarioEjemplo.tipos
};

/**
 * Etiqueta de Neo4j de cada TipoEntidad, para escribir datos de prueba cortos.
 */
const ETIQUETA_DE_TIPO = {
  PERSONA: "Person",
  ORGANIZACION: "Organization",
  OBRA_DE_ARTE: "HeritageItem"
};

/**
 * Convierte unos datos de prueba cortos, del estilo del incremento 1:
 *   { entidades: [ { id, tipo: "PERSONA", nombre } ],
 *     relaciones: [ [id, origen, destino, tipo, valor] ] }
 * en un vecindario con el formato de /api/vecindario. Si ya lo tiene (por
 * ejemplo VECINDARIO_EJEMPLO), lo devuelve tal cual.
 *
 * @param {Object} datos
 * @returns {Object} JSON con el formato de /api/vecindario.
 */
export function vecindarioDesdeDatos(datos) {
  if (datos.entidades.length > 0 && Array.isArray(datos.entidades[0].etiquetas)) {
    return datos;
  }
  const entidades = [];
  for (let i = 0; i < datos.entidades.length; i++) {
    const entidad = datos.entidades[i];
    const propiedades = {};
    if (entidad.tipo === "PERSONA") {
      propiedades.name = entidad.nombre;
    } else {
      propiedades.name_es = entidad.nombre;
    }
    entidades.push({ id: entidad.id, etiquetas: [ETIQUETA_DE_TIPO[entidad.tipo]], propiedades: propiedades });
  }
  const relaciones = [];
  for (let i = 0; i < datos.relaciones.length; i++) {
    const fila = datos.relaciones[i];
    relaciones.push({
      id: fila[0], idIntermedio: fila[0], origen: fila[1], destino: fila[2], tipo: fila[3], padres: [],
      valor: fila[4], roles: {}, periodo: null, lugar: null, fecha: null
    });
  }
  return { idCentral: "", umbral: 0, recortado: false, entidades: entidades, relaciones: relaciones,
    relevanciasAsignadas: 0, relevanciasReutilizadas: 0 };
}

/**
 * Un vecindario calculado igual que lo hace el servidor
 * (RepositorioSimulado.obtener_vecindario), a partir de un vecindario
 * completo: recorrido en anchura desde la entidad siguiendo solo las
 * relaciones cuyo valor supera el umbral. Sirve de doble de prueba del servidor.
 *
 * @param {Object} completo - un vecindario completo (por ejemplo VECINDARIO_EJEMPLO).
 * @param {string} idCentral
 * @param {number} umbral
 * @returns {Object} JSON con el formato de /api/vecindario.
 */
export function vecindarioComoElServidor(completo, idCentral, umbral) {
  const encontrados = new Set();
  const relacionesIncluidas = [];
  const idsIncluidos = new Set();
  encontrados.add(idCentral);
  const cola = [idCentral];
  let posicion = 0;
  while (posicion < cola.length) {
    const idActual = cola[posicion];
    posicion = posicion + 1;
    for (let i = 0; i < completo.relaciones.length; i++) {
      const relacion = completo.relaciones[i];
      const tocaLaActual = relacion.origen === idActual || relacion.destino === idActual;
      if (tocaLaActual && relacion.valor > umbral) {
        if (!idsIncluidos.has(relacion.id)) {
          idsIncluidos.add(relacion.id);
          relacionesIncluidas.push(relacion);
        }
        let idOtra = relacion.origen;
        if (relacion.origen === idActual) {
          idOtra = relacion.destino;
        }
        if (!encontrados.has(idOtra)) {
          encontrados.add(idOtra);
          cola.push(idOtra);
        }
      }
    }
  }
  const entidades = [];
  for (let i = 0; i < completo.entidades.length; i++) {
    if (encontrados.has(completo.entidades[i].id)) {
      entidades.push(completo.entidades[i]);
    }
  }
  return { idCentral: idCentral, umbral: umbral, recortado: false, entidades: entidades,
    relaciones: relacionesIncluidas, relevanciasAsignadas: 0, relevanciasReutilizadas: relacionesIncluidas.length };
}
