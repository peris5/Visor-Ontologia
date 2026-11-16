/**
 * DetectorComunidades
 *
 * Encuentra los GRUPOS de entidades muy relacionadas entre sí dentro de un
 * subgrafo (por ejemplo, un taller: el maestro, sus alumnos y sus obras), con
 * el algoritmo de PROPAGACIÓN DE ETIQUETAS:
 *
 *  1. Al principio, cada nodo es su propio grupo (su etiqueta es su id).
 *  2. Por turnos, cada nodo mira a sus vecinos y se cambia a la etiqueta que
 *     más «pesa» entre ellos. El peso de un vecino es la relevancia de la
 *     relación que los une: los vecinos muy relacionados cuentan más.
 *  3. Se repite hasta que ningún nodo cambia (o hasta MAX_VUELTAS vueltas).
 *     Al final, los nodos con la misma etiqueta forman un grupo.
 *
 * Así, las etiquetas se «contagian» dentro de las zonas muy conectadas y se
 * paran en las relaciones débiles que unen unas zonas con otras.
 *
 * Detalles:
 *  - La entidad central NO participa: está relacionada con casi todos y
 *    juntaría todo en un solo grupo.
 *  - Es DETERMINISTA: los nodos se recorren siempre en el mismo orden (por
 *    id) y, si dos etiquetas empatan, gana la que ya tenía el nodo o, si no,
 *    la menor. Así la misma entidad da siempre los mismos grupos.
 *  - Los grupos se numeran de mayor a menor tamaño (el 0 es el más grande).
 *
 * Requisitos: RF-40 (cúmulos de entidades muy relacionadas).
 */
export class DetectorComunidades {
  static MAX_VUELTAS = 20;

  /**
   * @param {Subgrafo} subgrafo
   * @returns {Map<string, number>} id de la entidad → número de grupo (la
   *   central no está). Un nodo sin vecinos (salvo la central) queda solo
   *   en su grupo.
   */
  detectar(subgrafo) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const vecinos = this.#pesosEntreVecinos(subgrafo, idCentral);
    const orden = [];
    for (const id of vecinos.keys()) {
      orden.push(id);
    }
    orden.sort();

    // Paso 1: cada nodo, su propia etiqueta.
    const etiquetas = new Map();
    for (let i = 0; i < orden.length; i++) {
      etiquetas.set(orden[i], orden[i]);
    }

