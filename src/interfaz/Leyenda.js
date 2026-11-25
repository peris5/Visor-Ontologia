import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * Explica qué significa lo que se ve en la escena 3D y sirve también de
 * FILTRO: se pulsa cada tipo para mostrarlo u ocultarlo (los ocultos salen
 * apagados y tachados). Muestra SOLO los tipos presentes en el grafo
 * actual, con cuántos hay de cada uno:
 *  - los tipos de nodo, con un símbolo de su forma y su color;
 *  - los tipos de relación, con una línea de su color, AGRUPADOS POR FAMILIA
 *    (Parentesco, Relación profesional...), de más a menos frecuentes (a
 *    igualdad, por nombre), y los botones «Todas» y «Ninguna»;
 *  - el ORIGEN de la relevancia: relación declarada (línea continua), solo
 *    coincidencias en eventos (línea discontinua) y deducido (nodo
 *    semitransparente), con la casilla «Mostrar deducidos» (no pide nada al
 *    servidor);
 *  - qué significan el tamaño y la distancia al centro.
 *
 * Si un tipo de relación está activo pero no se ve ninguna de sus
 * relaciones (porque se han ocultado sus nodos), sale atenuado y con la
 * nota «(ocultas por los nodos)».
 *
 * En pantallas estrechas (menos de 700 px) se pliega tras un botón «Leyenda».
 */
export class Leyenda extends ComponenteUI {
  // Orden fijo en el que se muestran los tipos de nodo.
  static ORDEN_TIPOS_NODO = [TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION, TipoEntidad.OBRA_DE_ARTE];

  #nodos;
  #relaciones;
  #tipos;
  #botonPlegar;
  #casillaDeducidos;

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
    this.#casillaDeducidos = null;

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
      crear("h3", { texto: "Origen" }, []),
      this.#crearExplicacionOrigen(),
      this.#crearCasillaDeducidos(),
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
   *     relaciones: [{ tipo: TipoRelacion, cantidad, activo, visibles }],
   *     mostrarDeducidos: si la casilla «Mostrar deducidos» está marcada (opcional)
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
    // foco se perdería cada vez que pulsa un tipo.
    const tipoConFoco = this.#tipoConFoco();
    this.#actualizarNodos(datos.nodos);
    this.#actualizarRelaciones(datos.relaciones);
    if (typeof datos.mostrarDeducidos === "boolean") {
      this.#casillaDeducidos.checked = datos.mostrarDeducidos;
    }
    this.#devolverFoco(tipoConFoco);
  }

  /**
   * @returns {boolean} si la casilla «Mostrar deducidos» está marcada.
   */
  getMostrarDeducidos() {
    if (this.#casillaDeducidos === null) {
      return true;
    }
    return this.#casillaDeducidos.checked;
  }

  /**
   * Grupo y valor del tipo de la leyenda que tiene el foco.
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
   * Pone el foco en el botón nuevo del mismo grupo y valor.
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
   * Lista de tipos de nodo presentes, en el orden fijo.
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
   * Lista de tipos de relación presentes, de más a menos frecuentes.
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
   * Un tipo de relación de la leyenda.
   *
   * @param {Object} dato - { tipo, cantidad, activo, visibles }
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
   * Agrupa los tipos de relación por su familia
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
   * Para ordenar familias de más a menos relaciones y, a igualdad, por nombre.
   *
   * @param {Object} a - { nombre, cantidad }
   * @param {Object} b - { nombre, cantidad }
   */
  static #compararFamilias(a, b) {
    if (a.cantidad !== b.cantidad) {
      return b.cantidad - a.cantidad;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  }

  /**
   * Un elemento de la lista: una etiqueta pulsable con el
   * símbolo, el nombre y la cantidad. Es un <button> con aria-pressed (true
   * si el tipo se ve): así se usa con el teclado (Tab, Intro o espacio) y
   * los lectores de pantalla dicen si está activado. Los tipos
   * ocultos se ven apagados y tachados (CSS).
   *
   * @param {string} grupo - "nodo" o "relacion".
   * @param {string} valor - el tipo de entidad o el id del tipo de relación.
   * @param {boolean} activo - si el tipo se muestra.
   * @param {boolean} seVe - false si está activo pero no se ve ninguna (se atenúa).
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
   * Se ha pulsado un tipo: se avisa al controlador. El clic
   * puede caer en el símbolo o en el nombre, que están dentro del botón:
   * closest busca el botón del tipo que los contiene.
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

  /** Los botones «Todas» y «Ninguna» de las relaciones. */
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
   * Las tres muestras del origen de la relevancia. No dependen solo del
   * color (RNF-26): una línea continua, una discontinua y un nodo
   * semitransparente, cada una con su texto.
   */
  #crearExplicacionOrigen() {
    return crear("ul", { clase: "leyenda-lista leyenda-origen" }, [
      crear("li", {}, [
        crear("span", { clase: "simbolo-origen simbolo-continua", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Relación declarada" }, [])
      ]),
      crear("li", {}, [
        crear("span", { clase: "simbolo-origen simbolo-discontinua", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Solo coincidencias en eventos" }, [])
      ]),
      crear("li", {}, [
        crear("span", { clase: "simbolo-origen simbolo-deducido", "aria-hidden": "true" }, []),
        crear("span", { clase: "leyenda-nombre", texto: "Deducido (a dos saltos)" }, [])
      ])
    ]);
  }

  /**
   * La casilla «Mostrar deducidos». Al cambiarla se avisa al controlador,
   * que recalcula el subgrafo con lo que ya tiene (sin peticiones).
   */
  #crearCasillaDeducidos() {
    this.#casillaDeducidos = crear("input", { type: "checkbox", id: "casillaDeducidos" }, []);
    this.#casillaDeducidos.checked = true;
    const leyenda = this;
    this.#casillaDeducidos.addEventListener("change", function () {
      if (leyenda._controlador !== null) {
        leyenda._controlador.alternarDeducidos(leyenda.#casillaDeducidos.checked);
      }
    });
    return crear("label", { clase: "leyenda-casilla", for: "casillaDeducidos" }, [
      this.#casillaDeducidos,
      crear("span", { texto: "Mostrar deducidos" }, [])
    ]);
  }

  /** Pliega o despliega la leyenda (solo se nota en pantallas estrechas). */
  #alternarPlegado() {
    const estaAbierta = this._elemento.classList.toggle("leyenda-abierta");
    this.#botonPlegar.setAttribute("aria-expanded", String(estaAbierta));
  }

  /** Un círculo pequeño y uno grande para explicar el tamaño. */
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

  /** El campo "activo" de un dato de la leyenda; si no viene, true. */
  static #leerActivo(dato) {
    if (dato.activo === false) {
      return false;
    }
    return true;
  }

  /**
   * Para ordenar de más a menos frecuente y, a igualdad, por nombre.
   *
   * @param {Object} a - { tipo, cantidad }
   * @param {Object} b - { tipo, cantidad }
   */
  static #compararRelaciones(a, b) {
    if (a.cantidad !== b.cantidad) {
      return b.cantidad - a.cantidad;
    }
    return a.tipo.getNombre().localeCompare(b.tipo.getNombre(), "es");
  }
}
