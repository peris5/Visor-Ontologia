import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CalculadorDisposicion } from './CalculadorDisposicion.js';
import { SimulacionFuerzas } from './SimulacionFuerzas.js';
import { FabricaNodosVisuales } from './FabricaNodosVisuales.js';
import { EnlaceVisual } from './EnlaceVisual.js';
import { SelectorInteraccion } from './SelectorInteraccion.js';
import { ModoDisposicion } from './ModoDisposicion.js';
import { DetectorComunidades } from '../logica/DetectorComunidades.js';
import { PaletaColores } from '../logica/PaletaColores.js';

/**
 * Crea la escena 3D y la anima: cámara, luces, renderizadores (el de WebGL
 * para las formas y el de CSS para las etiquetas), controles de la cámara y
 * el bucle que avanza la simulación de fuerzas y dibuja cada fotograma.
 *
 * También aplica los filtros de la leyenda (oculta o muestra nodos y líneas)
 * y resalta lo que el usuario selecciona.
 *
 * Y tiene dos modos de disposición (ModoDisposicion): libre y por grupos.
 * En «Por grupos» busca los grupos con DetectorComunidades, junta a cada
 * grupo en su zona y dibuja una mancha de color transparente detrás de cada
 * grupo grande (5 o más entidades).
 */
export class EscenaGrafo {
  // Pasos de simulación por fotograma: con 3, los 300 pasos tardan unos
  // 100 fotogramas (menos de 2 segundos a 60 fps).
  static PASOS_POR_FOTOGRAMA = 3;
  // Cuánto se acerca la cámara al encuadre en cada fotograma (0 = nada, 1 = de golpe).
  static SUAVIDAD_CAMARA = 0.08;
  // Las manchas solo se dibujan en grupos de al menos 5 entidades: con los
  // pequeños habría tantas que se taparían unas a otras.
  static MIEMBROS_MINIMOS_MANCHA = 5;
  // Tamaño de la mancha: la distancia MEDIA de sus nodos al centro del grupo
  // por este factor, más este margen. Se usa la media y no la del nodo más
  // alejado para que un solo nodo suelto no haga enorme la mancha.
  static FACTOR_MANCHA = 1.3;
  static MARGEN_MANCHA = 1.5;

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
  #selector;
  #detector;
  #modo;
  #subgrafo;
  #grupos;
  // Manchas de los grupos: { malla, ids } (ids de las entidades del grupo).
  #manchas;

  constructor() {
    this.#nodos = new Map();
    this.#enlaces = [];
    this.#idCentral = null;
    this.#camaraMovida = false;
    this.#disposicion = new CalculadorDisposicion();
    this.#simulacion = new SimulacionFuerzas();
    this.#fabrica = new FabricaNodosVisuales();
    this.#selector = null;
    this.#detector = new DetectorComunidades();
    this.#modo = ModoDisposicion.LIBRE;
    this.#subgrafo = null;
    this.#grupos = null;
    this.#manchas = [];
  }

