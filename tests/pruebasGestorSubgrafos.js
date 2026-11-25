import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { GestorSubgrafos } from '../src/logica/GestorSubgrafos.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { AjustadorUmbral } from '../src/logica/AjustadorUmbral.js';
import {
  RELACIONES_EJEMPLO, CONTEXTO_PRUEBAS, CONFIGURACION_RELEVANCIA, ClienteFalso, crearRelevanciaPruebas, relacionesDesdeDatos
} from './utilidadesPruebas.js';

/*
 * Pruebas de GestorSubgrafos (src/logica/).
 *
 * En lugar del ClienteServicio de verdad (que iría al servidor) se usa un
 * DOBLE DE PRUEBA (ClienteFalso, en utilidadesPruebas.js): responde como el
 * servidor y cuenta las tandas, las peticiones y los ids de cada una.
 */

const ENTIDADES = ["n1", "n2", "n121", "n146", "ana_ferrer", "luis_peris"];

function crearGestor(cliente, configuracion) {
  const piezas = crearRelevanciaPruebas(configuracion);
  return new GestorSubgrafos(cliente, piezas.estrategia, piezas.calculador, 150, CONTEXTO_PRUEBAS, true,
    piezas.seleccionador);
}

prueba("GestorSubgrafos: cada entidad nueva necesita como mucho 2 tandas", async function () {
  for (let i = 0; i < ENTIDADES.length; i++) {
    const cliente = new ClienteFalso();
    const gestor = crearGestor(cliente);
    const subgrafo = await gestor.obtenerSubgrafo(ENTIDADES[i], 0.3);
    comprobar(cliente.tandas >= 1 && cliente.tandas <= 2, ENTIDADES[i] + ": " + cliente.tandas + " tandas");
    comprobarIgual(gestor.getEstadisticas().tandas, cliente.tandas, "las estadísticas cuentan las tandas");
    comprobarIgual(subgrafo.getEntidadCentral().getId(), ENTIDADES[i], "entidad central");
  }
});

prueba("GestorSubgrafos: cambiar el umbral (subir Y bajar) no pide nada", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  await gestor.obtenerSubgrafo("ana_ferrer", 0.3);
  const peticiones = cliente.peticiones;
  const umbrales = [0.6, 0.1, 0.9, 0, 0.3];
  for (let i = 0; i < umbrales.length; i++) {
    const subgrafo = await gestor.obtenerSubgrafo("ana_ferrer", umbrales[i]);
    comprobarIgual(subgrafo.getUmbral(), umbrales[i], "umbral nuevo");
  }
  comprobarIgual(cliente.peticiones, peticiones, "ninguna petición más");
  comprobarIgual(gestor.getEstadisticas().tandas, 0, "0 tandas");
});

prueba("GestorSubgrafos: volver a una entidad ya visitada no pide nada", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  await gestor.obtenerSubgrafo("ana_ferrer", 0.3);
  await gestor.obtenerSubgrafo("n1", 0.3);
  const peticiones = cliente.peticiones;
  await gestor.obtenerSubgrafo("ana_ferrer", 0.3);
  await gestor.obtenerSubgrafo("n1", 0.5);
  comprobarIgual(cliente.peticiones, peticiones, "ninguna petición más");
});

prueba("GestorSubgrafos: mostrar u ocultar los deducidos no pide nada", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  const conDeducidos = await gestor.obtenerSubgrafo("ana_ferrer", 0);
  const peticiones = cliente.peticiones;
  gestor.setMostrarDeducidos(false);
  const sinDeducidos = await gestor.obtenerSubgrafo("ana_ferrer", 0);
  comprobarIgual(cliente.peticiones, peticiones, "ninguna petición más");
  comprobar(sinDeducidos.getNumeroNodos() < conDeducidos.getNumeroNodos(), "hay menos nodos");
});

