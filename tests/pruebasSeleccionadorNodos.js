import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { SeleccionadorNodos } from '../src/logica/SeleccionadorNodos.js';
import { ResultadoRelevanciaNodo } from '../src/modelo/ResultadoRelevanciaNodo.js';
import { OrigenRelevancia } from '../src/modelo/OrigenRelevancia.js';
import { FabricaEntidades } from '../src/datos/FabricaEntidades.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';

/*
 * Pruebas de SeleccionadorNodos (src/logica/): el orden (S, C, id) y las
 * cuotas por clase.
 */

function anadir(resultados, id, tipo, fuerza, certeza, origen) {
  let origenFinal = OrigenRelevancia.DECLARADA;
  if (origen !== undefined) {
    origenFinal = origen;
  }
  resultados.set(id, new ResultadoRelevanciaNodo({
    entidad: FabricaEntidades.crearEntidad(tipo, { id: id, propiedades: { name: id } }), fuerza: fuerza, certeza: certeza,
    origen: origenFinal, explicacion: [], padres: [], evidenciaPropia: 0
  }));
}

function ids(lista) {
  const resultado = [];
  for (let i = 0; i < lista.length; i++) {
    resultado.push(lista[i].getEntidad().getId());
  }
  return resultado.join(",");
}

prueba("Seleccionador: ordena por S; a igualdad, por C; a igualdad, por id", function () {
  const resultados = new Map();
  anadir(resultados, "z", TipoEntidad.PERSONA, 0.5, 1);
  anadir(resultados, "menos", TipoEntidad.PERSONA, 0.4, 1);
  anadir(resultados, "a", TipoEntidad.PERSONA, 0.5, 1);
  anadir(resultados, "dudoso", TipoEntidad.PERSONA, 1, 0.5);
  anadir(resultados, "mas", TipoEntidad.PERSONA, 0.9, 1);
  comprobarIgual(ids(new SeleccionadorNodos({}).elegibles(resultados, "central", true)), "mas,a,z,dudoso,menos", "orden");
});

prueba("Seleccionador: la cuota por clase se queda con las de más S y la central no cuenta", function () {
  const resultados = new Map();
  anadir(resultados, "central", TipoEntidad.OBRA_DE_ARTE, 1, 1, OrigenRelevancia.CENTRAL);
  for (let i = 0; i < 5; i++) {
    anadir(resultados, "obra" + i, TipoEntidad.OBRA_DE_ARTE, 0.9 - i / 100, 1);
  }
  anadir(resultados, "persona", TipoEntidad.PERSONA, 0.1, 1);
  const seleccionador = new SeleccionadorNodos({ OBRA_DE_ARTE: 2 });
  comprobarIgual(ids(seleccionador.elegibles(resultados, "central", true)), "obra0,obra1,persona", "dos obras");
  comprobarIgual(ids(new SeleccionadorNodos().elegibles(resultados, "central", true)),
    "obra0,obra1,obra2,obra3,obra4,persona", "sin cuotas, todas");
});

prueba("Seleccionador: los deducidos ocultos no gastan cuota", function () {
  const resultados = new Map();
  anadir(resultados, "deducida", TipoEntidad.OBRA_DE_ARTE, 0.9, 1, OrigenRelevancia.DEDUCIDA);
  anadir(resultados, "propia", TipoEntidad.OBRA_DE_ARTE, 0.5, 1);
  const seleccionador = new SeleccionadorNodos({ OBRA_DE_ARTE: 1 });
  comprobarIgual(ids(seleccionador.elegibles(resultados, "central", true)), "deducida", "con deducidos");
  comprobarIgual(ids(seleccionador.elegibles(resultados, "central", false)), "propia", "sin ellos");
});

prueba("Seleccionador: rechaza una cuota que no es un entero", function () {
  let fallo = false;
  try {
    new SeleccionadorNodos({ OBRA_DE_ARTE: "muchas" });
  } catch (error) {
    fallo = true;
  }
  comprobar(fallo, "debería fallar");
});
