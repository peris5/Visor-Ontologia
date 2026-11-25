import { RepositorioVecindario } from '../datos/RepositorioVecindario.js';
import { FabricaRelevancia } from '../logica/FabricaRelevancia.js';

/**
 * Los escenarios de docs/prototipo_relevancia_v4.mjs, con la forma de las
 * respuestas del servidor: el de Ana y los de las propiedades P0–P16. Los
 * usan el laboratorio (PropiedadesRelevancia) y las pruebas de pruebas.html.
 *
 * Hay dos formas de describir un escenario:
 *  - por PAREJAS, como en el prototipo: { central, entidades: { id: [clase,
 *    nombre] }, parejas: [{ a, b, pruebas }] }, con pruebas declaradas (rel)
 *    o coincidencias en eventos (evento). construirDatos lo convierte en
 *    una respuesta de /api/relaciones;
 *  - por INTERMEDIARIOS, como en Neo4j (P13 a P16): { id, tipo, fecha,
 *    participantes: [{ id, via, rol }] }. derivarDatos saca las parejas
 *    con la MISMA regla que el servidor (ProyectorRelaciones), incluida la
 *    deduplicación de eventos (E7).
 *
 * Todos los nombres son inventados.
 */
export class EscenariosPrueba {
  static LUGAR = "OCURRED_AT";