prueba("GestorSubgrafos: nunca más de 200 ids por petición", async function () {
  // Una central con 450 vecinos, todos con evidencia de sobra (450 directos).
  const datos = { entidades: [{ id: "c", tipo: "PERSONA", nombre: "Central" }], relaciones: [] };
  for (let i = 0; i < 450; i++) {
    datos.entidades.push({ id: "v" + i, tipo: "PERSONA", nombre: "Vecina " + i });
    datos.relaciones.push(["r" + i, "c", "v" + i, "Friendship"]);
  }
  const cliente = new ClienteFalso(relacionesDesdeDatos(datos));
  const gestor = crearGestor(cliente);
  const subgrafo = await gestor.obtenerSubgrafo("c", 0);
  comprobarIgual(cliente.tandas, 2, "2 tandas");
  comprobarIgual(cliente.idsPorPeticion.join(","), "1,200,200,50", "la segunda tanda en trozos de 200");
  comprobarIgual(subgrafo.getNumeroNodos(), 150, "máximo de 150 nodos");
});

prueba("GestorSubgrafos: con más de maxDirectos se queda con los de más evidencia y avisa", async function () {
  const datos = { entidades: [{ id: "c", tipo: "PERSONA", nombre: "Central" }], relaciones: [] };
  for (let i = 0; i < 20; i++) {
    datos.entidades.push({ id: "v" + i, tipo: "PERSONA", nombre: "Vecina " + i });
    datos.relaciones.push(["r" + i, "c", "v" + i, "Friendship"]);
  }
  datos.entidades.push({ id: "maestra", tipo: "PERSONA", nombre: "Maestra" });
  datos.relaciones.push(["m", "c", "maestra", "Mentorship"]);
  const configuracion = Object.assign({}, CONFIGURACION_RELEVANCIA);
  configuracion.maxDirectos = 5;
  const cliente = new ClienteFalso(relacionesDesdeDatos(datos));
  const avisos = [];
  const avisoOriginal = console.warn;
  console.warn = function (texto) {
    avisos.push(texto);
  };
  try {
    const subgrafo = await crearGestor(cliente, configuracion).obtenerSubgrafo("c", 0);
    comprobar(subgrafo.contieneEntidad("maestra"), "la de más evidencia (Mentoría) entra");
  } finally {
    console.warn = avisoOriginal;
  }
  comprobarIgual(cliente.idsPorPeticion[1], 5, "solo se piden 5 directos");
  comprobarIgual(avisos.length, 1, "un aviso en la consola");
});

prueba("GestorSubgrafos: el subgrafo con dos tandas es exacto (igual que con todos los datos)", async function () {
  const piezas = crearRelevanciaPruebas();
  const todo = { ids: [], entidades: RELACIONES_EJEMPLO.entidades, relaciones: RELACIONES_EJEMPLO.relaciones };
  for (let i = 0; i < RELACIONES_EJEMPLO.entidades.length; i++) {
    todo.ids.push(RELACIONES_EJEMPLO.entidades[i].id);
  }
  const cacheCompleta = new RepositorioVecindario(todo, CONTEXTO_PRUEBAS);
  const umbrales = [0, 0.3, 0.6];
  for (let e = 0; e < ENTIDADES.length; e++) {
    for (let u = 0; u < umbrales.length; u++) {
      const id = ENTIDADES[e];
      const umbral = umbrales[u];
      const conTandas = await crearGestor(new ClienteFalso()).obtenerSubgrafo(id, umbral);
      const completo = await new ConstructorSubgrafo(cacheCompleta, piezas.estrategia, piezas.calculador, umbral, 150,
        true, piezas.seleccionador).construir(id);
      const contexto = id + " con umbral " + umbral;
      comprobarIgual(conTandas.getNumeroNodos(), completo.getNumeroNodos(), "nodos de " + contexto);
      comprobarIgual(conTandas.getRelaciones().length, completo.getRelaciones().length, "relaciones de " + contexto);
      const nodos = completo.getNodos();
      for (let i = 0; i < nodos.length; i++) {
        const nodo = conTandas.getNodo(nodos[i].getEntidad().getId());
        comprobar(nodo !== null, "falta " + nodos[i].getEntidad().getId() + " en " + contexto);
        comprobarIgual(redondear(nodo.getRelevancia()), redondear(nodos[i].getRelevancia()),
          "relevancia de " + nodos[i].getEntidad().getId() + " en " + contexto);
      }
    }
  }
});

