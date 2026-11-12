import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoEntidad } from '../modelo/TipoEntidad.js';

/**
 * PanelBusqueda extends ComponenteUI
 *
 * El buscador: un campo de texto, un desplegable para elegir el tipo y una
 * lista de sugerencias que aparece mientras se escribe.
 *
 *  - Espera 150 ms sin teclear antes de buscar: así no se busca con cada
 *    letra cuando se escribe deprisa. Como la búsqueda es local (Buscador),
 *    basta con una espera corta.
 *  - Teclado: flechas para moverse por las sugerencias, Intro para elegir
 *    (la primera si no hay ninguna marcada) y Escape para cerrar la lista.
 *  - Accesibilidad: sigue el patrón «combobox» de WAI-ARIA, que es el que
 *    los lectores de pantalla reconocen para un campo con sugerencias:
 *      · el campo tiene role="combobox", aria-expanded (si la lista está
 *        abierta), aria-controls (cuál es la lista) y aria-activedescendant
 *        (qué sugerencia está marcada, aunque el foco siga en el campo);
 *      · la lista tiene role="listbox" y cada sugerencia role="option".
 *
 * Requisitos: RF-01 (buscar por nombre), RF-02 (sugerencias), RF-03
 * (filtro por tipo), RF-06 (sin resultados), RF-07 (elegir una entidad del
 * resultado), RNF-03 (rapidez), RNF-13 (máximo 100 caracteres), RNF-25
 * (teclado y lectores de pantalla).
 */
export class PanelBusqueda extends ComponenteUI {
  static MILISEGUNDOS_ESPERA = 150;
  static ID_CAMPO = "campoBusqueda";
  static ID_LISTA = "listaSugerencias";
  static ID_TIPO = "selectorTipoBusqueda";

  #campoTexto;
  #selectorTipo;
  #lista;
  #temporizador;
  #sugerencias;
  #indiceActivo;

  /**
   * @param {ControladorExploracion} controlador
   */
  constructor(controlador) {
    super(controlador, "div", "panel-busqueda");
    this._elemento.setAttribute("role", "search");
    this.#campoTexto = null;
    this.#selectorTipo = null;
    this.#lista = null;
    this.#temporizador = null;
    this.#sugerencias = [];
    this.#indiceActivo = -1;

    // La lista se cierra al hacer clic fuera del buscador. El navegador
    // llama a la función desde fuera de la clase, y dentro de una función
    // normal "this" ya no es el panel; por eso lo guardamos antes.
    const panelBusqueda = this;
    document.addEventListener("pointerdown", function (evento) {
      if (!panelBusqueda._elemento.contains(evento.target)) {
        panelBusqueda.#ocultarLista();
      }
    });
  }

