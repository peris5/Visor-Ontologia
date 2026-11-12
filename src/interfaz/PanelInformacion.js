import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoRelacion } from '../modelo/TipoRelacion.js';

/**
 * PanelInformacion extends ComponenteUI
 *
 * El panel de la derecha. Muestra la información de lo que el usuario ha
 * seleccionado:
 *  - de una ENTIDAD: nombre, tipo y subtipos («Persona · Pintor/a ·
 *    Creador/a»), atributos, relevancia, nivel, centralidad y sus relaciones
 *    dentro del subgrafo (al pulsar una se selecciona). Si no es la central,
 *    el botón «Explorar su red». Debajo, el DETALLE, que se pide aparte al
 *    servidor (con «Cargando…» mientras llega y sin bloquear la vista 3D):
 *    nacimiento, defunción y residencia, sus otros eventos y relaciones, su
 *    ubicación, sus imágenes y sus fuentes.
 *  - de una RELACIÓN: tipo, «Origen (rol) → Destino (rol)» (cada nombre es
 *    un botón que selecciona ese nodo), periodo, lugar, fecha, relevancia y,
 *    si hay más relaciones entre esas dos entidades, cuáles.
 *
 * Los nombres de los tipos salen de nombresTipos (configuración) o, si es un
 * tipo nuevo, del automático (TipoRelacion.nombrar). Las únicas etiquetas
 * de Neo4j escritas aquí son Birth, Death y Live (los tiposSinRelacion), para
 * poder mostrarlas como «Nacimiento», «Defunción» y «Residencia».
 *
 * aria-live="polite": los lectores de pantalla leen el contenido nuevo
 * cuando cambia, sin interrumpir lo que estuvieran leyendo.
 *
 * Requisitos: RF-28 (información del nodo), RF-29 (de la relación), RF-30
 * (explorar su red), RF-38 (varias relaciones entre el mismo par), RNF-25
 * (texto alternativo de las imágenes), RNF-27 (fuentes).
 */
export class PanelInformacion extends ComponenteUI {
  // Los datos de vida de una persona (tiposSinRelacion de la configuración)
  // y cómo se llaman en el panel. Es la única excepción a no escribir
  // etiquetas de Neo4j en el código: hace falta para ponerles nombre.
  static TIPOS_DE_VIDA = Object.freeze([
    ["Birth", "Nacimiento"],
    ["Death", "Defunción"],
    ["Live", "Residencia"]
  ]);
  // Nombre para mostrar de los atributos conocidos. Los que no estén aquí
  // (propiedades nuevas de la BD) se muestran separando las palabras.
  static NOMBRES_ATRIBUTOS = Object.freeze({
    dimensiones: "Dimensiones"
  });
  // Cuántos participantes se nombran en un evento («con A, B, C y 4 más»).
  static MAX_PARTICIPANTES = 3;

  #contenido;
  #detalle;
  #nombresTipos;
  #idEntidadMostrada;
  #nombreEntidadMostrada;

