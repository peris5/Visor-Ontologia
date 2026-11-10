/*
 * Configuración de la aplicación (RNF-16).
 *
 * Es un archivo .js (y no un .json) porque la aplicación se abre con doble clic
 * (file://) y desde ahí el navegador no deja leer archivos con fetch.
 * Por eso la configuración se guarda en una variable global que lee la clase
 * Configuracion (src/logica/Configuracion.js).
 */
var CONFIGURACION = {
  // "simulado": datos de ejemplo de src/datos/datosEjemplo.js.
  // La conexión con la base de datos real llegará en el incremento 4.
  origenDatos: "simulado",

  // Dirección del servicio de la base de datos real (incremento 4).
  urlServicio: "",

  // Relevancia mínima (entre 0 y 1) para que un nodo o una relación entren en el subgrafo.
  umbralPorDefecto: 0.3,

  // Número máximo de nodos del subgrafo (contando la entidad central).
  maxNodos: 150,

  // Entidad que se muestra al abrir la página (id de src/datos/datosEjemplo.js).
  entidadInicial: "p01"
};
