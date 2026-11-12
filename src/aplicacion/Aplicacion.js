import { ClienteServicio } from '../datos/ClienteServicio.js';
import { RelevanciaDesdeBD } from '../logica/RelevanciaDesdeBD.js';
import { GestorSubgrafos } from '../logica/GestorSubgrafos.js';
import { Buscador } from '../logica/Buscador.js';
import { ControladorExploracion } from '../logica/ControladorExploracion.js';
import { EscenaGrafo } from '../vista3d/EscenaGrafo.js';
import { InterfazUsuario } from '../interfaz/InterfazUsuario.js';

/**
 * Aplicacion
 *
 * Arranca la página: crea todas las piezas, las conecta y empieza.
 *
 *   Aplicacion ──crea──▶ ControladorExploracion ◀──avisan── EscenaGrafo / InterfazUsuario
 *                              │
 *                              ├──▶ Buscador (índice de nombres, en memoria)
 *                              └──▶ GestorSubgrafos ──▶ ClienteServicio ──▶ API Python
 *
 * Composición (◆): tiene el controlador, la escena, la interfaz, el
 * cliente, el gestor y el buscador.
 *
 * También lleva la barra de rendimiento (nodos, relaciones, fps, tiempo de
 * estabilización, tiempo de cálculo y datos recibidos), que se usará en
 * las pruebas de rendimiento del incremento 4.
 *
 * Requisitos: RNF-16 (configuración en un solo sitio), RNF-17 (inyección
 * de dependencias: cada pieza recibe las que usa), RF-15 (aviso si no hay
 * servidor), RNF-01 y RNF-29 (medidas de rendimiento).
 */
export class Aplicacion {
  static UMBRAL_POR_DEFECTO = 0.3;
  static MAX_NODOS_POR_DEFECTO = 150;

  #controlador;
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
   *   2. Pide a la vez la configuración y el índice de nombres.
   *   3. Crea y conecta todas las piezas.
   *   4. Carga la entidad inicial.
   * Si no hay servidor, muestra el aviso de error en la página.
   *
   * @returns {Promise<Aplicacion>}
   */
  static async main() {
    const aplicacion = new Aplicacion();
    try {
      const urlServicio = await Aplicacion.#leerUrlServicio();
      // El cliente se crea aquí y no en crearDependencias porque hace falta
      // ANTES, para pedir la configuración con la que se crea todo lo demás.
      aplicacion.#cliente = new ClienteServicio(urlServicio);

      // Promise.all lanza las dos peticiones A LA VEZ y espera a que
      // lleguen las dos (en el orden en que se pidieron). Pedirlas una
      // detrás de otra tardaría el doble, porque la segunda no saldría
      // hasta que llegara la primera.
      const respuestas = await Promise.all([
        aplicacion.#cliente.obtenerConfiguracion(),
        aplicacion.#cliente.obtenerNombres()
      ]);
      const configuracion = respuestas[0];
      const nombres = respuestas[1];

      aplicacion.#crearDependencias(configuracion, nombres);
      aplicacion.#iniciarBarraRendimiento();
      await aplicacion.#controlador.iniciar(configuracion.entidadInicial);
    } catch (error) {
      Aplicacion.#mostrarErrorDeArranque(error.message);
    }
    return aplicacion;
  }

  /**
   * (Privado) El ÚNICO sitio donde se hace "new" de las clases principales
   * (además del cliente, ver main). Es la «inyección de dependencias»: en
   * lugar de que cada clase cree las piezas que usa, se las dan ya hechas.
   * Así, en las pruebas se le puede dar a cada clase un doble de prueba (por
   * ejemplo, un cliente falso que no va a la red), y para cambiar una pieza
   * (la estrategia de relevancia, el origen de los datos...) basta con
   * tocar este método.
   *
   * @param {Object} configuracion - { umbralPorDefecto, maxNodos, entidadInicial }
   * @param {Object[]} nombres - [{ id, nombre, tipo }]
   */
  #crearDependencias(configuracion, nombres) {
    const umbral = Aplicacion.#leerUmbral(configuracion);
    const maxNodos = Aplicacion.#leerMaxNodos(configuracion);

