import { prueba, comprobar } from './miniPruebas.js';
import { OrigenRelevancia } from '../src/modelo/OrigenRelevancia.js';
import {
  configuracionEscenario, calcularEscenario, escenarioAna, copiaSinPareja, escenarioDiversidad, escenarioHub,
  escenarioMaestro, escenarioTiempo, escenarioCirculo
} from './escenarioPrototipo.js';

/*
 * Las NUEVE PROPIEDADES que debe cumplir la relevancia en tres capas, con
 * los mismos escenarios que propiedades() de docs/prototipo_relevancia_v2.mjs:
 *
 *  P1  Añadir una relación no baja la relevancia de nadie
 *  P2  Ningún nodo directo baja de su propia evidencia
 *  P3  Un nodo deducido sin evidencia propia no supera a su mejor padre
 *  P4  Cuatro tipos distintos de vínculo pesan más que diez exposiciones repetidas
 *  P5  El compañero de un taller pequeño pesa más que el de una academia enorme
 *  P6  El maestro es más relevante para la alumna que la alumna para el maestro
 *  P7  La obra del maestro de la época de la mentoría pesa más que una muy posterior
 *  P8  En el ejemplo de Ana entra la obra de su maestro y no el marido (no artista) de su amigo
 *  P9  Dos nodos en la misma situación reciben la misma relevancia (el orden no influye)
 *
 * Y que se siguen cumpliendo al mover ρ, δ y κ (como robustez() del prototipo).
 */

const EPS = 0.000001;
const UMBRAL = 0.3;

/**
 * Comprueba las nueve propiedades con una configuración.
 *
 * @returns {Object[]} [{ p, ok, detalle }]
 */
function propiedades(configuracion) {
  const salida = [];
  const base = calcularEscenario(escenarioAna(), configuracion);

  // P1: añadir la relación Luis–Marta no baja a nadie.
  const sinVinculo = calcularEscenario(copiaSinPareja(escenarioAna(), "luis", "marta"), configuracion);
  let monotona = true;
  let detalle = "";
  for (const [id, resultado] of sinVinculo) {
    if (base.has(id) && base.get(id).getRelevancia() < resultado.getRelevancia() - EPS) {
      monotona = false;
      detalle = id + " baja de " + resultado.getRelevancia().toFixed(3) + " a " + base.get(id).getRelevancia().toFixed(3);
    }
  }
  salida.push({ p: "P1", ok: monotona, detalle: detalle });

  // P2: ningún directo queda por debajo de su evidencia propia.
  let suelo = true;
  detalle = "";
  for (const [id, resultado] of base) {
    const esDirecto = resultado.getOrigen() === OrigenRelevancia.DECLARADA ||
      resultado.getOrigen() === OrigenRelevancia.COINCIDENCIAS;
    if (esDirecto && resultado.getRelevancia() < resultado.getEvidenciaPropia() - EPS) {
      suelo = false;
      detalle = id;
    }
  }
  salida.push({ p: "P2", ok: suelo, detalle: detalle });

  // P3: un deducido sin evidencia propia no supera a su mejor padre.
  let techo = true;
  detalle = "";
  for (const [id, resultado] of base) {
    if (resultado.esDeducido() && resultado.getEvidenciaPropia() < EPS) {
      const padres = resultado.getPadres();
      let mejor = 0;
      for (let i = 0; i < padres.length; i++) {
        mejor = Math.max(mejor, base.get(padres[i].getId()).getRelevancia());
      }
      if (resultado.getRelevancia() > mejor + EPS) {
        techo = false;
        detalle = id;
      }
    }
  }
  salida.push({ p: "P3", ok: techo, detalle: detalle });

  // P4: variedad > repetición.
  const diversidad = calcularEscenario(escenarioDiversidad(), configuracion);
  salida.push({ p: "P4", ok: diversidad.get("y").getRelevancia() > diversidad.get("x").getRelevancia(),
    detalle: "10 expos " + diversidad.get("x").getRelevancia().toFixed(3) + " · 4 tipos " +
      diversidad.get("y").getRelevancia().toFixed(3) });

  // P5: penaliza los intermediarios enormes.
  const hub = calcularEscenario(escenarioHub(), configuracion);
  salida.push({ p: "P5", ok: hub.get("companeroTaller").getRelevancia() > hub.get("companeroAcademia").getRelevancia() + EPS,
    detalle: "taller " + hub.get("companeroTaller").getRelevancia().toFixed(3) + " · academia " +
      hub.get("companeroAcademia").getRelevancia().toFixed(3) });

  // P6: asimetría maestro–alumna.
  const maestro = calcularEscenario(escenarioMaestro(), configuracion);
  salida.push({ p: "P6", ok: base.get("joaquin").getRelevancia() > maestro.get("ana").getRelevancia() + EPS,
    detalle: "Joaquín desde Ana " + base.get("joaquin").getRelevancia().toFixed(3) + " · Ana desde Joaquín " +
      maestro.get("ana").getRelevancia().toFixed(3) });

  // P7: respeta el orden en el tiempo.
  const tiempo = calcularEscenario(escenarioTiempo(), configuracion);
  salida.push({ p: "P7", ok: tiempo.get("paseo").getRelevancia() > tiempo.get("tardia").getRelevancia() + EPS,
    detalle: "Paseo " + tiempo.get("paseo").getRelevancia().toFixed(3) + " · Tardía " +
      tiempo.get("tardia").getRelevancia().toFixed(3) });

  // P8: entra «Paseo» y no Pedro.
  salida.push({ p: "P8", ok: base.get("paseo").getRelevancia() > UMBRAL && base.get("pedro").getRelevancia() <= UMBRAL,
    detalle: "Paseo " + base.get("paseo").getRelevancia().toFixed(3) + " · Pedro " +
      base.get("pedro").getRelevancia().toFixed(3) });

  // P9: iguales reciben lo mismo.
  const circulo = calcularEscenario(escenarioCirculo(), configuracion);
  let minimo = 2;
  let maximo = -1;
  for (let i = 0; i < 25; i++) {
    const valor = circulo.get("c" + i).getRelevancia();
    minimo = Math.min(minimo, valor);
    maximo = Math.max(maximo, valor);
  }
  salida.push({ p: "P9", ok: maximo - minimo < 0.001, detalle: "de " + minimo.toFixed(3) + " a " + maximo.toFixed(3) });
  return salida;
}

