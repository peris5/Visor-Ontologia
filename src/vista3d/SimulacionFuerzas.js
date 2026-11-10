/**
 * SimulacionFuerzas
 *
 * Grafo dirigido por fuerzas programado a mano. Coloca los nodos del
 * subgrafo moviéndolos poco a poco, como si fueran bolas unidas por muelles:
 *
 *  1. REPULSIÓN: todos los nodos cercanos se empujan entre sí, para que no
 *     se amontonen.
 *  2. MUELLES: cada par de entidades relacionadas está unido por un muelle
 *     que tira de ellas hasta una longitud de reposo. Las relaciones más
 *     relevantes tienen muelles más cortos y más fuertes, así que sus
 *     entidades acaban juntas y se forman grupos (cúmulos, RF-40).
 *  3. RESTRICCIÓN RADIAL: después de moverse, cada nodo se vuelve a colocar
 *     exactamente a su distancia del centro, que depende solo de su
 *     relevancia. Así LA DISTANCIA AL CENTRO SE LEE COMO RELEVANCIA (RF-17), y
 *     las fuerzas solo deciden en qué punto de esa esfera queda cada nodo.
 *
 * Cada paso multiplica las fuerzas por "alfa", la "temperatura" de la
 * simulación: empieza en 1 y baja un poco en cada paso. Cuando llega a 0,001
 * la simulación se para (está estabilizada).
 *
 * No usa Three.js: trabaja con objetos { x, y, z }, así se puede probar sin
 * tarjeta gráfica.
 *
 * Requisitos: RNF-28 (disposición por fuerzas), RF-17 (distancia según
 * relevancia), RF-40 (cúmulos de entidades muy relacionadas).
 */
export class SimulacionFuerzas {
  static PARAMETROS_POR_DEFECTO = Object.freeze({
    repulsion: 5,
    distanciaRepulsion: 15,
    rigidez: 4,
    exponenteMuelle: 2,
    longitudMinima: 2,
    longitudVariable: 20,
    radioMinimo: 6,
    radioVariable: 40,
    rozamiento: 0.4,
    pasos: 300
  });

  // Por debajo de este alfa la simulación se considera estabilizada.
  static ALFA_MINIMO = 0.001;

  #parametros;
  #alfa;
  #pasos;
  // Nodos de la simulación: { id, x, y, z, vx, vy, vz, fijo, radio, grado }.
  #nodos;
  // Muelles: { a, b, longitud, fuerza } (a y b son posiciones en #nodos).
  #muelles;
  // id de la entidad → posición en #nodos, para encontrar un nodo al momento.
  #indicePorId;

  /**
   * @param {Object} [parametros] - opcional: sustituye algunos de
   *   PARAMETROS_POR_DEFECTO (se usa en las pruebas).
   */
  constructor(parametros) {
    this.#parametros = {};
    const nombres = Object.keys(SimulacionFuerzas.PARAMETROS_POR_DEFECTO);
    for (let i = 0; i < nombres.length; i++) {
      const nombre = nombres[i];
      this.#parametros[nombre] = SimulacionFuerzas.PARAMETROS_POR_DEFECTO[nombre];
      if (parametros !== undefined && parametros !== null && typeof parametros[nombre] === "number") {
        this.#parametros[nombre] = parametros[nombre];
      }
    }
    this.#alfa = 0;
    this.#pasos = 0;
    this.#nodos = [];
    this.#muelles = [];
    this.#indicePorId = new Map();
  }

  /**
   * Prepara la simulación para un subgrafo nuevo.
   *
   * @param {Subgrafo} subgrafo
   * @param {Map<string, {x:number, y:number, z:number}>|null} posicionesIniciales -
   *   opcional (las da CalculadorDisposicion). Se usa su dirección, pero cada
   *   nodo se coloca ya a su distancia del centro.
   */
  iniciar(subgrafo, posicionesIniciales) {
    this.#alfa = 1;
    this.#pasos = 0;
    this.#crearNodos(subgrafo, posicionesIniciales);
    this.#crearMuelles(subgrafo);
  }

