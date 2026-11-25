import * as THREE from 'three';

/**
 * La línea 3D de una Relacion entre dos NodoVisual.
 *  - Su color es el del tipo de relación.
 *  - Su opacidad depende de la relevancia: las relaciones más relevantes se
 *    ven más intensas.
 *  - Si entre dos entidades hay varias relaciones, cada una se dibuja como
 *    una curva separada de las demás, para que se vean todas.
 *  - Las aristas COINCIDENCIAS, y las de cualquier pareja SIN relación
 *    declarada (solo coinciden en eventos), se dibujan con línea
 *    DISCONTINUA (LineDashedMaterial). Así no depende solo del color (RNF-26).
 *
 * La línea siempre tiene 17 puntos (16 segmentos). Con una sola relación los
 * puntos quedan en línea recta; con varias, forman una curva de Bézier.
 */
export class EnlaceVisual {
  static NUMERO_DE_PUNTOS = 17;
  static SEPARACION_ENTRE_CURVAS = 1.6;
  static LONGITUD_TRAZO = 0.8;
  static LONGITUD_HUECO = 0.6;

  #relacion;
  #origen;
  #destino;
  #linea;
  #desplazamiento;
  #opacidadBase;
  #discontinua;

  /**
   * @param {number} indice - posición de esta relación entre las del mismo par (0, 1, 2...).
   * @param {number} total - número de relaciones entre esas dos entidades.
   * @param {boolean} discontinua - opcional: true para dibujarla discontinua.
   */
  constructor(relacion, origen, destino, indice, total, discontinua) {
    this.#relacion = relacion;
    this.#discontinua = discontinua === true;
    this.#origen = origen;
    this.#destino = destino;

    // Las curvas de un mismo par se reparten a los dos lados de la recta:
    // con 2 relaciones, −0,8 y +0,8; con 3, −1,6, 0 y +1,6; con 1, 0 (recta).
    this.#desplazamiento = (indice - (total - 1) / 2) * EnlaceVisual.SEPARACION_ENTRE_CURVAS;
    this.#opacidadBase = this.#calcularOpacidad(relacion.getRelevancia());

    const geometria = new THREE.BufferGeometry();
    const coordenadas = new Float32Array(EnlaceVisual.NUMERO_DE_PUNTOS * 3);
    geometria.setAttribute("position", new THREE.BufferAttribute(coordenadas, 3));
    let material = null;
    if (this.#discontinua) {
      material = new THREE.LineDashedMaterial({
        color: relacion.getTipo().getColor(),
        transparent: true,
        opacity: this.#opacidadBase,
        dashSize: EnlaceVisual.LONGITUD_TRAZO,
        gapSize: EnlaceVisual.LONGITUD_HUECO
      });
    } else {
      material = new THREE.LineBasicMaterial({
        color: relacion.getTipo().getColor(),
        transparent: true,
        opacity: this.#opacidadBase
      });
    }
    this.#linea = new THREE.Line(geometria, material);
    // Así, al hacer clic en la línea (SelectorInteraccion), se llega a su relación.
    this.#linea.userData.visual = this;
    this.actualizar();
  }

  getRelacion() {
    return this.#relacion;
  }

  getLinea() {
    return this.#linea;
  }

  getOrigen() {
    return this.#origen;
  }

  getDestino() {
    return this.#destino;
  }

  /**
   * @returns {boolean} true si se dibuja con línea discontinua.
   */
  esDiscontinua() {
    return this.#discontinua;
  }

