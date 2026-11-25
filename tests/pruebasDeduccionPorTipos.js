import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { configuracionEscenario, escenarioAna, calcularEscenario, rel } from './escenarioPrototipo.js';

/*
 * Pruebas de DeduccionPorTipos (src/logica/): la capa 3, a dos saltos.
 * Se usa el escenario de Ana del prototipo con algún añadido.
 */

prueba("DeduccionPorTipos: un nodo a 3 saltos no aparece", function () {
  // La colección donde está «Paseo» (Ana → Joaquín → Paseo → Colección).
  const escenario = escenarioAna();
  escenario.entidades.coleccion = ["Organization", "Colección"];
  escenario.parejas.push({ a: "paseo", b: "coleccion", pruebas: [rel("Exposition")] });
  const resultados = calcularEscenario(escenario);
  comprobar(resultados.has("paseo"), "Paseo (2 saltos) sí");
  comprobar(!resultados.has("coleccion"), "la colección (3 saltos) no");
});

prueba("DeduccionPorTipos: un deducido sin evidencia propia nunca supera a su mejor padre", function () {
  const resultados = calcularEscenario(escenarioAna());
  let comprobados = 0;
  for (const resultado of resultados.values()) {
    if (resultado.esDeducido() && resultado.getEvidenciaPropia() === 0) {
      const padres = resultado.getPadres();
      let mejor = 0;
      for (let i = 0; i < padres.length; i++) {
        mejor = Math.max(mejor, resultados.get(padres[i].getId()).getRelevancia());
      }
      comprobar(resultado.getRelevancia() <= mejor, resultado.getEntidad().getNombre() + " no supera a su padre");
      comprobados = comprobados + 1;
    }
  }
  comprobarIgual(comprobados, 4, "Paseo, Museo, Juan y Retrato");
});

prueba("DeduccionPorTipos: ni con tres padres fuertes supera al mejor (tope añadido)", function () {
  // Tres maestros de Ana firman la misma obra: el «o» de las tres
  // deducciones pasaría de 0,95; el tope lo deja en S del mejor padre.
  const escenario = escenarioAna();
  escenario.entidades.obraComun = ["HeritageItem", "Obra común"];
  const maestros = ["m1", "m2", "m3"];
  for (let i = 0; i < maestros.length; i++) {
    escenario.entidades[maestros[i]] = ["Creator", "Maestro " + i];
    const roles = { ana: "aprendiz" };
    roles[maestros[i]] = "maestro";
    escenario.parejas.push({ a: "ana", b: maestros[i], pruebas: [rel("Mentorship", roles)] });
    escenario.parejas.push({ a: maestros[i], b: "obraComun", pruebas: [rel("Creation")] });
  }
  const resultados = calcularEscenario(escenario);
  const obra = resultados.get("obraComun");
  comprobarIgual(obra.getPadres().length, 3, "tres padres");
  comprobar(obra.getRelevancia() <= resultados.get("m1").getRelevancia() + 0.000001,
    "S = " + obra.getRelevancia().toFixed(3) + " ≤ " + resultados.get("m1").getRelevancia().toFixed(3));
});

prueba("DeduccionPorTipos: con δ = 0, la certeza de un deducido sin evidencia propia es 0", function () {
  const configuracion = configuracionEscenario();
  configuracion.delta = 0;
  const resultados = calcularEscenario(escenarioAna(), configuracion);
  const paseo = resultados.get("paseo");
  comprobarIgual(paseo.getCerteza(), 0, "Paseo: C = 0");
  comprobarIgual(paseo.getRelevancia(), 0, "y S = 0 (no entra con ningún umbral)");
  comprobar(paseo.getFuerza() > 0, "aunque su fuerza no sea 0");
  comprobar(resultados.get("pedro").getCerteza() > 0, "Pedro sí tiene certeza (coincide con Ana en una exposición)");
});

prueba("DeduccionPorTipos: un nodo con dos padres combina las dos deducciones", function () {
  const soloLuis = calcularEscenario(escenarioAna()).get("retrato");
  // «Retrato» también es obra de Joaquín (coautor).
  const escenario = escenarioAna();
  escenario.parejas.push({ a: "joaquin", b: "retrato", pruebas: [rel("Creation")] });
  const resultados = calcularEscenario(escenario);
  const conDos = resultados.get("retrato");
  comprobar(conDos.getRelevancia() > soloLuis.getRelevancia(), "más que solo por Luis (" +
    soloLuis.getRelevancia().toFixed(3) + " → " + conDos.getRelevancia().toFixed(3) + ")");
  comprobar(conDos.getRelevancia() > resultados.get("paseo").getRelevancia(), "y más que solo por Joaquín (como Paseo)");
  comprobarIgual(conDos.getPadres().length, 2, "dos padres");
  comprobarIgual(conDos.getExplicacion().length, 2, "una línea por padre");
  comprobarIgual(conDos.getPadre().getId(), "joaquin", "el primero es el que más aporta");
});