const NOMBRES = {
  P1: "añadir una relación no baja a nadie",
  P2: "ningún directo baja de su propia evidencia",
  P3: "un deducido sin evidencia propia no supera a su mejor padre",
  P4: "cuatro tipos distintos pesan más que diez exposiciones",
  P5: "el compañero de un taller pequeño pesa más que el de una academia de 300",
  P6: "el maestro es más relevante para la alumna que la alumna para el maestro",
  P7: "la obra de la época de la mentoría pesa más que una 35 años posterior",
  P8: "entra «Paseo» y no Pedro",
  P9: "dos nodos en la misma situación reciben lo mismo"
};

const CON_LOS_PARAMETROS = propiedades(configuracionEscenario());
for (let i = 0; i < CON_LOS_PARAMETROS.length; i++) {
  const propiedad = CON_LOS_PARAMETROS[i];
  prueba("Propiedades: " + propiedad.p + ", " + NOMBRES[propiedad.p], function () {
    comprobar(propiedad.ok, propiedad.detalle);
  });
}

prueba("Propiedades: las nueve se siguen cumpliendo con ρ ∈ {0,3; 0,5; 0,7}, δ ∈ {0,5; 0,7; 0,9} y κ ∈ {0,2; 0,3; 0,5}", function () {
  const rhos = [0.3, 0.5, 0.7];
  const deltas = [0.5, 0.7, 0.9];
  const cierres = [0.2, 0.3, 0.5];
  let combinaciones = 0;
  for (let i = 0; i < rhos.length; i++) {
    for (let j = 0; j < deltas.length; j++) {
      for (let k = 0; k < cierres.length; k++) {
        const configuracion = configuracionEscenario();
        configuracion.rho = rhos[i];
        configuracion.delta = deltas[j];
        configuracion.cierreTriadico = cierres[k];
        const lista = propiedades(configuracion);
        for (let n = 0; n < lista.length; n++) {
          comprobar(lista[n].ok, lista[n].p + " falla con ρ = " + rhos[i] + ", δ = " + deltas[j] + ", κ = " + cierres[k] +
            ": " + lista[n].detalle);
        }
        combinaciones = combinaciones + 1;
      }
    }
  }
  comprobar(combinaciones === 27, "27 combinaciones");
});
