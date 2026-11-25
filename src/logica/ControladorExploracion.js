import { FiltroVisualizacion } from './FiltroVisualizacion.js';
import { HistorialNavegacion } from './HistorialNavegacion.js';
import { EstadoCarga } from './EstadoCarga.js';
import { AjustadorUmbral } from './AjustadorUmbral.js';

/**
 * Recibe lo que hace el usuario (desde la escena 3D o desde los paneles), decide qué hay que
 * hacer y se lo pide a quien corresponda:
 *  - el MODELO: GestorSubgrafos (subgrafos), Buscador (sugerencias),
 *    FiltroVisualizacion (qué se ve) e HistorialNavegacion (volver);
 *  - las VISTAS: EscenaGrafo (lo 3D) e InterfazUsuario (lo 2D).
 *
 * Así ninguna vista habla con otra ni con el modelo: un clic en un nodo
 * llega aquí, y aquí se decide que hay que resaltarlo en la escena y
 * mostrar su información en el panel.
 *
 * Al seleccionar una entidad también pide su detalle (eventos, imágenes y
 * fuentes) sin bloquear la vista.
 */
export class ControladorExploracion {
  #filtro;
  #historial;
  #gestor;
  #buscador;
  #escena;
  #interfaz;
  #subgrafoActual;
  #estado;
  #idSolicitado;
  #umbral;
  #numeroCarga;
  #idDetalle;
  #ajustador;

  /**
   * @param {number} umbralInicial - entre 0 y 1 (de /api/configuracion).
   * @param {number} nodosObjetivo - opcional (de /api/configuracion). Si se
   *   indica, cada entidad nueva se abre con el umbral que da más o menos
   *   ese número de nodos (AjustadorUmbral). Si no, siempre con el umbral actual.
   */
  constructor(gestor, buscador, umbralInicial, nodosObjetivo) {
    this.#gestor = gestor;
    this.#buscador = buscador;
    this.#umbral = umbralInicial;
    this.#ajustador = null;
    if (nodosObjetivo !== undefined && nodosObjetivo !== null) {
      this.#ajustador = new AjustadorUmbral(nodosObjetivo);
    }
    this.#filtro = new FiltroVisualizacion();
    this.#historial = new HistorialNavegacion();
    this.#escena = null;
    this.#interfaz = null;
    this.#subgrafoActual = null;
    this.#estado = EstadoCarga.INACTIVO;
    this.#idSolicitado = null;
    this.#numeroCarga = 0;
    this.#idDetalle = null;
  }

  /**
   * Le da al controlador las dos vistas. Va aparte del constructor porque
   * las vistas también necesitan al controlador (para avisarle de lo que
   * hace el usuario): primero se crea el controlador, después las vistas
   * con él, y al final se conectan.
   */
  conectar(escena, interfaz) {
    this.#escena = escena;
    this.#interfaz = interfaz;
  }

  /**
   * Empieza: pone el umbral en su control y carga la entidad inicial.
   *
   * @returns {Promise<void>} termina cuando el primer subgrafo está cargado (o ha fallado).
   */
  async iniciar(idEntidadInicial) {
    this.#interfaz.setUmbral(this.#umbral);
    this.#interfaz.setHabilitadoVolver(false);
    if (typeof idEntidadInicial !== "string" || idEntidadInicial === "") {
      this.#cambiarEstado(EstadoCarga.ERROR);
      this.#interfaz.mostrarError("No hay ninguna entidad inicial configurada. Búscala con el buscador.");
      return;
    }
    await this.#cargarSubgrafo(idEntidadInicial, true);
  }

  /**
   * @returns {string} un valor de EstadoCarga.
   */
  getEstado() {
    return this.#estado;
  }

  /**
   * El subgrafo que se ve ahora (lo usa la barra de rendimiento para
   * contar nodos y relaciones y saber cuándo ha cambiado).
   */
  getSubgrafoActual() {
    return this.#subgrafoActual;
  }