  /**
   * Avanza un paso de la simulación.
   *
   * @returns {boolean} false si ya estaba estabilizada (no se ha movido nada).
   */
  paso() {
    if (!this.estaActiva()) {
      return false;
    }
    // alfa baja un poco en cada paso. El decaimiento se elige para que tras
    // "pasos" pasos alfa valga justo 0,001: alfa = 1 · (1 − decaimiento)^pasos.
    const decaimiento = 1 - Math.pow(SimulacionFuerzas.ALFA_MINIMO, 1 / this.#parametros.pasos);
    this.#alfa = this.#alfa - this.#alfa * decaimiento;

    this.#aplicarRepulsion();
    this.#aplicarMuelles();
    this.#mover();
    this.#pasos = this.#pasos + 1;
    return true;
  }

  /**
   * @returns {boolean} true mientras alfa no haya bajado de 0,001.
   */
  estaActiva() {
    return this.#alfa >= SimulacionFuerzas.ALFA_MINIMO;
  }

  /**
   * @returns {number} pasos dados desde iniciar().
   */
  getPasos() {
    return this.#pasos;
  }

  /**
   * @param {string} id - id de la entidad.
   * @returns {{x:number, y:number, z:number}|null} copia de su posición, o
   *   null si no está en la simulación.
   */
  getPosicion(id) {
    if (!this.#indicePorId.has(id)) {
      return null;
    }
    const nodo = this.#nodos[this.#indicePorId.get(id)];
    return { x: nodo.x, y: nodo.y, z: nodo.z };
  }

  /**
   * Distancia al centro de un nodo según su relevancia: los más relevantes,
   * más cerca. Relevancia 1 → radioMinimo; relevancia 0 → radioMinimo + radioVariable.
   *
   * @param {number} relevancia - entre 0 y 1.
   * @returns {number}
   */
  distanciaSegunRelevancia(relevancia) {
    return this.#parametros.radioMinimo + (1 - relevancia) * this.#parametros.radioVariable;
  }

  /**
   * Vuelve a poner en marcha la simulación (por ejemplo, tras arrastrar un
   * nodo en el incremento 3). Si ya tenía más alfa, no lo baja.
   *
   * @param {number} alfa - entre 0 y 1.
   */
  reactivar(alfa) {
    if (alfa > this.#alfa) {
      this.#alfa = alfa;
    }
  }

  /**
   * (Privado) Crea un nodo de simulación por cada NodoRelevante.
   *
   * @param {Subgrafo} subgrafo
   * @param {Map|null} posicionesIniciales
   */
  #crearNodos(subgrafo, posicionesIniciales) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const nodosDelSubgrafo = subgrafo.getNodos();
    this.#nodos = [];
    this.#indicePorId = new Map();

    for (let i = 0; i < nodosDelSubgrafo.length; i++) {
      const nodoRelevante = nodosDelSubgrafo[i];
      const id = nodoRelevante.getEntidad().getId();
      const esLaCentral = id === idCentral;
      const nodo = { id: id, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fijo: esLaCentral, radio: 0, grado: 0 };

      // La central está fija en el origen; los demás, ya a su distancia.
      if (!esLaCentral) {
        nodo.radio = this.distanciaSegunRelevancia(nodoRelevante.getRelevancia());
        let direccion = null;
        if (posicionesIniciales !== undefined && posicionesIniciales !== null && posicionesIniciales.has(id)) {
          direccion = posicionesIniciales.get(id);
        }
        if (direccion === null || SimulacionFuerzas.#longitud(direccion.x, direccion.y, direccion.z) === 0) {
          direccion = this.#posicionPorDefecto(i, nodosDelSubgrafo.length);
        }
        const escala = nodo.radio / SimulacionFuerzas.#longitud(direccion.x, direccion.y, direccion.z);
        nodo.x = direccion.x * escala;
        nodo.y = direccion.y * escala;
        nodo.z = direccion.z * escala;
      }
      this.#indicePorId.set(id, this.#nodos.length);
      this.#nodos.push(nodo);
    }
  }

  /**
   * (Privado) Crea un muelle por cada PAR de entidades relacionadas.
   *  - Si entre dos entidades hay varias relaciones, manda la más relevante
   *    (un solo muelle por par, para que no tiren el doble).
   *  - No hay muelles con la central: su distancia ya la fija la restricción
   *    radial, y si tirara de todos los nodos se juntarían en un solo lado.
   *
   * Cada muelle guarda su longitud de reposo y su fuerza:
   *    longitud = longitudMinima + (1 − r) · longitudVariable
   *    fuerza   = rigidez · r ^ exponenteMuelle
   * Con el exponente 2, una relación de 0,9 tira 0,81 y una de 0,3 solo 0,09:
   * las relaciones fuertes mandan mucho más que las débiles.
   *
   * @param {Subgrafo} subgrafo
   */
  #crearMuelles(subgrafo) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const relaciones = subgrafo.getRelaciones();

