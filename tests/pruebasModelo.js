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
