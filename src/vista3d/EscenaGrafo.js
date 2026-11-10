import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CalculadorDisposicion } from './CalculadorDisposicion.js';
import { SimulacionFuerzas } from './SimulacionFuerzas.js';
import { FabricaNodosVisuales } from './FabricaNodosVisuales.js';
import { EnlaceVisual } from './EnlaceVisual.js';

/**
 * EscenaGrafo
 *
 * Crea la escena 3D y la anima: cámara, luces, renderizadores (el de WebGL
 * para las formas y el de CSS para las etiquetas), controles de la cámara y
 * el bucle que avanza la simulación de fuerzas y dibuja cada fotograma.
 *
 * Composición (◆): tiene sus propios NodoVisual, EnlaceVisual,
 * CalculadorDisposicion, SimulacionFuerzas y FabricaNodosVisuales.
 *
 * Requisitos: RF-16 a RF-22 (representación 3D del subgrafo), RF-25 y RF-26
 * (girar y acercar la cámara), RF-27 (vista inicial), RNF-18 (Three.js).
 */
export class EscenaGrafo {
  // Pasos de simulación por fotograma: con 3, los 300 pasos tardan unos
  // 100 fotogramas (menos de 2 segundos a 60 fps).
  static PASOS_POR_FOTOGRAMA = 3;
  // Cuánto se acerca la cámara al encuadre en cada fotograma (0 = nada, 1 = de golpe).
  static SUAVIDAD_CAMARA = 0.08;

  #escena;
  #camara;
  #renderizador;
  #renderizadorEtiquetas;
  #controles;
  #contenedor;
  #grupo;
  #nodos;
  #enlaces;
  #idCentral;
  #camaraMovida;
  #disposicion;
  #simulacion;
  #fabrica;

  constructor() {
    this.#nodos = new Map();
    this.#enlaces = [];
    this.#idCentral = null;
    this.#camaraMovida = false;
    this.#disposicion = new CalculadorDisposicion();
    this.#simulacion = new SimulacionFuerzas();
    this.#fabrica = new FabricaNodosVisuales();
  }

