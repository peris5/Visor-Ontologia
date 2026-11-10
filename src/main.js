/*
 * PUNTO DE ENTRADA DE LA PÁGINA (incremento 2).
 *
 * En el incremento 3 este papel lo hará la clase Aplicacion. De momento,
 * este archivo crea y conecta las piezas:
 *   1. Lee public/config.json para saber dónde está la API.
 *   2. Pide al servidor la configuración (umbral por defecto y entidad
 *      inicial) y la lista de entidades para el desplegable.
 *   3. Crea la escena 3D y la leyenda.
 *   4. Pide el subgrafo y lo dibuja; lo repite cada vez que cambia la
 *      entidad o el umbral.
 *   5. Actualiza la barra de estado: nodos, relaciones, fps y tiempo de
 *      estabilización (para las pruebas de rendimiento, RNF-01 y RNF-29).
 */
import { ClienteServicio } from './datos/ClienteServicio.js';
import { EscenaGrafo } from './vista3d/EscenaGrafo.js';
import { Leyenda } from './interfaz/Leyenda.js';
import { TipoEntidad } from './modelo/TipoEntidad.js';

// Máximo de entidades del desplegable temporal (en el incremento 3 se
// sustituye por el buscador).
const LIMITE_DEL_DESPLEGABLE = 500;

// Objetos que se crean una vez al abrir la página y se reutilizan.
let cliente = null;
let escena = null;
let leyenda = null;

// Cada vez que se pide un subgrafo se suma 1. Si el usuario cambia de
// entidad muy deprisa, pueden llegar respuestas viejas después de las
// nuevas; con este número sabemos cuál es la última y las demás se ignoran.
let numeroDeLaUltimaCarga = 0;

// Momento (en milisegundos) en que se empezó a dibujar el subgrafo actual,
// para medir cuánto tarda en estabilizarse. null si ya se ha medido.
let inicioDeLaSimulacion = null;

// Para medir los fps: fotogramas contados y momento de la última medida.
let fotogramasContados = 0;
let ultimaMedidaFps = 0;

/**
 * Se ejecuta cuando el HTML ya está cargado.
 */
async function iniciarPagina() {
  escena = new EscenaGrafo();
  escena.inicializar(document.getElementById("contenedor3d"), null);
  leyenda = new Leyenda(null);
  leyenda.montar(document.getElementById("panelIzquierdo"));
  conectarEventos();
  iniciarMedidas();

  try {
    const urlServicio = await leerUrlServicio();
    cliente = new ClienteServicio(urlServicio);
    const configuracion = await cliente.obtenerConfiguracion();
    await rellenarDesplegable(configuracion.entidadInicial);
    prepararDeslizador(configuracion.umbralPorDefecto);
    await cargarSubgrafo();
  } catch (error) {
    mostrarError(error.message);
  }
}

/**
 * Lee public/config.json (Vite lo copia tal cual al publicar, así se puede
 * cambiar sin recompilar). Si no se puede leer, se usa "/api".
 *
 * @returns {Promise<string>}
 */
async function leerUrlServicio() {
  try {
    const respuesta = await fetch("./config.json");
    if (respuesta.ok) {
      const datos = await respuesta.json();
      if (typeof datos.urlServicio === "string" && datos.urlServicio !== "") {
        return datos.urlServicio;
      }
    }
  } catch (error) {
    // Si falla, seguimos con el valor por defecto de abajo.
  }
  return "/api";
}

/**
 * Pone en el desplegable las entidades del servidor y selecciona la inicial.
 *
 * @param {string} idEntidadInicial
 */
async function rellenarDesplegable(idEntidadInicial) {
  const desplegable = document.getElementById("selectorEntidad");
  const entidades = await cliente.buscarEntidades("", null, LIMITE_DEL_DESPLEGABLE);
  desplegable.textContent = "";

  for (let i = 0; i < entidades.length; i++) {
    const entidad = entidades[i];
    const opcion = document.createElement("option");
    opcion.value = entidad.getId();
    opcion.textContent = entidad.getNombre() + " (" + nombreDelTipoDeEntidad(entidad.getTipo()) + ")";
    desplegable.appendChild(opcion);
  }

  if (typeof idEntidadInicial === "string" && idEntidadInicial !== "") {
    desplegable.value = idEntidadInicial;
  }
}

/**
 * Coloca el deslizador en el umbral inicial y muestra su valor.
 *
 * @param {number} umbralInicial
 */
function prepararDeslizador(umbralInicial) {
  const deslizador = document.getElementById("deslizadorUmbral");
  deslizador.value = String(umbralInicial);
  mostrarValorDelUmbral();
}

/**
 * Escribe al lado del deslizador el valor actual del umbral.
 */
function mostrarValorDelUmbral() {
  const umbral = Number(document.getElementById("deslizadorUmbral").value);
  document.getElementById("valorUmbral").textContent = umbral.toFixed(2);
}

/**
 * Conecta los controles de la página.
 */
function conectarEventos() {
  document.getElementById("selectorEntidad").addEventListener("change", function () {
    cargarSubgrafo();
  });

  const deslizador = document.getElementById("deslizadorUmbral");
  // Mientras se arrastra ("input") solo se actualiza el número; el grafo se
  // pide al soltar ("change"), para no rehacer la escena decenas de veces.
  deslizador.addEventListener("input", function () {
    mostrarValorDelUmbral();
  });
  deslizador.addEventListener("change", function () {
    cargarSubgrafo();
  });

  // RF-27: volver a la vista inicial.
  document.getElementById("botonVistaInicial").addEventListener("click", function () {
    escena.restablecerCamara();
  });
}

/**
 * Pide el subgrafo de la entidad y el umbral elegidos y lo dibuja.
 * Si algo falla, enseña el aviso rojo en lugar de romper la página.
 */
