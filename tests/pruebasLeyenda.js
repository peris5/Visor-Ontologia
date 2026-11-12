import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { Leyenda } from '../src/interfaz/Leyenda.js';
import { ComponenteUI } from '../src/interfaz/ComponenteUI.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';

/*
 * Pruebas de Leyenda y ComponenteUI (src/interfaz/).
 * La leyenda se monta en un <div> que no se añade a la página.
 */

/**
 * @returns {Object} { leyenda, padre }
 */
function crearLeyendaMontada() {
  const padre = document.createElement("div");
  const leyenda = new Leyenda(null);
  leyenda.montar(padre);
  return { leyenda: leyenda, padre: padre };
}

/**
 * @param {HTMLElement} padre
 * @param {string} selector - selector CSS de la lista.
 * @returns {string[]} textos "nombre cantidad" de cada elemento de la lista.
 */
function textosDeLaLista(padre, selector) {
  // Los subtítulos de familia (li.leyenda-familia) no son elementos de la lista.
  const elementos = padre.querySelectorAll(selector + " li:not(.leyenda-familia)");
  const textos = [];
  for (let i = 0; i < elementos.length; i++) {
    const nombre = elementos[i].querySelector(".leyenda-nombre");
    const cantidad = elementos[i].querySelector(".leyenda-cantidad");
    if (nombre !== null && cantidad !== null) {
      textos.push(nombre.textContent + " " + cantidad.textContent);
    } else {
      textos.push(elementos[i].textContent);
    }
  }
  return textos;
}

prueba("Leyenda: muestra solo los tipos de nodo presentes, con su cantidad", function () {
  const l = crearLeyendaMontada();
  l.leyenda.actualizar({
    nodos: [
      { tipo: TipoEntidad.OBRA_DE_ARTE, cantidad: 4 },
      { tipo: TipoEntidad.PERSONA, cantidad: 6 }
    ],
    relaciones: []
  });
  const textos = textosDeLaLista(l.padre, ".leyenda-nodos");
  comprobarIgual(textos.length, 2, "número de tipos de nodo");
  comprobarIgual(textos[0], "Persona 6", "primer tipo");
  comprobarIgual(textos[1], "Obra de arte 4", "segundo tipo");
  comprobar(l.padre.querySelector(".simbolo-organizacion") === null, "no debe aparecer el tipo organización");
  comprobar(l.padre.querySelector(".simbolo-persona") !== null, "la persona lleva su símbolo");
});

prueba("Leyenda: relaciones de más a menos frecuentes y, a igualdad, por nombre", function () {
  const l = crearLeyendaMontada();
  const autorDe = new TipoRelacion("autor_de", "Autor de", "#4c8bf5");
  const miembroDe = new TipoRelacion("miembro_de", "Miembro de", "#f5a623");
  const conserva = new TipoRelacion("conserva", "Conserva", "#2bb673");
  const maestroDe = new TipoRelacion("maestro_de", "Maestro de", "#ff0000");
  l.leyenda.actualizar({
    nodos: [],
    relaciones: [
      { tipo: miembroDe, cantidad: 2 },
      { tipo: autorDe, cantidad: 5 },
      { tipo: maestroDe, cantidad: 0 },
      { tipo: conserva, cantidad: 2 }
    ]
  });
  const textos = textosDeLaLista(l.padre, ".leyenda-relaciones");
  comprobarIgual(textos.length, 3, "número de tipos de relación (sin los de cantidad 0)");
  comprobarIgual(textos[0], "Autor de 5", "primero, el más frecuente");
  comprobarIgual(textos[1], "Conserva 2", "empate: por nombre");
  comprobarIgual(textos[2], "Miembro de 2", "empate: por nombre");
  const linea = l.padre.querySelector(".leyenda-relaciones .simbolo-relacion");
  comprobarIgual(linea.style.backgroundColor, "rgb(76, 139, 245)", "la línea lleva el color del tipo");
});

prueba("Leyenda: mensaje cuando no hay relaciones", function () {
  const l = crearLeyendaMontada();
  l.leyenda.actualizar({ nodos: [{ tipo: TipoEntidad.PERSONA, cantidad: 1 }], relaciones: [] });
  const textos = textosDeLaLista(l.padre, ".leyenda-relaciones");
  comprobarIgual(textos.length, 1, "un solo elemento");
  comprobarIgual(textos[0], "No hay relaciones en el grafo.", "mensaje");
});

