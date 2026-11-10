/*
 * Pruebas de Configuracion (src/logica/).
 */

prueba("Configuración: lee los valores indicados", function () {
  const configuracion = new Configuracion();
  configuracion.cargar({
    origenDatos: "real",
    urlServicio: "https://ejemplo.invalid/api",
    umbralPorDefecto: 0.5,
    maxNodos: 40,
    entidadInicial: "p02"
  });
  comprobarIgual(configuracion.getOrigenDatos(), "real", "origenDatos");
  comprobarIgual(configuracion.getUrlServicio(), "https://ejemplo.invalid/api", "urlServicio");
  comprobarIgual(configuracion.getUmbralPorDefecto(), 0.5, "umbralPorDefecto");
  comprobarIgual(configuracion.getMaxNodos(), 40, "maxNodos");
  comprobarIgual(configuracion.getEntidadInicial(), "p02", "entidadInicial");
});

prueba("Configuración: aplica los valores por defecto si faltan", function () {
  const configuracion = new Configuracion();
  configuracion.cargar({});
  comprobarIgual(configuracion.getOrigenDatos(), "simulado", "origenDatos por defecto");
  comprobarIgual(configuracion.getUrlServicio(), "", "urlServicio por defecto");
  comprobarIgual(configuracion.getUmbralPorDefecto(), 0.3, "umbralPorDefecto por defecto");
  comprobarIgual(configuracion.getMaxNodos(), 150, "maxNodos por defecto");
  comprobarIgual(configuracion.getEntidadInicial(), "", "entidadInicial por defecto");
});

prueba("Configuración: aplica los valores por defecto si no son válidos", function () {
  const configuracion = new Configuracion();
  configuracion.cargar({ umbralPorDefecto: 7, maxNodos: -3 });
  comprobarIgual(configuracion.getUmbralPorDefecto(), 0.3, "umbral fuera de [0, 1]");
  comprobarIgual(configuracion.getMaxNodos(), 150, "maxNodos negativo");
});

prueba("Configuración: el archivo config.js se lee bien", function () {
  const configuracion = new Configuracion();
  configuracion.cargar(CONFIGURACION);
  comprobarIgual(configuracion.getOrigenDatos(), "simulado", "origenDatos de config.js");
  comprobar(configuracion.getEntidadInicial() !== "", "config.js debe indicar una entidad inicial");
});

prueba("Configuración: cargar sin un objeto da error", function () {
  const configuracion = new Configuracion();
  let huboError = false;
  try {
    configuracion.cargar(null);
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "cargar(null) debería lanzar un error");
});
