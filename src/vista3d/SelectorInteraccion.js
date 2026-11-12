import * as THREE from 'three';
import { NodoVisual } from './NodoVisual.js';
import { EnlaceVisual } from './EnlaceVisual.js';

/**
 * SelectorInteraccion
 *
 * Averigua qué hay debajo del puntero (ratón o dedo) en la escena 3D y se
 * lo dice al controlador:
 *  - clic en un nodo → su información; clic en una relación → la suya;
 *  - doble clic (o dos toques seguidos) en un nodo → navegar a él;
 *  - al pasar el puntero por encima → una etiqueta flotante con el nombre
 *    del nodo o con el tipo y los extremos de la relación.
 *
 * ¿Cómo se sabe qué hay debajo del puntero? Con un "rayo" (Raycaster): una
 * línea recta que sale de la cámara y atraviesa la pantalla por el punto
 * donde está el puntero. Three.js calcula qué objetos 3D corta ese rayo y a
 * qué distancia; el más cercano es el que se ve debajo del puntero.
 *
 * Arrastrar para girar la cámara NO es un clic: si entre pulsar y soltar
 * el puntero se ha movido más de 5 píxeles, no se selecciona nada.
 *
 * Requisitos: RF-28 (información del nodo), RF-29 (de la relación), RF-30
 * (navegar con doble clic), RF-41 (etiqueta al pasar el puntero), RNF-09
 * (pantallas táctiles: dos toques).
 */
export class SelectorInteraccion {
  // Lo que puede moverse el puntero entre pulsar y soltar para que siga
  // siendo un clic y no un giro de la cámara.
  static PIXELES_MAXIMOS_CLIC = 5;
  // Tiempo máximo entre dos toques para que cuenten como "doble toque".
  static MILISEGUNDOS_DOBLE_TOQUE = 300;
  // Distancia (en unidades de la escena) a la que el rayo "toca" una línea:
  // las líneas no tienen grosor y sería casi imposible acertarles.
  static UMBRAL_LINEA = 0.5;

  #escena;
  #controlador;
  #raycaster;
  #puntero;
  #inicioPulsacion;
  #ultimoToque;
  #ultimoVisualTocado;
  #etiqueta;
  #lienzo;
  #escuchadores;

