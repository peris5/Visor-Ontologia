/**
 * ConstructorSubgrafo
 *
 * Construye el entorno relevante (Subgrafo) de una entidad con una búsqueda
 * «primero el mejor»: siempre se trata antes el candidato pendiente de mayor
 * relevancia.
 *
 * Relaciones con otras clases:
 *  - usa un RepositorioDatos para leer entidades y relaciones;
 *  - usa una EstrategiaRelevancia para calcular las relevancias;
 *  - tiene (composición) un CalculadorCentralidad propio;
 *  - crea el Subgrafo que devuelve.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ¿Por qué «primero el mejor» da a cada nodo su MEJOR relevancia posible?
 *
 *   1. La relevancia de un nodo es el producto de las relevancias de las
 *      relaciones del camino. Todas valen entre 0 y 1, y multiplicar por un
 *      número menor o igual que 1 nunca hace crecer el resultado. Por tanto,
 *      a lo largo de un camino la relevancia NUNCA crece.
 *
 *   2. Un nodo NO entra en el subgrafo cuando se descubre, sino cuando sale
 *      de la lista de pendientes como el candidato más relevante de todos.
 *
 *   3. Supongamos que el nodo V sale de pendientes con relevancia R. Cualquier
 *      otro camino hacia V todavía sin explorar tiene que pasar por algún
 *      candidato que sigue pendiente, y ese candidato tiene relevancia ≤ R
 *      (si no, habría salido antes que V). Por el punto 1, seguir ese camino
 *      hasta V solo puede dar una relevancia ≤ R. Luego R ya es la mejor.
 *
 *   Ejemplo: Central→V vale 0,4 y Central→Y→V vale 0,9 × 0,9 = 0,81.
 *   Al expandir la Central, V queda pendiente con 0,4 e Y con 0,9.
 *   Sale Y (0,9), se expande y V vuelve a quedar pendiente, ahora con 0,81.
 *   Sale V con 0,81, su mejor valor. Cuando más tarde salga la copia con 0,4,
 *   se descarta porque V ya está dentro.
 *
 *   Consecuencia: los nodos entran en orden de relevancia de mayor a menor.
 *   Por eso, si paramos al llegar a maxNodos, nos quedamos justo con los
 *   más relevantes.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Requisitos: RF-08, RF-09, RF-10, RF-11, RF-12; RF-37 (centralidad); RNF-30.
 */
class ConstructorSubgrafo {
  static UMBRAL_POR_DEFECTO = 0.3;
  static MAX_NODOS_POR_DEFECTO = 150;

  #repositorio;
  #estrategia;
  #centralidad;
  #umbral;
  #maxNodos;

  /**
   * @param {RepositorioDatos} repositorio
   * @param {EstrategiaRelevancia} estrategia
   * @param {number} umbral - opcional; 0.3 si no se indica.
   * @param {number} maxNodos - opcional; 150 si no se indica.
   */
  constructor(repositorio, estrategia, umbral, maxNodos) {
    if (!(repositorio instanceof RepositorioDatos)) {
      throw new Error("ConstructorSubgrafo necesita un RepositorioDatos.");
    }
    if (!(estrategia instanceof EstrategiaRelevancia)) {
      throw new Error("ConstructorSubgrafo necesita una EstrategiaRelevancia.");
    }
    this.#repositorio = repositorio;
    this.#estrategia = estrategia;
    // Composición: el calculador nace y muere con este constructor.
    this.#centralidad = new CalculadorCentralidad();

    this.#umbral = ConstructorSubgrafo.UMBRAL_POR_DEFECTO;
    if (umbral !== undefined) {
      this.setUmbral(umbral);
    }

    this.#maxNodos = ConstructorSubgrafo.MAX_NODOS_POR_DEFECTO;
    if (maxNodos !== undefined) {
      if (!Number.isInteger(maxNodos) || maxNodos < 1) {
        throw new Error("El máximo de nodos debe ser un número entero mayor que 0.");
      }
      this.#maxNodos = maxNodos;
    }
  }

  /**
   * @param {number} valor - umbral entre 0 y 1.
   */
  setUmbral(valor) {
    if (typeof valor !== "number" || Number.isNaN(valor)) {
      throw new Error("El umbral debe ser un número.");
    }
    if (valor < 0 || valor > 1) {
      throw new Error("El umbral debe estar entre 0 y 1 (se ha recibido " + valor + ").");
    }
    this.#umbral = valor;
  }

  /**
   * @returns {number}
   */
  getUmbral() {
    return this.#umbral;
  }

