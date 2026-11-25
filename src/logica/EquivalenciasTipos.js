/**
 * Con qué tipos se busca un tipo de relación en la configuración (pesos,
 * pesos por rol, tabla T, pares temporales y tiposSinTiempo).
 *
 * Normalmente es el propio tipo y sus padres (IS_A), del más cercano al más
 * lejano. Con tiposEquivalentes (public/relevancia.json) se dice que un tipo
 * se comporta como otro aunque en la jerarquía no herede de él:
 *
 *     "tiposEquivalentes": { "STUDENT_OF": "Mentorship", "Apprenticeship": "Mentorship" }
 *
 * Un aprendizaje (Apprenticeship IS_A Professional) es en realidad una
 * mentoría: con la herencia recibía el peso de Professional (0,60), sin la
 * asimetría maestro/alumno ni la tabla T de la mentoría.
 *
 * El orden es: el propio tipo, aquel al que equivale y los padres de este. Los
 * padres propios dejan de contar (la equivalencia los sustituye), pero el
 * propio tipo va primero: si algún día se le da un peso, manda ese. Los hijos de
 * un tipo equivalente heredan la equivalencia. No se encadenan (si A equivale a
 * B y B a C, A se comporta como B).
 *
 * Solo afecta a qué valores se buscan. El tipo sigue siendo el suyo en la
 * leyenda y en lo que compara tipos exactos (tiposCoincidencia, el grado
 * por tipo de PenalizacionGrado y las pruebas repetidas del mismo tipo).
 */
export class EquivalenciasTipos {
  #equivalentes;
  #jerarquia;
  // id del tipo → la lista ya calculada.
  #calculados;

  /**
   * @param {Object} configuracion - { tiposEquivalentes: { idTipo: idTipo } } (opcional)
   * @param {Object} jerarquia - etiqueta → sus padres (de /api/jerarquia), para
   *   los padres del tipo al que se equivale. Opcional.
   */
  constructor(configuracion, jerarquia) {
    this.#equivalentes = new Map();
    const equivalentes = configuracion.tiposEquivalentes;
    if (equivalentes !== undefined && equivalentes !== null) {
      for (const id of Object.keys(equivalentes)) {
        if (typeof equivalentes[id] !== "string" || equivalentes[id] === "" || equivalentes[id] === id) {
          throw new Error("En public/relevancia.json, tiposEquivalentes: \"" + id + "\" debe equivaler a otro tipo.");
        }
        this.#equivalentes.set(id, equivalentes[id]);
      }
    }
    this.#jerarquia = {};
    if (jerarquia !== undefined && jerarquia !== null) {
      this.#jerarquia = jerarquia;
    }
    this.#calculados = new Map();
  }

  /**
   * Los ids con los que se busca el tipo, en orden (ver la explicación de la clase).
   *
   * @param {TipoRelacion} tipo
   * @returns {string[]} no se debe modificar (está guardada).
   */
  getIds(tipo) {
    if (!this.#calculados.has(tipo.getId())) {
      this.#calculados.set(tipo.getId(), this.#calcular(tipo));
    }
    return this.#calculados.get(tipo.getId());
  }

  /**
   * El tipo al que equivale (él o el padre que tenga equivalencia), o null.
   *
   * @param {TipoRelacion} tipo
   * @returns {string|null}
   */
  getEquivalente(tipo) {
    const propios = tipo.getIdYPadres();
    for (let i = 0; i < propios.length; i++) {
      if (this.#equivalentes.has(propios[i])) {
        return this.#equivalentes.get(propios[i]);
      }
    }
    return null;
  }

  #calcular(tipo) {
    const ids = [];
    const propios = tipo.getIdYPadres();
    for (let i = 0; i < propios.length; i++) {
      ids.push(propios[i]);
      if (this.#equivalentes.has(propios[i])) {
        const destino = this.#equivalentes.get(propios[i]);
        ids.push(destino);
        if (Array.isArray(this.#jerarquia[destino])) {
          for (let j = 0; j < this.#jerarquia[destino].length; j++) {
            ids.push(this.#jerarquia[destino][j]);
          }
        }
        return ids;
      }
    }
    return ids;
  }
}