  /**
   * Crea todo lo necesario para dibujar dentro del contenedor y arranca el
   * bucle de animación.
   *
   * @param {HTMLElement} contenedor - elemento de la página donde va la escena.
   * @param {ControladorExploracion|null} controlador - recibe los clics
   *   sobre los nodos y las relaciones (con null no se puede seleccionar nada).
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

    if (controlador !== null && controlador !== undefined) {
      this.#selector = new SelectorInteraccion(this, controlador, contenedor);
    }
  }

  /** Dibuja un subgrafo nuevo (borra el anterior). */
  mostrarSubgrafo(subgrafo) {
    this.#limpiar();
    this.#idCentral = subgrafo.getEntidadCentral().getId();
    this.#subgrafo = subgrafo;

    const posicionesIniciales = this.#disposicion.calcular(subgrafo);
    this.#crearNodos(subgrafo, posicionesIniciales);
    this.#crearEnlaces(subgrafo);
    this.#simulacion.iniciar(subgrafo, posicionesIniciales);
    // El modo elegido se mantiene al cambiar de entidad o de umbral.
    this.#aplicarModo();
    this.#copiarPosicionesDeLaSimulacion();

    this.resaltarNodo(this.#idCentral);
    this.restablecerCamara();
  }

  /**
   * Cambia el modo de disposición. Los nodos se mueven poco a poco hasta su
   * sitio nuevo (se vuelve a poner en marcha la simulación).
   *
   * @param {string} modo - un valor de ModoDisposicion.
   */
  setModoDisposicion(modo) {
    this.#modo = modo;
    if (this.#subgrafo !== null) {
      this.#aplicarModo();
      this.#simulacion.reactivar(1);
    }
  }

  /**
   * @returns {string} el modo de disposición actual (ModoDisposicion).
   */
  getModoDisposicion() {
    return this.#modo;
  }

  /**
   * @returns {number} cuántos grupos con mancha (5 o más entidades) hay en el modo
   *   «Por grupos» (0 en los otros modos).
   */
  getNumeroGrupos() {
    return this.#manchas.length;
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
   * Resalta una relación y sus dos nodos, y quita el resalte a todo lo demás.
   *
   * @param {string} id - id de la relación.
   */
  resaltarRelacion(id) {
    let idOrigen = null;
    let idDestino = null;
    for (let i = 0; i < this.#enlaces.length; i++) {
      const relacion = this.#enlaces[i].getRelacion();
      const esLaElegida = relacion.getId() === id;
      this.#enlaces[i].resaltar(esLaElegida);
      if (esLaElegida) {
        idOrigen = relacion.getOrigen().getId();
        idDestino = relacion.getDestino().getId();
      }
    }
    for (const idNodo of this.#nodos.keys()) {
      const esUnExtremo = idNodo === idOrigen || idNodo === idDestino;
      this.#nodos.get(idNodo).resaltar(esUnExtremo);
    }
  }

  /**
   * Oculta o muestra cada nodo y cada línea según el filtro de la leyenda.
   * Los nodos ocultos SIGUEN en la simulación de fuerzas (siguen empujando
   * y tirando de los demás); solo dejan de verse. Así, al volver a
   * mostrarlos, todo está donde estaba.
   */
  aplicarFiltro(filtro) {
    for (const visual of this.#nodos.values()) {
      visual.setVisible(filtro.esVisibleNodo(visual.getNodo(), this.#idCentral));
    }
    for (let i = 0; i < this.#enlaces.length; i++) {
      const enlace = this.#enlaces[i];
      enlace.setVisible(filtro.esVisibleRelacion(enlace.getRelacion(), this.#idCentral));
    }
  }

  /**
   * Los objetos 3D sobre los que se puede hacer clic: las mallas de los
   * nodos y las líneas de las relaciones que se ven ahora.
   */
  getObjetosSeleccionables() {
    const objetos = [];
    for (const visual of this.#nodos.values()) {
      if (visual.getVisible()) {
        objetos.push(visual.getMalla());
      }
    }
    for (let i = 0; i < this.#enlaces.length; i++) {
      const linea = this.#enlaces[i].getLinea();
      if (linea.visible) {
        objetos.push(linea);
      }
    }
    return objetos;
  }

  /**
   * @param {string} id - id de la entidad.
   */
  getNodoVisual(id) {
    if (this.#nodos.has(id)) {
      return this.#nodos.get(id);
    }
    return null;
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
   * Cuántas relaciones visibles hay de cada tipo (para la leyenda). Solo
   * cuenta las que se ven: las ocultas por el filtro no.
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

  /** Renderizador WebGL (formas) y, encima, el de CSS (etiquetas). */
  #crearRenderizadores() {
    // preserveDrawingBuffer permitirá sacar una imagen del lienzo.
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

  /** Controles de la cámara: girar arrastrando y acercar con la rueda. */
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
   * Una luz ambiental (para que nada quede negro) y dos
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
   * Un NodoVisual por nodo. Se muestra el nombre de la central, de
   * los nodos muy relevantes (≥ 0,75) y de los muy conectados (centralidad
   * ≥ 0,5); el resto se deja sin nombre para no llenar la pantalla de texto.
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
   * Una línea por relación. Las relaciones se agrupan por par de
   * entidades (getClavePar) para que cada una sepa su posición (indice) y
   * cuántas hay en el par (total); así se dibujan como curvas separadas.
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
        const enlace = new EnlaceVisual(relacion, origen, destino, indice, total,
          EscenaGrafo.#esDiscontinua(subgrafo, relacion));
        this.#grupo.add(enlace.getLinea());
        this.#enlaces.push(enlace);
      }
    }
  }

  /**
   * ¿Se dibuja discontinua? Las aristas COINCIDENCIAS (sintéticas) y las de
   * una pareja sin ninguna relación declarada (solo coincidencias).
   */
  static #esDiscontinua(subgrafo, relacion) {
    if (relacion.esSintetica()) {
      return true;
    }
    const evidencia = subgrafo.getEvidencia(relacion.getOrigen().getId(), relacion.getDestino().getId());
    return evidencia !== null && !evidencia.esDeclarada();
  }

  /** Se ejecuta en cada fotograma. */
  #animar() {
    if (this.#simulacion.estaActiva()) {
      this.#avanzarSimulacion();
    }
    this.#controles.update();
    this.#renderizador.render(this.#escena, this.#camara);
    this.#renderizadorEtiquetas.render(this.#escena, this.#camara);
  }

  /**
   * Avanza la simulación unos pasos, mueve los nodos y las líneas
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

  /** Lleva las posiciones de la simulación a los nodos y recoloca las líneas. */
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
    this.#actualizarManchas();
  }

  /**
   * Aplica el modo de disposición al subgrafo actual: calcula los
   * grupos (si hace falta), la dirección de cada nodo y las manchas.
   */
  #aplicarModo() {
    this.#grupos = null;
    if (this.#modo === ModoDisposicion.POR_GRUPOS) {
      this.#grupos = this.#detector.detectar(this.#subgrafo);
    }
    const direcciones = this.#disposicion.direccionesObjetivo(this.#subgrafo, this.#modo, this.#grupos);
    this.#simulacion.setDireccionesObjetivo(direcciones);
    this.#crearManchas();
  }

  /**
   * Una esfera transparente detrás de cada grupo de 5 o más
   * entidades (solo en «Por grupos»), cada una de un color. Se ve como una
   * mancha que envuelve al grupo. No se puede seleccionar con el ratón.
   */
  #crearManchas() {
    this.#quitarManchas();
    if (this.#grupos === null) {
      return;
    }
    const idsPorGrupo = [];
    for (const id of this.#grupos.keys()) {
      const numero = this.#grupos.get(id);
      while (idsPorGrupo.length <= numero) {
        idsPorGrupo.push([]);
      }
      idsPorGrupo[numero].push(id);
    }
    for (let numero = 0; numero < idsPorGrupo.length; numero++) {
      if (idsPorGrupo[numero].length >= EscenaGrafo.MIEMBROS_MINIMOS_MANCHA) {
        const material = new THREE.MeshBasicMaterial({
          color: PaletaColores.colorPara(numero),
          transparent: true,
          opacity: 0.07,
          // depthWrite false: la mancha no tapa a los nodos que tiene dentro.
          depthWrite: false
        });
        const malla = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
        this.#grupo.add(malla);
        this.#manchas.push({ malla: malla, ids: idsPorGrupo[numero] });
      }
    }
  }

