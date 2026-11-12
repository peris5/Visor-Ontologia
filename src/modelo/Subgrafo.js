import { Entidad } from './Entidad.js';
import { NodoRelevante } from './NodoRelevante.js';

/**
 * Subgrafo
 *
 * El entorno relevante de una entidad central: sus nodos y las relaciones
 * entre ellos.
 *  - Composición con NodoRelevante [1..*]: los nodos pertenecen al subgrafo.
 *    El propio subgrafo crea el nodo de la entidad central al nacer, y así
 *    nunca está vacío.
 *  - Agregación con Relacion [*]: las relaciones existen fuera (en el
 *    repositorio); el subgrafo solo apunta a ellas.
 *
 * Requisitos: RF-08 a RF-12.
 */
export class Subgrafo {
  #entidadCentral;
  #umbral;
  #nodos;
  #relaciones;
  #idsDeRelaciones;

  /**
   * @param {Entidad} entidadCentral
   * @param {number} umbral - umbral con el que se construyó.
   */
  constructor(entidadCentral, umbral) {
    if (!(entidadCentral instanceof Entidad)) {
      throw new Error("El subgrafo necesita una entidad central.");
    }
    this.#entidadCentral = entidadCentral;
    this.#umbral = umbral;
    // Map de idEntidad → NodoRelevante. Un Map permite encontrar un nodo
    // por su id al momento y recuerda el orden en que se añadieron.
    this.#nodos = new Map();
    this.#relaciones = [];
    // Los ids de las relaciones, para saber al momento si una ya está (ver
    // #contieneRelacion). Un Set es una colección sin repetidos.
    this.#idsDeRelaciones = new Set();

    // La entidad central siempre está: relevancia 1 y nivel 0.
    const nodoCentral = new NodoRelevante(entidadCentral, 1, 0);
    this.#nodos.set(entidadCentral.getId(), nodoCentral);
  }

  /**
   * @returns {Entidad}
   */
  getEntidadCentral() {
    return this.#entidadCentral;
  }

  /**
   * @returns {number}
   */
  getUmbral() {
    return this.#umbral;
  }

  /**
   * @returns {NodoRelevante[]} copia de la lista de nodos, en orden de entrada.
   */
  getNodos() {
    const listaDeNodos = [];
    for (const nodo of this.#nodos.values()) {
      listaDeNodos.push(nodo);
    }
    return listaDeNodos;
  }

  /**
   * @returns {Relacion[]} copia de la lista de relaciones.
   */
  getRelaciones() {
    const listaDeRelaciones = [];
    for (let i = 0; i < this.#relaciones.length; i++) {
      listaDeRelaciones.push(this.#relaciones[i]);
    }
    return listaDeRelaciones;
  }

  /**
   * @param {string} id - id de la entidad.
   * @returns {NodoRelevante|null} el nodo, o null si no está en el subgrafo.
   */
  getNodo(id) {
    if (this.#nodos.has(id)) {
      return this.#nodos.get(id);
    }
    return null;
  }

  /**
   * @returns {number} número de nodos (contando la central).
   */
  getNumeroNodos() {
    return this.#nodos.size;
  }

  /**
   * @param {NodoRelevante} nodo - nodo nuevo (su entidad no puede estar ya).
   */
  agregarNodo(nodo) {
    if (!(nodo instanceof NodoRelevante)) {
      throw new Error("Solo se pueden añadir objetos NodoRelevante al subgrafo.");
    }
    const idEntidad = nodo.getEntidad().getId();
    if (this.#nodos.has(idEntidad)) {
      throw new Error("La entidad " + idEntidad + " ya está en el subgrafo.");
    }
    this.#nodos.set(idEntidad, nodo);
  }

  /**
   * Añade una relación. Si ya estaba (mismo id) no hace nada, para no
   * tener duplicados. Sus dos extremos tienen que estar en el subgrafo.
   *
   * @param {Relacion} relacion
   */
  agregarRelacion(relacion) {
    if (this.#contieneRelacion(relacion.getId())) {
      return;
    }
    const idOrigen = relacion.getOrigen().getId();
    const idDestino = relacion.getDestino().getId();
    if (!this.contieneEntidad(idOrigen) || !this.contieneEntidad(idDestino)) {
      throw new Error("La relación " + relacion.getId() + " une entidades que no están en el subgrafo.");
    }
    this.#relaciones.push(relacion);
    this.#idsDeRelaciones.add(relacion.getId());
  }

  /**
   * Quita un nodo y todas las relaciones en las que participa
   * (una relación con un extremo fuera del subgrafo no tendría sentido).
   * La entidad central no se puede quitar: el subgrafo tiene como mínimo un nodo.
   *
   * @param {string} id - id de la entidad a quitar.
   */
  eliminarNodo(id) {
    if (id === this.#entidadCentral.getId()) {
      throw new Error("No se puede eliminar la entidad central del subgrafo.");
    }
    if (!this.#nodos.has(id)) {
      return;
    }
    this.#nodos.delete(id);
    this.#eliminarRelacionesDe(id);
  }

  /**
   * @param {string} id - id de la entidad.
   * @returns {boolean} true si la entidad tiene un nodo en el subgrafo.
   */
  contieneEntidad(id) {
    return this.#nodos.has(id);
  }

  /**
   * (Privado) ¿Hay ya una relación con este id?
   *
   * @param {string} idRelacion
   * @returns {boolean}
   */
  #contieneRelacion(idRelacion) {
    // Antes se recorría la lista entera de relaciones cada vez; con el Set
    // es inmediato. (Es la misma mejora que se hizo en la versión Python
    // del incremento 2: con 150 nodos se añaden cientos de relaciones.)
    return this.#idsDeRelaciones.has(idRelacion);
  }

  /**
   * (Privado) Se queda solo con las relaciones que no tocan a la entidad indicada.
   *
   * @param {string} idEntidad
   */
  #eliminarRelacionesDe(idEntidad) {
    const relacionesQueSeQuedan = [];
    const idsQueSeQuedan = new Set();
    for (let i = 0; i < this.#relaciones.length; i++) {
      const relacion = this.#relaciones[i];
      const tocaLaEntidad = relacion.getOrigen().getId() === idEntidad || relacion.getDestino().getId() === idEntidad;
      if (!tocaLaEntidad) {
        relacionesQueSeQuedan.push(relacion);
        idsQueSeQuedan.add(relacion.getId());
      }
    }
    this.#relaciones = relacionesQueSeQuedan;
    this.#idsDeRelaciones = idsQueSeQuedan;
  }
}
