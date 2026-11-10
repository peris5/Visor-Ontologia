import * as THREE from 'three';

/**
 * CalculadorDisposicion
 *
 * Calcula las posiciones INICIALES de los nodos, antes de la simulación de
 * fuerzas. Partir de una colocación razonable tiene dos ventajas:
 *  - la simulación se estabiliza antes (los nodos ya empiezan cerca de su sitio);
 *  - es determinista: la misma entidad se dibuja siempre igual.
 *
 * Reglas:
 *  - La central, en el origen.
 *  - Los de nivel 1, repartidos por una esfera (espiral de Fibonacci),
 *    ordenados de más a menos relevantes, cada uno a una distancia del centro
 *    que depende de su relevancia.
 *  - Los de niveles siguientes, alrededor de su padre y hacia fuera.
 *
 * Requisitos: RF-16 y RF-17 (colocación según la relevancia), RNF-28.
 */
export class CalculadorDisposicion {
  #radioBase;
  #separacionNivel;

  constructor() {
    this.#radioBase = 6;
    this.#separacionNivel = 14;
  }

  /**
   * @param {Subgrafo} subgrafo
   * @returns {Map<string, THREE.Vector3>} id de la entidad → posición.
   */
  calcular(subgrafo) {
    const posiciones = new Map();
    const idCentral = subgrafo.getEntidadCentral().getId();
    posiciones.set(idCentral, new THREE.Vector3(0, 0, 0));

    // Nivel 1: en una esfera alrededor de la central.
    const nodosNivelUno = this.#nodosDelNivel(subgrafo, 1);
    const direccionesNivelUno = this.#distribuirEnEsfera(nodosNivelUno, 1);
    for (let i = 0; i < nodosNivelUno.length; i++) {
      const nodo = nodosNivelUno[i];
      const distancia = this.#distanciaSegunRelevancia(nodo.getRelevancia());
      const posicion = direccionesNivelUno[i].clone().multiplyScalar(distancia);
      posiciones.set(nodo.getEntidad().getId(), posicion);
    }

    // Niveles 2 y siguientes, de dentro hacia fuera: así el padre de cada
    // nodo ya está colocado cuando le llega el turno.
    const nivelMaximo = this.#nivelMaximo(subgrafo);
    for (let nivel = 2; nivel <= nivelMaximo; nivel++) {
      this.#colocarNivel(subgrafo, nivel, posiciones);
    }
    return posiciones;
  }

