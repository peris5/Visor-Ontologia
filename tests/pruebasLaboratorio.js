import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { MedidorMuestra } from '../src/laboratorio/MedidorMuestra.js';
import { PruebaMonotonia } from '../src/laboratorio/PruebaMonotonia.js';
import { InformeLaboratorio } from '../src/laboratorio/InformeLaboratorio.js';
import { PropiedadesRelevancia } from '../src/laboratorio/PropiedadesRelevancia.js';
import { EscenariosPrueba } from '../src/laboratorio/EscenariosPrueba.js';
import { Estadistica } from '../src/laboratorio/Estadistica.js';
import { configuracionEscenario, configuracionV3, contextoEscenario, construirDatos, rel } from './escenarioPrototipo.js';
import { ClienteFalso, CONTEXTO_PRUEBAS, JERARQUIA_PRUEBAS, CONFIGURACION_RELEVANCIA } from './utilidadesPruebas.js';

/*
 * Pruebas del laboratorio (src/laboratorio/): las medidas, el análisis de los
 * tipos, la monotonía y el informe. No necesitan servidor.
 */

/** El ejemplo de Ana con «Tardía», una alumna y un compañero más. */
function escenarioMedible() {
  const e = EscenariosPrueba.tiempo();
  e.entidades.alumna = ["Creator", "Alumna"];
  e.parejas.push({ a: "ana", b: "alumna", pruebas: [rel("Mentorship", { ana: "maestro", alumna: "aprendiz" })] });
  return e;
}

async function medirEscenario(escenario, configuracion) {
  const medidor = new MedidorMuestra(new ClienteFalso(construirDatos(escenario)), contextoEscenario(),
    EscenariosPrueba.JERARQUIA, 0.3, 150);
  return await medidor.medir({ ids: [escenario.central], intermediariosIgnorados: { Exposition: 2 } }, configuracion);
}

/** Las filas del resumen por clave. */
function porClave(resumen) {
  const mapa = new Map();
  for (let i = 0; i < resumen.filas.length; i++) {
    mapa.set(resumen.filas[i].clave, resumen.filas[i]);
  }
  return mapa;
}

function tablaDe(resumen, titulo) {
  for (let i = 0; i < resumen.tipos.length; i++) {
    if (resumen.tipos[i].titulo === titulo) {
      return resumen.tipos[i];
    }
  }
  return null;
}

prueba("Laboratorio: las medidas salen de las propias relaciones", async function () {
  const medidas = porClave(await medirEscenario(escenarioMedible(), configuracionEscenario()));
  comprobarIgual(medidas.get("maestros").total + "/" + medidas.get("maestros").dentro, "1/1", "Joaquín, dentro");
  comprobarIgual(medidas.get("alumnos").total, 1, "la alumna");
  comprobarIgual(medidas.get("obrasPropias").total, 1, "Huerta");
  comprobarIgual(medidas.get("obrasMaestroEpoca").total, 1, "Paseo");
  comprobarIgual(medidas.get("obrasMaestroEpoca").dentro, 1, "Paseo, dentro");
  comprobarIgual(medidas.get("obrasMaestroPosteriores").total + "/" + medidas.get("obrasMaestroPosteriores").dentro, "1/0",
    "Tardía, fuera");
  comprobarIgual(medidas.get("obrasMaestroEpoca").ok, true, "la de su época, más que la posterior");
  comprobarIgual(medidas.get("obrasAmigos").total + "/" + medidas.get("obrasAmigos").dentro, "1/0", "Retrato, fuera");
  comprobarIgual(medidas.get("conyuges").total, 0, "Pedro coincide con Ana: tiene evidencia propia y no cuenta");
  comprobarIgual(medidas.get("soloCoincidencias").total, 2, "Marta y Pedro");
  comprobarIgual(medidas.get("companeros").total, 0, "el Taller no es una organización grande");
});

prueba("Laboratorio: los compañeros de una organización grande", async function () {
  const medidas = porClave(await medirEscenario(EscenariosPrueba.academia(), configuracionEscenario()));
  comprobarIgual(medidas.get("companeros").total, 301, "los 301 de la academia, y no los 5 del taller pequeño");
  comprobarIgual(medidas.get("companeros").dentro, 0, "ninguno entra");
  comprobarIgual(medidas.get("companeros").ok, true, "como se esperaba");
});

