/**
 * «enumeration» EstadoCarga
 *
 * En qué punto está la carga del subgrafo. Lo usa ControladorExploracion
 * para decirle a la interfaz qué mostrar ("Cargando…", el aviso de error...).
 *
 *  - INACTIVO: todavía no se ha pedido nada.
 *  - CARGANDO: se está pidiendo o calculando un subgrafo.
 *  - LISTO:    el subgrafo está en pantalla.
 *  - ERROR:    la última carga ha fallado.
 *
 * Object.freeze impide añadir o cambiar valores después.
 *
 * Requisitos: RF-14 (aviso de carga), RF-15 (aviso de error).
 */
export const EstadoCarga = Object.freeze({
  INACTIVO: "INACTIVO",
  CARGANDO: "CARGANDO",
  LISTO: "LISTO",
  ERROR: "ERROR"
});