  /**
   * (Privado) Distancia al centro de un nodo de nivel 1:
   * radioBase + (1 − relevancia) · separacionNivel.
   *
   * @param {number} relevancia
   * @returns {number}
   */
  #distanciaSegunRelevancia(relevancia) {
    return this.#radioBase + (1 - relevancia) * this.#separacionNivel;
  }

  /**
   * (Privado) Reparte puntos por una esfera con la espiral de Fibonacci:
   * se avanza en altura de un polo al otro en pasos iguales y se gira un
   * "ángulo áureo" cada vez. Los puntos quedan muy uniformes y la posición
   * de cada uno depende solo de su orden.
   *
   * @param {NodoRelevante[]} nodos
   * @param {number} radio
   * @returns {THREE.Vector3[]} un punto por nodo, en el mismo orden.
   */
  #distribuirEnEsfera(nodos, radio) {
    const puntos = [];
    const cantidad = nodos.length;
    const anguloAureo = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < cantidad; i++) {
      const y = 1 - 2 * (i + 0.5) / cantidad;
      const radioHorizontal = Math.sqrt(1 - y * y);
      const angulo = i * anguloAureo;
      const punto = new THREE.Vector3(Math.cos(angulo) * radioHorizontal, y, Math.sin(angulo) * radioHorizontal);
      puntos.push(punto.multiplyScalar(radio));
    }
    return puntos;
  }

  /**
   * (Privado) Busca el padre de un nodo: entre los nodos ya colocados que
   * están relacionados con él y tienen un nivel menor, el de nivel más alto
   * (el inmediatamente anterior, que es por donde llegó la búsqueda) y, a
   * igualdad, el de mayor relevancia.
   *
   * @param {NodoRelevante} nodo
   * @param {Subgrafo} subgrafo
   * @param {Map<string, THREE.Vector3>} posiciones
   * @returns {string|null} id del padre, o null si no hay ninguno.
   */
  #buscarPadre(nodo, subgrafo, posiciones) {
    const idNodo = nodo.getEntidad().getId();
    const relaciones = subgrafo.getRelaciones();
    let mejorPadre = null;

    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      let idVecino = null;
      if (relacion.getOrigen().getId() === idNodo) {
        idVecino = relacion.getDestino().getId();
      } else if (relacion.getDestino().getId() === idNodo) {
        idVecino = relacion.getOrigen().getId();
      }
      if (idVecino !== null && posiciones.has(idVecino)) {
        const vecino = subgrafo.getNodo(idVecino);
        if (vecino.getNivel() < nodo.getNivel() && this.#esMejorPadre(vecino, mejorPadre)) {
          mejorPadre = vecino;
        }
      }
    }

    if (mejorPadre === null) {
      return null;
    }
    return mejorPadre.getEntidad().getId();
  }

  /**
   * (Privado) ¿El candidato es mejor padre que el que teníamos?
   *
   * @param {NodoRelevante} candidato
   * @param {NodoRelevante|null} actual
   * @returns {boolean}
   */
  #esMejorPadre(candidato, actual) {
    if (actual === null) {
      return true;
    }
    if (candidato.getNivel() !== actual.getNivel()) {
      return candidato.getNivel() > actual.getNivel();
    }
    return candidato.getRelevancia() > actual.getRelevancia();
  }

  /**
   * (Privado) Coloca los nodos de un nivel (2 o más) alrededor de su padre:
   *    dirección = (dirección del padre + 0,8 · dirección de la espiral), normalizada
   *    posición  = padre + dirección · (3 + (1 − relevancia) · 6)
   * La dirección del padre empuja "hacia fuera" y la de la espiral separa a
   * los hermanos entre sí.
   *
   * @param {Subgrafo} subgrafo
   * @param {number} nivel
   * @param {Map<string, THREE.Vector3>} posiciones - se completa.
   */
  #colocarNivel(subgrafo, nivel, posiciones) {
    const nodos = this.#nodosDelNivel(subgrafo, nivel);
    const direccionesEspiral = this.#distribuirEnEsfera(nodos, 1);

    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const idPadre = this.#buscarPadre(nodo, subgrafo, posiciones);
      let posicionDelPadre = new THREE.Vector3(0, 0, 0);
      if (idPadre !== null) {
        posicionDelPadre = posiciones.get(idPadre);
      }

      const direccion = posicionDelPadre.clone().normalize();
      direccion.addScaledVector(direccionesEspiral[i], 0.8);
      direccion.normalize();

      // Si el padre es la central (posición 0) se mide desde el centro, como en el nivel 1.
      let distancia = 3 + (1 - nodo.getRelevancia()) * 6;
      if (posicionDelPadre.lengthSq() === 0) {
        distancia = this.#distanciaSegunRelevancia(nodo.getRelevancia());
      }
      const posicion = posicionDelPadre.clone().addScaledVector(direccion, distancia);
      posiciones.set(nodo.getEntidad().getId(), posicion);
    }
  }

  /**
   * (Privado) Nodos de un nivel, de más a menos relevantes (a igualdad, por id,
   * para que el orden no dependa de cómo llegaron).
   *
   * @param {Subgrafo} subgrafo
   * @param {number} nivel
   * @returns {NodoRelevante[]}
   */
  #nodosDelNivel(subgrafo, nivel) {
    const todos = subgrafo.getNodos();
    const delNivel = [];
    for (let i = 0; i < todos.length; i++) {
      if (todos[i].getNivel() === nivel) {
        delNivel.push(todos[i]);
      }
    }
    delNivel.sort(CalculadorDisposicion.#compararPorRelevancia);
    return delNivel;
  }

  /**
   * (Privado) Para ordenar de más a menos relevante y, a igualdad, por id.
   *
   * @param {NodoRelevante} nodoA
   * @param {NodoRelevante} nodoB
   * @returns {number}
   */
  static #compararPorRelevancia(nodoA, nodoB) {
    if (nodoA.getRelevancia() !== nodoB.getRelevancia()) {
      return nodoB.getRelevancia() - nodoA.getRelevancia();
    }
    const idA = nodoA.getEntidad().getId();
    const idB = nodoB.getEntidad().getId();
    if (idA < idB) {
      return -1;
    }
    if (idA > idB) {
      return 1;
    }
    return 0;
  }

  /**
   * (Privado) Nivel más alto del subgrafo.
   *
   * @param {Subgrafo} subgrafo
   * @returns {number}
   */
  #nivelMaximo(subgrafo) {
    const nodos = subgrafo.getNodos();
    let maximo = 0;
    for (let i = 0; i < nodos.length; i++) {
      if (nodos[i].getNivel() > maximo) {
        maximo = nodos[i].getNivel();
      }
    }
    return maximo;
  }
}
