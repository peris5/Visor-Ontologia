import { TipoEntidad } from '../modelo/TipoEntidad.js';
import { RelevanciaCompuesta } from '../logica/RelevanciaCompuesta.js';
import { SeleccionadorNodos } from '../logica/SeleccionadorNodos.js';
import { Estadistica } from './Estadistica.js';

/**
 * Acumula las medidas de la pestaña «Medir sobre los datos»: anotar() con cada
 * entidad central de la muestra y, al final, resumen().
 *
 * Todo sale de las PROPIAS RELACIONES (quién es maestro de quién, qué obras
 * son de un amigo...), no de datos que solo conozca el generador: funciona
 * igual con los datos simulados que con Neo4j.
 *
 * De cada medida guarda también las entidades que ENTRAN, con sus números,
 * sus padres y su explicación: así se ve por qué ha entrado cada una.
 *
 * Los nombres de los tipos (Mentorship, Creation...) están aquí porque
 * definen qué se mide. Se aplican con herencia (Paint cuenta como Creation) y
 * con tiposEquivalentes (STUDENT_OF cuenta como Mentorship). El cálculo de la
 * relevancia no los usa.
 */
export class MedidasRelevancia {
  static TIPOS = Object.freeze({
    MENTORIA: "Mentorship", CREACION: "Creation", AMISTAD: "Friendship", MATRIMONIO: "Marriage"
  });
  static ROL_MAESTRO = "maestro";
  static ROL_APRENDIZ = "aprendiz";
  static ETIQUETA_CREADORA = "Creator";
  // Cuántos padres se escriben de cada entidad que entra.
  static MAX_PADRES = 5;

  // Las medidas, en el orden en que se enseñan, con lo que se espera de
  // cada una (minimo o maximo en % de los que entran).
  static MEDIDAS = Object.freeze([
    { clave: "maestros", nombre: "Maestros dentro", minimo: 95 },
    { clave: "alumnos", nombre: "Alumnos dentro", minimo: 90 },
    { clave: "obrasPropias", nombre: "Obras propias dentro" },
    { clave: "obrasMaestroEpoca", nombre: "Obras del maestro de su época" },
    { clave: "obrasMaestroPosteriores", nombre: "Obras del maestro muy posteriores" },
    { clave: "obrasMaestroSinFecha", nombre: "Obras del maestro sin fecha" },
    { clave: "obrasAmigos", nombre: "Obras de amigos", maximo: 1 },
    { clave: "conyuges", nombre: "Cónyuges no artistas de amigos", maximo: 0 },
    { clave: "companeros", nombre: "Compañeros solo por una organización grande", maximo: 1 },
    { clave: "coexpuestas", nombre: "Obras coexpuestas de otros autores" },
    { clave: "soloCoincidencias", nombre: "Personas solo por coincidencias" }
  ]);

  #piezas;
  #jerarquia;
  #gradoReferencia;
  #margenAnios;
  #maxNodos;
  #medidas;
  #tamano;
  #clases;
  #origenes;
  #dibujados;

