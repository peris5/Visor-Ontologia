import { FiltroVisualizacion } from './FiltroVisualizacion.js';
import { HistorialNavegacion } from './HistorialNavegacion.js';
import { EstadoCarga } from './EstadoCarga.js';

/**
 * ControladorExploracion
 *
 * El «controlador» del patrón modelo–vista–controlador: recibe lo que hace
 * el usuario (desde la escena 3D o desde los paneles), decide qué hay que
 * hacer y se lo pide a quien corresponda:
 *  - el MODELO: GestorSubgrafos (subgrafos), Buscador (sugerencias),
 *    FiltroVisualizacion (qué se ve) e HistorialNavegacion (volver);
 *  - las VISTAS: EscenaGrafo (lo 3D) e InterfazUsuario (lo 2D).
 *
 * Así ninguna vista habla con otra ni con el modelo: un clic en un nodo
 * llega aquí, y aquí se decide que hay que resaltarlo en la escena y
 * mostrar su información en el panel.
 *
 * Composición (◆): el filtro y el historial nacen y mueren con el controlador.
 *
 * Requisitos: RF-01 a RF-07 (búsqueda), RF-13 (umbral), RF-14 y RF-15 (aviso
 * de carga y de error), RF-27 (vista inicial), RF-28 y RF-29 (información),
 * RF-30 (navegar), RF-31 (volver), RF-32 y RF-33 (filtros).
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

  /**
   * @param {GestorSubgrafos} gestor
   * @param {Buscador} buscador
   * @param {number} umbralInicial - entre 0 y 1 (de /api/configuracion).
   */
  constructor(gestor, buscador, umbralInicial) {
    this.#gestor = gestor;
    this.#buscador = buscador;
    this.#umbral = umbralInicial;
    this.#filtro = new FiltroVisualizacion();
    this.#historial = new HistorialNavegacion();
    this.#escena = null;
    this.#interfaz = null;
    this.#subgrafoActual = null;
    this.#estado = EstadoCarga.INACTIVO;
    this.#idSolicitado = null;
    this.#numeroCarga = 0;
  }

  /**
   * Le da al controlador las dos vistas. Va aparte del constructor porque
   * las vistas también necesitan al controlador (para avisarle de lo que
   * hace el usuario): primero se crea el controlador, después las vistas
   * con él, y al final se conectan.
   *
   * @param {EscenaGrafo} escena
   * @param {InterfazUsuario} interfaz
   */
  conectar(escena, interfaz) {
    this.#escena = escena;
    this.#interfaz = interfaz;
  }

  /**
   * Empieza: pone el umbral en su control y carga la entidad inicial.
   *
   * @param {string} idEntidadInicial
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
    await this.#cargarSubgrafo(idEntidadInicial);
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
   *
   * @returns {Subgrafo|null}
   */
  getSubgrafoActual() {
    return this.#subgrafoActual;
  }

  /**
   * Sugerencias para lo que se está escribiendo en el buscador. No pide
   * nada al servidor: el Buscador busca en el índice de nombres.
   *
   * @param {string} texto
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

  /**
   * El usuario ha elegido una entidad en el buscador: es lo mismo que navegar a ella.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async seleccionarEntidad(id) {
    await this.navegarA(id);
  }

  /**
   * Cambia la entidad central (RF-30). La actual se apunta en el historial
   * para poder volver a ella. Si ya es la actual, no hace nada.
   *
   * @param {string} id
   * @returns {Promise<void>}
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
    await this.#cargarSubgrafo(id);
  }

  /**
   * Vuelve a la entidad anterior (RF-31), sin apuntarla otra vez en el historial.
   *
   * @returns {Promise<void>}
   */
  async volver() {
    const idAnterior = this.#historial.volver();
    if (idAnterior === null) {
      return;
    }
    this.#interfaz.setHabilitadoVolver(this.#historial.puedeVolver());
    await this.#cargarSubgrafo(idAnterior);
  }

  /**
   * Cambia el umbral y recalcula el subgrafo de la misma entidad (RF-13).
   * No toca el historial. Si el umbral sube, GestorSubgrafos no pedirá
   * nada al servidor.
   *
   * @param {number} valor - entre 0 y 1.
   * @returns {Promise<void>}
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
      await this.#cargarSubgrafo(id);
    }
  }

  /**
   * Muestra u oculta un tipo de nodo (RF-32).
   *
   * @param {string} tipo - un valor de TipoEntidad.
   */
  alternarFiltroNodo(tipo) {
    this.#filtro.alternarTipoNodo(tipo);
    this.#aplicarFiltro();
  }

  /**
   * Muestra u oculta un tipo de relación (RF-33).
   *
   * @param {TipoRelacion} tipo
   */
  alternarFiltroRelacion(tipo) {
    this.#filtro.alternarTipoRelacion(tipo);
    this.#aplicarFiltro();
  }

  /**
   * Botones «Todas» (true) y «Ninguna» (false) de la leyenda (RF-33):
   * muestra u oculta todos los tipos de relación del subgrafo actual.
   *
   * @param {boolean} visible
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

  /**
   * El usuario ha hecho clic en un nodo (RF-28): se resalta y se muestra su información.
   *
   * @param {NodoRelevante} nodo
   */
  seleccionarNodo(nodo) {
    if (this.#subgrafoActual === null) {
      return;
    }
    this.#escena.resaltarNodo(nodo.getEntidad().getId());
    this.#interfaz.mostrarEntidad(nodo.getEntidad(), nodo, this.#subgrafoActual);
  }

  /**
   * El usuario ha hecho clic en una relación (RF-29).
   *
   * @param {Relacion} relacion
   */
  seleccionarRelacion(relacion) {
    if (this.#subgrafoActual === null) {
      return;
    }
    this.#escena.resaltarRelacion(relacion.getId());
    this.#interfaz.mostrarRelacion(relacion, this.#subgrafoActual);
  }

  /**
   * Vuelve a la vista inicial de la cámara (RF-27).
   */
  restablecerVista() {
    this.#escena.restablecerCamara();
  }

  /**
   * (Privado) Pide el subgrafo de una entidad y, cuando llega, lo muestra.
   *
   * Si el usuario pide otra cosa antes de que llegue (por ejemplo, elige
   * otra entidad muy deprisa), las respuestas pueden llegar desordenadas.
   * Por eso cada carga tiene un número: al llegar la respuesta, si
   * numeroCarga ya no es el suyo, es que se ha pedido algo más nuevo, y
   * esta respuesta se ignora.
   *
   * Si falla, se muestra el error y SE MANTIENE el grafo anterior.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async #cargarSubgrafo(id) {
    this.#idSolicitado = id;
    this.#cambiarEstado(EstadoCarga.CARGANDO);
    this.#numeroCarga = this.#numeroCarga + 1;
    const numeroDeEstaCarga = this.#numeroCarga;

    let subgrafo = null;
    try {
      subgrafo = await this.#gestor.obtenerSubgrafo(id, this.#umbral);
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
    this.#subgrafoActual = subgrafo;
    this.#escena.mostrarSubgrafo(subgrafo);
    this.#aplicarFiltro();
    const entidadCentral = subgrafo.getEntidadCentral();
    this.#interfaz.mostrarEntidad(entidadCentral, subgrafo.getNodo(entidadCentral.getId()), subgrafo);
    this.#interfaz.setHabilitadoVolver(this.#historial.puedeVolver());
    this.#cambiarEstado(EstadoCarga.LISTO);
  }

  /**
   * (Privado) Aplica el filtro en la escena y actualiza la leyenda (que
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
   * (Privado) Los datos que necesita Leyenda.actualizar:
   *   {
   *     nodos:      [{ tipo, cantidad, activo }],
   *     relaciones: [{ tipo, cantidad, activo, visibles }]
   *   }
   * cantidad: cuántos hay en el subgrafo; activo: si su casilla está
   * marcada; visibles: cuántas relaciones de ese tipo se ven ahora.
   *
   * @returns {Object}
   */
  #datosLeyenda() {
    const cantidadPorTipoDeNodo = new Map();
    const nodos = this.#subgrafoActual.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      ControladorExploracion.#sumarUno(cantidadPorTipoDeNodo, nodos[i].getEntidad().getTipo());
    }

    // La clave es el propio TipoRelacion: RepositorioVecindario crea uno
    // solo por id, así que todas las relaciones de un tipo comparten objeto.
    const cantidadPorTipoDeRelacion = new Map();
    const relaciones = this.#subgrafoActual.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      ControladorExploracion.#sumarUno(cantidadPorTipoDeRelacion, relaciones[i].getTipo());
    }
    const visiblesPorTipo = this.#escena.getRelacionesVisiblesPorTipo();

    const datos = { nodos: [], relaciones: [] };
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
   * (Privado) Cambia el estado y se lo dice a la interfaz.
   *
   * @param {string} estado - un valor de EstadoCarga.
   */
  #cambiarEstado(estado) {
    this.#estado = estado;
    this.#interfaz.mostrarEstado(estado);
  }

  /**
   * (Privado) Id de la entidad central que se ve ahora, o null si todavía
   * no hay ningún subgrafo en pantalla.
   *
   * @returns {string|null}
   */
  #idEntidadActual() {
    if (this.#subgrafoActual === null) {
      return null;
    }
    return this.#subgrafoActual.getEntidadCentral().getId();
  }

  /**
   * (Privado) Suma 1 al contador de esa clave (empieza en 0 si no existía).
   *
   * @param {Map} contadores
   * @param {*} clave
   */
  static #sumarUno(contadores, clave) {
    let cantidad = 0;
    if (contadores.has(clave)) {
      cantidad = contadores.get(clave);
    }
    contadores.set(clave, cantidad + 1);
  }
}