prueba("Laboratorio: un compañero que entra por otro motivo no cuenta como compañero de organización", async function () {
  // Al compañero de la academia le llega también algo por el maestro de Ana.
  const escenario = EscenariosPrueba.academia();
  escenario.entidades.joaquin = ["Creator", "Joaquín"];
  escenario.parejas.push({ a: "ana", b: "joaquin", pruebas: [rel("Mentorship", { ana: "aprendiz", joaquin: "maestro" })] });
  escenario.parejas.push({ a: "joaquin", b: "companeroAcademia", pruebas: [rel("coworking")] });
  const medidas = porClave(await medirEscenario(escenario, configuracionEscenario()));
  comprobarIgual(medidas.get("companeros").total, 300, "los otros 300: a ellos solo les transmite la academia");
});

prueba("Laboratorio: cada medida guarda quién entra y por qué", async function () {
  const medidas = porClave(await medirEscenario(escenarioMedible(), configuracionEscenario()));
  const paseo = medidas.get("obrasMaestroEpoca").entran[0];
  comprobarIgual(paseo.central, "ana (Ana Ferrer)", "la central");
  comprobarIgual(paseo.id, "paseo (Paseo)", "quién entra");
  comprobarIgual(paseo.clase + " " + paseo.origen, "OBRA_DE_ARTE DEDUCIDA", "clase y origen");
  comprobarIgual(paseo.s.toFixed(3) + " " + paseo.r.toFixed(3) + " " + paseo.c.toFixed(3), "0.532 0.760 0.700", "S, R y C");
  comprobarIgual(paseo.padres, "joaquin (Joaquín Mestre)", "padres");
  comprobarIgual(paseo.explicacion, "Creación de Joaquín Mestre (su maestro)", "explicación");
  comprobarIgual(medidas.get("obrasMaestroPosteriores").entran.length, 0, "la tardía no entra");
});

prueba("Laboratorio: los roles que faltan o no se reconocen en una mentoría se resaltan", async function () {
  const escenario = escenarioMedible();
  escenario.entidades.otro = ["Creator", "Otro"];
  escenario.entidades.sinRoles = ["Creator", "Sin roles"];
  escenario.parejas.push({ a: "ana", b: "otro", pruebas: [rel("Mentorship", { ana: "Tutelado/a", otro: "tutor" })] });
  escenario.parejas.push({ a: "ana", b: "sinRoles", pruebas: [rel("Mentorship")] });
  const roles = tablaDe(await medirEscenario(escenario, configuracionEscenario()), "Roles sin equivalencia");
  comprobarIgual(roles.filas[0].celdas[0], "Mentorship", "la mentoría, la primera");
  comprobar(roles.filas[0].aviso, "resaltada");
  comprobarIgual(roles.filas[0].celdas[1], "(sin rol) (2), tutelado (1), tutor (1)", "sin «/a» y en minúsculas");

  // El taller donde ocurrió la mentoría no tiene rol, y no es un fallo.
  const datos = EscenariosPrueba.derivarDatos(EscenariosPrueba.entidadesEventos(), EscenariosPrueba.mentoria(true), true);
  const medidor = new MedidorMuestra(new ClienteFalso(datos), contextoEscenario(), EscenariosPrueba.JERARQUIA, 0.3, 150);
  const conTaller = tablaDe(await medidor.medir({ ids: ["ana"] }, configuracionEscenario()), "Roles sin equivalencia");
  comprobarIgual(conTaller.filas.length, 0, "ningún rol sin equivalencia");
});

prueba("Laboratorio: con la v3, la artista prolífica llena el grafo de obras y no entran las alumnas", async function () {
  const v4 = porClave(await medirEscenario(EscenariosPrueba.artistaProlifica(), configuracionEscenario()));
  const v3 = porClave(await medirEscenario(EscenariosPrueba.artistaProlifica(), configuracionV3()));
  comprobarIgual(v4.get("alumnos").dentro, 12, "v4: las 12");
  comprobarIgual(v4.get("alumnos").ok, true, "v4: bien");
  comprobarIgual(v3.get("alumnos").dentro, 0, "v3: ninguna");
  comprobarIgual(v3.get("alumnos").ok, false, "v3: mal");
});