  /**
   * @param {Object} piezas - las de FabricaRelevancia.
   * @param {Object} configuracion - la de public/relevancia.json.
   * @param {Object} jerarquia - etiqueta → padres.
   * @param {number} maxNodos - el máximo del subgrafo.
   */
  constructor(piezas, configuracion, jerarquia, maxNodos) {
    this.#piezas = piezas;
    this.#jerarquia = jerarquia;
    this.#gradoReferencia = configuracion.gradoReferencia;
    this.#margenAnios = configuracion.margenAnios;
    this.#maxNodos = maxNodos;
    this.#medidas = new Map();
    for (let i = 0; i < MedidasRelevancia.MEDIDAS.length; i++) {
      this.#medidas.set(MedidasRelevancia.MEDIDAS[i].clave, { total: 0, dentro: 0, valores: [], entran: [] });
    }
    this.#tamano = { centrales: 0, directos: [], candidatos: [], nodos: [], milisegundos: [], llenan: 0, empates: 0,
      vacias: 0, casiVacias: 0 };
    this.#clases = new Map();
    this.#origenes = new Map();
    this.#dibujados = 0;
  }

  /**
   * Mide una entidad central.
   *
   * @param {Subgrafo} subgrafo - lo que dibuja la aplicación.
   * @param {Map<string, ResultadoRelevanciaNodo>} resultados - todos los nodos.
   * @param {RepositorioVecindario} cache
   * @param {number} directos - cuántos directos tiene.
   * @param {number} milisegundos - lo que ha tardado el cálculo.
   */
  anotar(subgrafo, resultados, cache, directos, milisegundos) {
    const c = subgrafo.getEntidadCentral();
    this.#anotarTamano(subgrafo, resultados, directos, milisegundos);
    this.#anotarComposicion(subgrafo);

    const contexto = { c: c, subgrafo: subgrafo, resultados: resultados, cache: cache };
    const propias = this.#vecinos(cache, c, MedidasRelevancia.TIPOS.CREACION, TipoEntidad.OBRA_DE_ARTE);
    const vecinosDeC = this.#todosLosVecinos(cache, c);
    const maestros = this.#conRol(cache, c, MedidasRelevancia.ROL_MAESTRO);
    this.#anotarTodos("maestros", maestros, contexto);
    this.#anotarTodos("alumnos", this.#conRol(cache, c, MedidasRelevancia.ROL_APRENDIZ), contexto);
    this.#anotarTodos("obrasPropias", propias, contexto);
    const obrasDeMaestros = this.#anotarObrasDeMaestros(maestros, propias, contexto);
    this.#anotarAmigos(maestros, vecinosDeC, contexto);
    this.#anotarCompaneros(vecinosDeC, contexto);
    this.#anotarCoincidencias(vecinosDeC, propias, obrasDeMaestros, contexto);
  }

  /**
   * @returns {Object} { filas: [{ clave, nombre, total, dentro, porcentaje, mediana, maxima, esperado, ok, entran }],
   *   tamano: [[nombre, texto]], clases: [[nombre, porcentaje]], origenes: [[nombre, porcentaje]] }
   *   ok es true, false o null (sin valor esperado o sin datos). entran, de más a
   *   menos S: [{ central, id, clase, s, r, c, origen, padres, explicacion }].
   */
  resumen() {
    const filas = [];
    for (let i = 0; i < MedidasRelevancia.MEDIDAS.length; i++) {
      filas.push(this.#fila(MedidasRelevancia.MEDIDAS[i]));
    }
    return {
      filas: filas,
      tamano: this.#resumenTamano(),
      clases: this.#repartoEnPorcentaje(this.#clases),
      origenes: this.#repartoEnPorcentaje(this.#origenes)
    };
  }

  // ───────────── Privados: resumen ─────────────

  #fila(definicion) {
    const medida = this.#medidas.get(definicion.clave);
    const fila = {
      clave: definicion.clave, nombre: definicion.nombre, total: medida.total, dentro: medida.dentro,
      porcentaje: Estadistica.porcentaje(medida.dentro, medida.total), mediana: Estadistica.mediana(medida.valores),
      maxima: Estadistica.maximo(medida.valores), esperado: "", ok: null, entran: medida.entran.slice()
    };
    fila.entran.sort(function (a, b) {
      return b.s - a.s;
    });
    if (typeof definicion.minimo === "number") {
      fila.esperado = "≥ " + definicion.minimo + " %";
      if (fila.porcentaje !== null) {
        fila.ok = fila.porcentaje >= definicion.minimo;
      }
    }
    if (typeof definicion.maximo === "number") {
      fila.esperado = "≤ " + definicion.maximo + " %";
      if (fila.porcentaje !== null) {
        fila.ok = fila.porcentaje <= definicion.maximo;
      }
    }
    if (definicion.clave === "obrasMaestroEpoca") {
      fila.esperado = "S mediana mayor que la de las muy posteriores";
      const posteriores = Estadistica.mediana(this.#medidas.get("obrasMaestroPosteriores").valores);
      if (fila.mediana !== null && posteriores !== null) {
        fila.ok = fila.mediana > posteriores;
      }
    }
    return fila;
  }

  #resumenTamano() {
    const t = this.#tamano;
    return [
      ["Centrales medidas", String(t.centrales)],
      ["Directos (mediana / p95 / máximo)", MedidasRelevancia.#tresValores(t.directos, 0)],
      ["Candidatos (mediana / p95 / máximo)", MedidasRelevancia.#tresValores(t.candidatos, 0)],
      ["Nodos dibujados, sin la central (mediana / p95 / máximo)", MedidasRelevancia.#tresValores(t.nodos, 0)],
      ["Tiempo de cálculo en ms (mediana / p95 / máximo)", MedidasRelevancia.#tresValores(t.milisegundos, 1)],
      ["Centrales que llenan el máximo", t.llenan + " de " + t.centrales],
      ["Centrales con el corte en un empate", t.empates + " de " + t.centrales],
      ["Centrales sin ningún nodo", t.vacias + " de " + t.centrales],
      ["Centrales con menos de 3 nodos", t.casiVacias + " de " + t.centrales]
    ];
  }

  static #tresValores(valores, decimales) {
    return Estadistica.textoNumero(Estadistica.mediana(valores), decimales) + " / " +
      Estadistica.textoNumero(Estadistica.percentil(valores, 0.95), decimales) + " / " +
      Estadistica.textoNumero(Estadistica.maximo(valores), decimales);
  }

  #repartoEnPorcentaje(mapa) {
    const filas = [];
    for (const [nombre, numero] of mapa) {
      filas.push([nombre, Estadistica.porcentaje(numero, this.#dibujados)]);
    }
    filas.sort(function (a, b) {
      return b[1] - a[1];
    });
    return filas;
  }

  // ───────────── Privados: cada medida ─────────────

  #anotarTamano(subgrafo, resultados, directos, milisegundos) {
    const t = this.#tamano;
    const umbral = subgrafo.getUmbral();
    const nodos = subgrafo.getNumeroNodos() - 1;
    t.centrales = t.centrales + 1;
    t.directos.push(directos);
    t.candidatos.push(resultados.size - 1);
    t.nodos.push(nodos);
    t.milisegundos.push(milisegundos);
    if (nodos === 0) {
      t.vacias = t.vacias + 1;
    }
    if (nodos < 3) {
      t.casiVacias = t.casiVacias + 1;
    }
    if (nodos >= this.#maxNodos - 1) {
      t.llenan = t.llenan + 1;
      // ¿El último que entra y el primero que se queda fuera tienen la misma S?
      const elegibles = this.#piezas.seleccionador.elegibles(resultados, subgrafo.getEntidadCentral().getId(), true);
      if (elegibles.length > nodos && elegibles[nodos].getRelevancia() > umbral) {
        const diferencia = Math.abs(elegibles[nodos - 1].getRelevancia() - elegibles[nodos].getRelevancia());
        if (diferencia <= SeleccionadorNodos.TOLERANCIA) {
          t.empates = t.empates + 1;
        }
      }
    }
  }

  #anotarComposicion(subgrafo) {
    const nodos = subgrafo.getNodos();
    const idCentral = subgrafo.getEntidadCentral().getId();
    for (let i = 0; i < nodos.length; i++) {
      if (nodos[i].getEntidad().getId() !== idCentral) {
        this.#dibujados = this.#dibujados + 1;
        Estadistica.contar(this.#clases, nodos[i].getEntidad().getTipo());
        Estadistica.contar(this.#origenes, nodos[i].getOrigen());
      }
    }
  }

  /**
   * Obras de los maestros que no son también de c, según su año frente al
   * fin de la mentoría más margenAnios. Si una obra es de dos maestros, cuenta
   * una vez (manda la que la pone en la época).
   *
   * @returns {Set<string>} los ids de todas las obras de los maestros.
   */
  #anotarObrasDeMaestros(maestros, propias, contexto) {
    const todas = new Set();
    const clases = { obrasMaestroEpoca: new Map(), obrasMaestroPosteriores: new Map(), obrasMaestroSinFecha: new Map() };
    for (const maestro of maestros.values()) {
      const fin = this.#finDeLaMentoria(contexto.cache, contexto.c, maestro);
      const relaciones = this.#relacionesCompletas(contexto.cache, maestro);
      for (let i = 0; i < relaciones.length; i++) {
        const obra = relaciones[i].getOtroExtremo(maestro);
        const esObra = this.#esDeTipo(relaciones[i], MedidasRelevancia.TIPOS.CREACION) &&
          obra.getTipo() === TipoEntidad.OBRA_DE_ARTE;
        if (esObra) {
          todas.add(obra.getId());
        }
        if (esObra && !propias.has(obra.getId()) && obra.getId() !== contexto.c.getId()) {
          const anios = RelevanciaCompuesta.aniosDe(relaciones[i]);
          let clase = "obrasMaestroSinFecha";
          if (anios !== null && fin !== null) {
            clase = "obrasMaestroPosteriores";
            if (anios.desde <= fin + this.#margenAnios) {
              clase = "obrasMaestroEpoca";
            }
          }
          clases[clase].set(obra.getId(), obra);
        }
      }
    }
    for (const id of clases.obrasMaestroEpoca.keys()) {
      clases.obrasMaestroPosteriores.delete(id);
      clases.obrasMaestroSinFecha.delete(id);
    }
    for (const clave of Object.keys(clases)) {
      this.#anotarTodos(clave, clases[clave], contexto);
    }
    return todas;
  }

  /** El último año de la mentoría de c con ese maestro, o null si no tiene fecha. */
  #finDeLaMentoria(cache, c, maestro) {
    let fin = null;
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].getOtroExtremo(c) === maestro && this.#esDeTipo(relaciones[i], MedidasRelevancia.TIPOS.MENTORIA)) {
        const anios = RelevanciaCompuesta.aniosDe(relaciones[i]);
        if (anios !== null && (fin === null || anios.hasta > fin)) {
          fin = anios.hasta;
        }
      }
    }
    return fin;
  }

  /** Obras y cónyuges no artistas de los amigos que no son maestros, sin evidencia propia con c. */
  #anotarAmigos(maestros, vecinosDeC, contexto) {
    const amigos = this.#vecinos(contexto.cache, contexto.c, MedidasRelevancia.TIPOS.AMISTAD, TipoEntidad.PERSONA);
    const obras = new Map();
    const conyuges = new Map();
    for (const [idAmigo, amigo] of amigos) {
      if (!maestros.has(idAmigo)) {
        const relaciones = this.#relacionesCompletas(contexto.cache, amigo);
        for (let i = 0; i < relaciones.length; i++) {
          const otra = relaciones[i].getOtroExtremo(amigo);
          if (otra !== contexto.c && !vecinosDeC.has(otra.getId())) {
            if (this.#esDeTipo(relaciones[i], MedidasRelevancia.TIPOS.CREACION) &&
              otra.getTipo() === TipoEntidad.OBRA_DE_ARTE) {
              obras.set(otra.getId(), otra);
            }
            if (this.#esDeTipo(relaciones[i], MedidasRelevancia.TIPOS.MATRIMONIO) && !this.#esCreadora(otra)) {
              conyuges.set(otra.getId(), otra);
            }
          }
        }
      }
    }
    this.#anotarTodos("obrasAmigos", obras, contexto);
    this.#anotarTodos("conyuges", conyuges, contexto);
  }

  /**
   * PERSONAS que comparten con c una organización con más de
   * gradoReferencia miembros (personas con una relación declarada con ella),
   * no tienen evidencia propia con c y a las que SOLO les transmite esa
   * organización: su único padre. Si además les llega algo por otro lado
   * (por su maestro, por otra organización...), no se sabe por qué entran y no
   * cuentan aquí.
   */
  #anotarCompaneros(vecinosDeC, contexto) {
    const companeros = new Map();
    for (const organizacion of vecinosDeC.values()) {
      if (organizacion.getTipo() === TipoEntidad.ORGANIZACION &&
        this.#tieneDeclarada(contexto.cache, contexto.c, organizacion)) {
        const miembros = this.#miembros(contexto.cache, organizacion);
        if (miembros.size > this.#gradoReferencia) {
          for (const [id, miembro] of miembros) {
            if (miembro !== contexto.c && !vecinosDeC.has(id) &&
              MedidasRelevancia.#esSuUnicoPadre(contexto.resultados, id, organizacion)) {
              companeros.set(id, miembro);
            }
          }
        }
      }
    }
    this.#anotarTodos("companeros", companeros, contexto);
  }

  /** ¿A ese nodo solo le transmite la organización? */
  static #esSuUnicoPadre(resultados, id, organizacion) {
    if (!resultados.has(id)) {
      return false;
    }
    const padres = resultados.get(id).getPadres();
    return padres.length === 1 && padres[0] === organizacion;
  }

  #miembros(cache, organizacion) {
    const miembros = new Map();
    const relaciones = this.#relacionesCompletas(cache, organizacion);
    for (let i = 0; i < relaciones.length; i++) {
      const otra = relaciones[i].getOtroExtremo(organizacion);
      if (otra.getTipo() === TipoEntidad.PERSONA && !this.#piezas.calculador.esCoincidencia(relaciones[i])) {
        miembros.set(otra.getId(), otra);
      }
    }
    return miembros;
  }

  /** Obras de otros autores en las mismas exposiciones que c, y personas que solo coinciden con c. */
  #anotarCoincidencias(vecinosDeC, propias, obrasDeMaestros, contexto) {
    const coexpuestas = new Map();
    const soloCoincidencias = new Map();
    for (const [id, vecina] of vecinosDeC) {
      const soloCoincide = !this.#tieneDeclarada(contexto.cache, contexto.c, vecina);
      if (soloCoincide && vecina.getTipo() === TipoEntidad.PERSONA) {
        soloCoincidencias.set(id, vecina);
      }
      if (vecina.getTipo() === TipoEntidad.OBRA_DE_ARTE && !propias.has(id) && !obrasDeMaestros.has(id) &&
        this.#compartenEvento(contexto.cache, contexto.c, vecina)) {
        coexpuestas.set(id, vecina);
      }
    }
    this.#anotarTodos("coexpuestas", coexpuestas, contexto);
    this.#anotarTodos("soloCoincidencias", soloCoincidencias, contexto);
  }

  // ───────────── Privados: ayudas ─────────────

  /** Apunta esas entidades en una medida: cuántas entran y su S (0 si no salen en el cálculo). */
  #anotarTodos(clave, entidades, contexto) {
    const medida = this.#medidas.get(clave);
    for (const id of entidades.keys()) {
      medida.total = medida.total + 1;
      if (contexto.subgrafo.contieneEntidad(id)) {
        medida.dentro = medida.dentro + 1;
        medida.entran.push(MedidasRelevancia.#ficha(contexto.c, contexto.resultados.get(id)));
      }
      let s = 0;
      if (contexto.resultados.has(id)) {
        s = contexto.resultados.get(id).getRelevancia();
      }
      medida.valores.push(s);
    }
  }

  /** Por qué entra una entidad, en textos (para enseñarla). */
  static #ficha(central, resultado) {
    const padres = resultado.getPadres();
    const nombres = [];
    for (let i = 0; i < padres.length && i < MedidasRelevancia.MAX_PADRES; i++) {
      nombres.push(MedidasRelevancia.#identificar(padres[i]));
    }
    if (padres.length > nombres.length) {
      nombres.push("y " + (padres.length - nombres.length) + " más");
    }
    const explicacion = resultado.getExplicacion();
    let texto = explicacion.slice(0, MedidasRelevancia.MAX_PADRES).join(" · ");
    if (explicacion.length > MedidasRelevancia.MAX_PADRES) {
      // Lo que la une a la propia central va al final y es lo que más informa.
      texto = texto + " · … · " + explicacion[explicacion.length - 1];
    }
    return {
      central: MedidasRelevancia.#identificar(central), id: MedidasRelevancia.#identificar(resultado.getEntidad()),
      clase: resultado.getEntidad().getTipo(), s: resultado.getRelevancia(), r: resultado.getFuerza(),
      c: resultado.getCerteza(), origen: resultado.getOrigen(), padres: nombres.join(", "), explicacion: texto
    };
  }

  /** El id y, si es distinto, el nombre. */
  static #identificar(entidad) {
    if (entidad.getNombre() === entidad.getId()) {
      return entidad.getId();
    }
    return entidad.getId() + " (" + entidad.getNombre() + ")";
  }

  /** ¿El tipo de la relación es ese, hereda de él o equivale a él? */
  #esDeTipo(relacion, idTipo) {
    return this.#piezas.equivalencias.getIds(relacion.getTipo()).includes(idTipo);
  }

  /** Las relaciones de una entidad solo si la caché las tiene todas (si no, []). */
  #relacionesCompletas(cache, entidad) {
    if (!cache.tieneCompletas(entidad.getId())) {
      return [];
    }
    return cache.relacionesDe(entidad.getId());
  }

  /** Los vecinos de c por un tipo de relación y de una clase: id → Entidad. */
  #vecinos(cache, c, idTipo, clase) {
    const vecinos = new Map();
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      const otra = relaciones[i].getOtroExtremo(c);
      if (otra !== c && otra.getTipo() === clase && this.#esDeTipo(relaciones[i], idTipo)) {
        vecinos.set(otra.getId(), otra);
      }
    }
    return vecinos;
  }

  #todosLosVecinos(cache, c) {
    const vecinos = new Map();
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      const otra = relaciones[i].getOtroExtremo(c);
      if (otra !== c) {
        vecinos.set(otra.getId(), otra);
      }
    }
    return vecinos;
  }

  /** Los vecinos por Mentorship (o un tipo equivalente) que tienen ese rol (ya normalizado) en ella. */
  #conRol(cache, c, rol) {
    const resultado = new Map();
    const normalizador = this.#piezas.calculador.getNormalizador();
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      const otra = relaciones[i].getOtroExtremo(c);
      if (otra !== c && this.#esDeTipo(relaciones[i], MedidasRelevancia.TIPOS.MENTORIA) &&
        normalizador.rolDe(relaciones[i], otra) === rol) {
        resultado.set(otra.getId(), otra);
      }
    }
    return resultado;
  }

  #tieneDeclarada(cache, c, otra) {
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].getOtroExtremo(c) === otra && !this.#piezas.calculador.esCoincidencia(relaciones[i])) {
        return true;
      }
    }
    return false;
  }

  /** ¿Hay un evento (de tiposCoincidencia) en el que estén las dos? */
  #compartenEvento(cache, c, otra) {
    const reparto = this.#piezas.compuesta.getReparto();
    const relaciones = cache.relacionesDe(c.getId());
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].getOtroExtremo(c) === otra && reparto.esTipoDeCoincidencia(relaciones[i].getTipo())) {
        return true;
      }
    }
    return false;
  }

  /** ¿Alguna de sus etiquetas (o de sus padres) es la de quien crea? */
  #esCreadora(entidad) {
    const etiquetas = entidad.getEtiquetas();
    for (let i = 0; i < etiquetas.length; i++) {
      if (etiquetas[i] === MedidasRelevancia.ETIQUETA_CREADORA) {
        return true;
      }
      const padres = this.#jerarquia[etiquetas[i]];
      if (Array.isArray(padres) && padres.includes(MedidasRelevancia.ETIQUETA_CREADORA)) {
        return true;
      }
    }
    return false;
  }
}