async function cargarSubgrafo() {
  if (cliente === null) {
    return;
  }
  numeroDeLaUltimaCarga = numeroDeLaUltimaCarga + 1;
  const numeroDeEstaCarga = numeroDeLaUltimaCarga;

  const idEntidad = document.getElementById("selectorEntidad").value;
  const umbral = Number(document.getElementById("deslizadorUmbral").value);
  ocultarError();
  document.getElementById("indicadorCarga").hidden = false;

  try {
    const subgrafo = await cliente.obtenerSubgrafo(idEntidad, umbral);
    // Si mientras esperábamos se ha pedido otro subgrafo, este ya no interesa.
    if (numeroDeEstaCarga !== numeroDeLaUltimaCarga) {
      return;
    }
    escena.mostrarSubgrafo(subgrafo);
    leyenda.actualizar(calcularDatosLeyenda(subgrafo));
    mostrarResumen(subgrafo);
    inicioDeLaSimulacion = performance.now();
    document.getElementById("estadoEstabilizacion").textContent = "Estabilizando…";
  } catch (error) {
    if (numeroDeEstaCarga === numeroDeLaUltimaCarga) {
      mostrarError(error.message);
    }
  } finally {
    if (numeroDeEstaCarga === numeroDeLaUltimaCarga) {
      document.getElementById("indicadorCarga").hidden = true;
    }
  }
}

/**
 * Cuenta los nodos de cada tipo y las relaciones de cada tipo para la leyenda.
 *
 * @param {Subgrafo} subgrafo
 * @returns {Object} { nodos: [{ tipo, cantidad }], relaciones: [{ tipo, cantidad }] }
 */
function calcularDatosLeyenda(subgrafo) {
  const cantidadPorTipoDeNodo = new Map();
  const nodos = subgrafo.getNodos();
  for (let i = 0; i < nodos.length; i++) {
    const tipo = nodos[i].getEntidad().getTipo();
    sumarUno(cantidadPorTipoDeNodo, tipo);
  }

  // La clave es el propio TipoRelacion: ClienteServicio crea uno solo por id.
  const cantidadPorTipoDeRelacion = new Map();
  const relaciones = subgrafo.getRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    sumarUno(cantidadPorTipoDeRelacion, relaciones[i].getTipo());
  }

  const datos = { nodos: [], relaciones: [] };
  for (const tipo of cantidadPorTipoDeNodo.keys()) {
    datos.nodos.push({ tipo: tipo, cantidad: cantidadPorTipoDeNodo.get(tipo) });
  }
  for (const tipo of cantidadPorTipoDeRelacion.keys()) {
    datos.relaciones.push({ tipo: tipo, cantidad: cantidadPorTipoDeRelacion.get(tipo) });
  }
  return datos;
}

/**
 * Suma 1 al contador de esa clave (empieza en 0 si no existía).
 *
 * @param {Map} contadores
 * @param {*} clave
 */
function sumarUno(contadores, clave) {
  let cantidad = 0;
  if (contadores.has(clave)) {
    cantidad = contadores.get(clave);
  }
  contadores.set(clave, cantidad + 1);
}

/**
 * @param {Subgrafo} subgrafo
 */
function mostrarResumen(subgrafo) {
  document.getElementById("estadoGrafo").textContent =
    subgrafo.getEntidadCentral().getNombre() + " · " +
    subgrafo.getNumeroNodos() + " nodos · " +
    subgrafo.getRelaciones().length + " relaciones";
}

/**
 * Arranca un bucle propio (requestAnimationFrame, el mismo ritmo al que el
 * navegador dibuja la escena) para medir los fps cada segundo y detectar
 * cuándo termina la simulación.
 */
function iniciarMedidas() {
  ultimaMedidaFps = performance.now();
  requestAnimationFrame(medirFotograma);
}

/**
 * Se ejecuta en cada fotograma.
 *
 * @param {number} ahora - milisegundos desde que se abrió la página.
 */
function medirFotograma(ahora) {
  fotogramasContados = fotogramasContados + 1;
  const transcurrido = ahora - ultimaMedidaFps;
  if (transcurrido >= 1000) {
    const fps = fotogramasContados * 1000 / transcurrido;
    document.getElementById("estadoFps").textContent = Math.round(fps) + " fps";
    fotogramasContados = 0;
    ultimaMedidaFps = ahora;
  }

  // RNF-29: tiempo hasta que la simulación de fuerzas se queda quieta.
  if (inicioDeLaSimulacion !== null && escena.estaEstabilizado()) {
    const segundos = (performance.now() - inicioDeLaSimulacion) / 1000;
    const texto = segundos.toFixed(1).replace(".", ",");
    document.getElementById("estadoEstabilizacion").textContent = "Estabilizado en " + texto + " s";
    inicioDeLaSimulacion = null;
  }
  requestAnimationFrame(medirFotograma);
}

/**
 * @param {string} tipo - un valor de TipoEntidad.
 * @returns {string} nombre para mostrar.
 */
function nombreDelTipoDeEntidad(tipo) {
  if (tipo === TipoEntidad.PERSONA) {
    return "Persona";
  }
  if (tipo === TipoEntidad.ORGANIZACION) {
    return "Organización";
  }
  if (tipo === TipoEntidad.OBRA_DE_ARTE) {
    return "Obra de arte";
  }
  return tipo;
}

/**
 * @param {string} mensaje
 */
function mostrarError(mensaje) {
  const aviso = document.getElementById("avisoError");
  aviso.textContent = mensaje;
  aviso.hidden = false;
}

function ocultarError() {
  const aviso = document.getElementById("avisoError");
  aviso.textContent = "";
  aviso.hidden = true;
}

document.addEventListener("DOMContentLoaded", iniciarPagina);
