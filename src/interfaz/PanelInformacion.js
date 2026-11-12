import { ComponenteUI, crear } from './ComponenteUI.js';

/**
 * PanelInformacion extends ComponenteUI
 *
 * El panel de la derecha. Muestra la información de lo que el usuario ha
 * seleccionado:
 *  - de una ENTIDAD: nombre, tipo, descripción, atributos, relevancia,
 *    nivel, centralidad y sus relaciones dentro del subgrafo (al pulsar una
 *    se selecciona). Si no es la central, el botón «Explorar su red».
 *  - de una RELACIÓN: tipo, «Origen → Destino» (cada nombre es un botón que
 *    selecciona ese nodo), relevancia y, si hay más relaciones entre esas
 *    dos entidades, cuáles.
 *
 * aria-live="polite": los lectores de pantalla leen el contenido nuevo
 * cuando cambia, sin interrumpir lo que estuvieran leyendo.
 *
 * Requisitos: RF-28 (información del nodo), RF-29 (de la relación), RF-30
 * (explorar su red), RF-38 (varias relaciones entre el mismo par), RNF-25.
 */
export class PanelInformacion extends ComponenteUI {
  // Nombre para mostrar de los atributos conocidos. Los que no estén aquí
  // se muestran separando las palabras ("fechaDeAlgo" → "Fecha de algo").
  static NOMBRES_ATRIBUTOS = Object.freeze({
    fechaNacimiento: "Nacimiento",
    fechaDefuncion: "Defunción",
    nacionalidad: "Nacionalidad",
    fechaFundacion: "Fundación",
    sede: "Sede",
    fechaCreacion: "Creación",
    tecnica: "Técnica"
  });

  #contenido;

  /**
   * @param {ControladorExploracion} controlador
   */
  constructor(controlador) {
    super(controlador, "aside", "panel-informacion");
    this._elemento.setAttribute("aria-label", "Información de la selección");
    this.#contenido = null;
  }

