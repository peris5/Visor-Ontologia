import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RelevanciaDesdeBD } from '../src/logica/RelevanciaDesdeBD.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { DATOS_EJEMPLO, vecindarioDesdeDatos } from './utilidadesPruebas.js';
import subgrafoIncremento2 from './subgrafoIncremento2.json';

/*
 * Pruebas de ConstructorSubgrafo (src/logica/), recuperadas del incremento 1
 * (los mismos casos y valores que tenían en Python). Como RepositorioSimulado
 * ya no está en el navegador, los datos se le dan con un RepositorioVecindario
 * que contiene todos los datos (vecindarioDesdeDatos).
 *
 * Mini grafo de prueba (valores de cada relación entre paréntesis):
 *
 *   C ──maestro_de (0.9)──── A ──miembro_de (0.3)── B
 *   C ──colaborador_de (0.5)─ A            (dos relaciones entre C y A)
 *   C ──pareja_de (0.9)───── Y ──maestro_de (0.9)── V ──autor_de (0.5)── W ──autor_de (0.6)── Z
 *   C ──autor_de (0.4)────── V             (camino directo, peor que C→Y→V)
 *   C ──miembro_de (0.2)──── L             (por debajo del umbral)
 *
 * Con umbral 0.3 el resultado esperado es:
 *   C = 1 (nivel 0), A = 0.9 (nivel 1), Y = 0.9 (nivel 1),
 *   V = 0.9 × 0.9 = 0.81 (nivel 2), W = 0.81 × 0.5 = 0.405 (nivel 3).
 *   Quedan fuera: B (0.27), Z (0.243) y L (0.2).
 */

/**
 * @returns {Object} datos del mini grafo.
 */
function crearDatosPruebaConstructor() {
  return {
    entidades: [
      { id: "C", tipo: "PERSONA", nombre: "Central" },
      { id: "A", tipo: "PERSONA", nombre: "Alumna" },
      { id: "B", tipo: "ORGANIZACION", nombre: "Banda" },
      { id: "Y", tipo: "PERSONA", nombre: "Yolanda" },
      { id: "V", tipo: "PERSONA", nombre: "Vicente" },
      { id: "W", tipo: "OBRA_DE_ARTE", nombre: "Obra W" },
      { id: "Z", tipo: "OBRA_DE_ARTE", nombre: "Obra Z" },
      { id: "L", tipo: "ORGANIZACION", nombre: "Liga" }
    ],
    relaciones: [
      ["r1", "C", "A", "maestro_de", 0.9],
      ["r2", "C", "A", "colaborador_de", 0.5],
      ["r3", "C", "Y", "pareja_de", 0.9],
      ["r4", "Y", "V", "maestro_de", 0.9],
      ["r5", "C", "V", "autor_de", 0.4],
      ["r6", "V", "W", "autor_de", 0.5],
      ["r7", "C", "L", "miembro_de", 0.2],
      ["r8", "A", "B", "miembro_de", 0.3],
      ["r9", "W", "Z", "autor_de", 0.6]
    ]
  };
}

/**
 * @param {Object} datos
 * @param {number} umbral
 * @param {number} maxNodos
 * @returns {ConstructorSubgrafo}
 */
function crearConstructorDePrueba(datos, umbral, maxNodos) {
  const repositorio = new RepositorioVecindario(vecindarioDesdeDatos(datos, "", 0));
  const estrategia = new RelevanciaDesdeBD();
  return new ConstructorSubgrafo(repositorio, estrategia, umbral, maxNodos);
}

/**
 * @param {Subgrafo} subgrafo
 * @returns {string[]} ids de las relaciones del subgrafo.
 */
function idsDeRelaciones(subgrafo) {
  const ids = [];
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    ids.push(relaciones[i].getId());
  }
  return ids;
}

prueba("Constructor: la central tiene relevancia 1 y nivel 0", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  const nodoCentral = subgrafo.getNodo("C");
  comprobarIgual(subgrafo.getEntidadCentral().getId(), "C", "entidad central");
  comprobarIgual(nodoCentral.getRelevancia(), 1, "relevancia de la central");
  comprobarIgual(nodoCentral.getNivel(), 0, "nivel de la central");
});

prueba("Constructor: nodos, relevancias y niveles esperados en el mini grafo", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  comprobarIgual(subgrafo.getNumeroNodos(), 5, "número de nodos");
  comprobarIgual(redondear(subgrafo.getNodo("A").getRelevancia()), 0.9, "relevancia de A");
  comprobarIgual(redondear(subgrafo.getNodo("Y").getRelevancia()), 0.9, "relevancia de Y");
  comprobarIgual(redondear(subgrafo.getNodo("W").getRelevancia()), 0.405, "relevancia de W");
  comprobarIgual(subgrafo.getNodo("W").getNivel(), 3, "nivel de W");
  comprobarIgual(subgrafo.contieneEntidad("B"), false, "B no debe entrar (0.27)");
  comprobarIgual(subgrafo.contieneEntidad("Z"), false, "Z no debe entrar (0.243)");
  comprobarIgual(subgrafo.contieneEntidad("L"), false, "L no debe entrar (0.2)");
});