prueba("Laboratorio: las coexpuestas son obras de otros en la misma exposición", async function () {
  const datos = EscenariosPrueba.derivarDatos(EscenariosPrueba.entidadesEventos(), EscenariosPrueba.exposicion(true)
    .concat([{ id: "c1", tipo: "Creation", participantes: [{ id: "ana", via: "PARTICIPATES_IN" },
      { id: "huerta", via: "PRODUCED" }] }]), true);
  const medidor = new MedidorMuestra(new ClienteFalso(datos), contextoEscenario(), EscenariosPrueba.JERARQUIA, 0.3, 150);
  const medidas = porClave(await medidor.medir({ ids: ["ana"] }, configuracionEscenario()));
  comprobarIgual(medidas.get("coexpuestas").total, 2, "Marina y Faro; Huerta es suya");
  comprobarIgual(medidas.get("coexpuestas").dentro, 0, "no entran");
});

prueba("Laboratorio: «Tipos y datos» enseña lo que la configuración no prevé", async function () {
  const escenario = escenarioMedible();
  // Un tipo inventado, un rol desconocido y un evento juntado.
  escenario.entidades.mecenas = ["Person", "Mecenas"];
  escenario.parejas.push({ a: "ana", b: "mecenas", pruebas: [rel("Inventado", { mecenas: "mecenas", ana: "protegida" })] });
  const datos = construirDatos(escenario);
  const ultima = datos.relaciones.length;
  datos.relaciones.push(EscenariosPrueba.relacion("ev", "ana", "mecenas", "Exposition", 2,
    { idsIntermediarios: ["ev", "ev2"], fecha: "1910-01-02" }));
  comprobarIgual(datos.relaciones.length, ultima + 1, "un evento más");
  const medidor = new MedidorMuestra(new ClienteFalso(datos), contextoEscenario(), EscenariosPrueba.JERARQUIA, 0.3, 150);
  const resumen = await medidor.medir({ ids: ["ana"], intermediariosIgnorados: { Exposition: 2 },
    eventosJuntados: { Exposition: 5 } }, configuracionEscenario());

  const tipos = tablaDe(resumen, "Tipos de relación");
  let inventado = null;
  for (let i = 0; i < tipos.filas.length; i++) {
    if (tipos.filas[i].celdas[0] === "Inventado") {
      inventado = tipos.filas[i];
    }
  }
  comprobar(inventado !== null && inventado.aviso, "el tipo inventado sale resaltado");
  comprobarIgual(inventado.celdas[3], "por defecto", "con el peso por defecto");

  const roles = tablaDe(resumen, "Roles sin equivalencia");
  comprobarIgual(roles.filas.length, 1, "solo en el tipo inventado (los de la mentoría se reconocen)");
  comprobarIgual(roles.filas[0].celdas[0], "Inventado", "agrupados por tipo");
  comprobarIgual(roles.filas[0].celdas[1], "mecenas (1), protegida (1)", "sus roles");
  comprobar(!roles.filas[0].aviso, "y no importan: ese tipo no tiene pesos por rol");

  const pares = tablaDe(resumen, "Pares de tipos con transferenciaPorDefecto");
  comprobar(pares.filas.length > 0, "pares por defecto");
  for (let i = 1; i < pares.filas.length; i++) {
    comprobar(pares.filas[i - 1].orden >= pares.filas[i].orden, "de más a menos fuerza movida");
  }

  const eventos = tablaDe(resumen, "Eventos");
  comprobarIgual(eventos.filas[0].celdas[0], "Exposition", "exposiciones");
  comprobarIgual(eventos.filas[0].celdas[7], "1", "una juntada en lo cargado");
  comprobarIgual(eventos.filas[0].celdas[8], "5", "y cinco en toda la base de datos");
  const grandes = tablaDe(resumen, "Intermediarios grandes");
  comprobar(grandes.filas[0].aviso || grandes.filas[1].aviso, "los que ignora el servidor");
});

prueba("Laboratorio: medir los datos de ejemplo (con el mejor camino también)", async function () {
  const medidor = new MedidorMuestra(new ClienteFalso(), CONTEXTO_PRUEBAS, JERARQUIA_PRUEBAS, 0.3, 150);
  let avances = 0;
  const ids = ["ana_ferrer", "n1", "n2", "n121", "n146"];
  const resumen = await medidor.medir({ ids: ids }, CONFIGURACION_RELEVANCIA, function () {
    avances = avances + 1;
  });
  comprobarIgual(avances, ids.length, "avisa de cada una");
  comprobarIgual(resumen.tamano[0][1], "5", "cinco centrales");
  comprobarIgual(porClave(resumen).get("maestros").ok, true, "los maestros entran");
  const mejorCamino = Object.assign({}, CONFIGURACION_RELEVANCIA);
  mejorCamino.estrategiaNodos = "mejorCamino";
  comprobarIgual((await medidor.medir({ ids: ids }, mejorCamino)).tamano[0][1], "5", "también con el mejor camino");
});