  /**
   * @param {ControladorExploracion} controlador
   * @param {Object} contexto - { nombresTipos } (opcional; sin él, los
   *   nombres de los tipos son los automáticos).
   */
  constructor(controlador, contexto) {
    super(controlador, "aside", "panel-informacion");
    this._elemento.setAttribute("aria-label", "Información de la selección");
    this.#contenido = null;
    this.#detalle = null;
    this.#nombresTipos = {};
    if (contexto !== undefined && contexto !== null && contexto.nombresTipos !== undefined) {
      this.#nombresTipos = contexto.nombresTipos;
    }
    this.#idEntidadMostrada = null;
    this.#nombreEntidadMostrada = "";
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
   * Muestra la información de una entidad del subgrafo. El detalle llega
   * después con mostrarDetalle (mientras tanto, «Cargando…»).
   *
   * @param {Entidad} entidad
   * @param {NodoRelevante} nodo - su nodo en el subgrafo.
   * @param {Subgrafo} subgrafo
   */
  mostrarEntidad(entidad, nodo, subgrafo) {
    this.#contenido.textContent = "";
    this.#idEntidadMostrada = entidad.getId();
    this.#nombreEntidadMostrada = entidad.getNombre();
    const relaciones = this.#relacionesDe(entidad.getId(), subgrafo);

    this.#contenido.appendChild(crear("h2", { clase: "informacion-titulo", texto: entidad.getNombre() }, []));
    this.#contenido.appendChild(crear("p", { clase: "informacion-tipo" }, [
      ComponenteUI._crearSimboloEntidad(entidad.getTipo()),
      this.#textoDelTipo(entidad)
    ]));

    const datos = crear("dl", { clase: "informacion-datos" }, []);
    const atributos = entidad.getAtributos();
    for (const clave of atributos.keys()) {
      PanelInformacion.#anadirDato(datos, PanelInformacion.#nombreDelAtributo(clave),
        PanelInformacion.#textoDelValor(atributos.get(clave)));
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

    // El detalle se rellena cuando llegue (mostrarDetalle).
    this.#detalle = crear("div", { clase: "informacion-detalle" }, [
      crear("p", { clase: "detalle-cargando", texto: "Cargando…" }, [])
    ]);
    this.#contenido.appendChild(this.#detalle);

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
   * Rellena el detalle de la entidad que se está mostrando. Si el detalle
   * es de otra (el usuario ya ha seleccionado otra cosa), no hace nada.
   *
   * @param {string} idEntidad
   * @param {DetalleEntidad} detalle
   */
  mostrarDetalle(idEntidad, detalle) {
    if (idEntidad !== this.#idEntidadMostrada || this.#detalle === null) {
      return;
    }
    this.#detalle.textContent = "";
    this.#mostrarVida(detalle);
    this.#mostrarOtrosEventos(detalle);
    this.#mostrarImagenes(detalle);
    this.#mostrarFuentes(detalle);
  }

  /**
   * Aviso, dentro del panel, de que no se ha podido cargar el detalle.
   *
   * @param {string} idEntidad
   * @param {string} mensaje
   */
  mostrarErrorDetalle(idEntidad, mensaje) {
    if (idEntidad !== this.#idEntidadMostrada || this.#detalle === null) {
      return;
    }
    this.#detalle.textContent = "";
    this.#detalle.appendChild(crear("p", {
      clase: "detalle-error",
      role: "alert",
      texto: "No se ha podido cargar el detalle: " + mensaje
    }, []));
  }

  /**
   * Muestra la información de una relación del subgrafo.
   *
   * @param {Relacion} relacion
   * @param {Subgrafo} subgrafo
   */
  mostrarRelacion(relacion, subgrafo) {
    this.#contenido.textContent = "";
    this.#idEntidadMostrada = null;
    this.#detalle = null;
    const tipo = relacion.getTipo();

    const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
    linea.style.backgroundColor = tipo.getColor();
    this.#contenido.appendChild(crear("h2", { clase: "informacion-titulo" }, [linea, tipo.getNombre()]));
    let textoTipo = "Relación";
    if (tipo.getFamilia() !== tipo.getId()) {
      textoTipo = "Relación · " + tipo.getNombreFamilia();
    }
    this.#contenido.appendChild(crear("p", { clase: "informacion-tipo", texto: textoTipo }, []));

    this.#contenido.appendChild(crear("p", { clase: "informacion-extremos" }, [
      this.#botonDeNodo(relacion.getOrigen(), subgrafo),
      PanelInformacion.#textoDelRol(relacion.getRol(relacion.getOrigen())),
      crear("span", { "aria-label": "con", texto: " → " }, []),
      this.#botonDeNodo(relacion.getDestino(), subgrafo),
      PanelInformacion.#textoDelRol(relacion.getRol(relacion.getDestino()))
    ]));

    const datos = crear("dl", { clase: "informacion-datos" }, []);
    if (relacion.getPeriodo() !== null && relacion.getPeriodo().getTexto() !== "") {
      PanelInformacion.#anadirDato(datos, "Periodo", relacion.getPeriodo().getTexto());
    }
    if (relacion.getLugar() !== null) {
      PanelInformacion.#anadirDato(datos, "Lugar", relacion.getLugar());
    }
    if (relacion.getFecha() !== null) {
      PanelInformacion.#anadirDato(datos, "Fecha", relacion.getFecha());
    }
    PanelInformacion.#anadirDato(datos, "Relevancia", PanelInformacion.#enPorcentaje(relacion.getRelevancia()) +
      " (asignada según el tipo de relación)");
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
    this.#idEntidadMostrada = null;
    this.#detalle = null;
    this._elemento.hidden = true;
  }

  // ───────────── Privados: detalle ─────────────

  /**
   * (Privado) Nacimiento, defunción y residencia (cuándo y dónde), y la
   * ubicación de la entidad (ciudad, provincia, país).
   *
   * @param {DetalleEntidad} detalle
   */
  #mostrarVida(detalle) {
    const datos = crear("dl", { clase: "informacion-datos" }, []);
    for (let i = 0; i < PanelInformacion.TIPOS_DE_VIDA.length; i++) {
      const tipo = PanelInformacion.TIPOS_DE_VIDA[i][0];
      const nombre = PanelInformacion.TIPOS_DE_VIDA[i][1];
      const eventos = detalle.getEventosDeTipo(tipo);
      for (let j = 0; j < eventos.length; j++) {
        const texto = PanelInformacion.#unir([eventos[j].getCuando(), eventos[j].getLugar()], ", ");
        if (texto !== "") {
          PanelInformacion.#anadirDato(datos, nombre, texto);
        }
      }
    }
    const ubicacion = detalle.getUbicacion();
    if (ubicacion.length > 0) {
      PanelInformacion.#anadirDato(datos, "Ubicación", PanelInformacion.#unir(ubicacion, ", "));
    }
    if (datos.childNodes.length > 0) {
      this.#detalle.appendChild(datos);
    }
  }

  /**
   * (Privado) Los demás eventos y relaciones en los que participa
   * («Pintura: Creación de… · 1902 · Valencia · como autora»).
   *
   * @param {DetalleEntidad} detalle
   */
  #mostrarOtrosEventos(detalle) {
    const eventos = detalle.getEventos();
    const lista = crear("ul", { clase: "informacion-eventos" }, []);
    for (let i = 0; i < eventos.length; i++) {
      const evento = eventos[i];
      if (!PanelInformacion.#esDeVida(evento.getTipo())) {
        lista.appendChild(crear("li", {}, [this.#textoDelEvento(evento)]));
      }
    }
    if (lista.childNodes.length > 0) {
      this.#detalle.appendChild(crear("h3", { texto: "Eventos y relaciones" }, []));
      this.#detalle.appendChild(lista);
    }
  }

  /**
   * (Privado) Miniaturas con su pie como texto alternativo (RNF-25).
   *
   * @param {DetalleEntidad} detalle
   */
  #mostrarImagenes(detalle) {
    const imagenes = detalle.getImagenes();
    if (imagenes.length === 0) {
      return;
    }
    const galeria = crear("div", { clase: "informacion-imagenes" }, []);
    for (let i = 0; i < imagenes.length; i++) {
      const imagen = imagenes[i];
      let alternativo = imagen.getPie();
      if (alternativo === "") {
        alternativo = "Imagen de " + this.#nombreEntidadMostrada;
      }
      const etiquetaImagen = crear("img", { src: imagen.getUrl(), alt: alternativo, loading: "lazy" }, []);
      galeria.appendChild(crear("figure", {}, [etiquetaImagen, crear("figcaption", { texto: imagen.getPie() }, [])]));
    }
    this.#detalle.appendChild(crear("h3", { texto: "Imágenes" }, []));
    this.#detalle.appendChild(galeria);
  }

  /**
   * (Privado) «Fuente: Nombre (Libro), actualizada el 15/07/2026», con
   * enlace si tiene url (RNF-27).
   *
   * @param {DetalleEntidad} detalle
   */
  #mostrarFuentes(detalle) {
    const fuentes = detalle.getFuentes();
    if (fuentes.length === 0) {
      return;
    }
    const lista = crear("ul", { clase: "informacion-fuentes" }, []);
    for (let i = 0; i < fuentes.length; i++) {
      const fuente = fuentes[i];
      let nombre = crear("span", { texto: fuente.getNombre() }, []);
      if (fuente.getUrl() !== "") {
        nombre = crear("a", { href: fuente.getUrl(), target: "_blank", rel: "noopener", texto: fuente.getNombre() }, []);
      }
      const partes = ["Fuente: ", nombre];
      if (fuente.getTipo() !== "") {
        partes.push(" (" + TipoRelacion.nombrar(fuente.getTipo(), this.#nombresTipos) + ")");
      }
      if (fuente.getActualizada() !== "") {
        partes.push(", actualizada el " + PanelInformacion.#formatearFecha(fuente.getActualizada()));
      }
      lista.appendChild(crear("li", {}, partes));
    }
    this.#detalle.appendChild(crear("h3", { texto: "Fuentes" }, []));
    this.#detalle.appendChild(lista);
  }

  /**
   * (Privado) El texto de un evento del detalle.
   *
   * @param {Evento} evento
   * @returns {string}
   */
  #textoDelEvento(evento) {
    let texto = TipoRelacion.nombrar(evento.getTipo(), this.#nombresTipos);
    if (evento.getNombre() !== "") {
      texto = texto + ": " + evento.getNombre();
    }
    const partes = [texto, evento.getCuando(), evento.getLugar()];
    if (evento.getRol() !== "") {
      partes.push("como " + evento.getRol());
    }
    const participantes = evento.getParticipantes();
    if (participantes.length > 0) {
      partes.push("con " + PanelInformacion.#listaAbreviada(participantes));
    }
    return PanelInformacion.#unir(partes, " · ");
  }

  // ───────────── Privados: entidad y relación ─────────────

  /**
   * (Privado) «Persona · Pintor/a · Creador/a»: el tipo y los subtipos
   * traducidos. Los subtipos se muestran del más específico al más general
   * (en los datos suelen venir al revés: :Person:Creator:Painter).
   *
   * @param {Entidad} entidad
   * @returns {string}
   */
  #textoDelTipo(entidad) {
    const partes = [ComponenteUI._nombreTipoEntidad(entidad.getTipo())];
    const subtipos = entidad.getSubtipos();
    for (let i = subtipos.length - 1; i >= 0; i--) {
      partes.push(TipoRelacion.nombrar(subtipos[i], this.#nombresTipos));
    }
    return partes.join(" · ");
  }

  /**
   * (Privado) Un botón con una relación vista desde una entidad: el color y
   * el nombre del tipo, la flecha en el sentido de la relación y la otra
   * entidad (con su rol, si lo tiene). Al pulsarlo se selecciona la relación.
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
    let textoOtra = otra.getNombre();
    if (relacion.getRol(otra) !== "") {
      textoOtra = textoOtra + " (" + relacion.getRol(otra) + ")";
    }
    const linea = crear("span", { clase: "simbolo-relacion", "aria-hidden": "true" }, []);
    linea.style.backgroundColor = relacion.getTipo().getColor();
    const boton = crear("button", { type: "button", clase: "boton-relacion" }, [
      linea,
      crear("span", { clase: "relacion-tipo", texto: relacion.getTipo().getNombre() }, []),
      crear("span", { "aria-hidden": "true", texto: flecha }, []),
      crear("span", { clase: "relacion-otra", texto: textoOtra }, [])
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

  // ───────────── Privados: ayudas ─────────────

  /**
   * (Privado) « (maestra)» detrás de un nombre, o "" si no hay rol.
   *
   * @param {string} rol
   * @returns {string}
   */
  static #textoDelRol(rol) {
    if (rol === "") {
      return "";
    }
    return " (" + rol + ")";
  }

  /**
   * (Privado) ¿Es un dato de vida (nacimiento, defunción, residencia)?
   *
   * @param {string} tipo
   * @returns {boolean}
   */
  static #esDeVida(tipo) {
    for (let i = 0; i < PanelInformacion.TIPOS_DE_VIDA.length; i++) {
      if (PanelInformacion.TIPOS_DE_VIDA[i][0] === tipo) {
        return true;
      }
    }
    return false;
  }

  /**
   * (Privado) «A, B, C y 4 más».
   *
   * @param {string[]} nombres
   * @returns {string}
   */
  static #listaAbreviada(nombres) {
    const primeros = [];
    for (let i = 0; i < nombres.length && i < PanelInformacion.MAX_PARTICIPANTES; i++) {
      primeros.push(nombres[i]);
    }
    let texto = primeros.join(", ");
    const resto = nombres.length - primeros.length;
    if (resto > 0) {
      texto = texto + " y " + resto + " más";
    }
    return texto;
  }

  /**
   * (Privado) Une los textos que no estén vacíos.
   *
   * @param {string[]} textos
   * @param {string} separador
   * @returns {string}
   */
  static #unir(textos, separador) {
    const conContenido = [];
    for (let i = 0; i < textos.length; i++) {
      if (typeof textos[i] === "string" && textos[i] !== "") {
        conContenido.push(textos[i]);
      }
    }
    return conContenido.join(separador);
  }

  /**
   * (Privado) "2026-07-15" → "15/07/2026" (otras fechas se dejan tal cual).
   *
   * @param {string} fecha
   * @returns {string}
   */
  static #formatearFecha(fecha) {
    const partes = fecha.split("-");
    if (partes.length === 3 && partes[0].length === 4) {
      return partes[2] + "/" + partes[1] + "/" + partes[0];
    }
    return fecha;
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
   * (Privado) Cualquier valor como texto (un objeto, en JSON).
   *
   * @param {*} valor
   * @returns {string}
   */
  static #textoDelValor(valor) {
    if (typeof valor === "object" && valor !== null) {
      return JSON.stringify(valor);
    }
    return String(valor);
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
   * (Privado) Nombre para mostrar de un atributo: el de la tabla o, si es
   * una propiedad nueva, el automático ("fechaDeAlgo" → "Fecha de algo").
   *
   * @param {string} clave
   * @returns {string}
   */
  static #nombreDelAtributo(clave) {
    if (Object.prototype.hasOwnProperty.call(PanelInformacion.NOMBRES_ATRIBUTOS, clave)) {
      return PanelInformacion.NOMBRES_ATRIBUTOS[clave];
    }
    return TipoRelacion.nombreDesdeId(clave);
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