prueba("GestorSubgrafos: el umbral ajustado cuenta los nodos que de verdad entran (con las cuotas)", async function () {
  // Una autora con 60 obras (S = 1) y 20 amigas (S = 0,5 × fE): con una cuota de
  // 5 obras, para acercarse a 20 nodos hay que bajar hasta las amigas.
  const datos = { entidades: [{ id: "c", tipo: "PERSONA", nombre: "Central" }], relaciones: [] };
  for (let i = 0; i < 60; i++) {
    datos.entidades.push({ id: "o" + i, tipo: "OBRA_DE_ARTE", nombre: "Obra " + i });
    datos.relaciones.push(["co" + i, "c", "o" + i, "Creation"]);
  }
  for (let i = 0; i < 20; i++) {
    datos.entidades.push({ id: "v" + i, tipo: "PERSONA", nombre: "Amiga " + i });
    datos.relaciones.push(["a" + i, "c", "v" + i, "Friendship"]);
  }
  const configuracion = Object.assign({}, CONFIGURACION_RELEVANCIA);
  configuracion.cuotasPorClase = { OBRA_DE_ARTE: 5 };
  const gestor = crearGestor(new ClienteFalso(relacionesDesdeDatos(datos)), configuracion);
  const subgrafo = await gestor.obtenerSubgrafoAjustado("c", new AjustadorUmbral(20));
  comprobarIgual(subgrafo.getNumeroNodos(), 26, "la central, 5 obras y las 20 amigas");
});

prueba("GestorSubgrafos: guarda el tiempo de cálculo, los bytes y las estadísticas", async function () {
  const gestor = crearGestor(new ClienteFalso());
  await gestor.obtenerSubgrafo("ana_ferrer", 0.3);
  comprobar(gestor.getMilisegundosUltimoCalculo() >= 0, "tiempo de cálculo");
  comprobarIgual(gestor.getBytesRecibidos(), 2 * 1234, "bytes de las dos tandas");
  const estadisticas = gestor.getEstadisticas();
  comprobar(estadisticas.directos >= 4, "directos (" + estadisticas.directos + ")");
  comprobar(estadisticas.deducidos > 0, "deducidos (" + estadisticas.deducidos + ")");
  comprobarIgual(estadisticas.vueltas, undefined, "ya no hay vueltas de circuito");
  await gestor.obtenerSubgrafo("ana_ferrer", 0.5);
  comprobarIgual(gestor.getBytesRecibidos(), 0, "sin peticiones, 0 bytes");
});

prueba("GestorSubgrafos: una entidad que no existe da un error", async function () {
  const cliente = new ClienteFalso();
  let mensaje = "";
  try {
    await crearGestor(cliente).obtenerSubgrafo("no_existe", 0.3);
  } catch (error) {
    mensaje = error.message;
  }
  comprobar(mensaje.includes("no_existe"), "el error nombra la entidad (" + mensaje + ")");
});

prueba("GestorSubgrafos: el detalle se pide una sola vez y con el contexto", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  const primero = await gestor.obtenerDetalle("n1");
  const segundo = await gestor.obtenerDetalle("n1");
  comprobarIgual(cliente.detallesPedidos, 1, "detalles pedidos");
  comprobar(primero === segundo, "el mismo detalle");
  comprobar(primero.contexto === CONTEXTO_PRUEBAS, "con el contexto");
});
