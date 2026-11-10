/*
 * PÁGINA TEMPORAL DE COMPROBACIÓN DEL INCREMENTO 1.
 *
 * Sirve para ver con los ojos que el subgrafo se construye bien: muestra los
 * nodos y las relaciones en dos tablas. En el incremento 2 esta página se
 * sustituirá por la escena 3D.
 *
 * Pasos al abrir la página:
 *   1. Leer la configuración (config.js).
 *   2. Crear el repositorio simulado y el constructor de subgrafos.
 *   3. Rellenar el desplegable de entidades y preparar el deslizador del umbral.
 *   4. Construir y mostrar el subgrafo; repetirlo cada vez que cambie algo.
 */

// Objetos que se crean una vez al abrir la página y se reutilizan.
let constructorDeSubgrafos = null;

// Cada vez que se pide un subgrafo se suma 1. Si el usuario mueve el
// deslizador muy deprisa, pueden llegar respuestas viejas después de las
// nuevas; con este número sabemos cuál es la última y las demás se ignoran.
let numeroDeLaUltimaPeticion = 0;

/**
 * Punto de entrada: se ejecuta cuando el HTML ya está cargado.
 */
async function iniciarPagina() {
  try {
    const configuracion = crearConfiguracion();
    const repositorio = crearRepositorio(configuracion);
    const estrategia = new RelevanciaDesdeBD();
    constructorDeSubgrafos = new ConstructorSubgrafo(repositorio, estrategia, configuracion.getUmbralPorDefecto(), configuracion.getMaxNodos());

    await rellenarDesplegable(repositorio, configuracion.getEntidadInicial());
    prepararDeslizador(configuracion.getUmbralPorDefecto());
    conectarEventos();
    await recalcularSubgrafo();
  } catch (error) {
    mostrarError(error.message);
  }
}

/**
 * Lee la variable global CONFIGURACION de config.js.
 *
 * @returns {Configuracion}
 */
function crearConfiguracion() {
  if (typeof CONFIGURACION === "undefined") {
    throw new Error("No se ha encontrado la configuración: revisa que config.js se carga en index.html.");
  }
  const configuracion = new Configuracion();
  configuracion.cargar(CONFIGURACION);
  return configuracion;
}

/**
 * Crea el repositorio según el origen de datos configurado.
 * En este incremento solo existe el simulado.
 *
 * @param {Configuracion} configuracion
 * @returns {RepositorioDatos}
 */
function crearRepositorio(configuracion) {
  if (configuracion.getOrigenDatos() !== "simulado") {
    throw new Error("El origen de datos \"" + configuracion.getOrigenDatos() + "\" aún no está disponible (llegará en el incremento 4). Usa \"simulado\" en config.js.");
  }
  // 150 ms de espera para que se note que los datos "llegan por la red".
  const retardoSimuladoMs = 150;
  return new RepositorioSimulado(DATOS_EJEMPLO, retardoSimuladoMs);
}

/**
 * Pone en el desplegable todas las entidades y selecciona la inicial.
 *
 * @param {RepositorioDatos} repositorio
 * @param {string} idEntidadInicial
 */