  /**
   * Crea todo lo necesario para dibujar dentro del contenedor y arranca el
   * bucle de animación.
   *
   * @param {HTMLElement} contenedor - elemento de la página donde va la escena.
   * @param {Object|null} controlador - en este incremento es null; en el
   *   incremento 3 recibirá los clics sobre los nodos.
   */
  inicializar(contenedor, controlador) {
    this.#contenedor = contenedor;

    this.#escena = new THREE.Scene();
    this.#escena.background = new THREE.Color("#10141f");

    this.#camara = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.#camara.position.copy(this.#posicionEncuadre());

    this.#crearRenderizadores();
    this.#crearControles();
    this.#crearLuces();

    // Todos los nodos y líneas van en un grupo: así limpiar es fácil.
    this.#grupo = new THREE.Group();
    this.#escena.add(this.#grupo);

    // Three.js llama a estas funciones desde fuera de la clase, y dentro de
    // una función normal "this" ya no es la escena. Por eso guardamos antes
    // "this" en una variable y usamos esa variable dentro.
    const escenaGrafo = this;
    const observador = new ResizeObserver(function () {
      escenaGrafo.#redimensionar();
    });
    observador.observe(contenedor);
    this.#redimensionar();

    this.#renderizador.setAnimationLoop(function () {
      escenaGrafo.#animar();
    });
  }

  /**
   * Dibuja un subgrafo nuevo (borra el anterior).
   *
   * @param {Subgrafo} subgrafo
   */
  mostrarSubgrafo(subgrafo) {
    this.#limpiar();
    this.#idCentral = subgrafo.getEntidadCentral().getId();

    const posicionesIniciales = this.#disposicion.calcular(subgrafo);
    this.#crearNodos(subgrafo, posicionesIniciales);
    this.#crearEnlaces(subgrafo);
    this.#simulacion.iniciar(subgrafo, posicionesIniciales);
    this.#copiarPosicionesDeLaSimulacion();

    this.resaltarNodo(this.#idCentral);
    this.restablecerCamara();
  }

  /**
   * Resalta un nodo y sus relaciones, y quita el resalte a todo lo demás.
   *
   * @param {string} id - id de la entidad.
   */
  resaltarNodo(id) {
    for (const idNodo of this.#nodos.keys()) {
      this.#nodos.get(idNodo).resaltar(idNodo === id);
    }
    for (let i = 0; i < this.#enlaces.length; i++) {
      const relacion = this.#enlaces[i].getRelacion();
      const tocaElNodo = relacion.getOrigen().getId() === id || relacion.getDestino().getId() === id;
      this.#enlaces[i].resaltar(tocaElNodo);
    }
  }

  /**
   * Vuelve a la vista inicial: cámara encuadrando el grafo y mirando al
   * centro. Mientras la simulación se mueva, la cámara seguirá ajustando el
   * encuadre hasta que el usuario la mueva.
   */
  restablecerCamara() {
    this.#camaraMovida = false;
    this.#camara.position.copy(this.#posicionEncuadre());
    this.#controles.target.set(0, 0, 0);
    this.#controles.update();
  }

  /**
   * @returns {THREE.PerspectiveCamera}
   */
  getCamara() {
    return this.#camara;
  }

  /**
   * @returns {HTMLCanvasElement} el lienzo donde dibuja WebGL.
   */
  getDomElement() {
    return this.#renderizador.domElement;
  }

  /**
   * @returns {boolean} true cuando la simulación de fuerzas ha terminado.
   */
  estaEstabilizado() {
    return !this.#simulacion.estaActiva();
  }

  /**
   * Cuántas relaciones visibles hay de cada tipo (para la leyenda).
   *
   * @returns {Map<TipoRelacion, number>}
   */
  getRelacionesVisiblesPorTipo() {
    const cantidadPorTipo = new Map();
    for (let i = 0; i < this.#enlaces.length; i++) {
      const enlace = this.#enlaces[i];
      if (enlace.getLinea().visible) {
        const tipo = enlace.getRelacion().getTipo();
        let cantidad = 0;
        if (cantidadPorTipo.has(tipo)) {
          cantidad = cantidadPorTipo.get(tipo);
        }
        cantidadPorTipo.set(tipo, cantidad + 1);
      }
    }
    return cantidadPorTipo;
  }

  /**
   * (Privado) Renderizador WebGL (formas) y, encima, el de CSS (etiquetas).
   */
  #crearRenderizadores() {
    // preserveDrawingBuffer permite sacar una imagen del lienzo (incremento 3).
    this.#renderizador = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    // En pantallas de mucha densidad se limita a 2 para no perder fluidez.
    this.#renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.#contenedor.appendChild(this.#renderizador.domElement);

    this.#renderizadorEtiquetas = new CSS2DRenderer();
    // La clase capa-etiquetas la pone encima del lienzo y hace que no
    // capture el ratón (si no, no se podría girar la cámara).
    this.#renderizadorEtiquetas.domElement.className = "capa-etiquetas";
    this.#contenedor.appendChild(this.#renderizadorEtiquetas.domElement);
  }

  /**
   * (Privado) Controles de la cámara: girar arrastrando y acercar con la rueda.
   */
  #crearControles() {
    this.#controles = new OrbitControls(this.#camara, this.#renderizador.domElement);
    // La amortiguación hace que el giro se frene poco a poco, más natural.
    this.#controles.enableDamping = true;
    this.#controles.minDistance = 5;
    this.#controles.maxDistance = 300;

    // Cuando el usuario empieza a mover la cámara, dejamos de encuadrar
    // automáticamente (si no, la cámara "pelearía" con el usuario).
    const escenaGrafo = this;
    this.#controles.addEventListener("start", function () {
      escenaGrafo.#camaraMovida = true;
    });
  }

  /**
   * (Privado) Una luz ambiental (para que nada quede negro) y dos
   * direccionales desde lados opuestos (para que se noten las caras de las formas).
   */
  #crearLuces() {
    this.#escena.add(new THREE.AmbientLight(0xffffff, 0.7));
    const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.6);
    luzPrincipal.position.set(10, 20, 15);
    this.#escena.add(luzPrincipal);
    const luzDeRelleno = new THREE.DirectionalLight(0xffffff, 0.5);
    luzDeRelleno.position.set(-15, -10, -10);
    this.#escena.add(luzDeRelleno);
  }

  /**
   * (Privado) Un NodoVisual por nodo. Se muestra el nombre de la central, de
   * los nodos muy relevantes (≥ 0,75) y de los muy conectados (centralidad
   * ≥ 0,5); el resto se deja sin nombre para no llenar la pantalla de texto.
   *
   * @param {Subgrafo} subgrafo
   * @param {Map<string, THREE.Vector3>} posicionesIniciales
   */
  #crearNodos(subgrafo, posicionesIniciales) {
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const id = nodo.getEntidad().getId();
      const visual = this.#fabrica.crear(nodo);
      visual.setPosicion(posicionesIniciales.get(id));

      const esLaCentral = id === this.#idCentral;
      const esMuyRelevante = nodo.getRelevancia() >= 0.75;
      const estaMuyConectado = nodo.getCentralidad() >= 0.5;
      if (esLaCentral || esMuyRelevante || estaMuyConectado) {
        visual.mostrarEtiqueta(true);
      }

      this.#grupo.add(visual.getMalla());
      this.#nodos.set(id, visual);
    }
  }

  /**
   * (Privado) Una línea por relación. Las relaciones se agrupan por par de
   * entidades (getClavePar) para que cada una sepa su posición (indice) y
   * cuántas hay en el par (total); así se dibujan como curvas separadas (RF-38).
   *
   * @param {Subgrafo} subgrafo
   */
  #crearEnlaces(subgrafo) {
    const relaciones = subgrafo.getRelaciones();
    const relacionesPorPar = new Map();
    for (let i = 0; i < relaciones.length; i++) {
      const clave = relaciones[i].getClavePar();
      if (!relacionesPorPar.has(clave)) {
        relacionesPorPar.set(clave, []);
      }
      relacionesPorPar.get(clave).push(relaciones[i]);
    }

    for (const relacionesDelPar of relacionesPorPar.values()) {
      const total = relacionesDelPar.length;
      for (let indice = 0; indice < total; indice++) {
        const relacion = relacionesDelPar[indice];
        const origen = this.#nodos.get(relacion.getOrigen().getId());
        const destino = this.#nodos.get(relacion.getDestino().getId());
        const enlace = new EnlaceVisual(relacion, origen, destino, indice, total);
        this.#grupo.add(enlace.getLinea());
        this.#enlaces.push(enlace);
      }
    }
  }

  /**
   * (Privado) Se ejecuta en cada fotograma.
   */
  #animar() {
    if (this.#simulacion.estaActiva()) {
      this.#avanzarSimulacion();
    }
    this.#controles.update();
    this.#renderizador.render(this.#escena, this.#camara);
    this.#renderizadorEtiquetas.render(this.#escena, this.#camara);
  }

  /**
   * (Privado) Avanza la simulación unos pasos, mueve los nodos y las líneas
   * y, si el usuario no ha tocado la cámara, la acerca suavemente al encuadre.
   */
  #avanzarSimulacion() {
    for (let i = 0; i < EscenaGrafo.PASOS_POR_FOTOGRAMA; i++) {
      this.#simulacion.paso();
    }
    this.#copiarPosicionesDeLaSimulacion();

    if (!this.#camaraMovida) {
      // lerp acerca la cámara un 8 % de lo que le falta: el movimiento es suave.
      this.#camara.position.lerp(this.#posicionEncuadre(), EscenaGrafo.SUAVIDAD_CAMARA);
    }
  }

  /**
   * (Privado) Lleva las posiciones de la simulación a los nodos y recoloca las líneas.
   */
  #copiarPosicionesDeLaSimulacion() {
    for (const id of this.#nodos.keys()) {
      const posicion = this.#simulacion.getPosicion(id);
      if (posicion !== null) {
        this.#nodos.get(id).setPosicion(posicion);
      }
    }
    for (let i = 0; i < this.#enlaces.length; i++) {
      this.#enlaces[i].actualizar();
    }
  }

  /**
   * (Privado) Dónde poner la cámara para ver todo el grafo.
   * Se usa la distancia al centro del nodo del percentil 90 (el que deja
   * más cerca al 90 % de los nodos), no la del más lejano: así un único nodo
   * muy alejado no obliga a alejar la cámara y dejar el resto diminuto.
   *
   * @returns {THREE.Vector3}
   */
  #posicionEncuadre() {
    const distancias = [];
    if (this.#nodos !== undefined) {
      for (const visual of this.#nodos.values()) {
        distancias.push(visual.getPosicion().length());
      }
    }
    distancias.sort(EscenaGrafo.#compararNumeros);

    let radio = 10;
    if (distancias.length > 0) {
      const posicionPercentil = Math.ceil(distancias.length * 0.9) - 1;
      radio = Math.max(10, distancias[posicionPercentil]);
    }
    return new THREE.Vector3(0, radio * 0.35, radio * 2 + 4);
  }

  /**
   * (Privado) Para ordenar números de menor a mayor.
   *
   * @param {number} a
   * @param {number} b
   * @returns {number}
   */
  static #compararNumeros(a, b) {
    return a - b;
  }

  /**
   * (Privado) Ajusta cámara y renderizadores al tamaño del contenedor.
   */
  #redimensionar() {
    const ancho = this.#contenedor.clientWidth;
    const alto = this.#contenedor.clientHeight;
    if (ancho === 0 || alto === 0) {
      return;
    }
    this.#camara.aspect = ancho / alto;
    this.#camara.updateProjectionMatrix();
    this.#renderizador.setSize(ancho, alto);
    this.#renderizadorEtiquetas.setSize(ancho, alto);
  }

  /**
   * (Privado) Quita y libera todos los nodos y líneas del subgrafo anterior.
   */
  #limpiar() {
    for (const visual of this.#nodos.values()) {
      this.#grupo.remove(visual.getMalla());
      visual.liberar();
    }
    for (let i = 0; i < this.#enlaces.length; i++) {
      this.#grupo.remove(this.#enlaces[i].getLinea());
      this.#enlaces[i].liberar();
    }
    this.#nodos = new Map();
    this.#enlaces = [];
  }
}