prueba("Constructor: un nodo entra con su mejor relevancia aunque se descubra antes por un camino peor", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  const nodoV = subgrafo.getNodo("V");
  // Directo C→V daría 0.4; por C→Y→V da 0.81, que es mejor.
  comprobarIgual(redondear(nodoV.getRelevancia()), 0.81, "relevancia de V");
  comprobarIgual(nodoV.getNivel(), 2, "nivel de V");
});

prueba("Constructor: hay nodos de nivel 2 o más", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  const nodos = subgrafo.getNodos();
  let hayNivelDosOMas = false;
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].getNivel() >= 2) {
      hayNivelDosOMas = true;
    }
  }
  comprobar(hayNivelDosOMas, "debería haber algún nodo de nivel 2 o más");
});

prueba("Constructor: ningún nodo ni relación queda por debajo del umbral", async function () {
  const umbrales = [0.1, 0.3, 0.5, 0.7];
  for (let u = 0; u < umbrales.length; u++) {
    const umbral = umbrales[u];
    const constructor = crearConstructorDePrueba(DATOS_EJEMPLO, umbral, 150);
    const subgrafo = await constructor.construir("p01");
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const esLaCentral = nodo.getEntidad().getId() === "p01";
      if (!esLaCentral) {
        comprobar(nodo.getRelevancia() > umbral, "nodo " + nodo.getEntidad().getId() + " por debajo del umbral " + umbral);
      }
    }
    const relaciones = subgrafo.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      comprobar(relaciones[i].getRelevancia() > umbral, "relación " + relaciones[i].getId() + " por debajo del umbral " + umbral);
    }
  }
});

prueba("Constructor: las relaciones solo unen nodos del subgrafo", async function () {
  const constructor = crearConstructorDePrueba(DATOS_EJEMPLO, 0.3, 150);
  const subgrafo = await constructor.construir("p01");
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    const relacion = relaciones[i];
    comprobar(subgrafo.contieneEntidad(relacion.getOrigen().getId()), "origen de " + relacion.getId() + " fuera del subgrafo");
    comprobar(subgrafo.contieneEntidad(relacion.getDestino().getId()), "destino de " + relacion.getId() + " fuera del subgrafo");
  }
});

prueba("Constructor: se guardan todas las relaciones del mini grafo que superan el umbral", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  const ids = idsDeRelaciones(subgrafo);
  comprobarIgual(ids.length, 6, "número de relaciones (r1 a r6)");
  comprobar(ids.includes("r5"), "debe incluir r5 (C–V, 0.4), aunque V entrara por otro camino");
  comprobar(!ids.includes("r8"), "no debe incluir r8 (0.3 no supera 0.3)");
});

prueba("Constructor: se conservan las relaciones múltiples entre un par", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const subgrafo = await constructor.construir("C");
  const ids = idsDeRelaciones(subgrafo);
  comprobar(ids.includes("r1"), "debe incluir r1 (C–A, maestro_de)");
  comprobar(ids.includes("r2"), "debe incluir r2 (C–A, colaborador_de)");
});

prueba("Constructor: nunca más de maxNodos y se conservan los más relevantes", async function () {
  const completo = await crearConstructorDePrueba(DATOS_EJEMPLO, 0.1, 150).construir("p01");
  const maximos = [1, 2, 3, 5, 8];
  for (let m = 0; m < maximos.length; m++) {
    const maxNodos = maximos[m];
    const limitado = await crearConstructorDePrueba(DATOS_EJEMPLO, 0.1, maxNodos).construir("p01");
    comprobar(limitado.getNumeroNodos() <= maxNodos, "con maxNodos " + maxNodos + " hay " + limitado.getNumeroNodos() + " nodos");

    // La relevancia más baja que se ha quedado dentro...
    let menorDentro = 1;
    const nodosDentro = limitado.getNodos();
    for (let i = 0; i < nodosDentro.length; i++) {
      if (nodosDentro[i].getRelevancia() < menorDentro) {
        menorDentro = nodosDentro[i].getRelevancia();
      }
    }
    // ...tiene que ser mayor o igual que la de cualquier nodo que se ha quedado fuera.
    const nodosDelCompleto = completo.getNodos();
    for (let i = 0; i < nodosDelCompleto.length; i++) {
      const nodo = nodosDelCompleto[i];
      if (!limitado.contieneEntidad(nodo.getEntidad().getId())) {
        comprobar(nodo.getRelevancia() <= menorDentro, "con maxNodos " + maxNodos + " se ha quedado fuera " + nodo.getEntidad().getId() + ", que es más relevante");
      }
    }
  }
});