prueba("Leyenda: al actualizar se sustituye el contenido anterior", function () {
  const l = crearLeyendaMontada();
  l.leyenda.actualizar({ nodos: [{ tipo: TipoEntidad.PERSONA, cantidad: 3 }], relaciones: [] });
  l.leyenda.actualizar({ nodos: [{ tipo: TipoEntidad.ORGANIZACION, cantidad: 1 }], relaciones: [] });
  const textos = textosDeLaLista(l.padre, ".leyenda-nodos");
  comprobarIgual(textos.length, 1, "número de tipos de nodo");
  comprobarIgual(textos[0], "Organización 1", "solo el tipo nuevo");
});

prueba("Leyenda: explica el tamaño y la distancia", function () {
  const l = crearLeyendaMontada();
  const texto = l.padre.textContent;
  comprobar(texto.includes("Menos conectado") && texto.includes("Más conectado"), "falta la explicación del tamaño");
  comprobar(texto.includes("La distancia al nodo central indica la relevancia"), "falta la explicación de la distancia");
});

prueba("ComponenteUI: es abstracta y mostrar/ocultar cambian la visibilidad", function () {
  let huboError = false;
  try {
    new ComponenteUI(null, "div", "x");
  } catch (error) {
    huboError = true;
  }
  comprobar(huboError, "new ComponenteUI(...) debería lanzar un error");

  const l = crearLeyendaMontada();
  const elemento = l.padre.firstChild;
  l.leyenda.ocultar();
  comprobarIgual(elemento.hidden, true, "tras ocultar()");
  l.leyenda.mostrar();
  comprobarIgual(elemento.hidden, false, "tras mostrar()");
});

/*
 * Leyenda interactiva: cada tipo es una etiqueta pulsable (un botón con
 * aria-pressed) que hace de filtro.
 * Estas pruebas montan la leyenda dentro de la página (y la quitan al
 * terminar) para que los clics en los tipos funcionen como en la página real.
 */

/**
 * Doble de ControladorExploracion: apunta las llamadas de la leyenda.
 */
class ControladorFalsoLeyenda {
  constructor() {
    this.llamadas = [];
  }

  alternarFiltroNodo(tipo) {
    this.llamadas.push("nodo:" + tipo);
  }

  alternarFiltroRelacion(tipo) {
    this.llamadas.push("relacion:" + tipo.getId());
    this.ultimoTipo = tipo;
  }

  mostrarTodasLasRelaciones(visible) {
    this.llamadas.push("todas:" + visible);
  }
}

/**
 * @param {Object} controlador
 * @returns {Object} { leyenda, padre, autorDe, conserva }
 */
function crearLeyendaInteractiva(controlador) {
  const padre = document.createElement("div");
  document.body.appendChild(padre);
  const leyenda = new Leyenda(controlador);
  leyenda.montar(padre);
  const autorDe = new TipoRelacion("autor_de", "Autor de", "#4c8bf5");
  const conserva = new TipoRelacion("conserva", "Conserva", "#2bb673");
  leyenda.actualizar({
    nodos: [
      { tipo: TipoEntidad.PERSONA, cantidad: 3, activo: true },
      { tipo: TipoEntidad.OBRA_DE_ARTE, cantidad: 2, activo: false }
    ],
    relaciones: [
      { tipo: autorDe, cantidad: 4, activo: true, visibles: 4 },
      { tipo: conserva, cantidad: 1, activo: true, visibles: 0 }
    ]
  });
  return { leyenda: leyenda, padre: padre, autorDe: autorDe, conserva: conserva };
}

/**
 * @param {HTMLElement} padre
 * @param {string} grupo
 * @param {string} valor
 * @returns {HTMLInputElement}
 */
function buscarTipo(padre, grupo, valor) {
  return padre.querySelector("button[data-grupo=\"" + grupo + "\"][data-valor=\"" + valor + "\"]");
}

prueba("Leyenda: una etiqueta pulsable por tipo, sin casillas, con su estado en aria-pressed", function () {
  const l = crearLeyendaInteractiva(new ControladorFalsoLeyenda());
  try {
    comprobarIgual(l.padre.querySelectorAll("input[type=checkbox]").length, 0, "no hay casillas");
    comprobarIgual(l.padre.querySelectorAll("button[data-grupo]").length, 4, "2 tipos de nodo y 2 de relación");
    comprobarIgual(buscarTipo(l.padre, "nodo", TipoEntidad.PERSONA).getAttribute("aria-pressed"), "true", "persona activa");
    comprobarIgual(buscarTipo(l.padre, "nodo", TipoEntidad.OBRA_DE_ARTE).getAttribute("aria-pressed"), "false", "obra oculta");
    comprobarIgual(buscarTipo(l.padre, "relacion", "autor_de").getAttribute("aria-pressed"), "true", "autor_de activo");
    comprobar(buscarTipo(l.padre, "relacion", "autor_de").textContent.includes("Autor de"), "la etiqueta lleva el nombre");
  } finally {
    l.padre.remove();
  }
});