    // Pasos 2 y 3: contagiar hasta que nada cambie.
    for (let vuelta = 0; vuelta < DetectorComunidades.MAX_VUELTAS; vuelta++) {
      let cambios = 0;
      for (let i = 0; i < orden.length; i++) {
        const id = orden[i];
        const nueva = this.#etiquetaMasPesada(id, vecinos.get(id), etiquetas);
        if (nueva !== etiquetas.get(id)) {
          etiquetas.set(id, nueva);
          cambios = cambios + 1;
        }
      }
      if (cambios === 0) {
        break;
      }
    }
    return this.#numerarGrupos(orden, etiquetas);
  }

  /**
   * (Privado) Para cada nodo (menos la central), sus vecinos con el peso de
   * la relación: la suma de las relevancias si hay varias relaciones entre
   * los dos.
   *
   * @param {Subgrafo} subgrafo
   * @param {string} idCentral
   * @returns {Map<string, Map<string, number>>}
   */
  #pesosEntreVecinos(subgrafo, idCentral) {
    const vecinos = new Map();
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const id = nodos[i].getEntidad().getId();
      if (id !== idCentral) {
        vecinos.set(id, new Map());
      }
    }
    const relaciones = subgrafo.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const idA = relacion.getOrigen().getId();
      const idB = relacion.getDestino().getId();
      if (idA !== idB && vecinos.has(idA) && vecinos.has(idB)) {
        DetectorComunidades.#sumarPeso(vecinos.get(idA), idB, relacion.getRelevancia());
        DetectorComunidades.#sumarPeso(vecinos.get(idB), idA, relacion.getRelevancia());
      }
    }
    return vecinos;
  }

  /**
   * (Privado) La etiqueta que más pesa entre los vecinos del nodo. Si no
   * tiene vecinos, se queda con la suya. Si hay empate, gana la que ya tenía
   * o, si no está entre las empatadas, la menor (orden alfabético).
   *
   * @param {string} id
   * @param {Map<string, number>} vecinosDelNodo - id del vecino → peso.
   * @param {Map<string, string>} etiquetas
   * @returns {string}
   */
  #etiquetaMasPesada(id, vecinosDelNodo, etiquetas) {
    const pesoPorEtiqueta = new Map();
    for (const idVecino of vecinosDelNodo.keys()) {
      DetectorComunidades.#sumarPeso(pesoPorEtiqueta, etiquetas.get(idVecino), vecinosDelNodo.get(idVecino));
    }
    const actual = etiquetas.get(id);
    if (pesoPorEtiqueta.size === 0) {
      return actual;
    }
    let mejor = null;
    let pesoMejor = -1;
    for (const etiqueta of pesoPorEtiqueta.keys()) {
      const peso = pesoPorEtiqueta.get(etiqueta);
      const ganaPorPeso = peso > pesoMejor;
      const empataYEsMenor = peso === pesoMejor && etiqueta < mejor;
      if (ganaPorPeso || empataYEsMenor) {
        mejor = etiqueta;
        pesoMejor = peso;
      }
    }
    // Si la etiqueta actual empata con la mejor, se queda con la suya: así
    // los nodos no cambian de grupo de un lado a otro sin parar.
    if (pesoPorEtiqueta.has(actual) && pesoPorEtiqueta.get(actual) === pesoMejor) {
      return actual;
    }
    return mejor;
  }

  /**
   * (Privado) Convierte las etiquetas en números de grupo, del grupo más
   * grande (0) al más pequeño; a igual tamaño, por etiqueta.
   *
   * @param {string[]} orden - ids de los nodos.
   * @param {Map<string, string>} etiquetas
   * @returns {Map<string, number>}
   */
  #numerarGrupos(orden, etiquetas) {
    const miembrosPorEtiqueta = new Map();
    for (let i = 0; i < orden.length; i++) {
      const etiqueta = etiquetas.get(orden[i]);
      if (!miembrosPorEtiqueta.has(etiqueta)) {
        miembrosPorEtiqueta.set(etiqueta, []);
      }
      miembrosPorEtiqueta.get(etiqueta).push(orden[i]);
    }
    const grupos = [];
    for (const etiqueta of miembrosPorEtiqueta.keys()) {
      grupos.push({ etiqueta: etiqueta, miembros: miembrosPorEtiqueta.get(etiqueta) });
    }
    grupos.sort(DetectorComunidades.#compararGrupos);

    const grupoPorId = new Map();
    for (let numero = 0; numero < grupos.length; numero++) {
      const miembros = grupos[numero].miembros;
      for (let i = 0; i < miembros.length; i++) {
        grupoPorId.set(miembros[i], numero);
      }
    }
    return grupoPorId;
  }

  /**
   * (Privado) Para ordenar los grupos: primero los más grandes; a igual
   * tamaño, por etiqueta.
   *
   * @param {Object} a - { etiqueta, miembros }
   * @param {Object} b - { etiqueta, miembros }
   * @returns {number}
   */
  static #compararGrupos(a, b) {
    if (a.miembros.length !== b.miembros.length) {
      return b.miembros.length - a.miembros.length;
    }
    if (a.etiqueta < b.etiqueta) {
      return -1;
    }
    if (a.etiqueta > b.etiqueta) {
      return 1;
    }
    return 0;
  }

  /**
   * (Privado) Suma el peso a la clave (empieza en 0 si no existía).
   *
   * @param {Map<string, number>} mapa
   * @param {string} clave
   * @param {number} peso
   */
  static #sumarPeso(mapa, clave, peso) {
    let actual = 0;
    if (mapa.has(clave)) {
      actual = mapa.get(clave);
    }
    mapa.set(clave, actual + peso);
  }
}