  /**
   * @param {EscenaGrafo} escena
   * @param {ControladorExploracion} controlador
   * @param {HTMLElement} contenedor - donde está el lienzo; ahí se pone la etiqueta flotante.
   */
  constructor(escena, controlador, contenedor) {
    this.#escena = escena;
    this.#controlador = controlador;
    this.#lienzo = escena.getDomElement();
    this.#raycaster = new THREE.Raycaster();
    this.#raycaster.params.Line.threshold = SelectorInteraccion.UMBRAL_LINEA;
    this.#puntero = new THREE.Vector2();
    this.#inicioPulsacion = null;
    this.#ultimoToque = 0;
    this.#ultimoVisualTocado = null;

    // La etiqueta flotante: role="tooltip" para los lectores de pantalla.
    // Su CSS (.etiqueta-flotante) hace que no capture el ratón.
    this.#etiqueta = document.createElement("div");
    this.#etiqueta.className = "etiqueta-flotante";
    this.#etiqueta.setAttribute("role", "tooltip");
    this.#etiqueta.hidden = true;
    contenedor.appendChild(this.#etiqueta);

    this.#escuchadores = [];
    this.#escuchar();
  }

  /**
   * Se ha pulsado (botón del ratón o dedo): se apunta dónde, para saber al
   * soltar si ha sido un clic o un arrastre.
   *
   * @param {PointerEvent} evento
   */
  onPulsar(evento) {
    this.#inicioPulsacion = { x: evento.clientX, y: evento.clientY };
  }

  /**
   * Se ha soltado: si el puntero casi no se ha movido, es un clic.
   *
   * @param {PointerEvent} evento
   */
  onClic(evento) {
    if (this.#inicioPulsacion === null) {
      return;
    }
    const movimientoX = evento.clientX - this.#inicioPulsacion.x;
    const movimientoY = evento.clientY - this.#inicioPulsacion.y;
    this.#inicioPulsacion = null;
    const distancia = Math.sqrt(movimientoX * movimientoX + movimientoY * movimientoY);
    if (distancia > SelectorInteraccion.PIXELES_MAXIMOS_CLIC) {
      // Era un giro de la cámara.
      return;
    }

    const visual = this.#detectarObjeto(evento);
    if (visual instanceof NodoVisual) {
      this.#controlador.seleccionarNodo(visual.getNodo());
      if (evento.pointerType === "touch") {
        this.#comprobarDobleToque(visual);
      }
    } else if (visual instanceof EnlaceVisual) {
      this.#controlador.seleccionarRelacion(visual.getRelacion());
    }
    // Clic en el vacío: no se hace nada.
  }

  /**
   * Doble clic en un nodo: pasa a ser la entidad central.
   *
   * @param {MouseEvent} evento
   */
  onDobleClic(evento) {
    const visual = this.#detectarObjeto(evento);
    if (visual instanceof NodoVisual) {
      this.#controlador.navegarA(visual.getNodo().getEntidad().getId());
    }
  }

  /**
   * El puntero se mueve: si está encima de algo, se muestra su etiqueta.
   *
   * @param {PointerEvent} evento
   */
  onMovimiento(evento) {
    // Con un botón pulsado se está girando la cámara: sin etiqueta.
    if (evento.buttons !== 0) {
      this.ocultarEtiqueta();
      return;
    }
    const visual = this.#detectarObjeto(evento);
    if (visual === null) {
      this.ocultarEtiqueta();
      this.#lienzo.style.cursor = "";
      return;
    }
    this.#mostrarEtiqueta(visual, evento);
    // Cursor de "mano": indica que se puede hacer clic.
    this.#lienzo.style.cursor = "pointer";
  }

  /**
   * Quita todos los escuchadores de eventos y la etiqueta flotante.
   */
  liberar() {
    for (let i = 0; i < this.#escuchadores.length; i++) {
      const escuchador = this.#escuchadores[i];
      this.#lienzo.removeEventListener(escuchador.evento, escuchador.funcion);
    }
    this.#escuchadores = [];
    if (this.#etiqueta.parentNode !== null) {
      this.#etiqueta.parentNode.removeChild(this.#etiqueta);
    }
  }

  /**
   * Oculta la etiqueta flotante. Es pública porque EscenaGrafo la oculta al
   * cambiar de subgrafo (el objeto que señalaba ya no existe).
   */
  ocultarEtiqueta() {
    this.#etiqueta.hidden = true;
  }

  /**
   * (Privado) Conecta los eventos del lienzo con los métodos on...
   *
   * El navegador llama a estas funciones desde fuera de la clase, y dentro
   * de una función normal "this" ya no es el selector. Por eso guardamos
   * antes "this" en una variable y usamos esa variable dentro. Se guardan
   * también las funciones, porque para quitarlas en liberar() hay que pasar
   * exactamente la misma función.
   */
  #escuchar() {
    const selector = this;
    this.#anadirEscuchador("pointerdown", function (evento) {
      selector.onPulsar(evento);
    });
    this.#anadirEscuchador("pointerup", function (evento) {
      selector.onClic(evento);
    });
    this.#anadirEscuchador("pointermove", function (evento) {
      selector.onMovimiento(evento);
    });
    this.#anadirEscuchador("pointerleave", function () {
      selector.ocultarEtiqueta();
    });
    this.#anadirEscuchador("dblclick", function (evento) {
      selector.onDobleClic(evento);
    });
  }

  /**
   * (Privado) Añade un escuchador al lienzo y lo apunta para liberar().
   *
   * @param {string} nombreEvento
   * @param {Function} funcion
   */
  #anadirEscuchador(nombreEvento, funcion) {
    this.#lienzo.addEventListener(nombreEvento, funcion);
    this.#escuchadores.push({ evento: nombreEvento, funcion: funcion });
  }

  /**
   * (Privado) En pantallas táctiles no siempre llega "dblclick": si se toca
   * dos veces el mismo nodo en menos de 300 ms, se navega a él.
   *
   * @param {NodoVisual} visual
   */
  #comprobarDobleToque(visual) {
    const ahora = performance.now();
    const esElMismo = visual === this.#ultimoVisualTocado;
    const esRapido = ahora - this.#ultimoToque < SelectorInteraccion.MILISEGUNDOS_DOBLE_TOQUE;
    if (esElMismo && esRapido) {
      this.#ultimoVisualTocado = null;
      this.#ultimoToque = 0;
      this.#controlador.navegarA(visual.getNodo().getEntidad().getId());
      return;
    }
    this.#ultimoVisualTocado = visual;
    this.#ultimoToque = ahora;
  }

  /**
   * (Privado) Escribe la etiqueta y la coloca junto al puntero (RF-41):
   * nodo → su nombre; relación → «Tipo: Origen → Destino».
   *
   * @param {NodoVisual|EnlaceVisual} visual
   * @param {PointerEvent} evento
   */
  #mostrarEtiqueta(visual, evento) {
    let texto = "";
    if (visual instanceof NodoVisual) {
      texto = visual.getNodo().getEntidad().getNombre();
    } else {
      const relacion = visual.getRelacion();
      texto = relacion.getTipo().getNombre() + ": " +
        SelectorInteraccion.#conRol(relacion, relacion.getOrigen()) + " → " +
        SelectorInteraccion.#conRol(relacion, relacion.getDestino());
    }
    // textContent (y no innerHTML) para que un nombre nunca se interprete como HTML.
    this.#etiqueta.textContent = texto;

    // Un poco a la derecha y por debajo del puntero, para no taparlo.
    const rectangulo = this.#lienzo.getBoundingClientRect();
    this.#etiqueta.style.left = (evento.clientX - rectangulo.left + 14) + "px";
    this.#etiqueta.style.top = (evento.clientY - rectangulo.top + 14) + "px";
    this.#etiqueta.hidden = false;
  }

  /**
   * (Privado) «Nombre (rol)», o solo el nombre si no tiene rol.
   *
   * @param {Relacion} relacion
   * @param {Entidad} entidad
   * @returns {string}
   */
  static #conRol(relacion, entidad) {
    const rol = relacion.getRol(entidad);
    if (rol === "") {
      return entidad.getNombre();
    }
    return entidad.getNombre() + " (" + rol + ")";
  }

  /**
   * (Privado) El objeto que hay debajo del puntero.
   *
   *  1. La posición del puntero se pasa a coordenadas de −1 a 1 respecto al
   *     lienzo (es lo que espera Three.js): −1 es el borde izquierdo (o el
   *     de abajo) y 1 el derecho (o el de arriba). Por eso la y va al revés:
   *     en la pantalla crece hacia abajo.
   *  2. Se lanza el rayo desde la cámara por ese punto contra los nodos y
   *     las líneas que se ven.
   *  3. Three.js devuelve lo que corta el rayo, del más cercano al más lejano.
   *     Si hay algún nodo, se prefiere el nodo (es más fácil acertar a una
   *     línea por error, porque se "toca" a 0,5 de distancia).
   *
   * @param {PointerEvent|MouseEvent} evento
   * @returns {NodoVisual|EnlaceVisual|null}
   */
  #detectarObjeto(evento) {
    const rectangulo = this.#lienzo.getBoundingClientRect();
    if (rectangulo.width === 0 || rectangulo.height === 0) {
      return null;
    }
    this.#puntero.x = ((evento.clientX - rectangulo.left) / rectangulo.width) * 2 - 1;
    this.#puntero.y = -((evento.clientY - rectangulo.top) / rectangulo.height) * 2 + 1;
    this.#raycaster.setFromCamera(this.#puntero, this.#escena.getCamara());

    // false: no mirar dentro de los objetos (las etiquetas de los nodos).
    const cortes = this.#raycaster.intersectObjects(this.#escena.getObjetosSeleccionables(), false);
    let primeraLinea = null;
    for (let i = 0; i < cortes.length; i++) {
      const visual = cortes[i].object.userData.visual;
      if (visual instanceof NodoVisual) {
        return visual;
      }
      if (primeraLinea === null && visual instanceof EnlaceVisual) {
        primeraLinea = visual;
      }
    }
    return primeraLinea;
  }
}