  /**
   * Construye el subgrafo relevante de una entidad.
   *
   * @param {string} idEntidad - id de la entidad central.
   * @returns {Promise<Subgrafo>}
   */
  async construir(idEntidad) {
    // Copiamos el umbral al empezar: si alguien lo cambia mientras esperamos
    // al repositorio, este subgrafo se termina con el umbral con el que empezó.
    const umbral = this.#umbral;

    const entidadCentral = await this.#repositorio.obtenerEntidad(idEntidad);
    if (entidadCentral === null) {
      throw new Error("No existe ninguna entidad con el id \"" + idEntidad + "\".");
    }

    // Paso 1: el subgrafo nace con la central (relevancia 1, nivel 0).
    const subgrafo = new Subgrafo(entidadCentral, umbral);
    const nodoCentral = subgrafo.getNodo(entidadCentral.getId());

    // Paso 2: los vecinos de la central son los primeros candidatos pendientes.
    const pendientes = await this.#expandir(nodoCentral, subgrafo, umbral);

    // Paso 3: búsqueda «primero el mejor» (ver la explicación de arriba).
    while (pendientes.length > 0 && subgrafo.getNumeroNodos() < this.#maxNodos) {
      const candidato = this.#sacarElMasRelevante(pendientes);
      const idCandidato = candidato.getEntidad().getId();

      // Un mismo vecino puede estar varias veces en pendientes (una por cada
      // camino por el que se descubrió). La primera copia que sale es la
      // mejor; las demás se descartan aquí.
      if (!subgrafo.contieneEntidad(idCandidato)) {
        subgrafo.agregarNodo(candidato);
        const nuevosCandidatos = await this.#expandir(candidato, subgrafo, umbral);
        this.#anadirCandidatos(pendientes, nuevosCandidatos);
      }
    }

    // Paso 4: red de seguridad para no pasar nunca de maxNodos.
    this.#podar(subgrafo);

    // Paso 5: con el subgrafo terminado, calculamos la centralidad.
    this.#guardarCentralidad(subgrafo);
    return subgrafo;
  }

  /**
   * (Privado) Expande un nodo que ya está en el subgrafo:
   *  - pide sus relaciones y calcula la relevancia de cada una;
   *  - descarta las que no superan el umbral;
   *  - si el vecino ya está en el subgrafo, añade la relación (así se guardan
   *    todas las relaciones de un mismo par, no solo la mejor);
   *  - si el vecino no está, se queda con la mejor relación hacia él y lo
   *    devuelve como candidato si su relevancia supera el umbral.
   *
   * @param {NodoRelevante} nodo - nodo que se expande.
   * @param {Subgrafo} subgrafo
   * @param {number} umbral
   * @returns {Promise<NodoRelevante[]>} candidatos nuevos (aún NO están en el subgrafo).
   */
  async #expandir(nodo, subgrafo, umbral) {
    const entidadDelNodo = nodo.getEntidad();
    const relaciones = await this.#repositorio.obtenerRelaciones(entidadDelNodo.getId());

    // idVecino → la relación más relevante hacia ese vecino.
    const mejorRelacionPorVecino = new Map();

    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const relevanciaDeLaRelacion = this.#estrategia.calcularRelevanciaRelacion(relacion);
      relacion.setRelevancia(relevanciaDeLaRelacion);

      const vecino = relacion.getOtroExtremo(entidadDelNodo);
      const esUnaRelacionConsigoMismo = vecino.getId() === entidadDelNodo.getId();

