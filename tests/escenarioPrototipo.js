import { EscenariosPrueba } from '../src/laboratorio/EscenariosPrueba.js';

/*
 * Los escenarios de docs/prototipo_relevancia_v4.mjs para las pruebas. Están
 * en src/laboratorio/EscenariosPrueba.js (los mismos que usa el
 * laboratorio); aquí solo se les da un nombre corto.
 */

/** Los parámetros del prototipo (v4), con f_t = 1 en todo. */
export function configuracionEscenario() {
  return EscenariosPrueba.configuracionPrototipo();
}

/** Los mismos con los cambios de la v4 apagados: la v3. */
export function configuracionV3() {
  return EscenariosPrueba.sinCambiosV4(EscenariosPrueba.configuracionPrototipo());
}

export const JERARQUIA_ESCENARIO = EscenariosPrueba.JERARQUIA;

export function contextoEscenario() {
  return EscenariosPrueba.contexto();
}

export function relacionDePrueba(id, origen, destino, tipo, participantes, extra) {
  return EscenariosPrueba.relacion(id, origen, destino, tipo, participantes, extra);
}

export function entidadDePrueba(id, etiquetas, nombre) {
  return EscenariosPrueba.entidad(id, etiquetas, nombre);
}

export function rel(tipo, roles, periodo, idLugar) {
  return EscenariosPrueba.rel(tipo, roles, periodo, idLugar);
}

export function evento(tipo, participantes) {
  return EscenariosPrueba.evento(tipo, participantes);
}

export function construirDatos(escenario) {
  return EscenariosPrueba.construirDatos(escenario);
}

/** Las piezas del cálculo (FabricaRelevancia). */
export function crearPiezas(configuracion) {
  return EscenariosPrueba.piezas(configuracion);
}

/** La caché con un escenario completo (por defecto, el de Ana). */
export function cacheEscenario(escenario) {
  let e = escenario;
  if (e === undefined) {
    e = EscenariosPrueba.ana();
  }
  return EscenariosPrueba.cache(e);
}

/**
 * Calcula un escenario con una configuración (por defecto, la del prototipo).
 *
 * @returns {Map<string, ResultadoRelevanciaNodo>}
 */
export function calcularEscenario(escenario, configuracion) {
  let config = configuracion;
  if (config === undefined) {
    config = configuracionEscenario();
  }
  return EscenariosPrueba.calcular(escenario, config);
}

export function escenarioAna() {
  return EscenariosPrueba.ana();
}

export function escenarioTiempo() {
  return EscenariosPrueba.tiempo();
}

export function escenarioCirculo() {
  return EscenariosPrueba.circulo();
}
