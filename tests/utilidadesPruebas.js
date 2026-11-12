import datosEjemploDelServidor from '../servidor/datos/datos_ejemplo.json';

/*
 * Funciones de ayuda compartidas por las pruebas del navegador.
 *
 * Los datos de ejemplo son los MISMOS que usa el servidor
 * (servidor/datos/datos_ejemplo.json). Vite permite importar un archivo
 * JSON como si fuera un módulo.
 */

/**
 * Los datos de ejemplo del servidor, con su formato:
 *   { entidades: [ { id, tipo, nombre, descripcion, ...campos } ],
 *     relaciones: [ [id, origen, destino, tipo, valor] ] }
 */
export const DATOS_EJEMPLO = datosEjemploDelServidor;

/**
 * Convierte datos con el formato de los datos de ejemplo (las relaciones
 * como listas [id, origen, destino, tipo, valor]) en un vecindario con el
 * formato de GET /api/vecindario, con TODAS las entidades y relaciones.
 *
 * @param {Object} datos - { entidades, relaciones }
 * @param {string} idCentral
 * @param {number} umbral
 * @returns {Object} JSON con el formato de /api/vecindario.
 */
export function vecindarioDesdeDatos(datos, idCentral, umbral) {
  const relaciones = [];
  const tipos = [];
  for (let i = 0; i < datos.relaciones.length; i++) {
    const fila = datos.relaciones[i];
    relaciones.push({ id: fila[0], origen: fila[1], destino: fila[2], tipo: fila[3], valor: fila[4] });
    if (!tipos.includes(fila[3])) {
      tipos.push(fila[3]);
    }
  }
  return {
    idCentral: idCentral,
    umbral: umbral,
    recortado: false,
    entidades: datos.entidades,
    relaciones: relaciones,
    tiposRelacion: tipos
  };
}

/**
 * Un vecindario calculado igual que lo hace el servidor
 * (RepositorioSimulado.obtener_vecindario): recorrido en anchura desde la
 * entidad siguiendo solo las relaciones cuyo valor supera el umbral. Sirve
 * de doble de prueba del servidor.
 *
 * @param {Object} datos - { entidades, relaciones } (formato de los datos de ejemplo)
 * @param {string} idCentral
 * @param {number} umbral
 * @returns {Object} JSON con el formato de /api/vecindario.
 */
export function vecindarioComoElServidor(datos, idCentral, umbral) {
  const encontrados = new Set();
  const idsDeRelaciones = new Set();
  encontrados.add(idCentral);
  const cola = [idCentral];
  let posicion = 0;
  while (posicion < cola.length) {
    const idActual = cola[posicion];
    posicion = posicion + 1;
    for (let i = 0; i < datos.relaciones.length; i++) {
      const fila = datos.relaciones[i];
      const tocaLaActual = fila[1] === idActual || fila[2] === idActual;
      if (tocaLaActual && typeof fila[4] === "number" && fila[4] > umbral) {
        idsDeRelaciones.add(fila[0]);
        let idVecino = fila[1];
        if (fila[1] === idActual) {
          idVecino = fila[2];
        }
        if (!encontrados.has(idVecino)) {
          encontrados.add(idVecino);
          cola.push(idVecino);
        }
      }
    }
  }

  const completo = vecindarioDesdeDatos(datos, idCentral, umbral);
  const entidades = [];
  for (let i = 0; i < completo.entidades.length; i++) {
    if (encontrados.has(completo.entidades[i].id)) {
      entidades.push(completo.entidades[i]);
    }
  }
  const relaciones = [];
  for (let i = 0; i < completo.relaciones.length; i++) {
    if (idsDeRelaciones.has(completo.relaciones[i].id)) {
      relaciones.push(completo.relaciones[i]);
    }
  }
  completo.entidades = entidades;
  completo.relaciones = relaciones;
  return completo;
}
