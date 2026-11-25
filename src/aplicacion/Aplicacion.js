import { ClienteServicio } from '../datos/ClienteServicio.js';
import { FabricaRelevancia } from '../logica/FabricaRelevancia.js';
import { GestorSubgrafos } from '../logica/GestorSubgrafos.js';
import { Buscador } from '../logica/Buscador.js';
import { ControladorExploracion } from '../logica/ControladorExploracion.js';
import { EscenaGrafo } from '../vista3d/EscenaGrafo.js';
import { NodoVisual } from '../vista3d/NodoVisual.js';
import { InterfazUsuario } from '../interfaz/InterfazUsuario.js';
import { FabricaEntidades } from '../datos/FabricaEntidades.js';

/**
 * Arranca la página: crea todas las piezas, las conecta y empieza.
 *
 *   Aplicacion ──crea──▶ ControladorExploracion ◀──avisan── EscenaGrafo / InterfazUsuario
 *                              │
 *                              ├──▶ Buscador (índice de nombres, en memoria)
 *                              └──▶ GestorSubgrafos ──▶ ClienteServicio ──▶ API Python
 *
 * También lleva la barra de rendimiento (nodos, relaciones, fps, tiempo de
 * estabilización, tiempo de cálculo, datos recibidos y tandas, directos y
 * deducidos).
 *
 * Prepara también el CONTEXTO con el que se interpretan los datos de Neo4j: idioma, nombres de los tipos y etiquetas
 * de entidad (de /api/configuracion) y los tipos de relación con sus padres
 * (de /api/tipos).
 *
 * La relevancia se calcula SIEMPRE aquí, en el navegador (la base de datos
 * no trae relevancias), con los parámetros de public/relevancia.json.
 */
export class Aplicacion {
  static UMBRAL_POR_DEFECTO = 0.3;
  static MAX_NODOS_POR_DEFECTO = 150;
  static NODOS_OBJETIVO_POR_DEFECTO = 100;

  #controlador;
  #contexto;
  #escena;
  #interfaz;
  #cliente;
  #gestor;
  #buscador;

  // Para la barra de rendimiento.
  #subgrafoMedido;
  #inicioSimulacion;
  #fotogramasContados;
  #ultimaMedidaFps;

  constructor() {
    this.#controlador = null;
    this.#contexto = null;
    this.#escena = null;
    this.#interfaz = null;
    this.#cliente = null;
    this.#gestor = null;
    this.#buscador = null;
    this.#subgrafoMedido = null;
    this.#inicioSimulacion = null;
    this.#fotogramasContados = 0;
    this.#ultimaMedidaFps = 0;
  }

