import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * Leyenda extends ComponenteUI
 *
 * Explica qué significa lo que se ve en la escena 3D y, desde el incremento
 * 3, sirve también de FILTRO: se pulsa cada tipo para mostrarlo u
 * ocultarlo (los ocultos salen apagados y tachados). Muestra SOLO los tipos presentes en el grafo actual, con
 * cuántos hay de cada uno:
 *  - los tipos de nodo, con un símbolo de su forma y su color;
 *  - los tipos de relación, con una línea de su color, AGRUPADOS POR FAMILIA
 *    (Parentesco, Relación profesional...), de más a menos frecuentes (a
 *    igualdad, por nombre), y los botones «Todas» y «Ninguna»;
 *  - qué significan el tamaño y la distancia al centro.
 *
 * Si un tipo de relación está activo pero no se ve ninguna de sus
 * relaciones (porque se han ocultado sus nodos), sale atenuado y con la
 * nota «(ocultas por los nodos)».
 *
 * En pantallas estrechas (menos de 700 px) se pliega tras un botón «Leyenda».
 *
 * Requisitos: RF-23 (leyenda de nodos y relaciones), RF-24 (solo lo
 * presente), RF-32 y RF-33 (filtros), RNF-09 (pantallas pequeñas), RNF-25
 * (cada tipo es un botón con aria-pressed: se usa con el teclado y los
 * lectores de pantalla dicen si está activado o no).
 */
export class Leyenda extends ComponenteUI {
  // Orden fijo en el que se muestran los tipos de nodo.
  static ORDEN_TIPOS_NODO = [TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION, TipoEntidad.OBRA_DE_ARTE];

  #nodos;
  #relaciones;
  #tipos;
  #botonPlegar;

  /**
   * @param {ControladorExploracion|null} controlador - recibe los tipos que
   *   se pulsan (con null la leyenda solo informa).
   */
  constructor(controlador) {
    super(controlador, "aside", "leyenda");
    this._elemento.setAttribute("aria-label", "Leyenda y filtros");
    this.#nodos = null;
    this.#relaciones = null;
    this.#tipos = new Map();
    this.#botonPlegar = null;

    // Un solo escuchador para todos los tipos (sus botones se crean y se
    // borran en cada actualizar, pero el elemento de la leyenda no).
    // El navegador llama a la función desde fuera de la clase, y dentro de
    // una función normal "this" ya no es la leyenda; por eso la guardamos antes.
    const leyenda = this;
    this._elemento.addEventListener("click", function (evento) {
      leyenda.#onPulsar(evento);
    });
  }

