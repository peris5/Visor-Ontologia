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
 * Pruebas del modelo de dominio (src/modelo/). Las de getOtroExtremo,
 * nombreDesdeId y eliminarNodo vuelven del incremento 1, como esos métodos.
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

prueba("Modelo: getOtroExtremo devuelve la otra entidad en los dos sentidos", function () {
  const elementos = crearElementosDePruebaModelo();
  const relacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  comprobarIgual(relacion.getOtroExtremo(elementos.persona).getId(), "obr1", "otro extremo desde el origen");
  comprobarIgual(relacion.getOtroExtremo(elementos.obra).getId(), "per1", "otro extremo desde el destino");
});

prueba("Modelo: getOtroExtremo da error con una entidad que no es de la relación", function () {
  const elementos = crearElementosDePruebaModelo();
  const relacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  let huboError = false;
  try {
    relacion.getOtroExtremo(elementos.organizacion);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "debería lanzar un error");
});


prueba("Modelo: getClavePar es igual para A→B y B→A", function () {
  const elementos = crearElementosDePruebaModelo();
  const deIdaRelacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  const deVueltaRelacion = new Relacion("rel2", elementos.obra, elementos.persona, elementos.tipo, 0.5);
  comprobarIgual(deIdaRelacion.getClavePar(), deVueltaRelacion.getClavePar(), "clave del par");
});

prueba("Modelo: TipoRelacion.nombreDesdeId convierte el id en un nombre legible", function () {
  comprobarIgual(TipoRelacion.nombreDesdeId("maestro_de"), "Maestro de", "maestro_de");
  comprobarIgual(TipoRelacion.nombreDesdeId("pareja"), "Pareja", "pareja");
});


prueba("Modelo: el Subgrafo nace con la central (relevancia 1, nivel 0)", function () {
  const elementos = crearElementosDePruebaModelo();
  const subgrafo = new Subgrafo(elementos.persona, 0.3);
  comprobarIgual(subgrafo.getNumeroNodos(), 1, "número de nodos");
  comprobarIgual(subgrafo.getNodo("per1").getRelevancia(), 1, "relevancia de la central");
  comprobarIgual(subgrafo.getNodo("per1").getNivel(), 0, "nivel de la central");
});

prueba("Modelo: Subgrafo.eliminarNodo quita el nodo y sus relaciones", function () {
  const elementos = crearElementosDePruebaModelo();
  const subgrafo = new Subgrafo(elementos.persona, 0.3);
  subgrafo.agregarNodo(new NodoRelevante(elementos.obra, 0.8, 1));
  subgrafo.agregarNodo(new NodoRelevante(elementos.organizacion, 0.6, 1));
  subgrafo.agregarRelacion(new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8));
  subgrafo.agregarRelacion(new Relacion("rel2", elementos.obra, elementos.organizacion, elementos.tipo, 0.5));
  subgrafo.agregarRelacion(new Relacion("rel3", elementos.persona, elementos.organizacion, elementos.tipo, 0.6));

  subgrafo.eliminarNodo("obr1");

  comprobarIgual(subgrafo.contieneEntidad("obr1"), false, "la obra ya no está");
  comprobarIgual(subgrafo.getNumeroNodos(), 2, "número de nodos");
  const relaciones = subgrafo.getRelaciones();
  comprobarIgual(relaciones.length, 1, "solo queda una relación");
  comprobarIgual(relaciones[0].getId(), "rel3", "la que queda es rel3");
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

// Esta prueba estaba en pruebasRepositorio.js en el incremento 1.
// FabricaEntidades la usa RepositorioVecindario.
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

prueba("Modelo: getValor guarda el valor de la BD aunque cambie la relevancia", function () {
  const elementos = crearElementosDePruebaModelo();
  const relacion = new Relacion("rel1", elementos.persona, elementos.obra, elementos.tipo, 0.8);
  comprobarIgual(relacion.getRelevancia(), 0.8, "al principio la relevancia es el valor");
  relacion.setRelevancia(0.5);
  comprobarIgual(relacion.getRelevancia(), 0.5, "relevancia nueva");
  comprobarIgual(relacion.getValor(), 0.8, "el valor no cambia");
});