prueba("Constructor: con maxNodos 3 en el mini grafo quedan C, A e Y", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 3);
  const subgrafo = await constructor.construir("C");
  comprobarIgual(subgrafo.getNumeroNodos(), 3, "número de nodos");
  comprobar(subgrafo.contieneEntidad("A"), "debe estar A");
  comprobar(subgrafo.contieneEntidad("Y"), "debe estar Y");
});

prueba("Constructor: al subir el umbral el subgrafo no crece", async function () {
  let nodosAnteriores = Infinity;
  let relacionesAnteriores = Infinity;
  for (let paso = 0; paso <= 20; paso++) {
    const umbral = paso * 0.05;
    const subgrafo = await crearConstructorDePrueba(DATOS_EJEMPLO, umbral, 150).construir("p01");
    const numeroDeNodos = subgrafo.getNumeroNodos();
    const numeroDeRelaciones = subgrafo.getRelaciones().length;
    comprobar(numeroDeNodos <= nodosAnteriores, "con umbral " + umbral + " hay más nodos que con el anterior");
    comprobar(numeroDeRelaciones <= relacionesAnteriores, "con umbral " + umbral + " hay más relaciones que con el anterior");
    nodosAnteriores = numeroDeNodos;
    relacionesAnteriores = numeroDeRelaciones;
  }
});

prueba("Constructor: los datos de ejemplo tienen caminos de 3 o más saltos", async function () {
  const subgrafo = await crearConstructorDePrueba(DATOS_EJEMPLO, 0.3, 150).construir("p01");
  const nodos = subgrafo.getNodos();
  let nivelMaximo = 0;
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].getNivel() > nivelMaximo) {
      nivelMaximo = nodos[i].getNivel();
    }
  }
  comprobar(nivelMaximo >= 3, "nivel máximo: " + nivelMaximo);
});

prueba("Constructor: la centralidad se guarda en los nodos", async function () {
  const subgrafo = await crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150).construir("C");
  let maximo = 0;
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < nodos.length; i++) {
    if (nodos[i].getCentralidad() > maximo) {
      maximo = nodos[i].getCentralidad();
    }
  }
  comprobarIgual(maximo, 1, "la centralidad máxima debe ser 1");
});

prueba("Constructor: error con una entidad inexistente", async function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  let mensajeDeError = "";
  try {
    await constructor.construir("no_existe");
  } catch (error) {
    mensajeDeError = error.message;
  }
  comprobar(mensajeDeError.includes("no_existe"), "el mensaje de error debe nombrar el id; mensaje: '" + mensajeDeError + "'");
});

prueba("Constructor: setUmbral rechaza valores no válidos", function () {
  const constructor = crearConstructorDePrueba(crearDatosPruebaConstructor(), 0.3, 150);
  const valoresNoValidos = [-0.1, 1.1, NaN, "0.5", null];
  for (let i = 0; i < valoresNoValidos.length; i++) {
    let huboError = false;
    try {
      constructor.setUmbral(valoresNoValidos[i]);
    } catch (error) {
      huboError = true;
    }
    comprobar(huboError, "setUmbral(" + String(valoresNoValidos[i]) + ") debería lanzar un error");
  }
  comprobarIgual(constructor.getUmbral(), 0.3, "el umbral no debe cambiar tras los errores");
  constructor.setUmbral(0.5);
  comprobarIgual(constructor.getUmbral(), 0.5, "un umbral válido sí se acepta");
});

prueba("Constructor: con los datos de ejemplo da EXACTAMENTE el subgrafo del incremento 2", async function () {
  // subgrafoIncremento2.json se generó con el ConstructorSubgrafo de Python
  // del incremento 2 (p01, umbral 0.3, 150 nodos) antes de borrarlo.
  const subgrafo = await crearConstructorDePrueba(DATOS_EJEMPLO, 0.3, 150).construir("p01");
  const esperado = subgrafoIncremento2.nodos;
  comprobarIgual(subgrafo.getNumeroNodos(), esperado.length, "número de nodos");
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < esperado.length; i++) {
    // Cada nodo esperado es [id, relevancia, nivel, centralidad], en el orden en que entró.
    const idEsperado = esperado[i][0];
    comprobarIgual(nodos[i].getEntidad().getId(), idEsperado, "nodo número " + i);
    comprobarIgual(redondear(nodos[i].getRelevancia()), redondear(esperado[i][1]), "relevancia de " + idEsperado);
    comprobarIgual(nodos[i].getNivel(), esperado[i][2], "nivel de " + idEsperado);
    comprobarIgual(redondear(nodos[i].getCentralidad()), redondear(esperado[i][3]), "centralidad de " + idEsperado);
  }
  const relaciones = subgrafo.getRelaciones();
  comprobarIgual(relaciones.length, subgrafoIncremento2.relaciones.length, "número de relaciones");
  for (let i = 0; i < relaciones.length; i++) {
    comprobarIgual(relaciones[i].getId(), subgrafoIncremento2.relaciones[i], "relación número " + i);
  }
});