  /**
   * Dibuja el panel vacío (y oculto) con su botón de cerrar.
   */
  renderizar() {
    this._elemento.textContent = "";
    const botonCerrar = crear("button", {
      type: "button",
      clase: "boton-cerrar",
      "aria-label": "Cerrar la información",
      texto: "×"
    }, []);
    const panelInformacion = this;
    botonCerrar.addEventListener("click", function () {
      panelInformacion.limpiar();
    });
    this.#contenido = crear("div", { clase: "informacion-contenido", "aria-live": "polite" }, []);
    this._elemento.appendChild(botonCerrar);
    this._elemento.appendChild(this.#contenido);
    this._elemento.hidden = true;
  }

  /**
   * Muestra la información de una entidad del subgrafo.
   *
   * @param {Entidad} entidad
   * @param {NodoRelevante} nodo - su nodo en el subgrafo.
   * @param {Subgrafo} subgrafo
   */
  mostrarEntidad(entidad, nodo, subgrafo) {
    this.#contenido.textContent = "";
    const relaciones = this.#relacionesDe(entidad.getId(), subgrafo);

    this.#contenido.appendChild(crear("h2", { clase: "informacion-titulo", texto: entidad.getNombre() }, []));
    this.#contenido.appendChild(crear("p", { clase: "informacion-tipo" }, [
      ComponenteUI._crearSimboloEntidad(entidad.getTipo()),
      ComponenteUI._nombreTipoEntidad(entidad.getTipo())
    ]));
    if (entidad.getDescripcion() !== "") {
      this.#contenido.appendChild(crear("p", { clase: "informacion-descripcion", texto: entidad.getDescripcion() }, []));
    }

    const datos = crear("dl", { clase: "informacion-datos" }, []);
    const atributos = entidad.getAtributos();
    for (const clave of atributos.keys()) {
      const valor = atributos.get(clave);
      // Solo los que tienen valor.
      if (valor !== undefined && valor !== null && String(valor) !== "") {
        PanelInformacion.#anadirDato(datos, PanelInformacion.#nombreDelAtributo(clave), String(valor));
      }
    }
    PanelInformacion.#anadirDato(datos, "Relevancia", PanelInformacion.#enPorcentaje(nodo.getRelevancia()));
    PanelInformacion.#anadirDato(datos, "Nivel", PanelInformacion.#textoDelNivel(nodo.getNivel()));
    PanelInformacion.#anadirDato(datos, "Centralidad", PanelInformacion.#enPorcentaje(nodo.getCentralidad()));
    PanelInformacion.#anadirDato(datos, "Relaciones en el subgrafo", String(relaciones.length));
    this.#contenido.appendChild(datos);

    if (nodo.getNivel() !== 0) {
      const botonExplorar = crear("button", { type: "button", clase: "boton-explorar", texto: "Explorar su red" }, []);
      const panelInformacion = this;
      botonExplorar.addEventListener("click", function () {
        panelInformacion._controlador.navegarA(entidad.getId());
      });
      this.#contenido.appendChild(botonExplorar);
    }

    if (relaciones.length > 0) {
      this.#contenido.appendChild(crear("h3", { texto: "Sus relaciones en el subgrafo" }, []));
      relaciones.sort(PanelInformacion.#compararPorRelevancia);
      const lista = crear("ul", { clase: "informacion-relaciones" }, []);
      for (let i = 0; i < relaciones.length; i++) {
        lista.appendChild(crear("li", {}, [this.#botonDeRelacion(relaciones[i], entidad)]));
      }
      this.#contenido.appendChild(lista);
    }
    this._elemento.hidden = false;
  }

  /**
   * Muestra la información de una relación del subgrafo.
   *
   * @param {Relacion} relacion
   * @param {Subgrafo} subgrafo
   */
  mostrarRelacion(relacion, subgrafo) {
    this.#contenido.textContent = "";
    const tipo = relacion.getTipo();

    const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
    linea.style.backgroundColor = tipo.getColor();
    this.#contenido.appendChild(crear("h2", { clase: "informacion-titulo" }, [linea, tipo.getNombre()]));
    this.#contenido.appendChild(crear("p", { clase: "informacion-tipo", texto: "Relación" }, []));

    this.#contenido.appendChild(crear("p", { clase: "informacion-extremos" }, [
      this.#botonDeNodo(relacion.getOrigen(), subgrafo),
      crear("span", { "aria-label": "hacia", texto: " → " }, []),
      this.#botonDeNodo(relacion.getDestino(), subgrafo)
    ]));

    const datos = crear("dl", { clase: "informacion-datos" }, []);
    PanelInformacion.#anadirDato(datos, "Relevancia", PanelInformacion.#enPorcentaje(relacion.getRelevancia()));
    this.#contenido.appendChild(datos);

    // RF-38: otras relaciones entre las mismas dos entidades (en cualquier sentido).
    const otras = [];
    const todas = subgrafo.getRelaciones();
    for (let i = 0; i < todas.length; i++) {
      const otra = todas[i];
      if (otra.getId() !== relacion.getId() && otra.getClavePar() === relacion.getClavePar()) {
        otras.push(otra);
      }
    }
    if (otras.length > 0) {
      this.#contenido.appendChild(crear("h3", { texto: "Otras relaciones entre estas dos entidades" }, []));
      const lista = crear("ul", { clase: "informacion-relaciones" }, []);
      for (let i = 0; i < otras.length; i++) {
        lista.appendChild(crear("li", {}, [this.#botonDeRelacion(otras[i], relacion.getOrigen())]));
      }
      this.#contenido.appendChild(lista);
    }
    this._elemento.hidden = false;
  }

  /**
   * Vacía y oculta el panel.
   */
  limpiar() {
    this.#contenido.textContent = "";
    this._elemento.hidden = true;
  }

  /**
   * (Privado) Un botón con una relación vista desde una entidad: el color y
   * el nombre del tipo, la flecha en el sentido de la relación y la otra
   * entidad. Al pulsarlo se selecciona la relación.
   *
   * @param {Relacion} relacion
   * @param {Entidad} desde - la entidad desde la que se mira.
   * @returns {HTMLElement}
   */
  #botonDeRelacion(relacion, desde) {
    const otra = relacion.getOtroExtremo(desde);
    let flecha = " → ";
    if (relacion.getDestino().getId() === desde.getId()) {
      flecha = " ← ";
    }
    const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
    linea.style.backgroundColor = relacion.getTipo().getColor();
    const boton = crear("button", { type: "button", clase: "boton-relacion" }, [
      linea,
      crear("span", { clase: "relacion-tipo", texto: relacion.getTipo().getNombre() }, []),
      crear("span", { "aria-hidden": "true", texto: flecha }, []),
      crear("span", { clase: "relacion-otra", texto: otra.getNombre() }, [])
    ]);
    const panelInformacion = this;
    boton.addEventListener("click", function () {
      panelInformacion._controlador.seleccionarRelacion(relacion);
    });
    return boton;
  }

  /**
   * (Privado) Un botón con el nombre de una entidad; al pulsarlo se
   * selecciona su nodo.
   *
   * @param {Entidad} entidad
   * @param {Subgrafo} subgrafo
   * @returns {HTMLElement}
   */
  #botonDeNodo(entidad, subgrafo) {
    const boton = crear("button", { type: "button", clase: "boton-nodo", texto: entidad.getNombre() }, []);
    const panelInformacion = this;
    boton.addEventListener("click", function () {
      const nodo = subgrafo.getNodo(entidad.getId());
      if (nodo !== null) {
        panelInformacion._controlador.seleccionarNodo(nodo);
      }
    });
    return boton;
  }

  /**
   * (Privado) Relaciones del subgrafo en las que participa la entidad.
   *
   * @param {string} idEntidad
   * @param {Subgrafo} subgrafo
   * @returns {Relacion[]}
   */
  #relacionesDe(idEntidad, subgrafo) {
    const resultado = [];
    const relaciones = subgrafo.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      if (relacion.getOrigen().getId() === idEntidad || relacion.getDestino().getId() === idEntidad) {
        resultado.push(relacion);
      }
    }
    return resultado;
  }

  /**
   * (Privado) Añade una pareja «nombre: valor» a una lista de definiciones (<dl>).
   *
   * @param {HTMLElement} lista
   * @param {string} nombre
   * @param {string} valor
   */
  static #anadirDato(lista, nombre, valor) {
    lista.appendChild(crear("dt", { texto: nombre }, []));
    lista.appendChild(crear("dd", { texto: valor }, []));
  }

  /**
   * (Privado) 0.405 → "41 %".
   *
   * @param {number} valor - entre 0 y 1.
   * @returns {string}
   */
  static #enPorcentaje(valor) {
    return Math.round(valor * 100) + " %";
  }

  /**
   * (Privado) Texto del nivel: 0 → «Entidad central», 1 → «Relación
   * directa», N → «A N saltos».
   *
   * @param {number} nivel
   * @returns {string}
   */
  static #textoDelNivel(nivel) {
    if (nivel === 0) {
      return "Entidad central";
    }
    if (nivel === 1) {
      return "Relación directa";
    }
    return "A " + nivel + " saltos";
  }

  /**
   * (Privado) Nombre para mostrar de un atributo.
   *
   * @param {string} clave - por ejemplo "fechaNacimiento".
   * @returns {string}
   */
  static #nombreDelAtributo(clave) {
    if (Object.prototype.hasOwnProperty.call(PanelInformacion.NOMBRES_ATRIBUTOS, clave)) {
      return PanelInformacion.NOMBRES_ATRIBUTOS[clave];
    }
    // Un atributo desconocido: se separan las palabras por las mayúsculas
    // y los guiones bajos, y se pone la primera en mayúscula.
    let nombre = "";
    for (let i = 0; i < clave.length; i++) {
      const caracter = clave[i];
      const esMayuscula = caracter !== caracter.toLowerCase();
      if (caracter === "_") {
        nombre = nombre + " ";
      } else if (nombre === "") {
        nombre = caracter.toUpperCase();
      } else if (esMayuscula) {
        nombre = nombre + " " + caracter.toLowerCase();
      } else {
        nombre = nombre + caracter;
      }
    }
    return nombre;
  }

  /**
   * (Privado) Para ordenar relaciones de más a menos relevante.
   *
   * @param {Relacion} a
   * @param {Relacion} b
   * @returns {number}
   */
  static #compararPorRelevancia(a, b) {
    return b.getRelevancia() - a.getRelevancia();
  }
}
