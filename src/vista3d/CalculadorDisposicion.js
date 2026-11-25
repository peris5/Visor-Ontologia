import * as THREE from 'three';
import { ModoDisposicion } from './ModoDisposicion.js';

/**
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
 * También calcula, según el modo de disposición, hacia qué DIRECCIÓN tiene
 * que ir cada nodo (direccionesObjetivo): SimulacionFuerzas los empuja hacia
 * ella sin cambiar su distancia al centro.
 */
export class CalculadorDisposicion {
  #radioBase;
  #separacionNivel;

  constructor() {
    this.#radioBase = 6;
    this.#separacionNivel = 14;
  }

  /**
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
   * Distancia al centro de un nodo de nivel 1:
   * radioBase + (1 − relevancia) · separacionNivel.
   */
  #distanciaSegunRelevancia(relevancia) {
    return this.#radioBase + (1 - relevancia) * this.#separacionNivel;
  }

  /**
   * Reparte puntos por una esfera con la espiral de Fibonacci:
   * se avanza en altura de un polo al otro en pasos iguales y se gira un
   * "ángulo áureo" cada vez. Los puntos quedan muy uniformes y la posición
   * de cada uno depende solo de su orden.
   *
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
   * Busca el padre de un nodo: entre los nodos ya colocados que
   * están relacionados con él y tienen un nivel menor, el de nivel más alto
   * (el inmediatamente anterior, que es por donde llegó la búsqueda) y, a
   * igualdad, el de mayor relevancia.
   *
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

  /** ¿El candidato es mejor padre que el que teníamos? */
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
   * Coloca los nodos de un nivel (2 o más) alrededor de su padre:
   *    dirección = (dirección del padre + 0,8 · dirección de la espiral), normalizada
   *    posición  = padre + dirección · (3 + (1 − relevancia) · 6)
   * La dirección del padre empuja "hacia fuera" y la de la espiral separa a
   * los hermanos entre sí.
   *
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
   * Nodos de un nivel, de más a menos relevantes (a igualdad, por id,
   * para que el orden no dependa de cómo llegaron).
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

  /** Para ordenar de más a menos relevante y, a igualdad, por id. */
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

  /** Nivel más alto del subgrafo. */
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

  /**
   * Hacia qué dirección (vector de longitud 1) tiene que ir cada nodo en
   * un modo de disposición. Los nodos que no salen en el mapa se mueven
   * libremente (como siempre).
   *
   *  - LIBRE: ninguno.
   *  - POR_GRUPOS: cada grupo de 2 o más entidades, una dirección propia,
   *    repartidas por la esfera con la espiral de Fibonacci para que queden
   *    lo más separadas posible. Los nodos que están solos en su grupo
   *    quedan libres.
   * La central nunca sale (está fija en el centro).
   *
   * @param {string} modo - un valor de ModoDisposicion.
   * @param {Map<string, number>|null} grupos - id → número de grupo
   *   (DetectorComunidades); solo hace falta en POR_GRUPOS.
   * @returns {Map<string, {x:number, y:number, z:number}>}
   */
  direccionesObjetivo(subgrafo, modo, grupos) {
    const direcciones = new Map();
    const idCentral = subgrafo.getEntidadCentral().getId();
    if (modo === ModoDisposicion.POR_GRUPOS && grupos !== null && grupos !== undefined) {
      const tamanos = CalculadorDisposicion.#tamanosDeGrupo(grupos);
      // Solo los grupos de 2 o más; como están numerados de mayor a menor
      // tamaño, son los primeros números.
      let gruposConDireccion = 0;
      for (let numero = 0; numero < tamanos.length; numero++) {
        if (tamanos[numero] >= 2) {
          gruposConDireccion = gruposConDireccion + 1;
        }
      }
      const direccionesDeGrupo = CalculadorDisposicion.#puntosEnEsfera(gruposConDireccion);
      for (const id of grupos.keys()) {
        const numero = grupos.get(id);
        if (id !== idCentral && numero < gruposConDireccion) {
          direcciones.set(id, direccionesDeGrupo[numero]);
        }
      }
    }
    return direcciones;
  }

  /** Cuántos nodos tiene cada grupo (posición = número de grupo). */
  static #tamanosDeGrupo(grupos) {
    const tamanos = [];
    for (const numero of grupos.values()) {
      while (tamanos.length <= numero) {
        tamanos.push(0);
      }
      tamanos[numero] = tamanos[numero] + 1;
    }
    return tamanos;
  }

  /**
   * N puntos repartidos por una esfera de radio 1 (espiral de
   * Fibonacci). Con un solo punto, delante de la cámara.
   *
   * @returns {{x:number, y:number, z:number}[]}
   */
  static #puntosEnEsfera(cantidad) {
    const puntos = [];
    if (cantidad === 1) {
      puntos.push({ x: 0, y: 0, z: 1 });
      return puntos;
    }
    const anguloAureo = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < cantidad; i++) {
      const y = 1 - 2 * (i + 0.5) / cantidad;
      const radioHorizontal = Math.sqrt(1 - y * y);
      const angulo = i * anguloAureo;
      puntos.push({ x: Math.cos(angulo) * radioHorizontal, y: y, z: Math.sin(angulo) * radioHorizontal });
    }
    return puntos;
  }
}