      if (relevanciaDeLaRelacion > umbral && !esUnaRelacionConsigoMismo) {
        if (subgrafo.contieneEntidad(vecino.getId())) {
          subgrafo.agregarRelacion(relacion);
        } else {
          this.#guardarSiEsMejor(mejorRelacionPorVecino, vecino.getId(), relacion);
        }
      }
    }

    return this.#crearCandidatos(nodo, mejorRelacionPorVecino, umbral);
  }

  /**
   * (Privado) Guarda la relación para ese vecino si no había ninguna o si es
   * más relevante que la guardada. Entre dos entidades puede haber varias
   * relaciones: para decidir si el vecino entra se usa la mejor.
   *
   * @param {Map<string, Relacion>} mejorRelacionPorVecino
   * @param {string} idVecino
   * @param {Relacion} relacion
   */
  #guardarSiEsMejor(mejorRelacionPorVecino, idVecino, relacion) {
    if (!mejorRelacionPorVecino.has(idVecino)) {
      mejorRelacionPorVecino.set(idVecino, relacion);
      return;
    }
    const relacionGuardada = mejorRelacionPorVecino.get(idVecino);
    if (relacion.getRelevancia() > relacionGuardada.getRelevancia()) {
      mejorRelacionPorVecino.set(idVecino, relacion);
    }
  }

  /**
   * (Privado) Convierte cada vecino en un candidato (NodoRelevante) con
   * relevancia = relevancia del padre × mejor relación, y nivel = nivel del padre + 1.
   * Solo devuelve los que superan el umbral.
   *
   * @param {NodoRelevante} nodoPadre
   * @param {Map<string, Relacion>} mejorRelacionPorVecino
   * @param {number} umbral
   * @returns {NodoRelevante[]}
   */
  #crearCandidatos(nodoPadre, mejorRelacionPorVecino, umbral) {
    const candidatos = [];
    const entidadDelPadre = nodoPadre.getEntidad();
    const nivelDelVecino = nodoPadre.getNivel() + 1;

    for (const mejorRelacion of mejorRelacionPorVecino.values()) {
      const vecino = mejorRelacion.getOtroExtremo(entidadDelPadre);
      const relevanciaDelVecino = this.#estrategia.calcularRelevanciaNodo(nodoPadre.getRelevancia(), mejorRelacion.getRelevancia());
      if (relevanciaDelVecino > umbral) {
        candidatos.push(new NodoRelevante(vecino, relevanciaDelVecino, nivelDelVecino));
      }
    }
    return candidatos;
  }

  /**
   * (Privado) Saca de la lista el candidato de mayor relevancia.
   * Recorremos la lista buscando el mayor (más fácil de entender que
   * mantenerla ordenada). Si hay empate, gana el primero que se añadió.
   *
   * @param {NodoRelevante[]} pendientes - se modifica: el elegido se quita.
   * @returns {NodoRelevante}
   */
  #sacarElMasRelevante(pendientes) {
    let posicionDelMejor = 0;
    for (let i = 1; i < pendientes.length; i++) {
      if (pendientes[i].getRelevancia() > pendientes[posicionDelMejor].getRelevancia()) {
        posicionDelMejor = i;
      }
    }
    const elMejor = pendientes[posicionDelMejor];
    pendientes.splice(posicionDelMejor, 1);
    return elMejor;
  }

  /**
   * (Privado) Añade los candidatos nuevos al final de la lista de pendientes.
   *
   * @param {NodoRelevante[]} pendientes
   * @param {NodoRelevante[]} nuevosCandidatos
   */
  #anadirCandidatos(pendientes, nuevosCandidatos) {
    for (let i = 0; i < nuevosCandidatos.length; i++) {
      pendientes.push(nuevosCandidatos[i]);
    }
  }

  /**
   * (Privado) Garantiza que el subgrafo no pasa de maxNodos quitando los
   * nodos menos relevantes (nunca la central) junto con sus relaciones.
   *
   * Con la búsqueda de construir() el subgrafo nunca llega a pasarse, porque
   * los nodos entran de uno en uno y se para al llegar al máximo. Aun así lo
   * dejamos como red de seguridad, por si en el futuro cambia la forma de construirlo.
   *
   * @param {Subgrafo} subgrafo
   */
  #podar(subgrafo) {
    while (subgrafo.getNumeroNodos() > this.#maxNodos) {
      const idMenosRelevante = this.#buscarMenosRelevante(subgrafo);
      subgrafo.eliminarNodo(idMenosRelevante);
    }
  }

  /**
   * (Privado) Id del nodo menos relevante que no sea la central.
   *
   * @param {Subgrafo} subgrafo
   * @returns {string}
   */
  #buscarMenosRelevante(subgrafo) {
    const idCentral = subgrafo.getEntidadCentral().getId();
    const nodos = subgrafo.getNodos();
    let nodoMenosRelevante = null;
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const esLaCentral = nodo.getEntidad().getId() === idCentral;
      if (!esLaCentral) {
        if (nodoMenosRelevante === null || nodo.getRelevancia() < nodoMenosRelevante.getRelevancia()) {
          nodoMenosRelevante = nodo;
        }
      }
    }
    return nodoMenosRelevante.getEntidad().getId();
  }

  /**
   * (Privado) Calcula la centralidad y la guarda en cada nodo.
   *
   * @param {Subgrafo} subgrafo
   */
  #guardarCentralidad(subgrafo) {
    const centralidadPorNodo = this.#centralidad.calcular(subgrafo);
    const nodos = subgrafo.getNodos();
    for (let i = 0; i < nodos.length; i++) {
      const nodo = nodos[i];
      const idEntidad = nodo.getEntidad().getId();
      nodo.setCentralidad(centralidadPorNodo.get(idEntidad));
    }
  }
}
