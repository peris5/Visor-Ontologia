import { EvidenciaPareja } from '../modelo/EvidenciaPareja.js';
import { RelevanciaCompuesta } from './RelevanciaCompuesta.js';
import { NormalizadorRoles } from './NormalizadorRoles.js';

/**
 * Capa 0 de la relevancia: la EVIDENCIA de cada pareja de entidades, VISTA
 * DESDE UNA DE ELLAS (es dirigida: calcular(A, B) y calcular(B, A) pueden
 * dar fuerzas distintas por el rol).
 *
 * Se juntan TODAS las relaciones y eventos que unen a dos entidades, se
 * dibujen o no (también las de los eventos grandes, dibujable = false):
 *
 *     r = peso(tipo, rol del otro) × reparto × f_t           (RelevanciaCompuesta)
 *
 *     por tipo:  fuerza_tipo = 1 − Π_k (1 − r_k · ρ^(k−1))   pruebas del mismo tipo, de mayor a menor
 *     total:     F = 1 − Π_tipos (1 − fuerza_tipo)
 *
 *     certeza:   C = 1 si hay alguna relación DECLARADA;
 *                si no, 1 − Π_k (1 − pCoincidencia · reparto_k)   sobre sus eventos
 *
 * El REPARTO es (2/n)^β, con el tope de las coincidencias y las demás reglas
 * de RepartoParticipantes, que decide también qué es coincidencia.
 *
 * MULTIPLEXIDAD: las pruebas repetidas del mismo tipo rinden cada vez
 * menos (ρ, rho): diez exposiciones juntos no son diez veces una. Los tipos
 * DISTINTOS se combinan sin descuento: ser amigos, compañeros de taller y
 * coexpositores dice más que repetir lo mismo.
 *
 * Fuerza y certeza se combinan como «o» de probabilidades («noisy-OR»): cada
 * prueba nueva solo puede subirlas, nunca pasan de 1, y dos pruebas débiles
 * suman más que una.
 *
 * ¿Coincidencia o declarada?
 *  - COINCIDENCIA: dos entidades unidas por un evento de tiposCoincidencia
 *    (dos pintores, o dos obras, en la misma exposición), salvo que una sea
 *    el lugar del evento. Coincidir no prueba que tengan relación: solo da
 *    una certeza parcial.
 *  - DECLARADA: todo lo demás (una Relationship, una relación directa, el
 *    autor y su obra en una Creation, la obra y el museo donde se expuso, los
 *    coautores de una obra...).
 *
 * También elige los NODOS DIRECTOS de una entidad central: los X con
 * F(c,X) × C(c,X) × factorEntidad(X) ≥ umbralDirecto (como mucho maxDirectos).
 */
export class CalculadorEvidencia {
  #estrategia;
  #tabla;
  #normalizador;
  #reparto;
  #probabilidadCoincidencia;
  #rho;
  #umbralDirecto;
  #maxDirectos;