  /**
   * Coloca cada mancha en el centro de su grupo y le da un tamaño
   * según lo separados que están sus nodos (ver FACTOR_MANCHA).
   */
  #actualizarManchas() {
    for (let i = 0; i < this.#manchas.length; i++) {
      const mancha = this.#manchas[i];
      const centro = new THREE.Vector3(0, 0, 0);
      const posiciones = [];
      for (let j = 0; j < mancha.ids.length; j++) {
        const posicion = this.#simulacion.getPosicion(mancha.ids[j]);
        if (posicion !== null) {
          const vector = new THREE.Vector3(posicion.x, posicion.y, posicion.z);
          posiciones.push(vector);
          centro.add(vector);
        }
      }
      if (posiciones.length > 0) {
        centro.multiplyScalar(1 / posiciones.length);
        let suma = 0;
        for (let j = 0; j < posiciones.length; j++) {
          suma = suma + posiciones[j].distanceTo(centro);
        }
        const media = suma / posiciones.length;
        mancha.malla.position.copy(centro);
        mancha.malla.scale.setScalar(media * EscenaGrafo.FACTOR_MANCHA + EscenaGrafo.MARGEN_MANCHA);
      }
    }
  }

  /** Quita y libera las manchas de los grupos. */
  #quitarManchas() {
    for (let i = 0; i < this.#manchas.length; i++) {
      this.#grupo.remove(this.#manchas[i].malla);
      this.#manchas[i].malla.geometry.dispose();
      this.#manchas[i].malla.material.dispose();
    }
    this.#manchas = [];
  }

  /**
   * Dónde poner la cámara para ver todo el grafo.
   * Se usa la distancia al centro del nodo del percentil 90 (el que deja
   * más cerca al 90 % de los nodos), no la del más lejano: así un único nodo
   * muy alejado no obliga a alejar la cámara y dejar el resto diminuto.
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

  /** Para ordenar números de menor a mayor. */
  static #compararNumeros(a, b) {
    return a - b;
  }

  /** Ajusta cámara y renderizadores al tamaño del contenedor. */
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
   * Quita y libera todos los nodos y líneas del subgrafo anterior,
   * y oculta la etiqueta flotante (el objeto que señalaba ya no existe).
   */
  #limpiar() {
    if (this.#selector !== null) {
      this.#selector.ocultarEtiqueta();
    }
    this.#quitarManchas();
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