  /**
   * Punto de entrada (lo llama main.js):
   *   1. Lee public/config.json para saber dónde está la API.
   *   2. Pide a la vez la configuración, el índice de nombres, los tipos, la
   *      jerarquía y los parámetros de la relevancia (public/relevancia.json).
   *   3. Crea y conecta todas las piezas.
   *   4. Carga la entidad inicial.
   * Si no hay servidor, muestra el aviso de error en la página.
   */
  static async main() {
    const aplicacion = new Aplicacion();
    try {
      const urlServicio = await Aplicacion.#leerUrlServicio();
      // El cliente se crea aquí y no en crearDependencias porque hace falta
      // ANTES, para pedir la configuración con la que se crea todo lo demás.
      aplicacion.#cliente = new ClienteServicio(urlServicio);

      // Promise.all lanza las tres peticiones A LA VEZ y espera a que
      // lleguen todas (en el orden en que se pidieron). Pedirlas una
      // detrás de otra tardaría el triple, porque cada una no saldría
      // hasta que llegara la anterior.
      const respuestas = await Promise.all([
        aplicacion.#cliente.obtenerConfiguracion(),
        aplicacion.#cliente.obtenerNombres(),
        aplicacion.#cliente.obtenerTipos(),
        aplicacion.#cliente.obtenerJerarquia(),
        Aplicacion.#leerConfiguracionRelevancia()
      ]);
      const configuracion = respuestas[0];
      const nombres = respuestas[1];
      const tipos = respuestas[2];
      const jerarquia = respuestas[3];
      const relevancia = respuestas[4];

      aplicacion.#contexto = {
        idioma: configuracion.idioma,
        nombresTipos: configuracion.nombresTipos,
        etiquetasEntidad: configuracion.etiquetasEntidad,
        tipos: tipos
      };
      aplicacion.#crearDependencias(configuracion, nombres, relevancia, jerarquia);
      aplicacion.#iniciarBarraRendimiento();
      await aplicacion.#controlador.iniciar(configuracion.entidadInicial);
    } catch (error) {
      Aplicacion.#mostrarErrorDeArranque(error.message);
    }
    return aplicacion;
  }

  /**
   * El ÚNICO sitio donde se hace "new" de las clases principales
   * (además del cliente, ver main): en lugar de que cada clase cree las
   * piezas que usa, se las dan ya hechas.
   * Así, en las pruebas se le puede dar a cada clase un doble de prueba (por
   * ejemplo, un cliente falso que no va a la red), y para cambiar una pieza
   * (la estrategia de relevancia, el origen de los datos...) basta con
   * tocar este método.
   *
   * @param {Object} configuracion - { umbralPorDefecto, maxNodos, entidadInicial, ... }
   * @param {Object[]} nombres - [{ id, etiquetas, propiedades }] (de /api/nombres)
   * @param {Object} relevancia - public/relevancia.json
   * @param {Object} jerarquia - etiqueta → padres (de /api/jerarquia)
   */
  #crearDependencias(configuracion, nombres, relevancia, jerarquia) {
    const umbral = Aplicacion.#leerUmbral(configuracion);
    const maxNodos = Aplicacion.#leerMaxNodos(configuracion);

    // La relevancia: la de cada relación, la evidencia de cada pareja, la de
    // los nodos (la estrategia elegida con estrategiaNodos) y las cuotas.
    const piezas = FabricaRelevancia.crear(relevancia, jerarquia);
    if (typeof relevancia.opacidadMinima === "number") {
      NodoVisual.setOpacidadMinima(relevancia.opacidadMinima);
    }
    this.#gestor = new GestorSubgrafos(this.#cliente, piezas.estrategia, piezas.calculador, maxNodos, this.#contexto,
      relevancia.mostrarDeducidosPorDefecto !== false, piezas.seleccionador);
    this.#buscador = new Buscador(Aplicacion.#prepararIndice(nombres, this.#contexto));
    const nodosObjetivo = Aplicacion.#leerNodosObjetivo(configuracion, maxNodos);
    this.#controlador = new ControladorExploracion(this.#gestor, this.#buscador, umbral, nodosObjetivo);

    // Las vistas necesitan el controlador (para avisarle de los clics) y el
    // controlador necesita las vistas (para mostrar cosas): primero el
    // controlador, después las vistas, y al final se conectan.
    this.#escena = new EscenaGrafo();
    this.#escena.inicializar(document.getElementById("contenedor3d"), this.#controlador);
    this.#interfaz = new InterfazUsuario();
    this.#interfaz.inicializar(document.getElementById("interfaz"), this.#controlador, this.#contexto);
    this.#controlador.conectar(this.#escena, this.#interfaz);
  }

  /**
   * Arranca un bucle propio (requestAnimationFrame, el mismo ritmo
   * al que el navegador dibuja) que actualiza la barra de rendimiento:
   *  - nodos y relaciones del subgrafo;
   *  - fps (fotogramas por segundo), medidos cada segundo;
   *  - «Estabilizado en X,X s»: lo que tarda la simulación de fuerzas en
   *    quedarse quieta;
   *  - «Subgrafo calculado en X ms»: lo que tarda GestorSubgrafos en
   *    construir el subgrafo, sin contar la red;
   *  - «Datos recibidos: X KB»: lo que ocuparon las relaciones pedidas para
   *    el último subgrafo (0 si todo estaba en la caché);
   *  - «Tandas: X · Directos: Y · Deducidos: Z»: cuántas tandas de
   *    peticiones hicieron falta (como mucho 2) y cuántos nodos directos y
   *    deducidos se calcularon (ver GestorSubgrafos).
   */
  #iniciarBarraRendimiento() {
    this.#ultimaMedidaFps = performance.now();
    // requestAnimationFrame llama a la función desde fuera de la clase, y
    // dentro de una función normal "this" ya no es la aplicación; por eso
    // la guardamos antes en una variable.
    const aplicacion = this;
    function medirFotograma(ahora) {
      aplicacion.#medirFotograma(ahora);
      requestAnimationFrame(medirFotograma);
    }
    requestAnimationFrame(medirFotograma);
  }

  /**
   * Lo que hace la barra de rendimiento en cada fotograma.
   *
   * @param {number} ahora - milisegundos desde que se abrió la página.
   */
  #medirFotograma(ahora) {
    this.#fotogramasContados = this.#fotogramasContados + 1;
    const transcurrido = ahora - this.#ultimaMedidaFps;
    if (transcurrido >= 1000) {
      const fps = this.#fotogramasContados * 1000 / transcurrido;
      Aplicacion.#escribir("rendimientoFps", Math.round(fps) + " fps");
      this.#fotogramasContados = 0;
      this.#ultimaMedidaFps = ahora;
    }

    // ¿Ha llegado un subgrafo nuevo? Entonces se actualizan sus datos y se
    // empieza a medir la estabilización.
    const subgrafo = this.#controlador.getSubgrafoActual();
    if (subgrafo !== null && subgrafo !== this.#subgrafoMedido) {
      this.#subgrafoMedido = subgrafo;
      this.#inicioSimulacion = performance.now();
      Aplicacion.#escribir("rendimientoGrafo", subgrafo.getNumeroNodos() + " nodos · " + subgrafo.getRelaciones().length + " relaciones");
      Aplicacion.#escribir("rendimientoCalculo", "Subgrafo calculado en " + Math.round(this.#gestor.getMilisegundosUltimoCalculo()) + " ms");
      const kilobytes = this.#gestor.getBytesRecibidos() / 1024;
      Aplicacion.#escribir("rendimientoDatos", "Datos recibidos: " + kilobytes.toFixed(1).replace(".", ",") + " KB");
      Aplicacion.#escribir("rendimientoEstabilizacion", "Estabilizando…");
      const estadisticas = this.#gestor.getEstadisticas();
      Aplicacion.#escribir("rendimientoRelevancias", "Tandas: " + estadisticas.tandas + " · Directos: " +
        estadisticas.directos + " · Deducidos: " + estadisticas.deducidos);
    }

    if (this.#inicioSimulacion !== null && this.#escena.estaEstabilizado()) {
      const segundos = (performance.now() - this.#inicioSimulacion) / 1000;
      Aplicacion.#escribir("rendimientoEstabilizacion", "Estabilizado en " + segundos.toFixed(1).replace(".", ",") + " s");
      this.#inicioSimulacion = null;
    }
  }

  /**
   * Convierte los nombres en bruto de /api/nombres en el índice
   * del buscador: cada entidad con el nombre que se muestra (en el idioma
   * configurado), su tipo y todos sus nombres (los tres idiomas, y nombre y
   * apellidos por separado), para buscar en todos.
   *
   * @param {Object[]} nombres - [{ id, etiquetas, propiedades }]
   * @param {Object} contexto - { idioma, etiquetasEntidad }
   * @returns {Object[]} [{ id, nombre, tipo, nombresAlternativos }]
   */
  static #prepararIndice(nombres, contexto) {
    const indice = [];
    for (let i = 0; i < nombres.length; i++) {
      const datos = nombres[i];
      const entidad = FabricaEntidades.crearDesdeNeo4j(datos.etiquetas, datos.propiedades, datos.id,
        contexto.idioma, contexto.etiquetasEntidad);
      indice.push({
        id: entidad.getId(),
        nombre: entidad.getNombre(),
        tipo: entidad.getTipo(),
        nombresAlternativos: entidad.getTodosLosNombres()
      });
    }
    return indice;
  }

  /**
   * Lee public/config.json (Vite lo copia tal cual al publicar,
   * así se puede cambiar sin recompilar). Si no se puede leer, usa "/api".
   */
  static async #leerUrlServicio() {
    try {
      const respuesta = await fetch("./config.json");
      if (respuesta.ok) {
        const datos = await respuesta.json();
        if (typeof datos.urlServicio === "string" && datos.urlServicio !== "") {
          return datos.urlServicio;
        }
      }
    } catch (error) {
      // Si falla, seguimos con el valor por defecto de abajo.
    }
    return "/api";
  }

  /**
   * Lee public/relevancia.json (los parámetros de la relevancia; Vite lo
   * copia tal cual al publicar, así se puede cambiar sin recompilar). Sin
   * él no se puede calcular la relevancia, así que si falla la página no
   * arranca.
   */
  static async #leerConfiguracionRelevancia() {
    let respuesta = null;
    try {
      respuesta = await fetch("./relevancia.json");
    } catch (error) {
      throw new Error("No se puede leer public/relevancia.json");
    }
    if (!respuesta.ok) {
      throw new Error("No se puede leer public/relevancia.json");
    }
    return await respuesta.json();
  }

  /** El umbral de la configuración, si es un número entre 0 y 1. */
  static #leerUmbral(configuracion) {
    const umbral = configuracion.umbralPorDefecto;
    if (typeof umbral === "number" && umbral >= 0 && umbral <= 1) {
      return umbral;
    }
    return Aplicacion.UMBRAL_POR_DEFECTO;
  }

  /** El máximo de nodos de la configuración, si es un entero mayor que 0. */
  static #leerMaxNodos(configuracion) {
    const maximo = configuracion.maxNodos;
    if (Number.isInteger(maximo) && maximo > 0) {
      return maximo;
    }
    return Aplicacion.MAX_NODOS_POR_DEFECTO;
  }

  /**
   * Cuántos nodos, más o menos, se quieren al abrir una entidad
   * (ver AjustadorUmbral). Si la configuración no trae un entero mayor que
   * 0, 100. Nunca más que maxNodos (no podrían salir).
   */
  static #leerNodosObjetivo(configuracion, maxNodos) {
    let objetivo = Aplicacion.NODOS_OBJETIVO_POR_DEFECTO;
    if (Number.isInteger(configuracion.nodosObjetivo) && configuracion.nodosObjetivo > 0) {
      objetivo = configuracion.nodosObjetivo;
    }
    if (objetivo > maxNodos) {
      return maxNodos;
    }
    return objetivo;
  }

  /** Escribe un texto en un elemento de la barra de rendimiento. */
  static #escribir(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento !== null) {
      elemento.textContent = texto;
    }
  }

  /**
   * Si la página no ha podido arrancar (por ejemplo, el servidor
   * no contesta), todavía no existe la interfaz: el aviso se escribe en el
   * elemento #avisoArranque de index.html.
   */
  static #mostrarErrorDeArranque(mensaje) {
    const aviso = document.getElementById("avisoArranque");
    if (aviso === null) {
      return;
    }
    aviso.textContent = mensaje + ". Comprueba que el servidor está en marcha y recarga la página.";
    aviso.hidden = false;
  }
}