  /**
   * Sugerencias para lo que se está escribiendo en el buscador. No pide
   * nada al servidor: el Buscador busca en el índice de nombres.
   *
   * @param {string} tipo - un valor de TipoEntidad, o "" para todos.
   */
  buscar(texto, tipo) {
    let textoLimpio = "";
    if (typeof texto === "string") {
      textoLimpio = texto.trim();
    }
    if (textoLimpio.length < 2) {
      this.#interfaz.mostrarSugerencias([], textoLimpio);
      return;
    }
    const sugerencias = this.#buscador.sugerir(textoLimpio, tipo);
    this.#interfaz.mostrarSugerencias(sugerencias, textoLimpio);
  }

  /** El usuario ha elegido una entidad en el buscador: es lo mismo que navegar a ella. */
  async seleccionarEntidad(id) {
    await this.navegarA(id);
  }

  /**
   * Cambia la entidad central. La actual se apunta en el historial
   * para poder volver a ella. Si ya es la actual, no hace nada.
   */
  async navegarA(id) {
    const idActual = this.#idEntidadActual();
    if (id === idActual) {
      return;
    }
    // Si ya se está cargando esa misma entidad, no se vuelve a pedir.
    if (id === this.#idSolicitado && this.#estado === EstadoCarga.CARGANDO) {
      return;
    }
    if (idActual !== null) {
      this.#historial.registrar(idActual);
    }
    await this.#cargarSubgrafo(id, true);
  }

  /** Vuelve a la entidad anterior, sin apuntarla otra vez en el historial. */
  async volver() {
    const idAnterior = this.#historial.volver();
    if (idAnterior === null) {
      return;
    }
    this.#interfaz.setHabilitadoVolver(this.#historial.puedeVolver());
    await this.#cargarSubgrafo(idAnterior, true);
  }