  /**
   * Dibuja la estructura fija de la leyenda (títulos, botones, tamaño y
   * explicación). Las listas de tipos se rellenan con actualizar().
   */
  renderizar() {
    this._elemento.textContent = "";
    this.#nodos = crear("ul", { clase: "leyenda-lista leyenda-nodos" }, []);
    this.#relaciones = crear("ul", { clase: "leyenda-lista leyenda-relaciones" }, []);

    // Botón para plegar o desplegar la leyenda en pantallas estrechas (el
    // CSS solo lo muestra con menos de 700 px de ancho).
    this.#botonPlegar = crear("button", {
      type: "button",
      clase: "boton-plegar-leyenda",
      "aria-expanded": "false",
      "aria-controls": "contenidoLeyenda",
      texto: "Leyenda"
    }, []);
    const leyenda = this;
    this.#botonPlegar.addEventListener("click", function () {
      leyenda.#alternarPlegado();
    });

    const contenido = crear("div", { id: "contenidoLeyenda", clase: "leyenda-contenido" }, [
      crear("h2", { clase: "leyenda-titulo", texto: "Leyenda" }, []),
      crear("h3", { texto: "Entidades" }, []),
      this.#nodos,
      crear("h3", { texto: "Relaciones" }, []),
      this.#crearBotonesTodasNinguna(),
      this.#relaciones,
      crear("h3", { texto: "Tamaño" }, []),
      this.#crearExplicacionTamano(),
      crear("p", {
        clase: "leyenda-nota",
        texto: "La distancia al nodo central indica la relevancia: cuanto más cerca, más relevante. El tamaño indica la centralidad."
      }, [])
    ]);
    this._elemento.appendChild(this.#botonPlegar);
    this._elemento.appendChild(contenido);
  }

  /**
   * Rellena la leyenda con los tipos del grafo actual.
   *
   * @param {Object} datos - {
   *     nodos:      [{ tipo: TipoEntidad, cantidad, activo }],
   *     relaciones: [{ tipo: TipoRelacion, cantidad, activo, visibles }]
   *   }
   *   Si falta "activo", se considera activo; si falta "visibles", se
   *   considera que se ven todas.
   */
  actualizar(datos) {
    if (this.#nodos === null) {
      this.renderizar();
    }
    // Los botones de los tipos se vuelven a crear. Si el usuario estaba
    // usando uno con el teclado, se le devuelve el foco al nuevo; si no, el
    // foco se perdería cada vez que pulsa un tipo (RNF-25).
    const tipoConFoco = this.#tipoConFoco();
    this.#actualizarNodos(datos.nodos);
    this.#actualizarRelaciones(datos.relaciones);
    this.#devolverFoco(tipoConFoco);
  }

  /**
   * (Privado) Grupo y valor del tipo de la leyenda que tiene el foco.
   *
   * @returns {Object|null} { grupo, valor }, o null si el foco está en otro sitio.
   */
  #tipoConFoco() {
    const elementoConFoco = document.activeElement;
    if (elementoConFoco === null || !this._elemento.contains(elementoConFoco)) {
      return null;
    }
    if (elementoConFoco.dataset === undefined || elementoConFoco.dataset.grupo === undefined) {
      return null;
    }
    return { grupo: elementoConFoco.dataset.grupo, valor: elementoConFoco.dataset.valor };
  }

  /**
   * (Privado) Pone el foco en el botón nuevo del mismo grupo y valor.
   *
   * @param {Object|null} tipo - { grupo, valor }
   */
  #devolverFoco(tipo) {
    if (tipo === null) {
      return;
    }
    // CSS.escape evita problemas si el id del tipo tiene caracteres especiales.
    const selector = "button[data-grupo=\"" + CSS.escape(tipo.grupo) + "\"][data-valor=\"" + CSS.escape(tipo.valor) + "\"]";
    const nueva = this._elemento.querySelector(selector);
    if (nueva !== null) {
      nueva.focus();
    }
  }

  /**
   * (Privado) Lista de tipos de nodo presentes, en el orden fijo.
   *
   * @param {Object[]} nodos - [{ tipo, cantidad, activo }]
   */
  #actualizarNodos(nodos) {
    this.#nodos.textContent = "";
    for (let t = 0; t < Leyenda.ORDEN_TIPOS_NODO.length; t++) {
      const tipo = Leyenda.ORDEN_TIPOS_NODO[t];
      for (let i = 0; i < nodos.length; i++) {
        if (nodos[i].tipo === tipo && nodos[i].cantidad > 0) {
          const simbolo = ComponenteUI._crearSimboloEntidad(tipo);
          const activo = Leyenda.#leerActivo(nodos[i]);
          const nombre = ComponenteUI._nombreTipoEntidad(tipo);
          this.#nodos.appendChild(this.#elemento("nodo", tipo, simbolo, nombre, nodos[i].cantidad, activo, true));
        }
      }
    }
  }

  /**
   * (Privado) Lista de tipos de relación presentes, de más a menos frecuentes.
   *
   * @param {Object[]} relaciones - [{ tipo: TipoRelacion, cantidad, activo, visibles }]
   */
  #actualizarRelaciones(relaciones) {
    this.#relaciones.textContent = "";
    this.#tipos = new Map();
    const presentes = [];
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].cantidad > 0) {
        presentes.push(relaciones[i]);
      }
    }
    if (presentes.length === 0) {
      this.#relaciones.appendChild(crear("li", { clase: "leyenda-vacia", texto: "No hay relaciones en el grafo." }, []));
      return;
    }

    // Se agrupan por familia (Parentesco, Relación profesional, Creación...):
    // un subtítulo por familia, de la más frecuente a la menos (a igualdad,
    // por nombre), y dentro de cada una los tipos como antes.
    const familias = Leyenda.#agruparPorFamilia(presentes);
    for (let f = 0; f < familias.length; f++) {
      const familia = familias[f];
      this.#relaciones.appendChild(crear("li", { clase: "leyenda-familia", role: "presentation" }, [
        crear("span", { texto: familia.nombre }, [])
      ]));
      familia.elementos.sort(Leyenda.#compararRelaciones);
      for (let i = 0; i < familia.elementos.length; i++) {
        this.#relaciones.appendChild(this.#elementoDeRelacion(familia.elementos[i]));
      }
    }
  }

  /**
   * (Privado) Un tipo de relación de la leyenda.
   *
   * @param {Object} dato - { tipo, cantidad, activo, visibles }
   * @returns {HTMLElement}
   */
  #elementoDeRelacion(dato) {
    const tipo = dato.tipo;
    // Se guarda el tipo por su id: al pulsar un tipo solo se sabe su
    // id (data-valor), y así se recupera el objeto TipoRelacion.
    this.#tipos.set(tipo.getId(), tipo);

    const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
    linea.style.backgroundColor = tipo.getColor();
    const activo = Leyenda.#leerActivo(dato);
    let seVe = true;
    if (activo && typeof dato.visibles === "number" && dato.visibles === 0) {
      seVe = false;
    }
    return this.#elemento("relacion", tipo.getId(), linea, tipo.getNombre(), dato.cantidad, activo, seVe);
  }

  /**
   * (Privado) Agrupa los tipos de relación por su familia
   * (TipoRelacion.getFamilia) y ordena las familias.
   *
   * @param {Object[]} presentes - [{ tipo, cantidad, ... }]
   * @returns {Object[]} [{ id, nombre, cantidad, elementos: [...] }]
   */
  static #agruparPorFamilia(presentes) {
    const porId = new Map();
    for (let i = 0; i < presentes.length; i++) {
      const tipo = presentes[i].tipo;
      const idFamilia = tipo.getFamilia();
      if (!porId.has(idFamilia)) {
        porId.set(idFamilia, { id: idFamilia, nombre: tipo.getNombreFamilia(), cantidad: 0, elementos: [] });
      }
      const familia = porId.get(idFamilia);
      familia.cantidad = familia.cantidad + presentes[i].cantidad;
      familia.elementos.push(presentes[i]);
    }
    const familias = [];
    for (const familia of porId.values()) {
      familias.push(familia);
    }
    familias.sort(Leyenda.#compararFamilias);
    return familias;
  }

  /**
   * (Privado) Para ordenar familias de más a menos relaciones y, a igualdad, por nombre.
   *
   * @param {Object} a - { nombre, cantidad }
   * @param {Object} b - { nombre, cantidad }
   * @returns {number}
   */
  static #compararFamilias(a, b) {
    if (a.cantidad !== b.cantidad) {
      return b.cantidad - a.cantidad;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  }

  /**
   * (Privado) Un elemento de la lista: una etiqueta pulsable con el
   * símbolo, el nombre y la cantidad. Es un <button> con aria-pressed (true
   * si el tipo se ve): así se usa con el teclado (Tab, Intro o espacio) y
   * los lectores de pantalla dicen si está activado (RNF-25). Los tipos
   * ocultos se ven apagados y tachados (CSS).
   *
   * @param {string} grupo - "nodo" o "relacion".
   * @param {string} valor - el tipo de entidad o el id del tipo de relación.
   * @param {HTMLElement} simbolo
   * @param {string} nombre
   * @param {number} cantidad
   * @param {boolean} activo - si el tipo se muestra.
   * @param {boolean} seVe - false si está activo pero no se ve ninguna (se atenúa).
   * @returns {HTMLElement}
   */
  #elemento(grupo, valor, simbolo, nombre, cantidad, activo, seVe) {
    const partes = [
      simbolo,
      crear("span", { clase: "leyenda-nombre", texto: nombre }, []),
      crear("span", { clase: "leyenda-cantidad", texto: String(cantidad) }, [])
    ];
    const etiqueta = crear("button", {
      type: "button",
      clase: "leyenda-elemento",
      "data-grupo": grupo,
      "data-valor": valor,
      "aria-pressed": String(activo),
      title: "Mostrar u ocultar: " + nombre
    }, partes);

    let claseDelElemento = "";
    if (!seVe) {
      claseDelElemento = "leyenda-atenuado";
      etiqueta.appendChild(crear("span", { clase: "leyenda-oculta", texto: "(ocultas por los nodos)" }, []));
    }
    return crear("li", { clase: claseDelElemento }, [etiqueta]);
  }

  /**
   * (Privado) Se ha pulsado un tipo: se avisa al controlador. El clic
   * puede caer en el símbolo o en el nombre, que están dentro del botón:
   * closest busca el botón del tipo que los contiene.
   *
   * @param {Event} evento
   */
  #onPulsar(evento) {
    if (this._controlador === null || typeof evento.target.closest !== "function") {
      return;
    }
    const boton = evento.target.closest("button[data-grupo]");
    if (boton === null) {
      return;
    }
    const grupo = boton.dataset.grupo;
    const valor = boton.dataset.valor;
    if (grupo === "nodo") {
      this._controlador.alternarFiltroNodo(valor);
    } else if (grupo === "relacion" && this.#tipos.has(valor)) {
      this._controlador.alternarFiltroRelacion(this.#tipos.get(valor));
    }
  }

  /**
   * (Privado) Los botones «Todas» y «Ninguna» de las relaciones.
   *
   * @returns {HTMLElement}
   */
  #crearBotonesTodasNinguna() {
    const botonTodas = crear("button", { type: "button", texto: "Todas", "aria-label": "Mostrar todas las relaciones" }, []);
    const botonNinguna = crear("button", { type: "button", texto: "Ninguna", "aria-label": "Ocultar todas las relaciones" }, []);
    const leyenda = this;
    botonTodas.addEventListener("click", function () {
      if (leyenda._controlador !== null) {
        leyenda._controlador.mostrarTodasLasRelaciones(true);
      }
    });
    botonNinguna.addEventListener("click", function () {
      if (leyenda._controlador !== null) {
        leyenda._controlador.mostrarTodasLasRelaciones(false);
      }
    });
    return crear("div", { clase: "leyenda-botones" }, [botonTodas, botonNinguna]);
  }

  /**
   * (Privado) Pliega o despliega la leyenda (solo se nota en pantallas estrechas).
   */
  #alternarPlegado() {
    const estaAbierta = this._elemento.classList.toggle("leyenda-abierta");
    this.#botonPlegar.setAttribute("aria-expanded", String(estaAbierta));
  }

  /**
   * (Privado) Un círculo pequeño y uno grande para explicar el tamaño.
   *
   * @returns {HTMLElement}
   */
  #crearExplicacionTamano() {
    return crear("ul", { clase: "leyenda-lista leyenda-tamano" }, [
      crear("li", {}, [
        crear("span", { clase: "simbolo-tamano simbolo-pequeno", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Menos conectado" }, [])
      ]),
      crear("li", {}, [
        crear("span", { clase: "simbolo-tamano simbolo-grande", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Más conectado" }, [])
      ])
    ]);
  }

  /**
   * (Privado) El campo "activo" de un dato de la leyenda; si no viene, true.
   *
   * @param {Object} dato
   * @returns {boolean}
   */
  static #leerActivo(dato) {
    if (dato.activo === false) {
      return false;
    }
    return true;
  }

  /**
   * (Privado) Para ordenar de más a menos frecuente y, a igualdad, por nombre.
   *
   * @param {Object} a - { tipo, cantidad }
   * @param {Object} b - { tipo, cantidad }
   * @returns {number}
   */
  static #compararRelaciones(a, b) {
    if (a.cantidad !== b.cantidad) {
      return b.cantidad - a.cantidad;
    }
    return a.tipo.getNombre().localeCompare(b.tipo.getNombre(), "es");
  }
}
