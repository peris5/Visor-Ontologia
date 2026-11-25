import { ComponenteUI, crear } from './ComponenteUI.js';
import { TipoRelacion } from '../modelo/TipoRelacion.js';

/**
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

  /** Dibuja el panel vacío (y oculto) con su botón de cerrar. */
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
   * @param {NodoRelevante} nodo - su nodo en el subgrafo.
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
    PanelInformacion.#anadirDato(datos, "Relevancia (S)", PanelInformacion.#enPorcentaje(nodo.getRelevancia()));
    this.#anadirOrigen(datos, nodo, subgrafo);
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

    this.#mostrarEventosNoDibujados(entidad, subgrafo);

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

  /** Aviso, dentro del panel, de que no se ha podido cargar el detalle. */
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

  /** Muestra la información de una relación del subgrafo. */
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
    if (relacion.esSintetica()) {
      PanelInformacion.#anadirDato(datos, "Qué es", relacion.getTexto() +
        " (no hay ninguna relación que se pueda dibujar)");
      PanelInformacion.#anadirDato(datos, "Evidencia", PanelInformacion.#enPorcentaje(relacion.getRelevancia()));
    } else {
      if (relacion.getNombre() !== "") {
        PanelInformacion.#anadirDato(datos, "Nombre", relacion.getNombre());
      }
      PanelInformacion.#anadirDato(datos, "Participantes", String(relacion.getParticipantes()));
      const registros = relacion.getIdsIntermediarios().length;
      if (registros > 1) {
        PanelInformacion.#anadirDato(datos, "Registros", registros + " del mismo evento (se cuentan como uno)");
      }
      PanelInformacion.#anadirDato(datos, "Relevancia", PanelInformacion.#enPorcentaje(relacion.getRelevancia()) +
        " (peso del tipo × participantes × época)");
    }
    this.#contenido.appendChild(datos);

    // Otras relaciones entre las mismas dos entidades (en cualquier sentido).
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

  /** Vacía y oculta el panel. */
  limpiar() {
    this.#contenido.textContent = "";
    this.#idEntidadMostrada = null;
    this.#detalle = null;
    this._elemento.hidden = true;
  }

  // ───────────── Privados: origen de la relevancia ─────────────

  /**
   * De dónde sale la relevancia: la fuerza R, la certeza C (en número y en
   * palabras), el origen, la explicación, la evidencia propia y, en los
   * deducidos, el camino por cada padre. Los textos solo dicen que dos
   * personas «coinciden» si no hay relación declarada: nunca que se conozcan
   * (RNF-23).
   */
  #anadirOrigen(datos, nodo, subgrafo) {
    const resultado = nodo.getResultado();
    if (resultado === null || nodo.getNivel() === 0) {
      return;
    }
    PanelInformacion.#anadirDato(datos, "Fuerza (R)", PanelInformacion.#enPorcentaje(resultado.getFuerza()));
    PanelInformacion.#anadirDato(datos, "Certeza (C)", PanelInformacion.#enPorcentaje(resultado.getCerteza()) + " (" +
      PanelInformacion.textoDeLaCerteza(resultado.getCerteza()) + ")");
    let textoOrigen = PanelInformacion.textoDelOrigen(resultado.getOrigen());
    if (resultado.esDeducido() && resultado.getPadre() === null) {
      // Ni directo ni a través de otro: lo que lo une a la central es muy poco.
      textoOrigen = "Evidencia escasa con la entidad central";
    }
    PanelInformacion.#anadirDato(datos, "Origen", textoOrigen);
    if (resultado.getTextoExplicacion() !== "") {
      PanelInformacion.#anadirDato(datos, "Por qué", resultado.getTextoExplicacion());
    }
    PanelInformacion.#anadirDato(datos, "Evidencia propia", PanelInformacion.#enPorcentaje(resultado.getEvidenciaPropia()));
    if (resultado.esDeducido()) {
      const padres = resultado.getPadres();
      for (let i = 0; i < padres.length; i++) {
        PanelInformacion.#anadirDato(datos, "Camino", subgrafo.getEntidadCentral().getNombre() + " → " +
          padres[i].getNombre() + " → " + nodo.getEntidad().getNombre());
      }
    }
  }

  /**
   * La certeza en palabras: «segura» (C ≥ 0,9), «probable» (C ≥ 0,5) o
   * «supuesta» (menos). Es estático para poder probarlo.
   */
  static textoDeLaCerteza(certeza) {
    if (certeza >= 0.9) {
      return "segura";
    }
    if (certeza >= 0.5) {
      return "probable";
    }
    return "supuesta";
  }

  /**
   * Los eventos que la entidad comparte con la central y NO se dibujan
   * (dibujable = false: demasiados participantes), solo con su tipo, su
   * nombre y su número de participantes. Cuentan para la relevancia aunque
   * no se vean.
   */
  #mostrarEventosNoDibujados(entidad, subgrafo) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    if (entidad.getId() === idCentral) {
      return;
    }
    const evidencia = subgrafo.getEvidencia(idCentral, entidad.getId());
    if (evidencia === null) {
      return;
    }
    const noDibujados = [];
    const relaciones = evidencia.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      if (!relaciones[i].esDibujable()) {
        noDibujados.push(relaciones[i]);
      }
    }
    if (noDibujados.length === 0) {
      return;
    }
    this.#contenido.appendChild(crear("h3", { texto: "Eventos compartidos que no se dibujan" }, []));
    const lista = crear("ul", { clase: "informacion-eventos-ocultos" }, []);
    for (let i = 0; i < noDibujados.length; i++) {
      lista.appendChild(crear("li", { texto: PanelInformacion.textoEventoNoDibujado(noDibujados[i]) }, []));
    }
    this.#contenido.appendChild(lista);
  }

  /**
   * «Exposición · Exposición colectiva de 1911 (40 artistas) · 40 participantes».
   * Es estático para poder probarlo.
   */
  static textoEventoNoDibujado(relacion) {
    const partes = [relacion.getTipo().getNombre()];
    if (relacion.getNombre() !== "") {
      partes.push(relacion.getNombre());
    }
    partes.push(relacion.getParticipantes() + " participantes");
    return partes.join(" · ");
  }

  /**
   * Nombre para mostrar de un OrigenRelevancia.
   */
  static textoDelOrigen(origen) {
    if (origen === "DECLARADA") {
      return "Relación declarada con la entidad central";
    }
    if (origen === "COINCIDENCIAS") {
      return "Solo coincidencias en eventos con la entidad central";
    }
    if (origen === "DEDUCIDA") {
      return "Deducido a través de un nodo directo";
    }
    return "Entidad central";
  }

  // ───────────── Privados: detalle ─────────────

  /**
   * Nacimiento, defunción y residencia (cuándo y dónde), y la
   * ubicación de la entidad (ciudad, provincia, país).
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
   * Los demás eventos y relaciones en los que participa
   * («Pintura: Creación de… · 1902 · Valencia · como autora»).
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

  /** Miniaturas con su pie como texto alternativo. */
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
   * «Fuente: Nombre (Libro), actualizada el 15/07/2026», con
   * enlace si tiene url.
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

  /** El texto de un evento del detalle. */
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
   * «Persona · Pintor/a · Creador/a»: el tipo y los subtipos
   * traducidos. Los subtipos se muestran del más específico al más general
   * (en los datos suelen venir al revés: :Person:Creator:Painter).
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
   * Un botón con una relación vista desde una entidad: el color y
   * el nombre del tipo, la flecha en el sentido de la relación y la otra
   * entidad (con su rol, si lo tiene). Al pulsarlo se selecciona la relación.
   *
   * @param {Entidad} desde - la entidad desde la que se mira.
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
   * Un botón con el nombre de una entidad; al pulsarlo se
   * selecciona su nodo.
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

  /** Relaciones del subgrafo en las que participa la entidad. */
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

  /** « (maestra)» detrás de un nombre, o "" si no hay rol. */
  static #textoDelRol(rol) {
    if (rol === "") {
      return "";
    }
    return " (" + rol + ")";
  }

  /** ¿Es un dato de vida (nacimiento, defunción, residencia)? */
  static #esDeVida(tipo) {
    for (let i = 0; i < PanelInformacion.TIPOS_DE_VIDA.length; i++) {
      if (PanelInformacion.TIPOS_DE_VIDA[i][0] === tipo) {
        return true;
      }
    }
    return false;
  }

  /** «A, B, C y 4 más». */
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

  /** Une los textos que no estén vacíos. */
  static #unir(textos, separador) {
    const conContenido = [];
    for (let i = 0; i < textos.length; i++) {
      if (typeof textos[i] === "string" && textos[i] !== "") {
        conContenido.push(textos[i]);
      }
    }
    return conContenido.join(separador);
  }

  /** "2026-07-15" → "15/07/2026" (otras fechas se dejan tal cual). */
  static #formatearFecha(fecha) {
    const partes = fecha.split("-");
    if (partes.length === 3 && partes[0].length === 4) {
      return partes[2] + "/" + partes[1] + "/" + partes[0];
    }
    return fecha;
  }

  /** Añade una pareja «nombre: valor» a una lista de definiciones (<dl>). */
  static #anadirDato(lista, nombre, valor) {
    lista.appendChild(crear("dt", { texto: nombre }, []));
    lista.appendChild(crear("dd", { texto: valor }, []));
  }

  /** Cualquier valor como texto (un objeto, en JSON). */
  static #textoDelValor(valor) {
    if (typeof valor === "object" && valor !== null) {
      return JSON.stringify(valor);
    }
    return String(valor);
  }

  /**
   * 0.405 → "41 %".
   *
   * @param {number} valor - entre 0 y 1.
   */
  static #enPorcentaje(valor) {
    return Math.round(valor * 100) + " %";
  }

  /**
   * Texto del nivel: 0 → «Entidad central», 1 → «Nodo directo (evidencia
   * propia con la central)», N → «A N saltos». En el nivel 1 no se dice
   * «relación», porque puede haber solo coincidencias (RNF-23).
   */
  static #textoDelNivel(nivel) {
    if (nivel === 0) {
      return "Entidad central";
    }
    if (nivel === 1) {
      return "Nodo directo (evidencia propia con la central)";
    }
    return "A " + nivel + " saltos";
  }

  /**
   * Nombre para mostrar de un atributo: el de la tabla o, si es
   * una propiedad nueva, el automático ("fechaDeAlgo" → "Fecha de algo").
   */
  static #nombreDelAtributo(clave) {
    if (Object.prototype.hasOwnProperty.call(PanelInformacion.NOMBRES_ATRIBUTOS, clave)) {
      return PanelInformacion.NOMBRES_ATRIBUTOS[clave];
    }
    return TipoRelacion.nombreDesdeId(clave);
  }

  /** Para ordenar relaciones de más a menos relevante. */
  static #compararPorRelevancia(a, b) {
    return b.getRelevancia() - a.getRelevancia();
  }
}
