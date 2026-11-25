/**
 * De dónde sale la relevancia de un nodo (RelevanciaNodosTresCapas):
 *
 *  - CENTRAL:       la entidad central (relevancia 1).
 *  - DECLARADA:     tiene alguna relación declarada con la central (una
 *                   relación, la autoría de una obra, la obra en un museo...).
 *  - COINCIDENCIAS: solo coincide con la central en eventos (por ejemplo,
 *                   exposiciones), sin ninguna relación declarada. NUNCA se
 *                   puede decir que «se conocen» (RNF-23).
 *  - DEDUCIDA:      no tiene evidencia propia suficiente con la central:
 *                   entra a dos saltos, a través de un nodo directo.
 *
 * Object.freeze impide añadir o cambiar valores después.
 */
export const OrigenRelevancia = Object.freeze({
  CENTRAL: "CENTRAL",
  DECLARADA: "DECLARADA",
  COINCIDENCIAS: "COINCIDENCIAS",
  DEDUCIDA: "DEDUCIDA"
});