  // Las clases del prototipo → etiquetas de la base de datos.
  static #ETIQUETAS_DE_CLASE = {
    Creator: ["Person", "Creator", "Painter"],
    Person: ["Person"],
    Organization: ["Organization"],
    HeritageItem: ["HeritageItem"]
  };
  static #TIPO_DE_CLASE = {
    Creator: "PERSONA", Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE"
  };

  // Las etiquetas con sus padres (como /api/jerarquia).
  static JERARQUIA = {
    Painter: ["Creator", "Person"], Creator: ["Person"], Person: [], Organization: [], HeritageItem: [],
    Paint: ["Creation", "Event"], Creation: ["Event"], Exposition: ["Event"], Event: []
  };

  // Los tipos de relación con sus padres (como /api/tipos).
  static TIPOS = [
    { id: "Creation", padres: ["Event"] },
    { id: "Employement", padres: ["Professional", "Relationship"] },
    { id: "Event", padres: [] },
    { id: "Exposition", padres: ["Event"] },
    { id: "Friendship", padres: ["Relationship"] },
    { id: "Marriage", padres: ["Related", "Relationship"] },
    { id: "Mentorship", padres: ["Relationship"] },
    { id: "Paint", padres: ["Creation", "Event"] },
    { id: "Work", padres: ["Event"] },
    { id: "coworking", padres: ["Professional", "Relationship"] }
  ];

  /**
   * Los parámetros del prototipo (perfil artístico, v4), con f_t = 1 en todo.
   * Están fijos aquí, y no se leen de public/relevancia.json, para que las
   * pruebas numéricas no cambien al ajustar los valores de la aplicación.
   */
  static configuracionPrototipo() {
    return {
      perfil: "artistico",
      estrategiaNodos: "tresCapas",
      pesosRelevancia: {
        Creation: 1.00, Mentorship: 0.95, coworking: 0.85, Fund: 0.85, Exposition: 0.70, Employement: 0.65,
        Professional: 0.60, Work: 0.60, Friendship: 0.50, Marriage: 0.50, Related: 0.45, Filiation: 0.45,
        Wedding: 0.20, Event: 0.30
      },
      pesoPorDefecto: 0.40,
      pesosPorRol: { "Mentorship.maestro": 0.95, "Mentorship.aprendiz": 0.60 },
      rolesEquivalentes: {
        maestro: ["maestro", "maestra", "mestre", "mestra", "teacher", "master"],
        aprendiz: ["aprendiz", "alumno", "alumna", "discípulo", "discípula", "deixeble", "student", "apprentice"]
      },
      betaParticipantes: 1,
      factorTiempoMinimo: 1,
      tauTiempoAnios: 25,
      factorTiempoSinFecha: 1,
      tiposSinTiempo: ["Creation", "Mentorship", "Related"],
      tablaTransferencia: {
        "Mentorship:maestro>Creation": 0.8, "Mentorship:aprendiz>Creation": 0.5,
        "Mentorship:maestro>Mentorship": 0.6, "Mentorship:aprendiz>Mentorship": 0.3,
        "Mentorship>Creation": 0.8, "Mentorship>Mentorship": 0.6,
        "Creation>Exposition": 0.8, "coworking>Creation": 0.6, "Marriage>Creation": 0.5,
        "Employement>Employement": 0.5, "Exposition>Creation": 0.4, "Friendship>Friendship": 0.4,
        "Exposition>Exposition": 0.3, "Friendship>Marriage": 0.3, "Friendship>Creation": 0.2
      },
      transferenciaPorDefecto: 0.3,
      factorEntidad: { Creator: 1.0, HeritageItem: 1.0, Organization: 0.8, Person: 0.6 },
      tiposCoincidencia: ["Exposition", "Work", "Wedding", "Event"],
      probabilidadCoincidencia: 0.4,
      rho: 0.5,
      delta: 0.7,
      gradoReferencia: 10,
      paresTemporales: {
        "Mentorship>Creation": "antesODurante", "Mentorship>Mentorship": "solapa",
        "Employement>Employement": "solapa", "Friendship>Marriage": "solapa"
      },
      margenAnios: 5,
      factorFueraDeTiempo: 0.3,
      transferenciaSinFecha: 1.0,
      umbralDirecto: 0.05,
      maxDirectos: 1000,
      penalizacionPorTipo: true,
      contarSoloPersonas: true,
      coincidenciaSalvoLugar: true,
      relacionesLugar: [EscenariosPrueba.LUGAR],
      cuotasPorClase: { OBRA_DE_ARTE: 50 },
      topeCoincidencia: 0.2,
      lugarSinReparto: true,
      mostrarDeducidosPorDefecto: true,
      opacidadMinima: 0.25
    };
  }

  /**
   * Una copia de la configuración con los cambios de la v4 apagados: el
   * resultado debe ser idéntico a la v3. (La deduplicación, E7, es del
   * servidor: ver derivarDatos.)
   */
  static sinCambiosV4(configuracion) {
    const copia = Object.assign({}, configuracion);
    copia.penalizacionPorTipo = false;
    copia.contarSoloPersonas = false;
    copia.coincidenciaSalvoLugar = false;
    copia.cuotasPorClase = {};
    copia.topeCoincidencia = null;
    copia.lugarSinReparto = false;
    return copia;
  }

  /**
   * Una copia de la configuración con f_t = 1 en todas las relaciones, como
   * en el prototipo: las propiedades hablan de la propagación, no de la
   * época de la central.
   */
  static conTiempoNeutro(configuracion) {
    const copia = Object.assign({}, configuracion);
    copia.factorTiempoMinimo = 1;
    copia.factorTiempoSinFecha = 1;
    return copia;
  }

  /** El contexto con que se interpretan los datos (como en Aplicacion). */
  static contexto() {
    return {
      idioma: "es",
      nombresTipos: {
        Friendship: "Amistad", Mentorship: "Mentoría", Employement: "Empleo", Marriage: "Matrimonio",
        Creation: "Creación", Paint: "Pintura", Exposition: "Exposición", Event: "Evento", Work: "Trabajo",
        coworking: "Colaboración", COINCIDENCIAS: "Coincidencias en eventos"
      },
      etiquetasEntidad: { Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE" },
      tipos: EscenariosPrueba.TIPOS
    };
  }

  // ───────────── De un escenario a datos con la forma del servidor ─────────────

  /**
   * Una relación derivada con el formato de /api/relaciones.
   *
   * @param {Object} extra - opcional: { roles: { id: rol }, via: { id: tipo }, periodo: { from, to }, fecha,
   *   dibujable, participantesPorClase, idsIntermediarios }
   */
  static relacion(id, origen, destino, tipo, participantes, extra) {
    let datos = {};
    if (extra !== undefined && extra !== null) {
      datos = extra;
    }
    let seDibuja = participantes <= 10;
    if (typeof datos.dibujable === "boolean") {
      seDibuja = datos.dibujable;
    }
    let idA = origen;
    let idB = destino;
    if (idB < idA) {
      idA = destino;
      idB = origen;
    }
    const relacion = {
      id: id + "|" + idA + "|" + idB, idIntermedio: id, origen: idA, destino: idB, tipo: tipo,
      padres: EscenariosPrueba.#padresDe(tipo), roles: {}, via: {}, nombre: "", periodo: null, lugar: null,
      fecha: null, participantes: participantes, participantesPorClase: null, dibujable: seDibuja
    };
    const opcionales = ["roles", "via", "periodo", "fecha", "participantesPorClase", "idsIntermediarios"];
    for (let i = 0; i < opcionales.length; i++) {
      if (datos[opcionales[i]] !== undefined) {
        relacion[opcionales[i]] = datos[opcionales[i]];
      }
    }
    return relacion;
  }

  static #padresDe(tipo) {
    for (let i = 0; i < EscenariosPrueba.TIPOS.length; i++) {
      if (EscenariosPrueba.TIPOS[i].id === tipo) {
        return EscenariosPrueba.TIPOS[i].padres;
      }
    }
    return [];
  }

  /** Una entidad en bruto (como /api/relaciones). */
  static entidad(id, etiquetas, nombre) {
    const propiedades = {};
    if (etiquetas[0] === "Person") {
      const partes = nombre.split(" ");
      propiedades.name = partes[0];
      if (partes.length > 1) {
        propiedades.lastName = partes.slice(1).join(" ");
      }
    } else {
      propiedades.name_es = nombre;
    }
    return { id: id, etiquetas: etiquetas, propiedades: propiedades };
  }

  /**
   * Una prueba declarada (rel del prototipo).
   *
   * @param {string} idLugar - opcional: cuál de los dos extremos es el lugar del evento.
   */
  static rel(tipo, roles, periodo, idLugar) {
    const prueba = { tipo: tipo, participantes: 2 };
    if (roles !== undefined && roles !== null) {
      prueba.roles = roles;
    }
    if (periodo !== undefined && periodo !== null) {
      prueba.periodo = periodo;
    }
    if (typeof idLugar === "string") {
      prueba.via = {};
      prueba.via[idLugar] = EscenariosPrueba.LUGAR;
    }
    return prueba;
  }

  /** Una coincidencia en un evento (evento del prototipo). */
  static evento(tipo, participantes) {
    return { tipo: tipo, participantes: participantes };
  }

  /**
   * Un escenario por parejas como una respuesta de /api/relaciones con TODAS
   * las entidades marcadas como completas.
   */
  static construirDatos(escenario) {
    const datos = EscenariosPrueba.#datosConEntidades(escenario.entidades);
    let numero = 0;
    for (let i = 0; i < escenario.parejas.length; i++) {
      const pareja = escenario.parejas[i];
      for (let j = 0; j < pareja.pruebas.length; j++) {
        const prueba = pareja.pruebas[j];
        numero = numero + 1;
        const extra = {};
        if (prueba.roles !== undefined) {
          extra.roles = prueba.roles;
        }
        if (prueba.via !== undefined) {
          extra.via = prueba.via;
        }
        if (prueba.periodo !== undefined) {
          extra.periodo = { from: String(prueba.periodo.desde), to: String(prueba.periodo.hasta) };
        }
        datos.relaciones.push(EscenariosPrueba.relacion("p" + numero, pareja.a, pareja.b, prueba.tipo,
          prueba.participantes, extra));
      }
    }
    return datos;
  }

  /**
   * Los datos de unos intermediarios, con la misma regla que el servidor: una
   * relación por cada pareja de entidades, con sus vías, sus roles y los
   * participantes por clase.
   *
   * @param {Object} entidades - { id: [clase, nombre] }
   * @param {Object[]} intermediarios - { id, tipo, fecha, participantes: [{ id, via, rol }] }
   * @param {boolean} deduplicar - juntar los eventos repetidos (E7).
   */
  static derivarDatos(entidades, intermediarios, deduplicar) {
    const datos = EscenariosPrueba.#datosConEntidades(entidades);
    let lista = intermediarios;
    if (deduplicar) {
      lista = EscenariosPrueba.#juntarRepetidos(intermediarios);
    }
    for (let i = 0; i < lista.length; i++) {
      const intermediario = lista[i];
      const participantes = intermediario.participantes;
      const porClase = {};
      for (let k = 0; k < participantes.length; k++) {
        const clase = EscenariosPrueba.#TIPO_DE_CLASE[entidades[participantes[k].id][0]];
        if (porClase[clase] === undefined) {
          porClase[clase] = 0;
        }
        porClase[clase] = porClase[clase] + 1;
      }
      for (let x = 0; x < participantes.length; x++) {
        for (let y = x + 1; y < participantes.length; y++) {
          const extra = { roles: {}, via: {}, fecha: null, participantesPorClase: porClase };
          const extremos = [participantes[x], participantes[y]];
          for (let k = 0; k < extremos.length; k++) {
            extra.via[extremos[k].id] = extremos[k].via;
            if (extremos[k].rol !== undefined) {
              extra.roles[extremos[k].id] = extremos[k].rol;
            }
          }
          if (intermediario.fecha !== undefined) {
            extra.fecha = intermediario.fecha;
          }
          if (intermediario.ids !== undefined && intermediario.ids.length > 1) {
            extra.idsIntermediarios = intermediario.ids;
          }
          datos.relaciones.push(EscenariosPrueba.relacion(intermediario.id, participantes[x].id, participantes[y].id,
            intermediario.tipo, participantes.length, extra));
        }
      }
    }
    return datos;
  }

  /** E7, como el servidor: mismo tipo, mismo lugar y misma fecha con día. */
  static #juntarRepetidos(intermediarios) {
    const resultado = [];
    const porClave = new Map();
    for (let i = 0; i < intermediarios.length; i++) {
      const original = intermediarios[i];
      const copia = { id: original.id, tipo: original.tipo, fecha: original.fecha, ids: [original.id],
        participantes: original.participantes.slice() };
      const clave = EscenariosPrueba.#claveDeEvento(original);
      if (clave === null || !porClave.has(clave)) {
        if (clave !== null) {
          porClave.set(clave, copia);
        }
        resultado.push(copia);
      } else {
        const unido = porClave.get(clave);
        unido.ids.push(original.id);
        for (let k = 0; k < original.participantes.length; k++) {
          let yaEsta = false;
          for (let q = 0; q < unido.participantes.length; q++) {
            if (unido.participantes[q].id === original.participantes[k].id) {
              yaEsta = true;
            }
          }
          if (!yaEsta) {
            unido.participantes.push(original.participantes[k]);
          }
        }
      }
    }
    return resultado;
  }

  static #claveDeEvento(intermediario) {
    const tiposDeEvento = EscenariosPrueba.configuracionPrototipo().tiposCoincidencia;
    if (!tiposDeEvento.includes(intermediario.tipo) || typeof intermediario.fecha !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(intermediario.fecha)) {
      return null;
    }
    for (let k = 0; k < intermediario.participantes.length; k++) {
      if (intermediario.participantes[k].via === EscenariosPrueba.LUGAR) {
        return intermediario.tipo + "|" + intermediario.participantes[k].id + "|" + intermediario.fecha;
      }
    }
    return null;
  }

  static #datosConEntidades(entidades) {
    const datos = { ids: [], entidades: [], relaciones: [] };
    for (const id of Object.keys(entidades)) {
      datos.ids.push(id);
      datos.entidades.push(EscenariosPrueba.entidad(id, EscenariosPrueba.#ETIQUETAS_DE_CLASE[entidades[id][0]],
        entidades[id][1]));
    }
    return datos;
  }

  // ───────────── Calcular un escenario ─────────────

  /** Las piezas del cálculo con la jerarquía de los escenarios (FabricaRelevancia). */
  static piezas(configuracion) {
    return FabricaRelevancia.crear(configuracion, EscenariosPrueba.JERARQUIA);
  }

  /** La caché con un escenario por parejas completo. */
  static cache(escenario) {
    return new RepositorioVecindario(EscenariosPrueba.construirDatos(escenario), EscenariosPrueba.contexto());
  }

  /**
   * Calcula un escenario por parejas.
   *
   * @returns {Map<string, ResultadoRelevanciaNodo>} con la central.
   */
  static calcular(escenario, configuracion) {
    const cache = EscenariosPrueba.cache(escenario);
    return EscenariosPrueba.piezas(configuracion).estrategia.calcular(cache.entidad(escenario.central), cache);
  }

  /**
   * La evidencia de «hacia» vista desde «desde» en unos datos derivados.
   *
   * @returns {EvidenciaPareja}
   */
  static evidencia(datos, configuracion, desde, hacia) {
    const cache = new RepositorioVecindario(datos, EscenariosPrueba.contexto());
    const calculador = EscenariosPrueba.piezas(configuracion).calculador;
    return calculador.calcularDesde(cache.entidad(desde), cache.relacionesDe(desde)).get(hacia);
  }

  // ───────────── Escenarios por parejas ─────────────

  static #repetir(prueba, veces) {
    const lista = [];
    for (let i = 0; i < veces; i++) {
      lista.push(prueba);
    }
    return lista;
  }

  /** El ejemplo de Ana Ferrer (escenarioAna del prototipo). */
  static ana() {
    const rel = EscenariosPrueba.rel;
    const evento = EscenariosPrueba.evento;
    const e = {
      central: "ana",
      entidades: {
        ana: ["Creator", "Ana Ferrer"], luis: ["Creator", "Luis Peris"], marta: ["Creator", "Marta Soler"],
        pedro: ["Person", "Pedro Navarro"], juan: ["Creator", "Juan Ribes"], joaquin: ["Creator", "Joaquín Mestre"],
        taller: ["Organization", "Taller Valencia"], museo: ["Organization", "Museo de la Ciudad"],
        retrato: ["HeritageItem", "Retrato"], paseo: ["HeritageItem", "Paseo"], huerta: ["HeritageItem", "Huerta"]
      },
      parejas: []
    };
    const luis = [rel("Friendship")].concat(EscenariosPrueba.#repetir(evento("Exposition", 4), 5));
    e.parejas.push({ a: "ana", b: "luis", pruebas: luis });
    e.parejas.push({ a: "ana", b: "marta",
      pruebas: [evento("Exposition", 3), evento("Exposition", 6), evento("Exposition", 40)] });
    e.parejas.push({ a: "ana", b: "taller", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "ana", b: "pedro", pruebas: [evento("Exposition", 12)] });
    e.parejas.push({ a: "ana", b: "joaquin", pruebas: [rel("Mentorship", { ana: "aprendiz", joaquin: "maestro" },
      { desde: 1900, hasta: 1910 })] });
    e.parejas.push({ a: "ana", b: "huerta", pruebas: [rel("Creation")] });
    e.parejas.push({ a: "luis", b: "marta", pruebas: [rel("Friendship")] });
    e.parejas.push({ a: "luis", b: "pedro", pruebas: [rel("Marriage")] });
    e.parejas.push({ a: "luis", b: "retrato", pruebas: [rel("Creation")] });
    e.parejas.push({ a: "taller", b: "juan", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "joaquin", b: "paseo", pruebas: [rel("Creation", null, { desde: 1905, hasta: 1905 })] });
    e.parejas.push({ a: "huerta", b: "museo", pruebas: [rel("Exposition", null, null, "museo")] });
    return e;
  }

  /** Una copia del escenario sin la pareja a–b (P1). */
  static sinPareja(escenario, a, b) {
    const copia = { central: escenario.central, entidades: escenario.entidades, parejas: [] };
    for (let i = 0; i < escenario.parejas.length; i++) {
      const par = escenario.parejas[i];
      const esLaQuitada = (par.a === a && par.b === b) || (par.a === b && par.b === a);
      if (!esLaQuitada) {
        copia.parejas.push(par);
      }
    }
    return copia;
  }

  /** Diez exposiciones con X frente a cuatro tipos distintos de vínculo con Y (P4). */
  static diversidad() {
    const rel = EscenariosPrueba.rel;
    const evento = EscenariosPrueba.evento;
    return {
      central: "ana",
      entidades: { ana: ["Creator", "Ana"], x: ["Creator", "Equis"], y: ["Creator", "Ye"] },
      parejas: [
        { a: "ana", b: "x", pruebas: [rel("Friendship")].concat(EscenariosPrueba.#repetir(evento("Exposition", 4), 10)) },
        { a: "ana", b: "y", pruebas: [rel("Friendship"), evento("Exposition", 4), rel("coworking"), evento("Work", 2)] }
      ]
    };
  }

  /** Un compañero de un taller pequeño frente a uno de una academia de 300 (P5). */
  static academia() {
    const rel = EscenariosPrueba.rel;
    const e = {
      central: "ana",
      entidades: {
        ana: ["Creator", "Ana"], tallerPequeno: ["Organization", "Taller pequeño"], academia: ["Organization", "Academia"],
        companeroTaller: ["Creator", "Compañero del taller"], companeroAcademia: ["Creator", "Compañero de la academia"]
      },
      parejas: [
        { a: "ana", b: "tallerPequeno", pruebas: [rel("Employement")] },
        { a: "ana", b: "academia", pruebas: [rel("Employement")] },
        { a: "tallerPequeno", b: "companeroTaller", pruebas: [rel("Employement")] },
        { a: "academia", b: "companeroAcademia", pruebas: [rel("Employement")] }
      ]
    };
    for (let i = 0; i < 4; i++) {
      e.entidades["t" + i] = ["Creator", "T" + i];
      e.parejas.push({ a: "tallerPequeno", b: "t" + i, pruebas: [rel("Employement")] });
    }
    for (let i = 0; i < 300; i++) {
      e.entidades["a" + i] = ["Creator", "A" + i];
      e.parejas.push({ a: "academia", b: "a" + i, pruebas: [rel("Employement")] });
    }
    return e;
  }

  /** Joaquín como centro: tiene 40 alumnos, Ana entre ellos (P6). */
  static maestro() {
    const e = EscenariosPrueba.ana();
    e.central = "joaquin";
    for (let i = 0; i < 39; i++) {
      e.entidades["alumno" + i] = ["Creator", "Alumno " + i];
      const roles = { joaquin: "maestro" };
      roles["alumno" + i] = "aprendiz";
      e.parejas.push({ a: "joaquin", b: "alumno" + i, pruebas: [EscenariosPrueba.rel("Mentorship", roles)] });
    }
    return e;
  }

  /** Dos obras del maestro: «Paseo», durante la mentoría, y «Tardía», 35 años después (P7). */
  static tiempo() {
    const e = EscenariosPrueba.ana();
    e.entidades.tardia = ["HeritageItem", "Tardía"];
    e.parejas.push({ a: "joaquin", b: "tardia",
      pruebas: [EscenariosPrueba.rel("Creation", null, { desde: 1945, hasta: 1945 })] });
    return e;
  }

  /** Un maestro y un círculo de 25 contactos flojos (solo coincidencias), todos amigos entre sí (P9). */
  static circulo() {
    const rel = EscenariosPrueba.rel;
    const evento = EscenariosPrueba.evento;
    const e = { central: "ana", entidades: { ana: ["Creator", "Ana"], joaquin: ["Creator", "Joaquín"] }, parejas: [] };
    e.parejas.push({ a: "ana", b: "joaquin", pruebas: [rel("Mentorship", { ana: "aprendiz", joaquin: "maestro" })] });
    for (let i = 0; i < 25; i++) {
      e.entidades["c" + i] = ["Creator", "C" + i];
      e.parejas.push({ a: "ana", b: "c" + i, pruebas: [evento("Exposition", 6), evento("Exposition", 8)] });
      for (let j = 0; j < i; j++) {
        e.parejas.push({ a: "c" + j, b: "c" + i, pruebas: [rel("Friendship")] });
      }
    }
    return e;
  }

  /** El ejemplo de Ana con más exposiciones (de esos tamaños) entre Ana y Pedro (P10). */
  static pedroCoincide(tamanos) {
    const e = EscenariosPrueba.ana();
    for (let i = 0; i < e.parejas.length; i++) {
      if (e.parejas[i].a === "ana" && e.parejas[i].b === "pedro") {
        for (let k = 0; k < tamanos.length; k++) {
          e.parejas[i].pruebas.push(EscenariosPrueba.evento("Exposition", tamanos[k]));
        }
      }
    }
    return e;
  }

  /** Joaquín, maestro prolífico: 60 obras y, si se pide, 400 personas con las que expuso (P11). */
  static maestroProlifico(conCoexpositores) {
    const e = EscenariosPrueba.ana();
    for (let i = 0; i < 59; i++) {
      e.entidades["obra" + i] = ["HeritageItem", "Obra " + i];
      e.parejas.push({ a: "joaquin", b: "obra" + i,
        pruebas: [EscenariosPrueba.rel("Creation", null, { desde: 1930, hasta: 1930 })] });
    }
    for (let i = 0; conCoexpositores && i < 400; i++) {
      e.entidades["expositor" + i] = ["Creator", "Expositor " + i];
      e.parejas.push({ a: "joaquin", b: "expositor" + i, pruebas: [EscenariosPrueba.evento("Exposition", 20)] });
    }
    return e;
  }

  /** Ana, muy prolífica: 200 obras y 12 alumnas (P12). */
  static artistaProlifica() {
    const e = EscenariosPrueba.ana();
    for (let i = 0; i < 199; i++) {
      e.entidades["propia" + i] = ["HeritageItem", "Propia " + i];
      e.parejas.push({ a: "ana", b: "propia" + i, pruebas: [EscenariosPrueba.rel("Creation")] });
    }
    for (let i = 0; i < 12; i++) {
      e.entidades["alumna" + i] = ["Creator", "Alumna " + i];
      const roles = { ana: "maestro" };
      roles["alumna" + i] = "aprendiz";
      e.parejas.push({ a: "ana", b: "alumna" + i, pruebas: [EscenariosPrueba.rel("Mentorship", roles)] });
    }
    return e;
  }

  // ───────────── Escenarios por intermediarios ─────────────

  static #PERSONA(id) {
    return { id: id, via: "PARTICIPATES_IN", rol: "expositora" };
  }

  static #GALERIA() {
    return { id: "galeria", via: EscenariosPrueba.LUGAR };
  }

  /** Las entidades de los escenarios por intermediarios (P13 a P16). */
  static entidadesEventos() {
    const entidades = {
      ana: ["Creator", "Ana"], bea: ["Creator", "Bea"], carla: ["Creator", "Carla"], joaquin: ["Creator", "Joaquín"],
      huerta: ["HeritageItem", "Huerta"], marina: ["HeritageItem", "Marina"], faro: ["HeritageItem", "Faro"],
      galeria: ["Organization", "Galería"], taller: ["Organization", "Taller"]
    };
    for (let i = 0; i < 98; i++) {
      entidades["visitante" + i] = ["Creator", "Visitante " + i];
    }
    return entidades;
  }

  /** Una exposición de Ana y Bea con sus obras y la galería (o sin obras ni galería) (P13 y P14). */
  static exposicion(conObrasYLugar) {
    const participantes = [EscenariosPrueba.#PERSONA("ana"), EscenariosPrueba.#PERSONA("bea")];
    if (conObrasYLugar) {
      const obras = ["huerta", "marina", "faro"];
      for (let i = 0; i < obras.length; i++) {
        participantes.push({ id: obras[i], via: "IS_EXPOSED" });
      }
      participantes.push(EscenariosPrueba.#GALERIA());
    }
    return [{ id: "i4", tipo: "Exposition", fecha: "1920", participantes: participantes }];
  }

  /** La mentoría de Joaquín y Ana, con o sin el taller donde ocurrió (P14). */
  static mentoria(conLugar) {
    const participantes = [{ id: "joaquin", via: "HAS_ROLE_IN", rol: "maestro" },
      { id: "ana", via: "HAS_ROLE_IN", rol: "aprendiz" }];
    if (conLugar) {
      participantes.push({ id: "taller", via: EscenariosPrueba.LUGAR });
    }
    return [{ id: "m1", tipo: "Mentorship", participantes: participantes }];
  }

  /**
   * Una exposición del 14/05/1920 con Ana, Bea y Carla y, si se indica, otra
   * con Ana y Bea en la misma galería con esa fecha (P15).
   *
   * @param {string|null} fechaDeLaOtra
   */
  static duplicados(fechaDeLaOtra) {
    const lista = [{ id: "e1", tipo: "Exposition", fecha: "1920-05-14", participantes: [EscenariosPrueba.#PERSONA("ana"),
      EscenariosPrueba.#PERSONA("bea"), EscenariosPrueba.#PERSONA("carla"), EscenariosPrueba.#GALERIA()] }];
    if (fechaDeLaOtra !== null) {
      lista.push({ id: "e2", tipo: "Exposition", fecha: fechaDeLaOtra, participantes: [EscenariosPrueba.#PERSONA("ana"),
        EscenariosPrueba.#PERSONA("bea"), EscenariosPrueba.#GALERIA()] });
    }
    return lista;
  }

  /** Una exposición de Ana y Bea con ese número de personas registradas (P16). */
  static registrados(numero) {
    const participantes = [EscenariosPrueba.#PERSONA("ana"), EscenariosPrueba.#PERSONA("bea"), EscenariosPrueba.#GALERIA()];
    for (let i = 0; i < numero - 2; i++) {
      participantes.push(EscenariosPrueba.#PERSONA("visitante" + i));
    }
    return [{ id: "e9", tipo: "Exposition", fecha: "1930", participantes: participantes }];
  }
}
