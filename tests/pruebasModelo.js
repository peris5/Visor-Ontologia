import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { Entidad } from '../src/modelo/Entidad.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';
import { FabricaEntidades } from '../src/datos/FabricaEntidades.js';

/*
 * Pruebas del modelo de dominio (src/modelo/).
 */

/**
 * Crea unas entidades y un tipo de relación pequeños para estas pruebas.
 *
 * @returns {Object} { persona, organizacion, obra, tipo }
 */
function crearElementosDePruebaModelo() {
  const persona = new Persona({ id: "per1", nombre: "Persona de prueba", nacionalidad: "Española" });
  const organizacion = new Organizacion({ id: "org1", nombre: "Organización de prueba", sede: "Ciudad" });
  const obra = new ObraDeArte({ id: "obr1", nombre: "Obra de prueba", tecnica: "Óleo" });
  const tipo = new TipoRelacion("autor_de", "Autor de", "#ff0000");
  return { persona: persona, organizacion: organizacion, obra: obra, tipo: tipo };
}

prueba("Modelo: no se puede crear una Entidad directamente (es abstracta)", function () {
  let huboError = false;
  try {
    new Entidad({ id: "x", nombre: "X" });
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "new Entidad(...) debería lanzar un error");
});

prueba("Modelo: getTipo de cada subclase", function () {
  const elementos = crearElementosDePruebaModelo();
  comprobarIgual(elementos.persona.getTipo(), TipoEntidad.PERSONA, "Persona.getTipo()");
  comprobarIgual(elementos.organizacion.getTipo(), TipoEntidad.ORGANIZACION, "Organizacion.getTipo()");
  comprobarIgual(elementos.obra.getTipo(), TipoEntidad.OBRA_DE_ARTE, "ObraDeArte.getTipo()");
});

prueba("Modelo: getAtributos añade los campos propios de cada subclase", function () {
  const elementos = crearElementosDePruebaModelo();
  comprobarIgual(elementos.persona.getAtributos().get("nacionalidad"), "Española", "nacionalidad de la persona");
  comprobarIgual(elementos.organizacion.getAtributos().get("sede"), "Ciudad", "sede de la organización");
  comprobarIgual(elementos.obra.getAtributos().get("tecnica"), "Óleo", "técnica de la obra");
});

prueba("Modelo: getClavePar es igual para A→B y B→A", function () {
  const elementos = crearElementosDePruebaModelo();
  const deIdaRelacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  const deVueltaRelacion = new Relacion("rel2", elementos.obra, elementos.persona, elementos.tipo, 0.5);
  comprobarIgual(deIdaRelacion.getClavePar(), deVueltaRelacion.getClavePar(), "clave del par");
});

prueba("Modelo: el Subgrafo nace con la central (relevancia 1, nivel 0)", function () {
  const elementos = crearElementosDePruebaModelo();
  const subgrafo = new Subgrafo(elementos.persona, 0.3);
  comprobarIgual(subgrafo.getNumeroNodos(), 1, "número de nodos");
  comprobarIgual(subgrafo.getNodo("per1").getRelevancia(), 1, "relevancia de la central");
  comprobarIgual(subgrafo.getNodo("per1").getNivel(), 0, "nivel de la central");
});

prueba("Modelo: Subgrafo no guarda dos veces la misma relación", function () {
  const elementos = crearElementosDePruebaModelo();
  const subgrafo = new Subgrafo(elementos.persona, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(elementos.obra, 0.8, 1));
  const relacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  subgrafo.agregarRelacion(relacion);
  subgrafo.agregarRelacion(relacion);
  comprobarIgual(subgrafo.getRelaciones().length, 1, "número de relaciones");
});

// Esta prueba estaba en pruebasRepositorio.js, que ha pasado a Python.
// FabricaEntidades se queda en el navegador (la usa ClienteServicio).
prueba("FabricaEntidades: crea cada tipo y da error con un tipo desconocido", function () {
  const persona = FabricaEntidades.crearEntidad(TipoEntidad.PERSONA, { id: "x1" });
  const organizacion = FabricaEntidades.crearEntidad(TipoEntidad.ORGANIZACION, { id: "x2" });
  const obra = FabricaEntidades.crearEntidad(TipoEntidad.OBRA_DE_ARTE, { id: "x3" });
  comprobar(persona instanceof Persona, "debería ser una Persona");
  comprobar(organizacion instanceof Organizacion, "debería ser una Organizacion");
  comprobar(obra instanceof ObraDeArte, "debería ser una ObraDeArte");

  let huboError = false;
  try {
    FabricaEntidades.crearEntidad("DINOSAURIO", { id: "x4" });
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "un tipo desconocido debería lanzar un error");
});