  /**
   * @param {RelevanciaCompuesta} estrategia - la relevancia de cada relación.
   * @param {Object} configuracion - la de public/relevancia.json:
   *   { probabilidadCoincidencia, rho, rolesEquivalentes, rolesPorDireccion,
   *     umbralDirecto, maxDirectos }
   * @param {TablaTransferencia} tabla - opcional: para el factorEntidad con
   *   que se eligen los directos (sin ella, 1).
   */
  constructor(estrategia, configuracion, tabla) {
    if (!(estrategia instanceof RelevanciaCompuesta)) {
      throw new Error("CalculadorEvidencia necesita una RelevanciaCompuesta.");
    }
    this.#estrategia = estrategia;
    this.#tabla = null;
    if (tabla !== undefined && tabla !== null) {
      this.#tabla = tabla;
    }
    this.#normalizador = new NormalizadorRoles(configuracion);
    this.#reparto = estrategia.getReparto();
    this.#probabilidadCoincidencia = CalculadorEvidencia.#entre0y1(configuracion.probabilidadCoincidencia,
      "probabilidadCoincidencia");
    this.#rho = CalculadorEvidencia.#entre0y1(configuracion.rho, "rho");
    this.#umbralDirecto = CalculadorEvidencia.#entre0y1(configuracion.umbralDirecto, "umbralDirecto");
    this.#maxDirectos = 1000;
    if (Number.isInteger(configuracion.maxDirectos) && configuracion.maxDirectos > 0) {
      this.#maxDirectos = configuracion.maxDirectos;
    }
  }

  /**
   * @returns {RelevanciaCompuesta} la estrategia de las relaciones.
   */
  getEstrategia() {
    return this.#estrategia;
  }

  /**
   * @returns {NormalizadorRoles}
   */
  getNormalizador() {
    return this.#normalizador;
  }

  getUmbralDirecto() {
    return this.#umbralDirecto;
  }

  getMaxDirectos() {
    return this.#maxDirectos;
  }

  /**
   * ¿Es una coincidencia (ver RepartoParticipantes)?
   */
  esCoincidencia(relacion) {
    return this.#reparto.esCoincidencia(relacion);
  }

  /**
   * La evidencia de «hacia» vista desde «desde», con todas las relaciones
   * entre las dos. Calcula (y guarda en cada relación) su relevancia r.
   *
   * @param {Entidad} desde
   * @param {Entidad} hacia
   * @param {Relacion[]} relaciones - todas entre esas dos entidades (al menos una).
   * @returns {EvidenciaPareja}
   */
  calcular(desde, hacia, relaciones) {
    if (relaciones.length === 0) {
      throw new Error("Para calcular la evidencia de una pareja hace falta al menos una relación.");
    }
    // id del tipo → { tipo, pruebas: [{ r, relacion, rol }] }, en el orden en que aparecen.
    const porTipo = new Map();
    let productoCerteza = 1;
    let hayDeclarada = false;
    let numeroEventos = 0;
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const rol = this.#normalizador.rolDe(relacion, hacia);
      const r = this.#estrategia.calcularRelevanciaRelacion(relacion, rol);
      const idTipo = relacion.getTipo().getId();
      if (!porTipo.has(idTipo)) {
        porTipo.set(idTipo, { tipo: relacion.getTipo(), pruebas: [] });
      }
      porTipo.get(idTipo).pruebas.push({ r: r, relacion: relacion, rol: rol });
      if (this.esCoincidencia(relacion)) {
        numeroEventos = numeroEventos + 1;
        productoCerteza = productoCerteza * (1 - this.#probabilidadCoincidencia * this.#reparto.getFactor(relacion));
      } else {
        hayDeclarada = true;
      }
    }

    let productoFuerza = 1;
    const tipos = [];
    let principal = null;
    let mejorFuerza = -1;
    for (const grupo of porTipo.values()) {
      grupo.pruebas.sort(CalculadorEvidencia.#compararPruebas);
      let producto = 1;
      let atenuacion = 1;
      for (let k = 0; k < grupo.pruebas.length; k++) {
        producto = producto * (1 - grupo.pruebas[k].r * atenuacion);
        atenuacion = atenuacion * this.#rho;
      }
      const fuerzaTipo = 1 - producto;
      productoFuerza = productoFuerza * (1 - fuerzaTipo);
      const periodos = [];
      for (let k = 0; k < grupo.pruebas.length; k++) {
        periodos.push(RelevanciaCompuesta.aniosDe(grupo.pruebas[k].relacion));
      }
      tipos.push({ tipo: grupo.tipo, rol: grupo.pruebas[0].rol, fuerza: fuerzaTipo, periodos: periodos });
      // A igual fuerza, el primer tipo por orden alfabético: el orden en que
      // llegan las relaciones depende de por dónde se haya navegado, y no
      // puede influir en el resultado.
      if (fuerzaTipo > mejorFuerza ||
        (fuerzaTipo === mejorFuerza && grupo.tipo.getId() < principal.tipo.getId())) {
        mejorFuerza = fuerzaTipo;
        principal = grupo;
      }
    }
    let certeza = 1 - productoCerteza;
    if (hayDeclarada) {
      certeza = 1;
    }
    return new EvidenciaPareja({
      desde: desde,
      hacia: hacia,
      fuerza: 1 - productoFuerza,
      certeza: certeza,
      tipos: tipos,
      tipoPrincipal: principal.tipo,
      rolPrincipal: principal.pruebas[0].rol,
      periodoPrincipal: RelevanciaCompuesta.aniosDe(principal.pruebas[0].relacion),
      declarada: hayDeclarada,
      numeroEventos: numeroEventos,
      relaciones: relaciones
    });
  }

  /**
   * La evidencia de cada vecino VISTA DESDE una entidad. Las relaciones
   * repetidas (mismo id) se cuentan una vez; las de la entidad consigo misma
   * no cuentan.
   *
   * Con esto RelevanciaNodosTresCapas forma la caché de evidencias de cada
   * cálculo, por pareja ORDENADA (idDesde → idHacia): la de B vista desde A y
   * la de A vista desde B pueden ser distintas. Es de un solo cálculo porque
   * f_t depende de la época de la central.
   *
   * @param {Entidad} entidad
   * @param {Relacion[]} relaciones - todas las suyas.
   * @returns {Map<string, EvidenciaPareja>} idHacia → evidencia.
   */
  calcularDesde(entidad, relaciones) {
    const porVecino = new Map();
    const vistas = new Set();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      const otra = relacion.getOtroExtremo(entidad);
      if (!vistas.has(relacion.getId()) && otra.getId() !== entidad.getId()) {
        vistas.add(relacion.getId());
        if (!porVecino.has(otra.getId())) {
          porVecino.set(otra.getId(), { otra: otra, relaciones: [] });
        }
        porVecino.get(otra.getId()).relaciones.push(relacion);
      }
    }
    const evidencias = new Map();
    for (const [idOtra, pareja] of porVecino) {
      evidencias.set(idOtra, this.calcular(entidad, pareja.otra, pareja.relaciones));
    }
    return evidencias;
  }

  /**
   * La evidencia propia de un nodo con la central, como la mide la elección
   * de directos: F × C × factorEntidad(hacia).
   *
   * @param {EvidenciaPareja} evidencia - vista desde la central.
   */
  valorPropio(evidencia) {
    return evidencia.getValor() * this.#factorEntidad(evidencia.getHacia());
  }

  /**
   * Los nodos DIRECTOS de la central: los vecinos con F × C × factorEntidad ≥
   * umbralDirecto, de mayor a menor. Si hay más de maxDirectos, se queda
   * con los de más evidencia.
   *
   * Es lo primero que se calcula para una central, así que aquí se fija
   * también su ÉPOCA (RelevanciaCompuesta.setEpoca), con la que se calcula
   * el factor de tiempo de todas las relaciones que vengan después.
   *
   * @param {Entidad} central
   * @param {Relacion[]} relacionesDeLaCentral - TODAS las de la central.
   * @returns {Object} { directos: Entidad[], evidencias: Map<idOtra, EvidenciaPareja> (vistas desde
   *   la central), descartados: número }
   */
  elegirDirectos(central, relacionesDeLaCentral) {
    this.#estrategia.setEpoca(RelevanciaCompuesta.epocaDe(relacionesDeLaCentral));
    const evidencias = this.calcularDesde(central, relacionesDeLaCentral);
    const candidatos = [];
    for (const evidencia of evidencias.values()) {
      const valor = this.valorPropio(evidencia);
      if (valor >= this.#umbralDirecto) {
        candidatos.push({ entidad: evidencia.getHacia(), valor: valor });
      }
    }
    // De mayor a menor; a igual evidencia, por id (para que maxDirectos no
    // dependa del orden en que llegaron).
    candidatos.sort(function (a, b) {
      if (b.valor !== a.valor) {
        return b.valor - a.valor;
      }
      if (a.entidad.getId() < b.entidad.getId()) {
        return -1;
      }
      return 1;
    });
    const directos = [];
    for (let i = 0; i < candidatos.length && i < this.#maxDirectos; i++) {
      directos.push(candidatos[i].entidad);
    }
    return { directos: directos, evidencias: evidencias, descartados: candidatos.length - directos.length };
  }

  /**
   * Los tipos con alguna relación DECLARADA en palabras, de más a menos
   * fuerza y con el rol del otro si se conoce: «Mentoría (su maestro)»,
   * «Amistad», «Amistad, Empleo». "" si solo hay coincidencias.
   *
   * @param {EvidenciaPareja} evidencia
   */
  textoDeclaradas(evidencia) {
    const declarados = this.#tiposDeclarados(evidencia);
    const nombres = [];
    for (let i = 0; i < declarados.length; i++) {
      let nombre = declarados[i].tipo.getNombre();
      if (declarados[i].rol !== null) {
        nombre = nombre + " (su " + declarados[i].rol + ")";
      }
      if (!nombres.includes(nombre)) {
        nombres.push(nombre);
      }
    }
    return nombres.join(", ");
  }

  /**
   * Lo que une a la central con un nodo directo, en pocas palabras, para
   * explicar un deducido («Creación de Joaquín Mestre (su maestro)»): por cada
   * tipo declarado, de más a menos fuerza, el rol del otro («su maestro») o,
   * si no tiene, el nombre del tipo («Amistad»). Se dicen TODOS («su maestro,
   * Colaboración») porque todos transmiten, y el más fuerte no es siempre el
   * que hace entrar al deducido: una obra del maestro muy posterior a la
   * mentoría puede entrar porque además colaboraban. Si solo hay
   * coincidencias, «coinciden en 3 exposiciones».
   *
   * @param {EvidenciaPareja} evidencia - el directo visto desde la central.
   */
  textoVinculo(evidencia) {
    const declarados = this.#tiposDeclarados(evidencia);
    if (declarados.length === 0) {
      return "coinciden en " + this.textoCoincidencias(evidencia);
    }
    const nombres = [];
    for (let i = 0; i < declarados.length; i++) {
      let nombre = declarados[i].tipo.getNombre();
      if (declarados[i].rol !== null) {
        nombre = "su " + declarados[i].rol;
      }
      if (!nombres.includes(nombre)) {
        nombres.push(nombre);
      }
    }
    return nombres.join(", ");
  }

  /**
   * Las coincidencias de una pareja en palabras: «3 exposiciones» si son
   * todas del mismo tipo, «3 eventos» si son de varios, «» si no hay.
   * Nunca dice que se conozcan (RNF-23): solo que coinciden.
   *
   * @param {EvidenciaPareja} evidencia
   */
  textoCoincidencias(evidencia) {
    const relaciones = evidencia.getRelaciones();
    let numero = 0;
    let tipo = null;
    let variosTipos = false;
    for (let i = 0; i < relaciones.length; i++) {
      if (this.esCoincidencia(relaciones[i])) {
        numero = numero + 1;
        if (tipo === null) {
          tipo = relaciones[i].getTipo();
        } else if (tipo.getId() !== relaciones[i].getTipo().getId()) {
          variosTipos = true;
        }
      }
    }
    if (numero === 0) {
      return "";
    }
    let nombre = "evento";
    if (!variosTipos) {
      nombre = tipo.getNombre().toLowerCase();
    }
    return CalculadorEvidencia.contar(numero, nombre);
  }

  /**
   * «1 exposición», «3 exposiciones», «2 eventos», «4 bodas»: el número y el
   * nombre en singular o plural (reglas sencillas del castellano).
   */
  static contar(numero, nombreEnSingular) {
    if (numero === 1) {
      return "1 " + nombreEnSingular;
    }
    return numero + " " + CalculadorEvidencia.#plural(nombreEnSingular);
  }

  /**
   * Los tipos de la evidencia que tienen alguna relación declarada (no
   * coincidencia), de más a menos fuerza: [{ tipo, rol, fuerza }].
   */
  #tiposDeclarados(evidencia) {
    const conDeclarada = new Set();
    const relaciones = evidencia.getRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      if (!this.esCoincidencia(relaciones[i])) {
        conDeclarada.add(relaciones[i].getTipo().getId());
      }
    }
    const tipos = evidencia.getTipos();
    const declarados = [];
    for (let i = 0; i < tipos.length; i++) {
      if (conDeclarada.has(tipos[i].tipo.getId())) {
        declarados.push(tipos[i]);
      }
    }
    declarados.sort(function (a, b) {
      return b.fuerza - a.fuerza;
    });
    return declarados;
  }

  /** El factor de entidad de la tabla, o 1 si no hay tabla. */
  #factorEntidad(entidad) {
    if (this.#tabla === null) {
      return 1;
    }
    return this.#tabla.getFactorEntidad(entidad);
  }

  /** Plural sencillo: «exposición» → «exposiciones», «evento» → «eventos», «mentor» → «mentores». */
  static #plural(palabra) {
    if (palabra.endsWith("ón")) {
      return palabra.substring(0, palabra.length - 2) + "ones";
    }
    const ultima = palabra.charAt(palabra.length - 1);
    if ("aeiouáéó".includes(ultima)) {
      return palabra + "s";
    }
    return palabra + "es";
  }

  /** De mayor a menor r; a igual r, por el id de la relación (el orden de llegada no influye). */
  static #compararPruebas(a, b) {
    if (b.r !== a.r) {
      return b.r - a.r;
    }
    if (a.relacion.getId() < b.relacion.getId()) {
      return -1;
    }
    return 1;
  }

  static #entre0y1(valor, nombre) {
    if (typeof valor !== "number" || Number.isNaN(valor) || valor < 0 || valor > 1) {
      throw new Error("En public/relevancia.json, " + nombre + " debe ser un número entre 0 y 1.");
    }
    return valor;
  }
}