    this.#gestor = new GestorSubgrafos(this.#cliente, new RelevanciaDesdeBD(), maxNodos);
    this.#buscador = new Buscador(nombres);
    this.#controlador = new ControladorExploracion(this.#gestor, this.#buscador, umbral);

    // Las vistas necesitan el controlador (para avisarle de los clics) y el
    // controlador necesita las vistas (para mostrar cosas): primero el
    // controlador, después las vistas, y al final se conectan.
    this.#escena = new EscenaGrafo();
    this.#escena.inicializar(document.getElementById("contenedor3d"), this.#controlador);
    this.#interfaz = new InterfazUsuario();
    this.#interfaz.inicializar(document.getElementById("interfaz"), this.#controlador);
    this.#controlador.conectar(this.#escena, this.#interfaz);
  }

  /**
   * (Privado) Arranca un bucle propio (requestAnimationFrame, el mismo ritmo
   * al que el navegador dibuja) que actualiza la barra de rendimiento:
   *  - nodos y relaciones del subgrafo;
   *  - fps (fotogramas por segundo), medidos cada segundo;
   *  - «Estabilizado en X,X s»: lo que tarda la simulación de fuerzas en
   *    quedarse quieta (RNF-29);
   *  - «Subgrafo calculado en X ms»: lo que tarda GestorSubgrafos en
   *    construir el subgrafo, sin contar la red;
   *  - «Datos recibidos: X KB»: lo que ocupaba el vecindario.
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
   * (Privado) Lo que hace la barra de rendimiento en cada fotograma.
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
      const kilobytes = this.#gestor.getBytesVecindario() / 1024;
      Aplicacion.#escribir("rendimientoDatos", "Datos recibidos: " + kilobytes.toFixed(1).replace(".", ",") + " KB");
      Aplicacion.#escribir("rendimientoEstabilizacion", "Estabilizando…");
    }

    if (this.#inicioSimulacion !== null && this.#escena.estaEstabilizado()) {
      const segundos = (performance.now() - this.#inicioSimulacion) / 1000;
      Aplicacion.#escribir("rendimientoEstabilizacion", "Estabilizado en " + segundos.toFixed(1).replace(".", ",") + " s");
      this.#inicioSimulacion = null;
    }
  }

  /**
   * (Privado) Lee public/config.json (Vite lo copia tal cual al publicar,
   * así se puede cambiar sin recompilar). Si no se puede leer, usa "/api".
   *
   * @returns {Promise<string>}
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
   * (Privado) El umbral de la configuración, si es un número entre 0 y 1.
   *
   * @param {Object} configuracion
   * @returns {number}
   */
  static #leerUmbral(configuracion) {
    const umbral = configuracion.umbralPorDefecto;
    if (typeof umbral === "number" && umbral >= 0 && umbral <= 1) {
      return umbral;
    }
    return Aplicacion.UMBRAL_POR_DEFECTO;
  }

  /**
   * (Privado) El máximo de nodos de la configuración, si es un entero mayor que 0.
   *
   * @param {Object} configuracion
   * @returns {number}
   */
  static #leerMaxNodos(configuracion) {
    const maximo = configuracion.maxNodos;
    if (Number.isInteger(maximo) && maximo > 0) {
      return maximo;
    }
    return Aplicacion.MAX_NODOS_POR_DEFECTO;
  }

  /**
   * (Privado) Escribe un texto en un elemento de la barra de rendimiento.
   *
   * @param {string} id
   * @param {string} texto
   */
  static #escribir(id, texto) {
    const elemento = document.getElementById(id);
    if (elemento !== null) {
      elemento.textContent = texto;
    }
  }

  /**
   * (Privado) Si la página no ha podido arrancar (por ejemplo, el servidor
   * no contesta), todavía no existe la interfaz: el aviso se escribe en el
   * elemento #avisoArranque de index.html.
   *
   * @param {string} mensaje
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