    // clave del par → mejor relevancia entre las dos entidades.
    const mejorRelevanciaPorPar = new Map();
    const extremosPorPar = new Map();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const idOrigen = relacion.getOrigen().getId();
      const idDestino = relacion.getDestino().getId();
      const tocaLaCentral = idOrigen === idCentral || idDestino === idCentral;
      const estanLosDos = this.#indicePorId.has(idOrigen) && this.#indicePorId.has(idDestino);
      if (!tocaLaCentral && estanLosDos && idOrigen !== idDestino) {
        const clave = relacion.getClavePar();
        if (!mejorRelevanciaPorPar.has(clave) || relacion.getRelevancia() > mejorRelevanciaPorPar.get(clave)) {
          mejorRelevanciaPorPar.set(clave, relacion.getRelevancia());
          extremosPorPar.set(clave, [idOrigen, idDestino]);
        }
      }
    }

    this.#muelles = [];
    for (const clave of mejorRelevanciaPorPar.keys()) {
      const relevancia = mejorRelevanciaPorPar.get(clave);
      const extremos = extremosPorPar.get(clave);
      const muelle = {
        a: this.#indicePorId.get(extremos[0]),
        b: this.#indicePorId.get(extremos[1]),
        longitud: this.#parametros.longitudMinima + (1 - relevancia) * this.#parametros.longitudVariable,
        fuerza: this.#parametros.rigidez * Math.pow(relevancia, this.#parametros.exponenteMuelle)
      };
      this.#muelles.push(muelle);
      // El grado (número de muelles de cada nodo) sirve para repartir la fuerza.
      this.#nodos[muelle.a].grado = this.#nodos[muelle.a].grado + 1;
      this.#nodos[muelle.b].grado = this.#nodos[muelle.b].grado + 1;
    }
  }

  /**
   * (Privado) Repulsión: cada pareja de nodos a menos de distanciaRepulsion
   * se empuja. Más allá no se repelen: así los grupos de entidades muy
   * relacionadas pueden quedarse juntos y separados de los demás (cúmulos).
   *
   *    f = repulsion · alfa / max(d², 1)
   *
   * Se resta "diferencia · f" a la velocidad de uno y se suma al otro, con
   * diferencia = vector que va del primero al segundo. Como la diferencia
   * mide d, el empujón total es repulsion · alfa / d: cuanto más cerca, más
   * fuerte. El max(d², 1) evita empujones enormes si están casi encima.
   */
  #aplicarRepulsion() {
    const distanciaMaxima = this.#parametros.distanciaRepulsion;
    const distanciaMaximaAlCuadrado = distanciaMaxima * distanciaMaxima;

    for (let i = 0; i < this.#nodos.length; i++) {
      const nodoA = this.#nodos[i];
      for (let j = i + 1; j < this.#nodos.length; j++) {
        const nodoB = this.#nodos[j];
        let dx = nodoB.x - nodoA.x;
        let dy = nodoB.y - nodoA.y;
        let dz = nodoB.z - nodoA.z;
        // Si dos nodos están exactamente en el mismo punto no sabemos hacia
        // dónde empujarlos: los separamos un poquito al azar.
        if (dx === 0 && dy === 0 && dz === 0) {
          dx = (Math.random() - 0.5) * 1e-6;
          dy = (Math.random() - 0.5) * 1e-6;
          dz = (Math.random() - 0.5) * 1e-6;
        }
        const distanciaAlCuadrado = dx * dx + dy * dy + dz * dz;
        if (distanciaAlCuadrado < distanciaMaximaAlCuadrado) {
          const fuerza = this.#parametros.repulsion * this.#alfa / Math.max(distanciaAlCuadrado, 1);
          nodoA.vx = nodoA.vx - dx * fuerza;
          nodoA.vy = nodoA.vy - dy * fuerza;
          nodoA.vz = nodoA.vz - dz * fuerza;
          nodoB.vx = nodoB.vx + dx * fuerza;
          nodoB.vy = nodoB.vy + dy * fuerza;
          nodoB.vz = nodoB.vz + dz * fuerza;
        }
      }
    }
  }

  /**
   * (Privado) Muelles: cada muelle acerca o aleja sus dos extremos hacia su
   * longitud de reposo.
   *
   *  - Se usan las posiciones FUTURAS (posición + velocidad), como hace la
   *    librería d3-force: así el muelle corrige también el movimiento que el
   *    nodo ya lleva y la simulación oscila menos.
   *  - k = (d − longitud) / d · alfa · fuerza / min(gradoA, gradoB)
   *    Si d > longitud, k es positivo y los acerca; si es menor, los aleja.
   *    Dividir por el grado menor evita que un nodo con muchos muelles reciba
   *    tantos tirones que salga disparado.
   *  - Reparto: reparto = gradoA / (gradoA + gradoB). El extremo B se mueve
   *    "reparto" del total y A el resto. Así el nodo con MENOS conexiones se
   *    mueve más: es más fácil mover una hoja hacia su grupo que mover el
   *    centro del grupo hacia la hoja (igual que d3-force).
   */
  #aplicarMuelles() {
    for (let i = 0; i < this.#muelles.length; i++) {
      const muelle = this.#muelles[i];
      const nodoA = this.#nodos[muelle.a];
      const nodoB = this.#nodos[muelle.b];

      const dx = (nodoB.x + nodoB.vx) - (nodoA.x + nodoA.vx);
      const dy = (nodoB.y + nodoB.vy) - (nodoA.y + nodoA.vy);
      const dz = (nodoB.z + nodoB.vz) - (nodoA.z + nodoA.vz);
      const distancia = SimulacionFuerzas.#longitud(dx, dy, dz);

      // Si están en el mismo punto no hay dirección: la repulsión los separará.
      if (distancia > 0) {
        const gradoMenor = Math.min(nodoA.grado, nodoB.grado);
        const k = (distancia - muelle.longitud) / distancia * this.#alfa * muelle.fuerza / gradoMenor;
        const reparto = nodoA.grado / (nodoA.grado + nodoB.grado);

        nodoB.vx = nodoB.vx - dx * k * reparto;
        nodoB.vy = nodoB.vy - dy * k * reparto;
        nodoB.vz = nodoB.vz - dz * k * reparto;
        nodoA.vx = nodoA.vx + dx * k * (1 - reparto);
        nodoA.vy = nodoA.vy + dy * k * (1 - reparto);
        nodoA.vz = nodoA.vz + dz * k * (1 - reparto);
      }
    }
  }

  /**
   * (Privado) Movimiento de cada nodo:
   *  1. El rozamiento frena la velocidad (si no, oscilarían siempre).
   *  2. Se suma la velocidad a la posición.
   *  3. Restricción radial: se escala la posición para que su distancia al
   *     origen sea exactamente su radio. Es lo que hace que la distancia al
   *     centro dependa SOLO de la relevancia.
   * La central (fija) vuelve siempre al origen con velocidad 0.
   */
  #mover() {
    const frenado = 1 - this.#parametros.rozamiento;
    for (let i = 0; i < this.#nodos.length; i++) {
      const nodo = this.#nodos[i];
      if (nodo.fijo) {
        nodo.x = 0;
        nodo.y = 0;
        nodo.z = 0;
        nodo.vx = 0;
        nodo.vy = 0;
        nodo.vz = 0;
      } else {
        nodo.vx = nodo.vx * frenado;
        nodo.vy = nodo.vy * frenado;
        nodo.vz = nodo.vz * frenado;
        nodo.x = nodo.x + nodo.vx;
        nodo.y = nodo.y + nodo.vy;
        nodo.z = nodo.z + nodo.vz;
        this.#recolocarEnSuRadio(nodo, i);
      }
    }
  }

  /**
   * (Privado) Pone el nodo a distancia "radio" del origen sin cambiar su dirección.
   *
   * @param {Object} nodo
   * @param {number} indice - para la posición por defecto si cae en el origen.
   */
  #recolocarEnSuRadio(nodo, indice) {
    let longitud = SimulacionFuerzas.#longitud(nodo.x, nodo.y, nodo.z);
    if (longitud === 0) {
      const direccion = this.#posicionPorDefecto(indice, this.#nodos.length);
      nodo.x = direccion.x;
      nodo.y = direccion.y;
      nodo.z = direccion.z;
      longitud = SimulacionFuerzas.#longitud(nodo.x, nodo.y, nodo.z);
    }
    const escala = nodo.radio / longitud;
    nodo.x = nodo.x * escala;
    nodo.y = nodo.y * escala;
    nodo.z = nodo.z * escala;
  }

  /**
   * (Privado) Dirección por defecto de un nodo sin posición inicial: puntos
   * repartidos por una esfera de radio 1 siguiendo una espiral (espiral de
   * Fibonacci). Es determinista: el mismo índice da siempre el mismo punto.
   *
   * @param {number} indice
   * @param {number} total - número de puntos de la espiral.
   * @returns {{x:number, y:number, z:number}}
   */
  #posicionPorDefecto(indice, total) {
    let cantidad = total;
    if (cantidad < 1) {
      cantidad = 1;
    }
    // Altura de -1 a 1 en pasos iguales y giro de un ángulo áureo cada vez.
    const anguloAureo = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - 2 * (indice + 0.5) / cantidad;
    const radioHorizontal = Math.sqrt(1 - y * y);
    const angulo = indice * anguloAureo;
    return { x: Math.cos(angulo) * radioHorizontal, y: y, z: Math.sin(angulo) * radioHorizontal };
  }

  /**
   * (Privado) Longitud de un vector.
   *
   * @returns {number}
   */
  static #longitud(x, y, z) {
    return Math.sqrt(x * x + y * y + z * z);
  }
}