async function rellenarDesplegable(repositorio, idEntidadInicial) {
  const desplegable = document.getElementById("selectorEntidad");
  const entidades = await repositorio.buscarEntidades("", null, null);

  for (let i = 0; i < entidades.length; i++) {
    const entidad = entidades[i];
    const opcion = document.createElement("option");
    opcion.value = entidad.getId();
    opcion.textContent = entidad.getNombre() + " (" + nombreDelTipoDeEntidad(entidad.getTipo()) + ")";
    desplegable.appendChild(opcion);
  }

  if (idEntidadInicial !== "") {
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
  const deslizador = document.getElementById("deslizadorUmbral");
  const umbral = Number(deslizador.value);
  document.getElementById("valorUmbral").textContent = umbral.toFixed(2);
}

/**
 * Recalcula el subgrafo cuando cambia la entidad o el umbral.
 */
function conectarEventos() {
  const desplegable = document.getElementById("selectorEntidad");
  const deslizador = document.getElementById("deslizadorUmbral");

  desplegable.addEventListener("change", function () {
    recalcularSubgrafo();
  });

  // "input" salta mientras se arrastra, así la tabla se actualiza en directo.
  deslizador.addEventListener("input", function () {
    mostrarValorDelUmbral();
    recalcularSubgrafo();
  });
}

/**
 * Construye el subgrafo con la entidad y el umbral elegidos y lo muestra.
 * Si algo falla, enseña el aviso rojo en lugar de romper la página.
 */
async function recalcularSubgrafo() {
  ocultarError();
  numeroDeLaUltimaPeticion = numeroDeLaUltimaPeticion + 1;
  const numeroDeEstaPeticion = numeroDeLaUltimaPeticion;

  const idEntidad = document.getElementById("selectorEntidad").value;
  const umbral = Number(document.getElementById("deslizadorUmbral").value);
  document.getElementById("resumen").textContent = "Calculando…";

  try {
    constructorDeSubgrafos.setUmbral(umbral);
    const subgrafo = await constructorDeSubgrafos.construir(idEntidad);

    // Si mientras esperábamos se ha pedido otro subgrafo, este ya no interesa.
    if (numeroDeEstaPeticion !== numeroDeLaUltimaPeticion) {
      return;
    }
    mostrarSubgrafo(subgrafo);
  } catch (error) {
    if (numeroDeEstaPeticion === numeroDeLaUltimaPeticion) {
      document.getElementById("resumen").textContent = "";
      mostrarError(error.message);
    }
  }
}

/**
 * @param {Subgrafo} subgrafo
 */
function mostrarSubgrafo(subgrafo) {
  const nodos = subgrafo.getNodos();
  const relaciones = subgrafo.getRelaciones();
  document.getElementById("resumen").textContent =
    "Entidad central: " + subgrafo.getEntidadCentral().getNombre() +
    " · " + nodos.length + " nodos · " + relaciones.length + " relaciones";
  mostrarTablaDeNodos(nodos);
  mostrarTablaDeRelaciones(relaciones);
}

/**
 * Tabla de nodos, de más a menos relevante.
 *
 * @param {NodoRelevante[]} nodos
 */
function mostrarTablaDeNodos(nodos) {
  nodos.sort(compararNodosPorRelevancia);
  const cuerpoDeLaTabla = document.getElementById("cuerpoTablaNodos");
  cuerpoDeLaTabla.innerHTML = "";

  for (let i = 0; i < nodos.length; i++) {
    const nodo = nodos[i];
    const entidad = nodo.getEntidad();
    const fila = document.createElement("tr");
    anadirCeldaDeTexto(fila, entidad.getNombre());
    anadirCeldaDeTexto(fila, nombreDelTipoDeEntidad(entidad.getTipo()));
    anadirCeldaDeTexto(fila, String(nodo.getNivel()));
    anadirCeldaDeTexto(fila, nodo.getRelevancia().toFixed(3));
    anadirCeldaDeTexto(fila, nodo.getCentralidad().toFixed(3));
    cuerpoDeLaTabla.appendChild(fila);
  }
}

/**
 * Tabla de relaciones, de más a menos relevante. El tipo lleva un cuadradito de su color.
 *
 * @param {Relacion[]} relaciones
 */
function mostrarTablaDeRelaciones(relaciones) {
  relaciones.sort(compararRelacionesPorRelevancia);
  const cuerpoDeLaTabla = document.getElementById("cuerpoTablaRelaciones");
  cuerpoDeLaTabla.innerHTML = "";

  for (let i = 0; i < relaciones.length; i++) {
    const relacion = relaciones[i];
    const fila = document.createElement("tr");
    anadirCeldaDeTexto(fila, relacion.getOrigen().getNombre());
    fila.appendChild(crearCeldaDeTipo(relacion.getTipo()));
    anadirCeldaDeTexto(fila, relacion.getDestino().getNombre());
    anadirCeldaDeTexto(fila, relacion.getRelevancia().toFixed(3));
    cuerpoDeLaTabla.appendChild(fila);
  }
}

/**
 * Celda con un cuadradito del color del tipo y su nombre.
 *
 * @param {TipoRelacion} tipo
 * @returns {HTMLTableCellElement}
 */
function crearCeldaDeTipo(tipo) {
  const celda = document.createElement("td");
  const cuadradito = document.createElement("span");
  cuadradito.className = "muestra-color";
  cuadradito.style.backgroundColor = tipo.getColor();
  celda.appendChild(cuadradito);
  celda.appendChild(document.createTextNode(tipo.getNombre()));
  return celda;
}

/**
 * Añade a la fila una celda con texto. Usamos textContent (y no innerHTML)
 * para que un nombre con símbolos raros nunca se interprete como HTML.
 *
 * @param {HTMLTableRowElement} fila
 * @param {string} texto
 */
function anadirCeldaDeTexto(fila, texto) {
  const celda = document.createElement("td");
  celda.textContent = texto;
  fila.appendChild(celda);
}

/**
 * Para ordenar de mayor a menor relevancia: si b es más relevante que a,
 * el resultado es positivo y b va antes.
 */
function compararNodosPorRelevancia(nodoA, nodoB) {
  return nodoB.getRelevancia() - nodoA.getRelevancia();
}

/**
 * Igual que compararNodosPorRelevancia, pero para relaciones.
 */
function compararRelacionesPorRelevancia(relacionA, relacionB) {
  return relacionB.getRelevancia() - relacionA.getRelevancia();
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
  aviso.textContent = "Error: " + mensaje;
  aviso.hidden = false;
}

function ocultarError() {
  const aviso = document.getElementById("avisoError");
  aviso.textContent = "";
  aviso.hidden = true;
}

document.addEventListener("DOMContentLoaded", iniciarPagina);
