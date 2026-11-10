import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { ClienteServicio } from '../src/datos/ClienteServicio.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';

/*
 * Pruebas de ClienteServicio.convertirSubgrafo (src/datos/).
 * No necesitan servidor: el JSON está escrito aquí, con el mismo formato que
 * envía /api/subgrafo.
 *
 *   P01 (central) ──autor_de 0.9──────── A03
 *   A03 ──restaurador_de 0.6───────────── P01   (segunda relación del mismo par)
 *   P01 ──miembro_de 0.5──────────────── O02
 *   O02 ──conserva 0.8────────────────── A03
 *   (autor_de lo usan dos relaciones: debe haber un solo TipoRelacion)
 */

/**
 * @returns {Object} JSON de un subgrafo pequeño.
 */
function crearJsonDePrueba() {
  const autorDe = { id: "autor_de", nombre: "Autor de", color: "#4c8bf5" };
  return {
    idCentral: "P01",
    umbral: 0.3,
    nodos: [
      { entidad: { id: "P01", nombre: "Pintora", tipo: "PERSONA", descripcion: "Retratista", atributos: { nacionalidad: "Española" } },
        relevancia: 1, nivel: 0, centralidad: 1 },
      { entidad: { id: "A03", nombre: "Cuadro", tipo: "OBRA_DE_ARTE", descripcion: "", atributos: { tecnica: "Óleo" } },
        relevancia: 0.9, nivel: 1, centralidad: 0.82 },
      { entidad: { id: "O02", nombre: "Academia", tipo: "ORGANIZACION", descripcion: "", atributos: {} },
        relevancia: 0.5, nivel: 1, centralidad: 0.45 },
      { entidad: { id: "A04", nombre: "Grabado", tipo: "OBRA_DE_ARTE", descripcion: "", atributos: {} },
        relevancia: 0.4, nivel: 2, centralidad: 0.3 }
    ],
    relaciones: [
      { id: "R07", origen: "P01", destino: "A03", valor: 0.9, relevancia: 0.9, tipo: autorDe },
      { id: "R08", origen: "A03", destino: "P01", valor: 0.6, relevancia: 0.6, tipo: { id: "restaurador_de", nombre: "Restaurador de", color: "#f5a623" } },
      { id: "R09", origen: "P01", destino: "O02", valor: 0.5, relevancia: 0.5, tipo: { id: "miembro_de", nombre: "Miembro de", color: "#2bb673" } },
      { id: "R10", origen: "O02", destino: "A04", valor: 0.8, relevancia: 0.8, tipo: autorDe }
    ]
  };
}

/**
 * @param {Subgrafo} subgrafo
 * @param {string} id
 * @returns {Relacion|null}
 */
function buscarRelacion(subgrafo, id) {
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].getId() === id) {
      return relaciones[i];
    }
  }
  return null;
}

prueba("ClienteServicio: convierte la central, el umbral y todos los nodos", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  comprobarIgual(subgrafo.getEntidadCentral().getId(), "P01", "entidad central");
  comprobarIgual(subgrafo.getUmbral(), 0.3, "umbral");
  comprobarIgual(subgrafo.getNumeroNodos(), 4, "número de nodos");
  comprobarIgual(subgrafo.getNodo("P01").getRelevancia(), 1, "relevancia de la central");
  comprobarIgual(subgrafo.getNodo("P01").getNivel(), 0, "nivel de la central");
});

prueba("ClienteServicio: cada nodo guarda su relevancia, nivel y centralidad", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  const nodo = subgrafo.getNodo("A03");
  comprobarIgual(nodo.getRelevancia(), 0.9, "relevancia de A03");
  comprobarIgual(nodo.getNivel(), 1, "nivel de A03");
  comprobarIgual(nodo.getCentralidad(), 0.82, "centralidad de A03");
  comprobarIgual(subgrafo.getNodo("P01").getCentralidad(), 1, "centralidad de la central");
  comprobarIgual(subgrafo.getNodo("A04").getNivel(), 2, "nivel de A04");
});

prueba("ClienteServicio: cada entidad es de la subclase de su tipo", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  comprobar(subgrafo.getNodo("P01").getEntidad() instanceof Persona, "P01 debería ser una Persona");
  comprobar(subgrafo.getNodo("O02").getEntidad() instanceof Organizacion, "O02 debería ser una Organizacion");
  comprobar(subgrafo.getNodo("A03").getEntidad() instanceof ObraDeArte, "A03 debería ser una ObraDeArte");
  comprobarIgual(subgrafo.getNodo("P01").getEntidad().getAtributos().get("nacionalidad"), "Española", "atributo de P01");
});

prueba("ClienteServicio: se conservan varias relaciones del mismo par", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  comprobarIgual(subgrafo.getRelaciones().length, 4, "número de relaciones");
  const r07 = buscarRelacion(subgrafo, "R07");
  const r08 = buscarRelacion(subgrafo, "R08");
  comprobar(r07 !== null && r08 !== null, "deben estar R07 y R08");
  comprobarIgual(r07.getClavePar(), r08.getClavePar(), "R07 y R08 son del mismo par");
  comprobarIgual(r08.getOrigen().getId(), "A03", "origen de R08");
  comprobarIgual(r08.getRelevancia(), 0.6, "relevancia de R08");
  comprobarIgual(r07.getTipo().getColor(), "#4c8bf5", "color del tipo de R07");
});

prueba("ClienteServicio: un solo TipoRelacion por id", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  const r07 = buscarRelacion(subgrafo, "R07");
  const r10 = buscarRelacion(subgrafo, "R10");
  comprobar(r07.getTipo() === r10.getTipo(), "R07 y R10 deben compartir el mismo objeto TipoRelacion");
  comprobar(r07.getTipo() !== buscarRelacion(subgrafo, "R08").getTipo(), "tipos distintos deben ser objetos distintos");
});

prueba("ClienteServicio: las relaciones apuntan a las mismas entidades que los nodos", function () {
  const subgrafo = ClienteServicio.convertirSubgrafo(crearJsonDePrueba());
  const r10 = buscarRelacion(subgrafo, "R10");
  comprobar(r10.getOrigen() === subgrafo.getNodo("O02").getEntidad(), "el origen de R10 es la entidad del nodo O02");
});