prueba("Leyenda: pulsar un tipo (también en su nombre) llama al controlador con el tipo correcto", function () {
  const controlador = new ControladorFalsoLeyenda();
  const l = crearLeyendaInteractiva(controlador);
  try {
    buscarTipo(l.padre, "nodo", TipoEntidad.OBRA_DE_ARTE).click();
    // Un clic en el nombre (dentro del botón) también cuenta.
    buscarTipo(l.padre, "relacion", "conserva").querySelector(".leyenda-nombre").click();
    comprobarIgual(controlador.llamadas.join(","), "nodo:OBRA_DE_ARTE,relacion:conserva", "llamadas");
    comprobar(controlador.ultimoTipo === l.conserva, "se pasa el mismo objeto TipoRelacion");
  } finally {
    l.padre.remove();
  }
});

prueba("Leyenda: los botones «Todas» y «Ninguna»", function () {
  const controlador = new ControladorFalsoLeyenda();
  const l = crearLeyendaInteractiva(controlador);
  try {
    const botones = l.padre.querySelectorAll(".leyenda-botones button");
    comprobarIgual(botones[0].textContent, "Todas", "primer botón");
    comprobarIgual(botones[1].textContent, "Ninguna", "segundo botón");
    botones[1].click();
    botones[0].click();
    comprobarIgual(controlador.llamadas.join(","), "todas:false,todas:true", "llamadas");
  } finally {
    l.padre.remove();
  }
});

prueba("Leyenda: un tipo activo sin relaciones visibles sale atenuado", function () {
  const l = crearLeyendaInteractiva(new ControladorFalsoLeyenda());
  try {
    const conserva = buscarTipo(l.padre, "relacion", "conserva").closest("li");
    const autorDe = buscarTipo(l.padre, "relacion", "autor_de").closest("li");
    comprobar(conserva.classList.contains("leyenda-atenuado"), "conserva atenuado");
    comprobar(conserva.textContent.includes("(ocultas por los nodos)"), "con la nota");
    comprobar(!autorDe.classList.contains("leyenda-atenuado"), "autor_de no");
  } finally {
    l.padre.remove();
  }
});

prueba("Leyenda: el foco del teclado sigue en el tipo tras actualizar", function () {
  const l = crearLeyendaInteractiva(new ControladorFalsoLeyenda());
  try {
    buscarTipo(l.padre, "relacion", "autor_de").focus();
    l.leyenda.actualizar({
      nodos: [{ tipo: TipoEntidad.PERSONA, cantidad: 3, activo: true }],
      relaciones: [{ tipo: l.autorDe, cantidad: 4, activo: false, visibles: 0 }]
    });
    comprobar(document.activeElement === buscarTipo(l.padre, "relacion", "autor_de"), "foco en el botón nuevo");
  } finally {
    l.padre.remove();
  }
});

prueba("Leyenda: las relaciones se agrupan por familia, con un subtítulo cada una", function () {
  const l = crearLeyendaMontada();
  const matrimonio = new TipoRelacion("Marriage", "Matrimonio", "#ff0000", ["Related", "Relationship"], "Parentesco");
  const filiacion = new TipoRelacion("Filiation", "Filiación", "#00ff00", ["Related", "Relationship"], "Parentesco");
  const mentoria = new TipoRelacion("Mentorship", "Mentoría", "#0000ff", ["Relationship"], "Mentoría");
  const pintura = new TipoRelacion("Paint", "Pintura", "#ffff00", ["Creation", "Event"], "Creación");
  l.leyenda.actualizar({
    nodos: [],
    relaciones: [
      { tipo: mentoria, cantidad: 2, activo: true, visibles: 2 },
      { tipo: matrimonio, cantidad: 3, activo: true, visibles: 3 },
      { tipo: pintura, cantidad: 9, activo: true, visibles: 9 },
      { tipo: filiacion, cantidad: 4, activo: true, visibles: 4 }
    ]
  });
  const filas = l.padre.querySelectorAll(".leyenda-relaciones li");
  const textos = [];
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].classList.contains("leyenda-familia")) {
      textos.push("## " + filas[i].textContent);
    } else {
      textos.push(filas[i].querySelector(".leyenda-nombre").textContent);
    }
  }
  // Creación (9) > Parentesco (3 + 4 = 7) > Mentoría (2); dentro de Parentesco, Filiación (4) antes que Matrimonio (3).
  comprobarIgual(textos.join(" | "), "## Creación | Pintura | ## Parentesco | Filiación | Matrimonio | ## Mentoría | Mentoría",
    "orden de familias y tipos");
  comprobarIgual(l.padre.querySelectorAll("button[data-grupo=relacion]").length, 4, "una etiqueta por tipo, no por familia");
});
