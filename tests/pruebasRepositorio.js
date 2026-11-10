/*
 * Pruebas del RepositorioSimulado y de FabricaEntidades (src/datos/).
 */

/**
 * Mini conjunto de datos para estas pruebas.
 *
 * @returns {Object}
 */
function crearDatosPruebaRepositorio() {
  return {
    entidades: [
      { id: "A", tipo: "PERSONA", nombre: "Ana" },
      { id: "B", tipo: "PERSONA", nombre: "Bruno" },
      { id: "C", tipo: "OBRA_DE_ARTE", nombre: "Cuadro azul" },
      { id: "D", tipo: "ORGANIZACION", nombre: "Academia" }
    ],
    relaciones: [
      ["r1", "A", "B", "maestro_de", 0.9],
      ["r2", "B", "C", "autor_de", 0.7],
      ["r3", "C", "A", "autor_de", 0.4],
      ["r4", "A", "D", "miembro_de", 0.5]
    ]
  };
}

/**
 * @returns {RepositorioSimulado} repositorio sin retardo con los datos de prueba.
 */
function crearRepositorioDePrueba() {
  return new RepositorioSimulado(crearDatosPruebaRepositorio(), 0);
}

/**
 * ¿Hay en la lista una relación con ese id?
 *
 * @param {Relacion[]} relaciones
 * @param {string} idRelacion
 * @returns {boolean}
 */
function contieneRelacionConId(relaciones, idRelacion) {
  for (let i = 0; i < relaciones.length; i++) {
    if (relaciones[i].getId() === idRelacion) {
      return true;
    }
  }
  return false;
}

prueba("Repositorio: obtenerRelaciones devuelve las relaciones en los dos sentidos", async function () {
  const repositorio = crearRepositorioDePrueba();
  const relaciones = await repositorio.obtenerRelaciones("A");
  comprobarIgual(relaciones.length, 3, "número de relaciones de A");
  comprobar(contieneRelacionConId(relaciones, "r1"), "debe incluir r1 (A es el origen)");
  comprobar(contieneRelacionConId(relaciones, "r3"), "debe incluir r3 (A es el destino)");
  comprobar(contieneRelacionConId(relaciones, "r4"), "debe incluir r4 (A es el origen)");
});

prueba("Repositorio: los tipos de relación se descubren de los datos, con nombre y color", async function () {
  const repositorio = crearRepositorioDePrueba();
  const tipos = await repositorio.obtenerTiposRelacion();
  comprobarIgual(tipos.length, 3, "número de tipos distintos");
  comprobarIgual(tipos[0].getId(), "maestro_de", "id del primer tipo");
  comprobarIgual(tipos[0].getNombre(), "Maestro de", "nombre del primer tipo");
  const formatoDeColor = /^#[0-9a-f]{6}$/;
  for (let i = 0; i < tipos.length; i++) {
    comprobar(formatoDeColor.test(tipos[i].getColor()), "color con formato #rrggbb: " + tipos[i].getColor());
  }
});

prueba("Repositorio: las relaciones apuntan a su TipoRelacion", async function () {
  const repositorio = crearRepositorioDePrueba();
  const relaciones = await repositorio.obtenerRelaciones("C");
  for (let i = 0; i < relaciones.length; i++) {
    comprobarIgual(relaciones[i].getTipo().getId(), "autor_de", "tipo de " + relaciones[i].getId());
  }
});

prueba("Repositorio: obtenerEntidad con un id inexistente devuelve null", async function () {
  const repositorio = crearRepositorioDePrueba();
  const entidad = await repositorio.obtenerEntidad("no_existe");
  comprobarIgual(entidad, null, "entidad inexistente");
});

prueba("Repositorio: obtenerEntidad devuelve la subclase correcta", async function () {
  const repositorio = crearRepositorioDePrueba();
  const entidad = await repositorio.obtenerEntidad("C");
  comprobar(entidad instanceof ObraDeArte, "C debería ser una ObraDeArte");
  comprobarIgual(entidad.getNombre(), "Cuadro azul", "nombre de C");
});

prueba("Repositorio: todos los métodos devuelven una Promise", async function () {
  const repositorio = crearRepositorioDePrueba();
  const resultadoBuscar = repositorio.buscarEntidades("a", null, 10);
  const resultadoObtener = repositorio.obtenerEntidad("A");
  const resultadoRelaciones = repositorio.obtenerRelaciones("A");
  const resultadoTipos = repositorio.obtenerTiposRelacion();
  comprobar(resultadoBuscar instanceof Promise, "buscarEntidades debe devolver una Promise");
  comprobar(resultadoObtener instanceof Promise, "obtenerEntidad debe devolver una Promise");
  comprobar(resultadoRelaciones instanceof Promise, "obtenerRelaciones debe devolver una Promise");
  comprobar(resultadoTipos instanceof Promise, "obtenerTiposRelacion debe devolver una Promise");
  // Esperamos a que terminen para no dejar nada a medias.
  await resultadoBuscar;
  await resultadoObtener;
  await resultadoRelaciones;
  await resultadoTipos;
});

prueba("Repositorio: buscarEntidades filtra por subcadena, tipo y límite", async function () {
  const repositorio = crearRepositorioDePrueba();
  const conLaLetraU = await repositorio.buscarEntidades("U", null, null);
  comprobarIgual(conLaLetraU.length, 2, "nombres con 'u' (Bruno, Cuadro azul)");
  const soloPersonas = await repositorio.buscarEntidades("", TipoEntidad.PERSONA, null);
  comprobarIgual(soloPersonas.length, 2, "número de personas");
  const conLimite = await repositorio.buscarEntidades("", null, 1);
  comprobarIgual(conLimite.length, 1, "con límite 1");
});

prueba("Repositorio: una relación con una entidad que no existe da error", function () {
  const datos = crearDatosPruebaRepositorio();
  datos.relaciones.push(["r9", "A", "Z", "maestro_de", 0.5]);
  let huboError = false;
  try {
    new RepositorioSimulado(datos, 0);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "debería lanzar un error");
});

prueba("Repositorio: la interfaz RepositorioDatos no está implementada", async function () {
  const interfaz = new RepositorioDatos();
  let huboError = false;
  try {
    await interfaz.obtenerEntidad("A");
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "obtenerEntidad de la interfaz debería fallar");
});

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

prueba("Repositorio: los datos de ejemplo se cargan sin errores", async function () {
  const repositorio = new RepositorioSimulado(DATOS_EJEMPLO, 0);
  const todas = await repositorio.buscarEntidades("", null, null);
  const tipos = await repositorio.obtenerTiposRelacion();
  comprobarIgual(todas.length, DATOS_EJEMPLO.entidades.length, "número de entidades");
  comprobar(tipos.length >= 5, "debe haber al menos 5 tipos de relación");
});