  /**
   * Dibuja el campo, el desplegable de tipo y la lista (vacía y cerrada).
   */
  renderizar() {
    this._elemento.textContent = "";

    this.#campoTexto = crear("input", {
      id: PanelBusqueda.ID_CAMPO,
      type: "text",
      clase: "campo-busqueda",
      placeholder: "Buscar persona, organización u obra…",
      maxlength: "100",
      autocomplete: "off",
      spellcheck: "false",
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": PanelBusqueda.ID_LISTA
    }, []);

    this.#selectorTipo = crear("select", { id: PanelBusqueda.ID_TIPO, clase: "selector-tipo" }, [
      crear("option", { value: "", texto: "Todos" }, []),
      crear("option", { value: TipoEntidad.PERSONA, texto: "Personas" }, []),
      crear("option", { value: TipoEntidad.ORGANIZACION, texto: "Organizaciones" }, []),
      crear("option", { value: TipoEntidad.OBRA_DE_ARTE, texto: "Obras de arte" }, [])
    ]);

    this.#lista = crear("ul", {
      id: PanelBusqueda.ID_LISTA,
      clase: "lista-sugerencias",
      role: "listbox",
      "aria-label": "Sugerencias"
    }, []);
    this.#lista.hidden = true;

    // Las etiquetas existen para los lectores de pantalla, aunque no se
    // vean (clase visualmente-oculto).
    this._elemento.appendChild(crear("label", { for: PanelBusqueda.ID_CAMPO, clase: "visualmente-oculto", texto: "Buscar una entidad por su nombre" }, []));
    this._elemento.appendChild(crear("label", { for: PanelBusqueda.ID_TIPO, clase: "visualmente-oculto", texto: "Tipo de entidad" }, []));
    this._elemento.appendChild(crear("div", { clase: "busqueda-fila" }, [this.#campoTexto, this.#selectorTipo]));
    this._elemento.appendChild(this.#lista);

    const panelBusqueda = this;
    this.#campoTexto.addEventListener("input", function () {
      panelBusqueda.#onEscribir();
    });
    this.#campoTexto.addEventListener("keydown", function (evento) {
      panelBusqueda.#onTeclado(evento);
    });
    this.#selectorTipo.addEventListener("change", function () {
      // Al cambiar el tipo se vuelve a buscar enseguida.
      panelBusqueda.#buscarYa();
    });
  }

  /**
   * Muestra las sugerencias que ha encontrado el buscador.
   *
   * @param {Object[]} lista - [{ id, nombre, tipo }]
   * @param {string} texto - lo que se ha buscado.
   */
  mostrarSugerencias(lista, texto) {
    this.#sugerencias = lista;
    this.#indiceActivo = -1;
    this.#campoTexto.removeAttribute("aria-activedescendant");
    this.#lista.textContent = "";

    if (typeof texto !== "string" || texto.trim().length < 2) {
      this.#ocultarLista();
      return;
    }
    if (lista.length === 0) {
      this.mostrarSinResultados();
      return;
    }

    for (let i = 0; i < lista.length; i++) {
      this.#lista.appendChild(this.#crearSugerencia(lista[i], i));
    }
    this.#abrirLista();
  }

  /**
   * Aviso de que no hay ninguna entidad con ese nombre (RF-06).
   */
  mostrarSinResultados() {
    this.#sugerencias = [];
    this.#lista.textContent = "";
    this.#lista.appendChild(crear("li", {
      clase: "sugerencia-vacia",
      role: "option",
      "aria-disabled": "true",
      texto: "No se ha encontrado ninguna entidad"
    }, []));
    this.#abrirLista();
  }

  /**
   * (Privado) Se ha escrito algo: se espera 150 ms sin teclear y se busca.
   * Cada letra nueva cancela la espera anterior (clearTimeout) y empieza
   * otra, así solo se busca cuando el usuario hace una pausa.
   */
  #onEscribir() {
    if (this.#temporizador !== null) {
      clearTimeout(this.#temporizador);
    }
    const panelBusqueda = this;
    this.#temporizador = setTimeout(function () {
      panelBusqueda.#buscarYa();
    }, PanelBusqueda.MILISEGUNDOS_ESPERA);
  }

  /**
   * (Privado) Busca sin esperar (y cancela la espera pendiente, si la hay).
   */
  #buscarYa() {
    if (this.#temporizador !== null) {
      clearTimeout(this.#temporizador);
      this.#temporizador = null;
    }
    if (this._controlador !== null) {
      this._controlador.buscar(this.#campoTexto.value, this.#selectorTipo.value);
    }
  }

  /**
   * (Privado) Teclas especiales del campo de búsqueda.
   *
   * @param {KeyboardEvent} evento
   */
  #onTeclado(evento) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      this.#mover(1);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      this.#mover(-1);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      this.#elegirConIntro();
    } else if (evento.key === "Escape") {
      this.#ocultarLista();
    }
  }

  /**
   * (Privado) Intro: elige la sugerencia marcada o, si no hay ninguna, la
   * primera. Si todavía no había pasado la espera de 150 ms, primero se busca.
   */
  #elegirConIntro() {
    if (this.#temporizador !== null) {
      this.#buscarYa();
    }
    if (this.#sugerencias.length === 0) {
      return;
    }
    let posicion = 0;
    if (this.#indiceActivo >= 0) {
      posicion = this.#indiceActivo;
    }
    this.#onSeleccionar(this.#sugerencias[posicion]);
  }

  /**
   * (Privado) Marca la sugerencia siguiente (paso = 1) o la anterior (paso = −1).
   *
   * @param {number} paso
   */
  #mover(paso) {
    if (this.#sugerencias.length === 0) {
      return;
    }
    if (this.#lista.hidden) {
      this.#abrirLista();
    }
    let nuevo = this.#indiceActivo + paso;
    if (nuevo < 0) {
      nuevo = 0;
    }
    if (nuevo > this.#sugerencias.length - 1) {
      nuevo = this.#sugerencias.length - 1;
    }
    this.#marcar(nuevo);
  }

  /**
   * (Privado) Marca visualmente una sugerencia y se lo dice a los lectores
   * de pantalla con aria-activedescendant y aria-selected. El foco sigue en
   * el campo de texto, para poder seguir escribiendo.
   *
   * @param {number} indice
   */
  #marcar(indice) {
    const opciones = this.#lista.querySelectorAll("[role=option]");
    for (let i = 0; i < opciones.length; i++) {
      const esLaMarcada = i === indice;
      opciones[i].setAttribute("aria-selected", String(esLaMarcada));
      opciones[i].classList.toggle("sugerencia-activa", esLaMarcada);
    }
    this.#indiceActivo = indice;
    const opcion = opciones[indice];
    this.#campoTexto.setAttribute("aria-activedescendant", opcion.id);
    // Si la lista tiene barra de desplazamiento, que se vea la marcada.
    if (typeof opcion.scrollIntoView === "function") {
      opcion.scrollIntoView({ block: "nearest" });
    }
  }

  /**
   * (Privado) Se ha elegido una entidad: se pone su nombre en el campo, se
   * cierra la lista y se avisa al controlador.
   *
   * @param {Object} entrada - { id, nombre, tipo }
   */
  #onSeleccionar(entrada) {
    this.#campoTexto.value = entrada.nombre;
    this.#ocultarLista();
    if (this._controlador !== null) {
      this._controlador.seleccionarEntidad(entrada.id);
    }
  }

  /**
   * (Privado) Una sugerencia: símbolo del tipo, nombre y tipo en texto.
   *
   * @param {Object} entrada - { id, nombre, tipo }
   * @param {number} indice
   * @returns {HTMLElement}
   */
  #crearSugerencia(entrada, indice) {
    const opcion = crear("li", {
      id: "sugerencia-" + indice,
      clase: "sugerencia",
      role: "option",
      "aria-selected": "false"
    }, [
      ComponenteUI._crearSimboloEntidad(entrada.tipo),
      crear("span", { clase: "sugerencia-nombre", texto: entrada.nombre }, []),
      crear("span", { clase: "sugerencia-tipo", texto: ComponenteUI._nombreTipoEntidad(entrada.tipo) }, [])
    ]);
    const panelBusqueda = this;
    // mousedown y no click: así se elige antes de que el campo pierda el foco.
    opcion.addEventListener("mousedown", function (evento) {
      evento.preventDefault();
      panelBusqueda.#onSeleccionar(entrada);
    });
    return opcion;
  }

  /**
   * (Privado) Abre la lista de sugerencias.
   */
  #abrirLista() {
    this.#lista.hidden = false;
    this.#campoTexto.setAttribute("aria-expanded", "true");
  }

  /**
   * (Privado) Cierra la lista de sugerencias.
   */
  #ocultarLista() {
    if (this.#lista === null) {
      return;
    }
    this.#lista.hidden = true;
    this.#indiceActivo = -1;
    this.#campoTexto.setAttribute("aria-expanded", "false");
    this.#campoTexto.removeAttribute("aria-activedescendant");
  }
}
