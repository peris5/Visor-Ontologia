/**
 * «enumeration» TipoEntidad
 *
 * Los tres tipos de entidad que hay en la base de datos de patrimonio.
 * Object.freeze impide que alguien añada, cambie o borre valores por error,
 * que es lo que esperamos de una enumeración.
 *
 * Requisitos: modelo de dominio usado en RF-08 a RF-12.
 *
 * @readonly
 * @enum {string}
 */
export const TipoEntidad = Object.freeze({
  PERSONA: "PERSONA",
  ORGANIZACION: "ORGANIZACION",
  OBRA_DE_ARTE: "OBRA_DE_ARTE"
});
