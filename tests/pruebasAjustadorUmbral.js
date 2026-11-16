import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { AjustadorUmbral } from '../src/logica/AjustadorUmbral.js';
import { GestorSubgrafos } from '../src/logica/GestorSubgrafos.js';
import { RelevanciaDesdeBD } from '../src/logica/RelevanciaDesdeBD.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { VECINDARIO_EJEMPLO, CONTEXTO_PRUEBAS, vecindarioComoElServidor } from './utilidadesPruebas.js';

/*
 * Pruebas de AjustadorUmbral (src/logica/) y de
 * GestorSubgrafos.obtenerSubgrafoAjustado, que lo usa.
 */

/**
 * Doble de ClienteServicio: calcula el vecindario como el servidor y
 * apunta con qué umbrales se le ha pedido.
 */
class ClienteFalso {
  constructor() {
    this.umbralesPedidos = [];
  }

  async obtenerVecindario(idEntidad, umbral) {
    this.umbralesPedidos.push(umbral);
    return vecindarioComoElServidor(VECINDARIO_EJEMPLO, idEntidad, umbral);
  }

  getBytesUltimaRespuesta() {
    return 0;
  }
}

/**
 * Los valores del deslizador, de 0,05 a 1.
 *
 * @returns {number[]}
 */
function valoresDelDeslizador() {
  const valores = [];
  for (let centesimas = 5; centesimas <= 100; centesimas = centesimas + 5) {
    valores.push(centesimas / 100);
  }
  return valores;
}

prueba("AjustadorUmbral: cuenta la central más los nodos que superan el umbral, sin pasar de maxNodos", function () {
  const ajustador = new AjustadorUmbral(10);
  const relevancias = [0.9, 0.8, 0.5, 0.31, 0.3, 0.1];
  comprobarIgual(ajustador.contarNodos(relevancias, 0.3, 150), 5, "0,3 no supera 0,3");
  comprobarIgual(ajustador.contarNodos(relevancias, 0.05, 150), 7, "todos");
  comprobarIgual(ajustador.contarNodos(relevancias, 0.05, 4), 4, "como mucho maxNodos");
  comprobarIgual(ajustador.contarNodos(relevancias, 1, 150), 1, "solo la central");
});

prueba("AjustadorUmbral: elige el valor del deslizador que más se acerca al objetivo", function () {
  // 10 nodos de cada relevancia: 0,92, 0,72, 0,52, 0,32 y 0,12.
  const relevancias = [];
  const niveles = [0.92, 0.72, 0.52, 0.32, 0.12];
  for (let i = 0; i < niveles.length; i++) {
    for (let j = 0; j < 10; j++) {
      relevancias.push(niveles[i]);
    }
  }
  // Con 0,5 salen 1 + 30 = 31; con 0,3, 41; con 0,1, 51.
  const eleccion = new AjustadorUmbral(30).elegir(relevancias, 0.05, 150);
  comprobarIgual(eleccion.nodos, 31, "nodos");
  comprobar(eleccion.umbral >= 0.35 && eleccion.umbral <= 0.5, "un umbral entre 0,35 y 0,5 (" + eleccion.umbral + ")");
  comprobarIgual(new AjustadorUmbral(45).elegir(relevancias, 0.05, 150).nodos, 41, "objetivo 45: 41");
});

prueba("AjustadorUmbral: en caso de empate, el umbral más alto; y nunca por debajo del mínimo", function () {
  const relevancias = [0.9, 0.5];
  // Objetivo 2: con 0,5 a 0,85 salen 2 (la central y el de 0,9). Gana 0,85.
  comprobarIgual(new AjustadorUmbral(2).elegir(relevancias, 0.05, 150).umbral, 0.85, "el más alto de los empatados");
  // Objetivo 3 pediría 0,45 o menos, pero el mínimo es 0,6.
  const conMinimo = new AjustadorUmbral(3).elegir(relevancias, 0.6, 150);
  comprobar(conMinimo.umbral >= 0.6, "no baja del mínimo (" + conMinimo.umbral + ")");
});

prueba("AjustadorUmbral: el objetivo debe ser un entero mayor que 0", function () {
  const malos = [0, -5, 2.5, "100", null];
  for (let i = 0; i < malos.length; i++) {
    let fallo = false;
    try {
      new AjustadorUmbral(malos[i]);
    } catch (error) {
      fallo = true;
    }
    comprobar(fallo, "rechaza " + malos[i]);
  }
});

prueba("GestorSubgrafos: obtenerSubgrafoAjustado da el número de nodos más cercano al objetivo", async function () {
  const objetivo = 40;
  const entidades = ["n1", "n121", "n146"];
  const repositorioCompleto = new RepositorioVecindario(VECINDARIO_EJEMPLO, CONTEXTO_PRUEBAS);
  const valores = valoresDelDeslizador();
  for (let e = 0; e < entidades.length; e++) {
    const id = entidades[e];
    const gestor = new GestorSubgrafos(new ClienteFalso(), new RelevanciaDesdeBD(), 150, CONTEXTO_PRUEBAS);
    const subgrafo = await gestor.obtenerSubgrafoAjustado(id, new AjustadorUmbral(objetivo), 0.3);
    const diferencia = Math.abs(subgrafo.getNumeroNodos() - objetivo);

    // Con todos los datos, ningún valor del deslizador se acerca más.
    for (let i = 0; i < valores.length; i++) {
      const directo = await new ConstructorSubgrafo(repositorioCompleto, new RelevanciaDesdeBD(), valores[i], 150).construir(id);
      const otraDiferencia = Math.abs(directo.getNumeroNodos() - objetivo);
      comprobar(diferencia <= otraDiferencia, id + ": con " + valores[i] + " salen " + directo.getNumeroNodos() +
        ", más cerca que los " + subgrafo.getNumeroNodos() + " elegidos con " + subgrafo.getUmbral());
    }
  }
});

prueba("GestorSubgrafos: si con el vecindario de partida no se llega al objetivo, pide uno con el umbral mínimo", async function () {
  const id = "n1";
  const repositorioCompleto = new RepositorioVecindario(VECINDARIO_EJEMPLO, CONTEXTO_PRUEBAS);
  const conUmbralDePartida = await new ConstructorSubgrafo(repositorioCompleto, new RelevanciaDesdeBD(), 0.3, 100000).construir(id);

  // Objetivo justo por encima de lo que da 0,3: tiene que pedir otro.
  const clienteQueNoLlega = new ClienteFalso();
  const gestorQueNoLlega = new GestorSubgrafos(clienteQueNoLlega, new RelevanciaDesdeBD(), 100000, CONTEXTO_PRUEBAS);
  await gestorQueNoLlega.obtenerSubgrafoAjustado(id, new AjustadorUmbral(conUmbralDePartida.getNumeroNodos() + 1), 0.3);
  comprobarIgual(clienteQueNoLlega.umbralesPedidos.join(","), "0.3,0.05", "pide primero con 0,3 y luego con 0,05");

  // Objetivo pequeño: con el de partida basta.
  const clienteQueLlega = new ClienteFalso();
  const gestorQueLlega = new GestorSubgrafos(clienteQueLlega, new RelevanciaDesdeBD(), 150, CONTEXTO_PRUEBAS);
  const subgrafo = await gestorQueLlega.obtenerSubgrafoAjustado(id, new AjustadorUmbral(5), 0.3);
  comprobarIgual(clienteQueLlega.umbralesPedidos.join(","), "0.3", "una sola petición");
  comprobar(subgrafo.getUmbral() >= 0.3, "umbral alto para pocos nodos (" + subgrafo.getUmbral() + ")");
});
