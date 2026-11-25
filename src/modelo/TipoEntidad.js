/**
 * Los tres tipos de entidad. Object.freeze impide añadir, cambiar o borrar
 * valores, como en una enumeración.
 */
export const TipoEntidad = Object.freeze({
  PERSONA: "PERSONA",
  ORGANIZACION: "ORGANIZACION",
  OBRA_DE_ARTE: "OBRA_DE_ARTE"
});
