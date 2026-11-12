import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { GestorSubgrafos } from '../src/logica/GestorSubgrafos.js';
import { RelevanciaDesdeBD } from '../src/logica/RelevanciaDesdeBD.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { DATOS_EJEMPLO, vecindarioDesdeDatos, vecindarioComoElServidor } from './utilidadesPruebas.js';

/*
 * Pruebas de GestorSubgrafos (src/logica/).
 *
 * En lugar del ClienteServicio de verdad (que iría al servidor) se usa un
 * DOBLE DE PRUEBA: un objeto falso con los mismos métodos, que calcula el
 * vecindario igual que el servidor y cuenta cuántas veces se le ha pedido.
 * Así se puede comprobar si el gestor pide o no pide al servidor.
 */

/**
 * Doble de prueba de ClienteServicio.
 */
class ClienteFalso {
  constructor() {
    this.peticiones = 0;
  }

  async obtenerVecindario(idEntidad, umbral) {
    this.peticiones = this.peticiones + 1;
    return vecindarioComoElServidor(DATOS_EJEMPLO, idEntidad, umbral);
  }

  getBytesUltimaRespuesta() {
    return 1234;
  }
}

/**
 * @param {ClienteFalso} cliente
 * @returns {GestorSubgrafos}
 */
function crearGestor(cliente) {
  return new GestorSubgrafos(cliente, new RelevanciaDesdeBD(), 150);
}

prueba("GestorSubgrafos: la primera vez pide el vecindario al servidor", async function () {
  const cliente = new ClienteFalso();
  const subgrafo = await crearGestor(cliente).obtenerSubgrafo("p01", 0.3);
  comprobarIgual(cliente.peticiones, 1, "peticiones");
  comprobarIgual(subgrafo.getEntidadCentral().getId(), "p01", "entidad central");
});

prueba("GestorSubgrafos: misma entidad con un umbral igual o mayor NO pide nada", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  await gestor.obtenerSubgrafo("p01", 0.3);
  await gestor.obtenerSubgrafo("p01", 0.3);
  const conMasUmbral = await gestor.obtenerSubgrafo("p01", 0.6);
  comprobarIgual(cliente.peticiones, 1, "solo la primera petición");
  comprobarIgual(conMasUmbral.getUmbral(), 0.6, "el subgrafo se ha recalculado con el umbral nuevo");
});

prueba("GestorSubgrafos: con un umbral menor u otra entidad sí pide", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  await gestor.obtenerSubgrafo("p01", 0.5);
  await gestor.obtenerSubgrafo("p01", 0.3);
  comprobarIgual(cliente.peticiones, 2, "umbral menor: otra petición");
  await gestor.obtenerSubgrafo("p02", 0.3);
  comprobarIgual(cliente.peticiones, 3, "otra entidad: otra petición");
});

prueba("GestorSubgrafos: el subgrafo desde el vecindario es igual que con todos los datos", async function () {
  const umbrales = [0.3, 0.5, 0.7];
  const entidades = ["p01", "o01", "a01"];
  for (let e = 0; e < entidades.length; e++) {
    for (let u = 0; u < umbrales.length; u++) {
      const idEntidad = entidades[e];
      const umbral = umbrales[u];
      const desdeElVecindario = await crearGestor(new ClienteFalso()).obtenerSubgrafo(idEntidad, umbral);

      const repositorioCompleto = new RepositorioVecindario(vecindarioDesdeDatos(DATOS_EJEMPLO, idEntidad, 0));
      const directo = await new ConstructorSubgrafo(repositorioCompleto, new RelevanciaDesdeBD(), umbral, 150).construir(idEntidad);

      const contexto = idEntidad + " con umbral " + umbral;
      comprobarIgual(desdeElVecindario.getNumeroNodos(), directo.getNumeroNodos(), "nodos de " + contexto);
      comprobarIgual(desdeElVecindario.getRelaciones().length, directo.getRelaciones().length, "relaciones de " + contexto);
      const nodosDirectos = directo.getNodos();
      for (let i = 0; i < nodosDirectos.length; i++) {
        const id = nodosDirectos[i].getEntidad().getId();
        const nodo = desdeElVecindario.getNodo(id);
        comprobar(nodo !== null, "falta " + id + " en " + contexto);
        comprobarIgual(redondear(nodo.getRelevancia()), redondear(nodosDirectos[i].getRelevancia()), "relevancia de " + id + " en " + contexto);
        comprobarIgual(nodo.getNivel(), nodosDirectos[i].getNivel(), "nivel de " + id + " en " + contexto);
      }
    }
  }
});

prueba("GestorSubgrafos: reutilizar el vecindario da el mismo subgrafo que pedir uno nuevo", async function () {
  const cliente = new ClienteFalso();
  const gestor = crearGestor(cliente);
  await gestor.obtenerSubgrafo("p01", 0.3);
  const reutilizado = await gestor.obtenerSubgrafo("p01", 0.55);
  const nuevo = await crearGestor(new ClienteFalso()).obtenerSubgrafo("p01", 0.55);
  comprobarIgual(cliente.peticiones, 1, "el primero no ha vuelto a pedir");
  comprobarIgual(reutilizado.getNumeroNodos(), nuevo.getNumeroNodos(), "mismo número de nodos");
  comprobarIgual(reutilizado.getRelaciones().length, nuevo.getRelaciones().length, "mismo número de relaciones");
});

prueba("GestorSubgrafos: guarda el tiempo de cálculo y el tamaño del vecindario", async function () {
  const gestor = crearGestor(new ClienteFalso());
  await gestor.obtenerSubgrafo("p01", 0.3);
  comprobar(gestor.getMilisegundosUltimoCalculo() >= 0, "tiempo de cálculo");
  comprobarIgual(gestor.getBytesVecindario(), 1234, "bytes del vecindario");
});