  /**
   * Cambia el umbral y recalcula el subgrafo de la misma entidad.
   * No toca el historial ni pide nada al servidor (ni subiendo ni bajando):
   * el cálculo de la relevancia no depende del umbral.
   *
   * @param {number} valor - entre 0 y 1.
   */
  async cambiarUmbral(valor) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      return;
    }
    this.#umbral = valor;
    let id = this.#idEntidadActual();
    if (id === null) {
      id = this.#idSolicitado;
    }
    if (id !== null) {
      // El usuario ha elegido el umbral: no se ajusta.
      await this.#cargarSubgrafo(id, false);
    }
  }

  /**
   * Casilla «Mostrar deducidos» de la leyenda: muestra u oculta los nodos
   * deducidos y recalcula el subgrafo de la misma entidad con el mismo
   * umbral. No pide nada al servidor.
   *
   * @param {boolean} mostrar
   */
  async alternarDeducidos(mostrar) {
    this.#gestor.setMostrarDeducidos(mostrar === true);
    let id = this.#idEntidadActual();
    if (id === null) {
      id = this.#idSolicitado;
    }
    if (id !== null) {
      await this.#cargarSubgrafo(id, false);
    }
  }

  /**
   * Muestra u oculta un tipo de nodo.
   *
   * @param {string} tipo - un valor de TipoEntidad.
   */
  alternarFiltroNodo(tipo) {
    this.#filtro.alternarTipoNodo(tipo);
    this.#aplicarFiltro();
  }

  /** Muestra u oculta un tipo de relación. */
  alternarFiltroRelacion(tipo) {
    this.#filtro.alternarTipoRelacion(tipo);
    this.#aplicarFiltro();
  }

  /**
   * Botones «Todas» (true) y «Ninguna» (false) de la leyenda:
   * muestra u oculta todos los tipos de relación del subgrafo actual.
   */
  mostrarTodasLasRelaciones(visible) {
    if (this.#subgrafoActual === null) {
      return;
    }
    const relaciones = this.#subgrafoActual.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      this.#filtro.setTipoRelacionActivo(relaciones[i].getTipo(), visible);
    }
    this.#aplicarFiltro();
  }

  /** El usuario ha hecho clic en un nodo: se resalta y se muestra su información. */
  seleccionarNodo(nodo) {
    if (this.#subgrafoActual === null) {
      return;
    }
    this.#escena.resaltarNodo(nodo.getEntidad().getId());
    this.#interfaz.mostrarEntidad(nodo.getEntidad(), nodo, this.#subgrafoActual);
    this.#cargarDetalle(nodo.getEntidad().getId());
  }

  /** El usuario ha hecho clic en una relación. */
  seleccionarRelacion(relacion) {
    if (this.#subgrafoActual === null) {
      return;
    }
    this.#escena.resaltarRelacion(relacion.getId());
    // Si se estaba esperando el detalle de una entidad, ya no interesa.
    this.#idDetalle = null;
    this.#interfaz.mostrarRelacion(relacion, this.#subgrafoActual);
  }

  /**
   * Cambia cómo se reparten los nodos en el espacio (libre, por tipo o por
   * grupos). No pide nada al servidor ni cambia el subgrafo: solo la escena.
   * El modo se mantiene al cambiar de entidad o de umbral.
   *
   * @param {string} modo - un valor de ModoDisposicion.
   */
  cambiarDisposicion(modo) {
    this.#escena.setModoDisposicion(modo);
    this.#interfaz.setModoDisposicion(modo);
  }

  /** Vuelve a la vista inicial de la cámara. */
  restablecerVista() {
    this.#escena.restablecerCamara();
  }

  /**
   * Pide el subgrafo de una entidad y, cuando llega, lo muestra.
   *
   * Si el usuario pide otra cosa antes de que llegue (por ejemplo, elige
   * otra entidad muy deprisa), las respuestas pueden llegar desordenadas.
   * Por eso cada carga tiene un número: al llegar la respuesta, si
   * numeroCarga ya no es el suyo, es que se ha pedido algo más nuevo, y
   * esta respuesta se ignora.
   *
   * Si falla, se muestra el error y SE MANTIENE el grafo anterior.
   *
   * Con ajustar (al abrir una entidad: inicio, navegar y volver), si hay
   * ajustador, el umbral se elige para que salgan más o menos los mismos
   * nodos y se pone en el deslizador. Al mover el deslizador no se ajusta.
   */
  async #cargarSubgrafo(id, ajustar) {
    this.#idSolicitado = id;
    this.#cambiarEstado(EstadoCarga.CARGANDO);
    this.#numeroCarga = this.#numeroCarga + 1;
    const numeroDeEstaCarga = this.#numeroCarga;
    const conAjuste = ajustar && this.#ajustador !== null;

    let subgrafo = null;
    try {
      if (conAjuste) {
        subgrafo = await this.#gestor.obtenerSubgrafoAjustado(id, this.#ajustador);
      } else {
        subgrafo = await this.#gestor.obtenerSubgrafo(id, this.#umbral);
      }
    } catch (error) {
      if (numeroDeEstaCarga !== this.#numeroCarga) {
        return;
      }
      this.#cambiarEstado(EstadoCarga.ERROR);
      this.#interfaz.mostrarError(error.message);
      this.#interfaz.setHabilitadoVolver(this.#historial.puedeVolver());
      return;
    }

    if (numeroDeEstaCarga !== this.#numeroCarga) {
      return;
    }
    if (conAjuste) {
      this.#umbral = subgrafo.getUmbral();
      this.#interfaz.setUmbral(this.#umbral);
    }
    this.#subgrafoActual = subgrafo;
    this.#escena.mostrarSubgrafo(subgrafo);
    this.#aplicarFiltro();
    const entidadCentral = subgrafo.getEntidadCentral();
    this.#interfaz.mostrarEntidad(entidadCentral, subgrafo.getNodo(entidadCentral.getId()), subgrafo);
    this.#interfaz.setHabilitadoVolver(this.#historial.puedeVolver());
    this.#cambiarEstado(EstadoCarga.LISTO);
    this.#cargarDetalle(entidadCentral.getId());
  }

  /**
   * Pide el detalle de una entidad (eventos, imágenes, fuentes) y
   * se lo da a la interfaz cuando llega. NO se espera (no tiene await quien
   * lo llama): mientras tanto la vista 3D sigue funcionando y el panel
   * muestra «Cargando…». Si cuando llega el usuario ya ha seleccionado otra
   * cosa, se ignora. Si falla, el panel muestra un aviso (el resto sigue).
   */
  async #cargarDetalle(idEntidad) {
    this.#idDetalle = idEntidad;
    let detalle = null;
    try {
      detalle = await this.#gestor.obtenerDetalle(idEntidad);
    } catch (error) {
      if (this.#idDetalle === idEntidad) {
        this.#interfaz.mostrarErrorDetalle(idEntidad, error.message);
      }
      return;
    }
    if (this.#idDetalle === idEntidad) {
      this.#interfaz.mostrarDetalle(idEntidad, detalle);
    }
  }

  /**
   * Aplica el filtro en la escena y actualiza la leyenda (que
   * cuenta lo que se ve).
   */
  #aplicarFiltro() {
    if (this.#subgrafoActual === null) {
      return;
    }
    this.#escena.aplicarFiltro(this.#filtro);
    this.#interfaz.actualizarLeyenda(this.#datosLeyenda());
  }

  /**
   * Los datos que necesita Leyenda.actualizar:
   *   {
   *     nodos:      [{ tipo, cantidad, activo }],
   *     relaciones: [{ tipo, cantidad, activo, visibles }],
   *     mostrarDeducidos: si la casilla «Mostrar deducidos» está marcada
   *   }
   * cantidad: cuántos hay en el subgrafo; activo: si ese tipo se muestra
   * (no está ocultado en la leyenda); visibles: cuántas relaciones de ese
   * tipo se ven ahora.
   */
  #datosLeyenda() {
    const cantidadPorTipoDeNodo = new Map();
    const nodos = this.#subgrafoActual.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      ControladorExploracion.#sumarUno(cantidadPorTipoDeNodo, nodos[i].getEntidad().getTipo());
    }

    // La clave es el propio TipoRelacion: la caché (RepositorioVecindario)
    // crea uno solo por id, así que todas las relaciones de un tipo comparten objeto.
    const cantidadPorTipoDeRelacion = new Map();
    const relaciones = this.#subgrafoActual.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      ControladorExploracion.#sumarUno(cantidadPorTipoDeRelacion, relaciones[i].getTipo());
    }
    const visiblesPorTipo = this.#escena.getRelacionesVisiblesPorTipo();

    const datos = { nodos: [], relaciones: [], mostrarDeducidos: this.#gestor.getMostrarDeducidos() };
    for (const tipo of cantidadPorTipoDeNodo.keys()) {
      datos.nodos.push({
        tipo: tipo,
        cantidad: cantidadPorTipoDeNodo.get(tipo),
        activo: this.#filtro.esTipoNodoActivo(tipo)
      });
    }
    for (const tipo of cantidadPorTipoDeRelacion.keys()) {
      let visibles = 0;
      if (visiblesPorTipo.has(tipo)) {
        visibles = visiblesPorTipo.get(tipo);
      }
      datos.relaciones.push({
        tipo: tipo,
        cantidad: cantidadPorTipoDeRelacion.get(tipo),
        activo: this.#filtro.esTipoRelacionActivo(tipo),
        visibles: visibles
      });
    }
    return datos;
  }

  /**
   * Cambia el estado y se lo dice a la interfaz.
   *
   * @param {string} estado - un valor de EstadoCarga.
   */
  #cambiarEstado(estado) {
    this.#estado = estado;
    this.#interfaz.mostrarEstado(estado);
  }

  /**
   * Id de la entidad central que se ve ahora, o null si todavía
   * no hay ningún subgrafo en pantalla.
   */
  #idEntidadActual() {
    if (this.#subgrafoActual === null) {
      return null;
    }
    return this.#subgrafoActual.getEntidadCentral().getId();
  }

  /** Suma 1 al contador de esa clave (empieza en 0 si no existía). */
  static #sumarUno(contadores, clave) {
    let cantidad = 0;
    if (contadores.has(clave)) {
      cantidad = contadores.get(clave);
    }
    contadores.set(clave, cantidad + 1);
  }
}