prueba("Laboratorio: monotonía, sin la penalización por grado no baja nadie y la caché queda como estaba", async function () {
  const cliente = new ClienteFalso();
  const medidor = new MedidorMuestra(cliente, CONTEXTO_PRUEBAS, JERARQUIA_PRUEBAS, 0.3, 150);
  const resultado = await new PruebaMonotonia(medidor, CONTEXTO_PRUEBAS, JERARQUIA_PRUEBAS).comprobar(
    ["ana_ferrer", "n1", "n2", "n3", "n4"], CONFIGURACION_RELEVANCIA, 11);
  comprobarIgual(resultado.sin.probadas, 5, "cinco centrales");
  comprobarIgual(resultado.sin.bajan, 0, "ninguna baja sin la penalización");
  comprobar(resultado.con.comparados > 100, "se comparan muchos valores");
});

prueba("Laboratorio: la comparación resalta lo que cambia y el informe sale en Markdown", async function () {
  const escenario = EscenariosPrueba.artistaProlifica();
  const una = { propiedades: new PropiedadesRelevancia(configuracionEscenario()).comprobar(),
    medicion: await medirEscenario(escenario, configuracionEscenario()) };
  const otra = { propiedades: new PropiedadesRelevancia(configuracionV3()).comprobar(),
    medicion: await medirEscenario(escenario, configuracionV3()) };
  const filas = InformeLaboratorio.filasComparacion(una, otra);
  let p12 = null;
  let alumnos = null;
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].celdas[0].startsWith("P12")) {
      p12 = filas[i];
    }
    if (filas[i].celdas[0] === "Alumnos dentro") {
      alumnos = filas[i];
    }
  }
  comprobar(p12.cambia, "P12 cambia");
  comprobar(alumnos.cambia && alumnos.celdas[3] === "-100,0 puntos", "alumnos: " + alumnos.celdas[3]);
  const informe = InformeLaboratorio.crear({
    fecha: "hoy", origenDatos: "simulado", muestra: { n: 1, creadores: 1, entidades: 224 }, semilla: 7, umbral: 0.3,
    configuracion: configuracionEscenario(),
    propiedades: una.propiedades, robustez: { combinaciones: 12, fallos: [] }, medicion: una.medicion, monotonia: null,
    comparacion: { otraConfiguracion: configuracionV3(), deLaPrimera: una, deLaSegunda: otra }
  });
  const titulos = ["## Propiedades", "## Medición", "## Comparación", "## Tipos y datos", "## Configuración"];
  for (let i = 0; i < titulos.length; i++) {
    comprobar(informe.includes(titulos[i]), "el informe tiene " + titulos[i]);
  }
  comprobar(informe.includes("1 entidades (1 creadores) de las 224 que hay, semilla 7"), "qué se ha medido");
  comprobar(informe.includes("#### Alumnos dentro (12)") && informe.includes("Mentoría (su aprendiz)"), "por qué entran");
  comprobar(informe.includes("simulado") && informe.includes("\"topeCoincidencia\": 0.2"), "la fuente y la configuración");
  comprobar(!informe.toLowerCase().includes("conoce"), "ningún texto dice que se conozcan");
});

prueba("Laboratorio: Estadistica (percentiles, azar con semilla y textos)", function () {
  comprobarIgual(Estadistica.mediana([3, 1, 2]), 2, "mediana");
  comprobarIgual(Estadistica.maximo([3, 1, 2]), 3, "máximo");
  comprobarIgual(Estadistica.minimo([3, 1, 2]), 1, "mínimo");
  comprobarIgual(Estadistica.mediana([]), null, "lista vacía");
  comprobarIgual(Estadistica.textoPorcentaje(12.34), "12,3 %", "porcentaje");
  const uno = Estadistica.crearAzar(7);
  const otro = Estadistica.crearAzar(7);
  for (let i = 0; i < 10; i++) {
    const valor = uno();
    comprobar(valor >= 0 && valor < 1, "entre 0 y 1");
    comprobarIgual(valor, otro(), "con la misma semilla, los mismos");
  }
});
