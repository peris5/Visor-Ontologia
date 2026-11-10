/*
 * Pruebas de PaletaColores (src/logica/).
 */

prueba("Paleta: los colores tienen el formato #rrggbb", function () {
  const formatoDeColor = /^#[0-9a-f]{6}$/;
  for (let indice = 0; indice < 50; indice++) {
    const color = PaletaColores.colorPara(indice);
    comprobar(formatoDeColor.test(color), "color del índice " + indice + ": " + color);
  }
});

prueba("Paleta: índices distintos dan colores distintos", function () {
  const coloresVistos = [];
  for (let indice = 0; indice < 50; indice++) {
    const color = PaletaColores.colorPara(indice);
    comprobar(!coloresVistos.includes(color), "el color " + color + " del índice " + indice + " está repetido");
    coloresVistos.push(color);
  }
});

prueba("Paleta: la asignación es determinista", function () {
  const ids = ["maestro_de", "pareja", "autor_de"];
  const primeraVez = PaletaColores.asignar(ids);
  const segundaVez = PaletaColores.asignar(ids);
  for (let i = 0; i < ids.length; i++) {
    comprobarIgual(primeraVez.get(ids[i]), segundaVez.get(ids[i]), "color de " + ids[i]);
  }
  comprobarIgual(primeraVez.get("maestro_de"), PaletaColores.colorPara(0), "el primero usa el color 0");
});

prueba("Paleta: un índice no válido da error", function () {
  let huboError = false;
  try {
    PaletaColores.colorPara(-1);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "colorPara(-1) debería lanzar un error");
});
