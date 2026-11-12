import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * Leyenda extends ComponenteUI
 *
 * Explica qué significa lo que se ve en la escena 3D y, desde el incremento
 * 3, sirve también de FILTRO: cada tipo tiene una casilla para mostrarlo u
 * ocultarlo. Muestra SOLO los tipos presentes en el grafo actual, con
 * cuántos hay de cada uno:
 *  - los tipos de nodo, con un símbolo de su forma y su color;
 *  - los tipos de relación, con una línea de su color, de más a menos
 *    frecuentes (a igualdad, por nombre), y los botones «Todas» y «Ninguna»;
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
 * (casillas con su etiqueta, usables con el teclado).
 */
export class Leyenda extends ComponenteUI {
  // Orden fijo en el que se muestran los tipos de nodo.
  static ORDEN_TIPOS_NODO = [TipoEntidad.PERSONA, TipoEntidad.ORGANIZACION, TipoEntidad.OBRA_DE_ARTE];

  #nodos;
  #relaciones;
  #tipos;
  #botonPlegar;

  /**
   * @param {ControladorExploracion|null} controlador - recibe los cambios de
   *   las casillas (con null la leyenda solo informa).
   */
  constructor(controlador) {
    super(controlador, "aside", "leyenda");
    this._elemento.setAttribute("aria-label", "Leyenda y filtros");
    this.#nodos = null;
    this.#relaciones = null;
    this.#tipos = new Map();
    this.#botonPlegar = null;

    // Un solo escuchador para todas las casillas (las casillas se crean y
    // se borran en cada actualizar, pero el elemento de la leyenda no).
    // El navegador llama a la función desde fuera de la clase, y dentro de
    // una función normal "this" ya no es la leyenda; por eso la guardamos antes.
    const leyenda = this;
    this._elemento.addEventListener("change", function (evento) {
      leyenda.#onCambio(evento);
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
    // Las casillas se vuelven a crear. Si el usuario estaba usando una con
    // el teclado, se le devuelve el foco a la nueva; si no, el foco se
    // perdería cada vez que marca una casilla (RNF-25).
    const casillaConFoco = this.#casillaConFoco();
    this.#actualizarNodos(datos.nodos);
    this.#actualizarRelaciones(datos.relaciones);
    this.#devolverFoco(casillaConFoco);
  }

  /**
   * (Privado) Grupo y valor de la casilla de la leyenda que tiene el foco.
   *
   * @returns {Object|null} { grupo, valor }, o null si el foco está en otro sitio.
   */
  #casillaConFoco() {
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
   * (Privado) Pone el foco en la casilla nueva del mismo grupo y valor.
   *
   * @param {Object|null} casilla - { grupo, valor }
   */
  #devolverFoco(casilla) {
    if (casilla === null) {
      return;
    }
    // CSS.escape evita problemas si el id del tipo tiene caracteres especiales.
    const selector = "input[data-grupo=\"" + CSS.escape(casilla.grupo) + "\"][data-valor=\"" + CSS.escape(casilla.valor) + "\"]";
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

    presentes.sort(Leyenda.#compararRelaciones);
    for (let i = 0; i < presentes.length; i++) {
      const tipo = presentes[i].tipo;
      // Se guarda el tipo por su id: al marcar una casilla solo se sabe su
      // id (data-valor), y así se recupera el objeto TipoRelacion.
      this.#tipos.set(tipo.getId(), tipo);

      const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
      linea.style.backgroundColor = tipo.getColor();
      const activo = Leyenda.#leerActivo(presentes[i]);
      let seVe = true;
      if (activo && typeof presentes[i].visibles === "number" && presentes[i].visibles === 0) {
        seVe = false;
      }
      this.#relaciones.appendChild(this.#elemento("relacion", tipo.getId(), linea, tipo.getNombre(), presentes[i].cantidad, activo, seVe));
    }
  }

  /**
   * (Privado) Un elemento de la lista: una casilla dentro de su etiqueta
   * (<label>), con el símbolo, el nombre y la cantidad. Al estar la casilla
   * dentro del <label>, hacer clic en el nombre también la marca, y los
   * lectores de pantalla leen el nombre al llegar a la casilla (RNF-25).
   *
   * @param {string} grupo - "nodo" o "relacion".
   * @param {string} valor - el tipo de entidad o el id del tipo de relación.
   * @param {HTMLElement} simbolo
   * @param {string} nombre
   * @param {number} cantidad
   * @param {boolean} activo - si la casilla está marcada.
   * @param {boolean} seVe - false si está activo pero no se ve ninguna (se atenúa).
   * @returns {HTMLElement}
   */
  #elemento(grupo, valor, simbolo, nombre, cantidad, activo, seVe) {
    const casilla = crear("input", { type: "checkbox", "data-grupo": grupo, "data-valor": valor }, []);
    casilla.checked = activo;

    const partes = [
      casilla,
      simbolo,
      crear("span", { clase: "leyenda-nombre", texto: nombre }, []),
      crear("span", { clase: "leyenda-cantidad", texto: String(cantidad) }, [])
    ];
    const etiqueta = crear("label", { clase: "leyenda-elemento" }, partes);

    let claseDelElemento = "";
    if (!seVe) {
      claseDelElemento = "leyenda-atenuado";
      etiqueta.appendChild(crear("span", { clase: "leyenda-oculta", texto: "(ocultas por los nodos)" }, []));
    }
    return crear("li", { clase: claseDelElemento }, [etiqueta]);
  }

  /**
   * (Privado) Se ha marcado o desmarcado una casilla: se avisa al controlador.
   *
   * @param {Event} evento
   */
  #onCambio(evento) {
    const casilla = evento.target;
    if (this._controlador === null || casilla.dataset === undefined) {
      return;
    }
    const grupo = casilla.dataset.grupo;
    const valor = casilla.dataset.valor;
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
