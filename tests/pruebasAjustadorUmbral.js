import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { AjustadorUmbral } from '../src/logica/AjustadorUmbral.js';
import { GestorSubgrafos } from '../src/logica/GestorSubgrafos.js';
import { ConstructorSubgrafo } from '../src/logica/ConstructorSubgrafo.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { RELACIONES_EJEMPLO, CONTEXTO_PRUEBAS, ClienteFalso, crearRelevanciaPruebas } from './utilidadesPruebas.js';

/*
 * Pruebas de AjustadorUmbral (src/logica/) y de
 * GestorSubgrafos.obtenerSubgrafoAjustado, que lo usa.
 */


/** Los valores del deslizador, de 0,05 a 1. */
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
  const entidades = ["n1", "n121", "n146", "ana_ferrer"];
  const piezas = crearRelevanciaPruebas();
  // La caché con TODO (todas las entidades completas).
  const todo = {
    ids: [], entidades: RELACIONES_EJEMPLO.entidades, relaciones: RELACIONES_EJEMPLO.relaciones
  };
  for (let i = 0; i < RELACIONES_EJEMPLO.entidades.length; i++) {
    todo.ids.push(RELACIONES_EJEMPLO.entidades[i].id);
  }
  const cacheCompleta = new RepositorioVecindario(todo, CONTEXTO_PRUEBAS);
  const valores = valoresDelDeslizador();
  for (let e = 0; e < entidades.length; e++) {
    const id = entidades[e];
    const gestor = new GestorSubgrafos(new ClienteFalso(), piezas.estrategia, piezas.calculador, 150, CONTEXTO_PRUEBAS);
    const subgrafo = await gestor.obtenerSubgrafoAjustado(id, new AjustadorUmbral(objetivo));
    const diferencia = Math.abs(subgrafo.getNumeroNodos() - objetivo);

    // Con todos los datos, ningún valor del deslizador se acerca más.
    for (let i = 0; i < valores.length; i++) {
      const directo = await new ConstructorSubgrafo(cacheCompleta, piezas.estrategia, piezas.calculador, valores[i], 150)
        .construir(id);
      const otraDiferencia = Math.abs(directo.getNumeroNodos() - objetivo);
      comprobar(diferencia <= otraDiferencia, id + ": con " + valores[i] + " salen " + directo.getNumeroNodos() +
        ", más cerca que los " + subgrafo.getNumeroNodos() + " elegidos con " + subgrafo.getUmbral());
    }
  }
});

prueba("GestorSubgrafos: obtenerSubgrafoAjustado no pide más que las dos tandas de siempre", async function () {
  const piezas = crearRelevanciaPruebas();
  const cliente = new ClienteFalso();
  const gestor = new GestorSubgrafos(cliente, piezas.estrategia, piezas.calculador, 150, CONTEXTO_PRUEBAS);
  const subgrafo = await gestor.obtenerSubgrafoAjustado("n1", new AjustadorUmbral(5));
  comprobar(cliente.tandas <= 2, "como mucho 2 tandas (" + cliente.tandas + ")");
  comprobar(subgrafo.getNumeroNodos() <= 10, "pocos nodos para un objetivo de 5 (" + subgrafo.getNumeroNodos() + ")");
  const tandas = cliente.tandas;
  await gestor.obtenerSubgrafoAjustado("n1", new AjustadorUmbral(60));
  comprobarIgual(cliente.tandas, tandas, "otro objetivo con la misma entidad no pide nada");
});
