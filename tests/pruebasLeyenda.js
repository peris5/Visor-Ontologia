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
  const elementos = padre.querySelectorAll(selector + " li");
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
