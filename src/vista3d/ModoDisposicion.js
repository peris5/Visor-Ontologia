/**
 * «enumeration» ModoDisposicion
 *
 * Cómo se reparten los nodos alrededor de la entidad central. En los dos
 * modos la DISTANCIA al centro sigue siendo la relevancia (RF-17); el modo
 * solo decide hacia qué LADO cae cada nodo:
 *
 *  - LIBRE:      lo deciden las fuerzas (como hasta ahora).
 *  - POR_GRUPOS: los grupos de entidades muy relacionadas entre sí
 *                (DetectorComunidades) se juntan, cada uno en su zona, con
 *                una mancha de color detrás de los grupos grandes.
 *
 * Object.freeze impide añadir o cambiar valores después.
 *
 * Requisitos: RF-40 (cúmulos), RNF-28 (disposición por fuerzas).
 */
export const ModoDisposicion = Object.freeze({
  LIBRE: "LIBRE",
  POR_GRUPOS: "POR_GRUPOS"
});