  /**
   * Recoloca la línea según las posiciones actuales de sus dos nodos.
   * Se llama en cada fotograma mientras la simulación se mueve.
   *
   * Curva de Bézier cuadrática: va del origen al destino "atraída" por un
   * punto de control. El punto de control es el punto medio desplazado
   * (desplazamiento · 2) en una dirección perpendicular a la línea; así el
   * punto central de la curva queda separado (desplazamiento) de la recta.
   * Con desplazamiento 0 el punto de control es el punto medio y sale recta.
   */
  actualizar() {
    const inicio = this.#origen.getPosicion();
    const fin = this.#destino.getPosicion();
    const puntoMedio = inicio.clone().add(fin).multiplyScalar(0.5);
    const control = puntoMedio.clone().addScaledVector(this.#direccionPerpendicular(), this.#desplazamiento * 2);

    const atributo = this.#linea.geometry.getAttribute("position");
    const segmentos = EnlaceVisual.NUMERO_DE_PUNTOS - 1;
    for (let i = 0; i <= segmentos; i++) {
      const t = i / segmentos;
      // Fórmula de Bézier: (1−t)²·inicio + 2·(1−t)·t·control + t²·fin
      const pesoInicio = (1 - t) * (1 - t);
      const pesoControl = 2 * (1 - t) * t;
      const pesoFin = t * t;
      const x = pesoInicio * inicio.x + pesoControl * control.x + pesoFin * fin.x;
      const y = pesoInicio * inicio.y + pesoControl * control.y + pesoFin * fin.y;
      const z = pesoInicio * inicio.z + pesoControl * control.z + pesoFin * fin.z;
      atributo.setXYZ(i, x, y, z);
    }
    atributo.needsUpdate = true;
    // La línea discontinua necesita saber la distancia recorrida en cada
    // punto de la curva para colocar los trazos; cambia al moverse los nodos.
    if (this.#discontinua) {
      this.#linea.computeLineDistances();
    }
    // Three.js usa la esfera envolvente para decidir si la línea está en
    // pantalla; si no se recalcula, la línea podría desaparecer al moverse.
    this.#linea.geometry.computeBoundingSphere();
  }

  setVisible(visible) {
    this.#linea.visible = visible;
  }

  /**
   * @param {boolean} activo - true: opacidad total; false: la de su relevancia.
   */
  resaltar(activo) {
    if (activo) {
      this.#linea.material.opacity = 1;
    } else {
      this.#linea.material.opacity = this.#opacidadBase;
    }
  }

  /** Libera la geometría y el material (memoria de la tarjeta gráfica). */
  liberar() {
    this.#linea.geometry.dispose();
    this.#linea.material.dispose();
  }

  /**
   * Opacidad = 0,25 + 0,75 · relevancia: incluso las relaciones
   * poco relevantes se ven un poco, y las de relevancia 1 son opacas.
   */
  #calcularOpacidad(relevancia) {
    return 0.25 + 0.75 * relevancia;
  }

  /**
   * Dirección perpendicular a la línea, de longitud 1:
   * producto vectorial de la dirección de la línea con (0, 1, 0), o con
   * (1, 0, 0) si la línea es vertical (entonces el primero da 0).
   *
   * La dirección de la línea se mide SIEMPRE del extremo de id menor al de
   * id mayor (como en getClavePar), no de origen a destino. Si no, una
   * relación A→B y otra B→A tendrían perpendiculares opuestas y sus curvas
   * podrían caer una encima de otra.
   */
  #direccionPerpendicular() {
    let primero = this.#origen;
    let segundo = this.#destino;
    if (this.#relacion.getOrigen().getId() > this.#relacion.getDestino().getId()) {
      primero = this.#destino;
      segundo = this.#origen;
    }
    const direccion = segundo.getPosicion().sub(primero.getPosicion());
    const perpendicular = new THREE.Vector3().crossVectors(direccion, new THREE.Vector3(0, 1, 0));
    if (perpendicular.lengthSq() < 1e-12) {
      perpendicular.crossVectors(direccion, new THREE.Vector3(1, 0, 0));
    }
    // Si los dos nodos están en el mismo punto no hay dirección: sin curva.
    if (perpendicular.lengthSq() < 1e-12) {
      return new THREE.Vector3(0, 0, 0);
    }
    return perpendicular.normalize();
  }
}
