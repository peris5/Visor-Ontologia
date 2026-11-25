// Prototipo v4 de la relevancia artística (no es código de la aplicación).
//
// Parte de la v3 (fórmula única) y añade los cuatro cambios que salieron de la prueba con la BD
// simulada grande (claude/resultados_simulacion_relevancia.md):
//   E1  la penalización por grado cuenta solo los vecinos de y unidos por el tipo del segundo tramo
//   E2  en las parejas de dos personas, p cuenta solo las personas del intermediario
//   E3  como mucho 50 obras entre los nodos dibujados (cuota por clase)
//   E4  en los eventos de tipo coincidencia, toda pareja es coincidencia salvo las del lugar del evento
// Y tres cambios en cómo cuentan los eventos, porque los participantes registrados de un evento salen
// de fuentes muy distintas (anécdotas, vídeos...) y no dicen cuánta gente hubo:
//   E5  una coincidencia en un evento vale como mucho topeCoincidencia (0,2); si los registrados
//       demuestran que el evento fue grande, menos (2/n). Los registrados se usan solo como mínimo.
//   E6  lo que une con el lugar del evento no se reparte entre participantes
//   E7  dos eventos del mismo tipo, en el mismo lugar y la misma fecha son el mismo: se juntan
// Además calcula recorriendo los vecinos de cada directo (mismo resultado, unas 9 veces más rápido)
// y desempata por certeza y por identificador, para que el corte de los 150 no dependa del orden.
//
// Ejecutar: node prototipo_relevancia_v4.mjs  →  debe decir «v4: 17/17» y «Todas cumplen».
// Estilo: sin flechas, ternarios, ?., ??, map ni filter.

// ---------- Perfil artístico ----------

const PESOS = {
    Creation: 1.00, Mentorship: 0.95, coworking: 0.85, Fund: 0.85, Exposition: 0.70,
    Employement: 0.65, Professional: 0.60, Work: 0.60, Friendship: 0.50, Marriage: 0.50,
    Related: 0.45, Filiation: 0.45, Wedding: 0.20, Event: 0.30
};
const PESO_POR_DEFECTO = 0.40;

// Peso según el rol que tiene el OTRO extremo, visto desde quien mira.
const PESOS_ROL = { "Mentorship.maestro": 0.95, "Mentorship.aprendiz": 0.60 };

// Clave "tipo1[:rol1]>tipo2": tipo1 y rol1 = tramo central–y (rol de y); tipo2 = tramo y–x.
const TABLA_T = {
    "Mentorship:maestro>Creation": 0.8, "Mentorship:aprendiz>Creation": 0.5,
    "Mentorship:maestro>Mentorship": 0.6, "Mentorship:aprendiz>Mentorship": 0.3,
    "Mentorship>Creation": 0.8, "Mentorship>Mentorship": 0.6,
    "Creation>Exposition": 0.8, "coworking>Creation": 0.6, "Marriage>Creation": 0.5,
    "Employement>Employement": 0.5, "Exposition>Creation": 0.4, "Friendship>Friendship": 0.4,
    "Exposition>Exposition": 0.3, "Friendship>Marriage": 0.3, "Friendship>Creation": 0.2
};
const T_POR_DEFECTO = 0.3;

const PARES_TEMPORALES = {
    "Mentorship>Creation": "antesODurante",
    "Mentorship>Mentorship": "solapa",
    "Employement>Employement": "solapa",
    "Friendship>Marriage": "solapa"
};

const FACTOR_ENTIDAD = { Creator: 1.0, HeritageItem: 1.0, Organization: 0.8, Person: 0.6 };
const CLASES_PERSONA = ["Creator", "Person"];
const TIPOS_COINCIDENCIA = ["Exposition", "Work", "Wedding", "Event"];
const ROL_LUGAR = "lugar";   // la entidad unida al intermediario por OCURRED_AT

export const PARAMETROS = {
    beta: 1,
    probabilidadCoincidencia: 0.4,
    umbralDirecto: 0.05,
    umbral: 0.3,
    maxNodos: 150,
    lambda: 0.5,            // rendimiento de las pruebas repetidas del mismo tipo
    delta: 0.7,             // descuento de la certeza por llegar a través de otro
    gradoReferencia: 10,    // desde este grado (del tipo del segundo tramo) se penaliza
    margenAnios: 5,
    factorFueraDeTiempo: 0.3,
    factorTiempoSinFecha: 1,
    maxParticipantesEvidencia: 200,
    topeCoincidencia: 0.2   // lo máximo que vale una coincidencia en un evento (E5)
};

// Las dos configuraciones que se comparan. v3 = la anterior; v4 = la propuesta.
export const CONFIG = {
    v3: { nombre: "v3", hubPorTipo: false, contarPersonas: false, coincidenciaSalvoLugar: false, cuotas: {},
          topeCoincidencia: false, lugarSinReparto: false, deduplicarEventos: false },
    v4: { nombre: "v4", hubPorTipo: true, contarPersonas: true, coincidenciaSalvoLugar: true, cuotas: { HeritageItem: 50 },
          topeCoincidencia: true, lugarSinReparto: true, deduplicarEventos: true }
};

// ---------- Utilidades ----------

export function noisyOr(valores) {
    let producto = 1;
    for (let i = 0; i < valores.length; i++) { producto = producto * (1 - valores[i]); }
    return 1 - producto;
}

function menor(x, y) {
    if (x < y) { return x; }
    return y;
}

function esPersona(clase) {
    return CLASES_PERSONA.indexOf(clase) >= 0;
}

function pesoPrueba(prueba, idOtro) {
    if (prueba.roles !== undefined && prueba.roles[idOtro] !== undefined) {
        const clave = prueba.tipo + "." + prueba.roles[idOtro];
        if (PESOS_ROL[clave] !== undefined) { return PESOS_ROL[clave]; }
    }
    if (PESOS[prueba.tipo] !== undefined) { return PESOS[prueba.tipo]; }
    return PESO_POR_DEFECTO;
}

function factorT(tipo1, rol1, tipo2) {
    if (rol1 !== null) {
        const conRol = tipo1 + ":" + rol1 + ">" + tipo2;
        if (TABLA_T[conRol] !== undefined) { return TABLA_T[conRol]; }
    }
    const sinRol = tipo1 + ">" + tipo2;
    if (TABLA_T[sinRol] !== undefined) { return TABLA_T[sinRol]; }
    return T_POR_DEFECTO;
}

function compatibilidad(modo, p1, p2) {
    if (p1 === null || p2 === null) { return PARAMETROS.factorTiempoSinFecha; }
    const m = PARAMETROS.margenAnios;
    let compatible = false;
    if (modo === "antesODurante") {
        compatible = p2.desde <= p1.hasta + m;
    } else {
        compatible = p2.desde <= p1.hasta + m && p2.hasta >= p1.desde - m;
    }
    if (compatible) { return 1; }
    return PARAMETROS.factorFueraDeTiempo;
}

// τ de un tipo del primer tramo: el mejor valor entre todas sus pruebas.
function factorTiempoTipo(tipoPrimero, segundoTramo) {
    const modo = PARES_TEMPORALES[tipoPrimero.tipo + ">" + segundoTramo.tipo];
    if (modo === undefined) { return 1; }
    let mejor = 0;
    for (let k = 0; k < tipoPrimero.periodos.length; k++) {
        const valor = compatibilidad(modo, tipoPrimero.periodos[k], segundoTramo.periodo);
        if (valor > mejor) { mejor = valor; }
    }
    return mejor;
}

// Tr: lo que transmite el primer tramo (central–y) hacia un segundo tramo (y–x).
function transmision(primerTramo, segundoTramo) {
    const valores = [];
    for (let i = 0; i < primerTramo.tipos.length; i++) {
        const t = primerTramo.tipos[i];
        valores.push(t.fuerza * factorT(t.tipo, t.rol, segundoTramo.tipo) * factorTiempoTipo(t, segundoTramo));
    }
    return noisyOr(valores);
}

// ---------- Regla genérica: de intermediarios a pruebas entre parejas ----------
// intermediario = { id, tipo, participantes: [{ id, rol }], periodo: { desde, hasta } | null }
// El lugar del evento (OCURRED_AT) va como participante con rol "lugar".

// E7: dos eventos del mismo tipo, en el mismo lugar y en la misma fecha exacta (día) son el mismo evento
// registrado desde dos fuentes. Se juntan en uno con todos los participantes de los dos. Sin lugar o sin fecha
// exacta no se juntan: con solo el año, dos exposiciones distintas de la misma galería se confundirían
// (en la BD simulada, que solo tiene años, se habrían juntado 1.184 eventos distintos).
function claveEvento(it) {
    if (TIPOS_COINCIDENCIA.indexOf(it.tipo) < 0 || it.periodo === null || it.periodo === undefined) { return null; }
    if (typeof it.periodo.fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(it.periodo.fecha)) { return null; }
    let lugar = null;
    for (let k = 0; k < it.participantes.length; k++) {
        if (it.participantes[k].rol === ROL_LUGAR) { lugar = it.participantes[k].id; }
    }
    if (lugar === null) { return null; }
    return it.tipo + "|" + lugar + "|" + it.periodo.fecha;
}

export function deduplicarEventos(intermediarios) {
    const resultado = [];
    const porClave = new Map();
    for (let i = 0; i < intermediarios.length; i++) {
        const it = intermediarios[i];
        const clave = claveEvento(it);
        if (clave === null) { resultado.push(it); continue; }
        if (!porClave.has(clave)) {
            const copia = { id: it.id, tipo: it.tipo, periodo: it.periodo, participantes: it.participantes.slice() };
            porClave.set(clave, copia);
            resultado.push(copia);
            continue;
        }
        const unido = porClave.get(clave);
        for (let k = 0; k < it.participantes.length; k++) {
            let ya = false;
            for (let q = 0; q < unido.participantes.length; q++) {
                if (unido.participantes[q].id === it.participantes[k].id) { ya = true; }
            }
            if (!ya) { unido.participantes.push(it.participantes[k]); }
        }
    }
    return resultado;
}

export function derivarParejas(entidades, intermediariosEnBruto, config) {
    const parejas = new Map();
    let intermediarios = intermediariosEnBruto;
    if (config.deduplicarEventos) { intermediarios = deduplicarEventos(intermediariosEnBruto); }
    for (let i = 0; i < intermediarios.length; i++) {
        const it = intermediarios[i];
        const n = it.participantes.length;
        if (n > PARAMETROS.maxParticipantesEvidencia) { continue; }
        let nPersonas = 0;
        for (let k = 0; k < n; k++) {
            if (esPersona(entidades[it.participantes[k].id])) { nPersonas = nPersonas + 1; }
        }
        const tipoCoincidencia = TIPOS_COINCIDENCIA.indexOf(it.tipo) >= 0;
        for (let x = 0; x < n; x++) {
            for (let y = x + 1; y < n; y++) {
                const px = it.participantes[x];
                const py = it.participantes[y];
                if (px.id === py.id) { continue; }
                const dosPersonas = esPersona(entidades[px.id]) && esPersona(entidades[py.id]);
                // E4: qué es coincidencia.
                let coincidencia = tipoCoincidencia && dosPersonas;
                if (config.coincidenciaSalvoLugar && tipoCoincidencia) {
                    coincidencia = px.rol !== ROL_LUGAR && py.rol !== ROL_LUGAR;
                }
                // E2: entre cuántos se reparte.
                let p = n;
                if (config.contarPersonas && dosPersonas) { p = nPersonas; }
                const roles = {};
                roles[px.id] = px.rol;
                roles[py.id] = py.rol;
                const prueba = { tipo: it.tipo, participantes: p, factorTiempo: 1, declarada: !coincidencia,
                                 conLugar: px.rol === ROL_LUGAR || py.rol === ROL_LUGAR,
                                 roles: roles, intermediario: it.id };
                if (it.periodo !== null && it.periodo !== undefined) { prueba.periodo = it.periodo; }
                let clave = px.id + "|" + py.id;
                if (py.id < px.id) { clave = py.id + "|" + px.id; }
                if (!parejas.has(clave)) { parejas.set(clave, { a: px.id, b: py.id, pruebas: [] }); }
                parejas.get(clave).pruebas.push(prueba);
            }
        }
    }
    const lista = [];
    for (const par of parejas.values()) { lista.push(par); }
    return lista;
}

// (2/p)^β de la fórmula (3), con los cambios E5 y E6.
//   E6: lo que une con el lugar del evento no se reparte: que una obra se expusiera en un museo
//       no depende de cuánta gente expusiera con ella.
//   E5: en una coincidencia, los participantes registrados no dicen cuánta gente hubo (los eventos se
//       registran desde anécdotas, vídeos, prensa...). Solo son un mínimo: si hay 100 registrados, hubo al
//       menos 100. Por eso la coincidencia vale como mucho topeCoincidencia y menos si los registrados
//       demuestran que el evento fue grande. Idea de Crandall y otros (2010) y Pham y otros (2013): un evento
//       concurrido dice poco de cada pareja.
function factorReparto(prueba, config) {
    const reparto = Math.pow(2 / prueba.participantes, PARAMETROS.beta);
    if (config.lugarSinReparto && prueba.declarada && prueba.conLugar) { return 1; }
    if (config.topeCoincidencia && !prueba.declarada) { return menor(PARAMETROS.topeCoincidencia, reparto); }
    return reparto;
}

// ---------- Grafo y capa 0: evidencia dirigida (b visto desde a) ----------

export class Grafo {
    constructor(entidades, parejas, config) {
        this.entidades = entidades;
        this.config = config;
        this.pruebas = new Map();
        this.vecinos = new Map();
        this.cacheEvidencia = new Map();
        this.cacheGradoTipo = new Map();
        for (let i = 0; i < parejas.length; i++) {
            this.anadir(parejas[i].a, parejas[i].b, parejas[i].pruebas);
        }
    }

    anadir(a, b, pruebas) {
        let lista = this.pruebas.get(this.clave(a, b));
        if (lista === undefined) {
            lista = [];
            this.pruebas.set(this.clave(a, b), lista);
        }
        for (let i = 0; i < pruebas.length; i++) { lista.push(pruebas[i]); }
        this.vecinoDe(a).add(b);
        this.vecinoDe(b).add(a);
        this.cacheEvidencia = new Map();
        this.cacheGradoTipo = new Map();
    }

    clave(a, b) {
        if (a < b) { return a + "|" + b; }
        return b + "|" + a;
    }

    vecinoDe(nodo) {
        if (!this.vecinos.has(nodo)) { this.vecinos.set(nodo, new Set()); }
        return this.vecinos.get(nodo);
    }

    grado(nodo) {
        return this.vecinoDe(nodo).size;
    }

    // Vecinos de y unidos por al menos una prueba del tipo dado.
    gradoPorTipo(y, tipo) {
        const clave = y + ">" + tipo;
        if (this.cacheGradoTipo.has(clave)) { return this.cacheGradoTipo.get(clave); }
        let n = 0;
        for (const x of this.vecinoDe(y)) {
            const pr = this.pruebas.get(this.clave(y, x));
            for (let i = 0; i < pr.length; i++) {
                if (pr[i].tipo === tipo) { n = n + 1; break; }
            }
        }
        this.cacheGradoTipo.set(clave, n);
        return n;
    }

    factorEntidad(nodo) {
        const clase = this.entidades[nodo];
        if (FACTOR_ENTIDAD[clase] !== undefined) { return FACTOR_ENTIDAD[clase]; }
        return 1;
    }

    // h(y): penalización de los nodos con muchas relaciones (Adamic-Adar). E1: con hubPorTipo,
    // solo cuentan las relaciones del mismo tipo que el segundo tramo (normalización por meta-camino).
    factorHub(y, tipoSegundo) {
        let grado = this.grado(y);
        if (this.config.hubPorTipo) { grado = this.gradoPorTipo(y, tipoSegundo); }
        const factor = Math.log(2 + PARAMETROS.gradoReferencia) / Math.log(2 + grado);
        return menor(1, factor);
    }

    evidencia(a, b) {
        const claveCache = a + ">" + b;
        if (this.cacheEvidencia.has(claveCache)) { return this.cacheEvidencia.get(claveCache); }
        const pruebas = this.pruebas.get(this.clave(a, b));
        if (pruebas === undefined) { return null; }
        const p = PARAMETROS;
        const porTipo = new Map();
        let productoCerteza = 1;
        let declarada = false;
        for (let i = 0; i < pruebas.length; i++) {
            const prueba = pruebas[i];
            const factorParticipantes = factorReparto(prueba, this.config);
            const r = pesoPrueba(prueba, b) * factorParticipantes * prueba.factorTiempo;
            if (!porTipo.has(prueba.tipo)) { porTipo.set(prueba.tipo, []); }
            porTipo.get(prueba.tipo).push({ r: r, prueba: prueba });
            if (prueba.declarada) {
                declarada = true;
            } else {
                productoCerteza = productoCerteza * (1 - p.probabilidadCoincidencia * factorParticipantes);
            }
        }
        const fuerzas = [];
        const tipos = [];
        let tipoPrincipal = null;
        let periodoPrincipal = null;
        let mejor = -1;
        for (const [tipo, lista] of porTipo) {
            lista.sort(function (x, y) { return y.r - x.r; });
            const valores = [];
            for (let k = 0; k < lista.length; k++) { valores.push(lista[k].r * Math.pow(p.lambda, k)); }
            const fuerzaTipo = noisyOr(valores);
            fuerzas.push(fuerzaTipo);
            let rolTipo = null;
            if (lista[0].prueba.roles !== undefined && lista[0].prueba.roles[b] !== undefined) {
                rolTipo = lista[0].prueba.roles[b];
            }
            const periodosTipo = [];
            for (let k = 0; k < lista.length; k++) {
                let per = null;
                if (lista[k].prueba.periodo !== undefined) { per = lista[k].prueba.periodo; }
                periodosTipo.push(per);
            }
            tipos.push({ tipo: tipo, rol: rolTipo, fuerza: fuerzaTipo, periodos: periodosTipo });
            if (fuerzaTipo > mejor) {
                mejor = fuerzaTipo;
                tipoPrincipal = tipo;
                periodoPrincipal = null;
                if (lista[0].prueba.periodo !== undefined) { periodoPrincipal = lista[0].prueba.periodo; }
            }
        }
        let certeza = 1 - productoCerteza;
        if (declarada) { certeza = 1; }
        const resultado = { fuerza: noisyOr(fuerzas), certeza: certeza, tipo: tipoPrincipal, tipos: tipos,
                            periodo: periodoPrincipal, declarada: declarada };
        this.cacheEvidencia.set(claveCache, resultado);
        return resultado;
    }
}

// ---------- Cálculo: fórmula única, recorriendo los vecinos de cada directo ----------

function nodosDirectos(g, c) {
    const directos = [];
    for (const nodo of g.vecinoDe(c)) {
        const e = g.evidencia(c, nodo);
        if (e.fuerza * e.certeza * g.factorEntidad(nodo) >= PARAMETROS.umbralDirecto) { directos.push(nodo); }
    }
    return directos;
}

// Aportación de un directo y a un nodo x (fuerza y certeza).
function aportacion(g, c, y, x) {
    const ecy = g.evidencia(c, y);
    const e = g.evidencia(y, x);
    const fuerza = g.factorEntidad(y) * transmision(ecy, e) * e.fuerza * g.factorEntidad(x) * g.factorHub(y, e.tipo);
    const certeza = ecy.certeza * e.certeza * PARAMETROS.delta;
    return { fuerza: fuerza, certeza: certeza };
}

export function calcular(g, c) {
    const directos = nodosDirectos(g, c);
    const esDirecto = new Set(directos);
    // Se acumula 1 − aportación (el producto del noisy-OR) para cada nodo que recibe algo.
    const restoR = new Map();
    const restoC = new Map();
    const padres = new Map();
    function acumular(x, aR, aC, y) {
        if (!restoR.has(x)) { restoR.set(x, 1); restoC.set(x, 1); padres.set(x, []); }
        restoR.set(x, restoR.get(x) * (1 - aR));
        restoC.set(x, restoC.get(x) * (1 - aC));
        if (y !== null) { padres.get(x).push(y); }
    }
    for (const x of g.vecinoDe(c)) {
        const e0 = g.evidencia(c, x);
        acumular(x, e0.fuerza * g.factorEntidad(x), e0.certeza, null);
    }
    for (let j = 0; j < directos.length; j++) {
        const y = directos[j];
        for (const x of g.vecinoDe(y)) {
            if (x === c) { continue; }
            const a = aportacion(g, c, y, x);
            acumular(x, a.fuerza, a.certeza, y);
        }
    }
    return empaquetar(g, c, esDirecto, restoR, restoC, padres);
}

// La misma fórmula escrita tal cual (cada candidato contra todos los directos). Solo para comprobar.
export function calcularReferencia(g, c) {
    const directos = nodosDirectos(g, c);
    const esDirecto = new Set(directos);
    const candidatos = new Set();
    for (const n of g.vecinoDe(c)) { candidatos.add(n); }
    for (let i = 0; i < directos.length; i++) {
        for (const n of g.vecinoDe(directos[i])) { if (n !== c) { candidatos.add(n); } }
    }
    const restoR = new Map();
    const restoC = new Map();
    const padres = new Map();
    for (const x of candidatos) {
        const valoresR = [];
        const valoresC = [];
        const lista = [];
        const e0 = g.evidencia(c, x);
        if (e0 !== null) {
            valoresR.push(e0.fuerza * g.factorEntidad(x));
            valoresC.push(e0.certeza);
        }
        for (let j = 0; j < directos.length; j++) {
            const y = directos[j];
            if (y === x || g.evidencia(y, x) === null) { continue; }
            const a = aportacion(g, c, y, x);
            valoresR.push(a.fuerza);
            valoresC.push(a.certeza);
            lista.push(y);
        }
        restoR.set(x, 1 - noisyOr(valoresR));
        restoC.set(x, 1 - noisyOr(valoresC));
        padres.set(x, lista);
    }
    return empaquetar(g, c, esDirecto, restoR, restoC, padres);
}

function empaquetar(g, c, esDirecto, restoR, restoC, padres) {
    const resultados = new Map();
    for (const [x, rr] of restoR) {
        const r = 1 - rr;
        const cc = 1 - restoC.get(x);
        const e0 = g.evidencia(c, x);
        let propia = 0;
        if (e0 !== null) { propia = e0.fuerza * g.factorEntidad(x) * e0.certeza; }
        let origen = "deducida";
        if (esDirecto.has(x)) {
            origen = "coincidencias";
            if (e0.declarada) { origen = "declarada"; }
        }
        resultados.set(x, { S: r * cc, R: r, C: cc, origen: origen, padres: padres.get(x), propia: propia });
    }
    return resultados;
}

// ---------- Selección del subgrafo ----------
// Umbral, cuota por clase (E3) y máximo. Desempate: certeza mayor primero y, si no, identificador.

export function seleccionar(resultados, entidades, config) {
    const lista = [];
    for (const [id, r] of resultados) {
        if (r.S >= PARAMETROS.umbral - 1e-9) { lista.push({ id: id, S: r.S, C: r.C }); }
    }
    lista.sort(function (x, y) {
        if (Math.abs(y.S - x.S) > 1e-12) { return y.S - x.S; }
        if (Math.abs(y.C - x.C) > 1e-12) { return y.C - x.C; }
        if (x.id < y.id) { return -1; }
        return 1;
    });
    const elegidos = [];
    const porClase = {};
    for (let i = 0; i < lista.length && elegidos.length < PARAMETROS.maxNodos; i++) {
        const clase = entidades[lista[i].id];
        const cuota = config.cuotas[clase];
        if (porClase[clase] === undefined) { porClase[clase] = 0; }
        if (cuota !== undefined && porClase[clase] >= cuota) { continue; }
        porClase[clase] = porClase[clase] + 1;
        elegidos.push(lista[i].id);
    }
    return elegidos;
}

// ---------- Escenarios ----------

function rel(tipo, roles, periodo) {
    const prueba = { tipo: tipo, participantes: 2, factorTiempo: 1, declarada: true };
    if (roles !== undefined && roles !== null) { prueba.roles = roles; }
    if (periodo !== undefined && periodo !== null) { prueba.periodo = periodo; }
    return prueba;
}

function evento(tipo, participantes) {
    return { tipo: tipo, participantes: participantes, factorTiempo: 1, declarada: false };
}

function repetir(prueba, veces) {
    const lista = [];
    for (let i = 0; i < veces; i++) { lista.push(prueba); }
    return lista;
}

function grafoDe(escenario, config) {
    return new Grafo(escenario.entidades, escenario.parejas, config);
}

function calcularEscenario(escenario, config) {
    return calcular(grafoDe(escenario, config), escenario.central);
}

// Ejemplo de Ana Ferrer, con roles y periodos.
export function escenarioAna() {
    const e = {
        central: "Ana",
        entidades: { Ana: "Creator", Luis: "Creator", Marta: "Creator", Pedro: "Person", Juan: "Creator",
                     "Joaquín": "Creator", Taller: "Organization", Museo: "Organization",
                     Retrato: "HeritageItem", Paseo: "HeritageItem", Huerta: "HeritageItem" },
        parejas: []
    };
    const luis = [rel("Friendship")];
    const expos = repetir(evento("Exposition", 4), 5);
    for (let i = 0; i < expos.length; i++) { luis.push(expos[i]); }
    e.parejas.push({ a: "Ana", b: "Luis", pruebas: luis });
    e.parejas.push({ a: "Ana", b: "Marta", pruebas: [evento("Exposition", 3), evento("Exposition", 6), evento("Exposition", 40)] });
    e.parejas.push({ a: "Ana", b: "Taller", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "Ana", b: "Pedro", pruebas: [evento("Exposition", 12)] });
    e.parejas.push({ a: "Ana", b: "Joaquín", pruebas: [rel("Mentorship", { "Ana": "aprendiz", "Joaquín": "maestro" }, { desde: 1900, hasta: 1910 })] });
    e.parejas.push({ a: "Ana", b: "Huerta", pruebas: [rel("Creation")] });
    e.parejas.push({ a: "Luis", b: "Marta", pruebas: [rel("Friendship")] });
    e.parejas.push({ a: "Luis", b: "Pedro", pruebas: [rel("Marriage")] });
    e.parejas.push({ a: "Luis", b: "Retrato", pruebas: [rel("Creation")] });
    e.parejas.push({ a: "Taller", b: "Juan", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "Joaquín", b: "Paseo", pruebas: [rel("Creation", null, { desde: 1905, hasta: 1905 })] });
    e.parejas.push({ a: "Huerta", b: "Museo", pruebas: [rel("Exposition")] });
    return e;
}

function copiaSinPareja(escenario, a, b) {
    const copia = { central: escenario.central, entidades: escenario.entidades, parejas: [] };
    for (let i = 0; i < escenario.parejas.length; i++) {
        const par = escenario.parejas[i];
        const esLaQuitada = (par.a === a && par.b === b) || (par.a === b && par.b === a);
        if (!esLaQuitada) { copia.parejas.push(par); }
    }
    return copia;
}

function escenarioDiversidad() {
    const e = { central: "Ana", entidades: { Ana: "Creator", X: "Creator", Y: "Creator" }, parejas: [] };
    const x = [rel("Friendship")];
    const expos = repetir(evento("Exposition", 4), 10);
    for (let i = 0; i < expos.length; i++) { x.push(expos[i]); }
    e.parejas.push({ a: "Ana", b: "X", pruebas: x });
    e.parejas.push({ a: "Ana", b: "Y", pruebas: [rel("Friendship"), evento("Exposition", 4), rel("coworking"), evento("Work", 2)] });
    return e;
}

function escenarioHub() {
    const e = { central: "Ana", entidades: { Ana: "Creator", TallerPequeno: "Organization", Academia: "Organization",
                                             CompaneroTaller: "Creator", CompaneroAcademia: "Creator" }, parejas: [] };
    e.parejas.push({ a: "Ana", b: "TallerPequeno", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "Ana", b: "Academia", pruebas: [rel("Employement")] });
    e.parejas.push({ a: "TallerPequeno", b: "CompaneroTaller", pruebas: [rel("Employement")] });
    for (let i = 0; i < 4; i++) {
        e.entidades["T" + i] = "Creator";
        e.parejas.push({ a: "TallerPequeno", b: "T" + i, pruebas: [rel("Employement")] });
    }
    e.parejas.push({ a: "Academia", b: "CompaneroAcademia", pruebas: [rel("Employement")] });
    for (let i = 0; i < 300; i++) {
        e.entidades["A" + i] = "Creator";
        e.parejas.push({ a: "Academia", b: "A" + i, pruebas: [rel("Employement")] });
    }
    return e;
}

function escenarioMaestro() {
    const e = escenarioAna();
    const copia = { central: "Joaquín", entidades: e.entidades, parejas: e.parejas.slice() };
    for (let i = 0; i < 39; i++) {
        copia.entidades["Alumno" + i] = "Creator";
        const roles = { "Joaquín": "maestro" };
        roles["Alumno" + i] = "aprendiz";
        copia.parejas.push({ a: "Joaquín", b: "Alumno" + i, pruebas: [rel("Mentorship", roles)] });
    }
    return copia;
}

function escenarioTiempo() {
    const e = escenarioAna();
    e.entidades["Tardía"] = "HeritageItem";
    e.parejas.push({ a: "Joaquín", b: "Tardía", pruebas: [rel("Creation", null, { desde: 1945, hasta: 1945 })] });
    return e;
}

function escenarioCirculo() {
    const e = { central: "Ana", entidades: { Ana: "Creator", "Joaquín": "Creator" }, parejas: [] };
    e.parejas.push({ a: "Ana", b: "Joaquín", pruebas: [rel("Mentorship", { "Ana": "aprendiz", "Joaquín": "maestro" })] });
    for (let i = 0; i < 25; i++) {
        e.entidades["C" + i] = "Creator";
        e.parejas.push({ a: "Ana", b: "C" + i, pruebas: [evento("Exposition", 6), evento("Exposition", 8)] });
        for (let j = 0; j < i; j++) { e.parejas.push({ a: "C" + j, b: "C" + i, pruebas: [rel("Friendship")] }); }
    }
    return e;
}

// P11: Joaquín es un maestro prolífico: 60 obras y, si se pide, 400 personas con las que coincidió en exposiciones.
function escenarioMaestroProlifico(conCoexpositores) {
    const e = escenarioAna();
    for (let i = 0; i < 59; i++) {
        e.entidades["Obra" + i] = "HeritageItem";
        e.parejas.push({ a: "Joaquín", b: "Obra" + i, pruebas: [rel("Creation", null, { desde: 1930, hasta: 1930 })] });
    }
    if (conCoexpositores === false) { return e; }
    for (let i = 0; i < 400; i++) {
        e.entidades["Expositor" + i] = "Creator";
        e.parejas.push({ a: "Joaquín", b: "Expositor" + i, pruebas: [evento("Exposition", 20)] });
    }
    return e;
}

// P12: Ana es muy prolífica (200 obras) y tiene 12 alumnos.
function escenarioArtistaProlifica() {
    const e = escenarioAna();
    for (let i = 0; i < 199; i++) {
        e.entidades["Propia" + i] = "HeritageItem";
        e.parejas.push({ a: "Ana", b: "Propia" + i, pruebas: [rel("Creation")] });
    }
    for (let i = 0; i < 12; i++) {
        e.entidades["Alumna" + i] = "Creator";
        const roles = { "Ana": "maestro" };
        roles["Alumna" + i] = "aprendiz";
        e.parejas.push({ a: "Ana", b: "Alumna" + i, pruebas: [rel("Mentorship", roles)] });
    }
    return e;
}

// P13 y P14: una exposición en una galería con dos artistas, sus obras y el lugar, como en Neo4j.
const ENTIDADES_EXPO = { Ana: "Creator", Bea: "Creator", Huerta: "HeritageItem", Marina: "HeritageItem",
                         Faro: "HeritageItem", Galeria: "Organization", Taller: "Organization", "Joaquín": "Creator" };
function intermediariosExpo(conObrasYLugar) {
    const part = [{ id: "Ana", rol: "expositor" }, { id: "Bea", rol: "expositor" }];
    if (conObrasYLugar) {
        part.push({ id: "Huerta", rol: "obra" });
        part.push({ id: "Marina", rol: "obra" });
        part.push({ id: "Faro", rol: "obra" });
        part.push({ id: "Galeria", rol: ROL_LUGAR });
    }
    return [
        { id: "I1", tipo: "Creation", participantes: [{ id: "Ana", rol: "autor" }, { id: "Huerta", rol: "obra" }], periodo: null },
        { id: "I2", tipo: "Creation", participantes: [{ id: "Bea", rol: "autor" }, { id: "Marina", rol: "obra" }], periodo: null },
        { id: "I3", tipo: "Creation", participantes: [{ id: "Bea", rol: "autor" }, { id: "Faro", rol: "obra" }], periodo: null },
        { id: "I4", tipo: "Exposition", participantes: part, periodo: { desde: 1920, hasta: 1920 } }
    ];
}
function intermediariosMentoria(conLugar) {
    const part = [{ id: "Joaquín", rol: "maestro" }, { id: "Ana", rol: "aprendiz" }];
    if (conLugar) { part.push({ id: "Taller", rol: ROL_LUGAR }); }
    return [{ id: "M1", tipo: "Mentorship", participantes: part, periodo: { desde: 1900, hasta: 1905 } }];
}

// P15: la misma exposición registrada desde dos fuentes (mismo tipo, lugar y día), una con Carla y otra sin ella.
// La otra fecha es del mismo año pero de otro día: es otra exposición y no se junta.
function intermediariosDuplicados(duplicado, otraFecha) {
    const lista = [{ id: "E1", tipo: "Exposition", periodo: { desde: 1920, hasta: 1920, fecha: "1920-05-14" },
                     participantes: [{ id: "Ana", rol: "expositor" }, { id: "Bea", rol: "expositor" }, { id: "Carla", rol: "expositor" },
                                     { id: "Galeria", rol: ROL_LUGAR }] }];
    if (duplicado) {
        let fecha = "1920-05-14";
        if (otraFecha) { fecha = "1920-06-02"; }
        lista.push({ id: "E2", tipo: "Exposition", periodo: { desde: 1920, hasta: 1920, fecha: fecha },
                     participantes: [{ id: "Ana", rol: "expositor" }, { id: "Bea", rol: "expositor" }, { id: "Galeria", rol: ROL_LUGAR }] });
    }
    return lista;
}

// P16: Ana y Bea en una exposición con solo ellas dos registradas, y en otra con 100 personas registradas.
function intermediariosTamano(registrados) {
    const part = [{ id: "Ana", rol: "expositor" }, { id: "Bea", rol: "expositor" }, { id: "Galeria", rol: ROL_LUGAR }];
    for (let i = 0; i < registrados - 2; i++) { part.push({ id: "Visitante" + i, rol: "expositor" }); }
    return [{ id: "E9", tipo: "Exposition", periodo: { desde: 1930, hasta: 1930 }, participantes: part }];
}
function entidadesTamano() {
    const e = { Ana: "Creator", Bea: "Creator", Galeria: "Organization", Carla: "Creator" };
    for (let i = 0; i < 98; i++) { e["Visitante" + i] = "Creator"; }
    return e;
}

// ---------- Propiedades ----------

const EPS = 0.000001;

function propiedades(config) {
    const salida = [];
    const base = calcularEscenario(escenarioAna(), config);

    // P0. El cálculo rápido coincide con la fórmula escrita tal cual.
    let maxDif = 0;
    const escenarios = [escenarioAna(), escenarioHub(), escenarioCirculo(), escenarioMaestroProlifico(true)];
    for (let i = 0; i < escenarios.length; i++) {
        const g = grafoDe(escenarios[i], config);
        const rapido = calcular(g, escenarios[i].central);
        const literal = calcularReferencia(g, escenarios[i].central);
        for (const [nodo, r] of literal) {
            const dif = Math.abs(r.S - rapido.get(nodo).S);
            if (dif > maxDif) { maxDif = dif; }
        }
    }
    salida.push({ p: "P0 El cálculo rápido da lo mismo que la fórmula", ok: maxDif < 1e-12, detalle: "diferencia máxima " + maxDif.toExponential(1) });

    const sinVinculo = calcularEscenario(copiaSinPareja(escenarioAna(), "Luis", "Marta"), config);
    let monotona = true;
    let detalle = "";
    for (const [nodo, r] of sinVinculo) {
        if (base.has(nodo) && base.get(nodo).S < r.S - EPS) {
            monotona = false;
            detalle = nodo + " baja de " + r.S.toFixed(2) + " a " + base.get(nodo).S.toFixed(2);
        }
    }
    salida.push({ p: "P1 Añadir una relación no baja a nadie", ok: monotona, detalle: detalle });

    let suelo = true;
    detalle = "";
    for (const [nodo, r] of base) {
        if (r.origen !== "deducida" && r.S < r.propia - EPS) { suelo = false; detalle = nodo; }
    }
    salida.push({ p: "P2 Nadie baja de su propia evidencia", ok: suelo, detalle: detalle });

    let techo = true;
    detalle = "";
    for (const [nodo, r] of base) {
        if (r.origen === "deducida" && r.propia < EPS) {
            let mejorPadre = 0;
            for (let i = 0; i < r.padres.length; i++) {
                if (base.get(r.padres[i]).S > mejorPadre) { mejorPadre = base.get(r.padres[i]).S; }
            }
            if (r.S > mejorPadre + EPS) { techo = false; detalle = nodo; }
        }
    }
    salida.push({ p: "P3 Lo deducido no supera a su padre", ok: techo, detalle: detalle });

    const div = calcularEscenario(escenarioDiversidad(), config);
    salida.push({ p: "P4 Variedad > repetición", ok: div.get("Y").S > div.get("X").S,
                  detalle: "10 expos " + div.get("X").S.toFixed(2) + " · 4 tipos " + div.get("Y").S.toFixed(2) });

    const hub = calcularEscenario(escenarioHub(), config);
    salida.push({ p: "P5 Penaliza intermediarios enormes", ok: hub.get("CompaneroTaller").S > hub.get("CompaneroAcademia").S + EPS,
                  detalle: "taller " + hub.get("CompaneroTaller").S.toFixed(3) + " · academia " + hub.get("CompaneroAcademia").S.toFixed(3) });

    const maestro = calcularEscenario(escenarioMaestro(), config);
    salida.push({ p: "P6 Maestro para alumna > alumna para maestro", ok: base.get("Joaquín").S > maestro.get("Ana").S + EPS,
                  detalle: "Joaquín desde Ana " + base.get("Joaquín").S.toFixed(2) + " · Ana desde Joaquín " + maestro.get("Ana").S.toFixed(2) });

    const tiempo = calcularEscenario(escenarioTiempo(), config);
    salida.push({ p: "P7 Respeta el orden en el tiempo", ok: tiempo.get("Paseo").S > tiempo.get("Tardía").S + EPS,
                  detalle: "Paseo " + tiempo.get("Paseo").S.toFixed(2) + " · Tardía " + tiempo.get("Tardía").S.toFixed(2) });

    const u = PARAMETROS.umbral;
    salida.push({ p: "P8 Entra «Paseo» y no Pedro", ok: base.get("Paseo").S > u && base.get("Pedro").S <= u,
                  detalle: "Paseo " + base.get("Paseo").S.toFixed(2) + " · Pedro " + base.get("Pedro").S.toFixed(2) });

    const circulo = calcularEscenario(escenarioCirculo(), config);
    let minimo = 2;
    let maximo = -1;
    for (let i = 0; i < 25; i++) {
        const valor = circulo.get("C" + i).S;
        if (valor < minimo) { minimo = valor; }
        if (valor > maximo) { maximo = valor; }
    }
    salida.push({ p: "P9 Iguales reciben lo mismo", ok: maximo - minimo < 0.001,
                  detalle: "círculo de 25: de " + minimo.toFixed(2) + " a " + maximo.toFixed(2) });

    const pasos = [[], [12], [8], [4], [3], [3, 4]];
    let anterior = -1;
    let crece = true;
    const valoresP = [];
    for (let i = 0; i < pasos.length; i++) {
        const esc = escenarioAna();
        for (let k = 0; k < esc.parejas.length; k++) {
            const par = esc.parejas[k];
            if (par.a === "Ana" && par.b === "Pedro") {
                const nuevas = [evento("Exposition", 12)];
                for (let n = 0; n < pasos[i].length; n++) { nuevas.push(evento("Exposition", pasos[i][n])); }
                par.pruebas = nuevas;
            }
        }
        const valor = calcularEscenario(esc, config).get("Pedro").S;
        valoresP.push(valor.toFixed(3));
        if (valor < anterior - EPS) { crece = false; }
        anterior = valor;
    }
    salida.push({ p: "P10 Más evidencia nunca baja", ok: crece, detalle: "Pedro: " + valoresP.join(" → ") });

    // P11 (nueva). Con quién expuso el maestro no rebaja sus obras: solo cuenta cuántas obras tiene.
    const conExpo = calcularEscenario(escenarioMaestroProlifico(true), config).get("Paseo").S;
    const sinExpo = calcularEscenario(escenarioMaestroProlifico(false), config).get("Paseo").S;
    salida.push({ p: "P11 Los coexpositores del maestro no rebajan su obra", ok: Math.abs(conExpo - sinExpo) < EPS,
                  detalle: "Paseo con 400 coexpositores " + conExpo.toFixed(2) + " · sin ellos " + sinExpo.toFixed(2) });

    // P12 (nueva). Las obras propias no desplazan al maestro ni a los alumnos.
    const escP = escenarioArtistaProlifica();
    const resP = calcularEscenario(escP, config);
    const elegidos = seleccionar(resP, escP.entidades, config);
    let alumnasDentro = 0;
    for (let i = 0; i < 12; i++) { if (elegidos.indexOf("Alumna" + i) >= 0) { alumnasDentro = alumnasDentro + 1; } }
    const maestroDentro = elegidos.indexOf("Joaquín") >= 0;
    salida.push({ p: "P12 Las obras propias no tapan a las personas", ok: maestroDentro && alumnasDentro === 12,
                  detalle: "200 obras propias: maestro " + maestroDentro + ", alumnas " + alumnasDentro + "/12" });

    // P13 (nueva). Exponer en la misma sala no es una relación declarada entre las obras.
    const gExpo = new Grafo(ENTIDADES_EXPO, derivarParejas(ENTIDADES_EXPO, intermediariosExpo(true), config), config);
    const cObras = gExpo.evidencia("Huerta", "Marina").certeza;
    const cLugar = gExpo.evidencia("Huerta", "Galeria").certeza;
    salida.push({ p: "P13 Coexponer no es relación declarada", ok: cObras < 1 && cLugar === 1,
                  detalle: "certeza Huerta–Marina " + cObras.toFixed(2) + " · Huerta–Galería " + cLugar.toFixed(2) });

    // P14 (nueva). Lo que une a dos personas no depende de cuántas obras o lugares tenga el intermediario.
    const gSolo = new Grafo(ENTIDADES_EXPO, derivarParejas(ENTIDADES_EXPO, intermediariosExpo(false), config), config);
    const fCon = gExpo.evidencia("Ana", "Bea").fuerza;
    const fSin = gSolo.evidencia("Ana", "Bea").fuerza;
    const gM1 = new Grafo(ENTIDADES_EXPO, derivarParejas(ENTIDADES_EXPO, intermediariosMentoria(true), config), config);
    const gM0 = new Grafo(ENTIDADES_EXPO, derivarParejas(ENTIDADES_EXPO, intermediariosMentoria(false), config), config);
    const mCon = gM1.evidencia("Ana", "Joaquín").fuerza;
    const mSin = gM0.evidencia("Ana", "Joaquín").fuerza;
    salida.push({ p: "P14 Obras y lugar no diluyen a las personas", ok: Math.abs(fCon - fSin) < EPS && Math.abs(mCon - mSin) < EPS,
                  detalle: "exponer juntas " + fCon.toFixed(2) + " vs " + fSin.toFixed(2) + " · mentoría " + mCon.toFixed(2) + " vs " + mSin.toFixed(2) });

    // P15 (nueva). Un evento registrado dos veces cuenta una vez; dos eventos de fechas distintas, dos.
    const ent = entidadesTamano();
    const fUna = new Grafo(ent, derivarParejas(ent, intermediariosDuplicados(false, false), config), config).evidencia("Ana", "Bea").fuerza;
    const fDup = new Grafo(ent, derivarParejas(ent, intermediariosDuplicados(true, false), config), config).evidencia("Ana", "Bea").fuerza;
    const fDos = new Grafo(ent, derivarParejas(ent, intermediariosDuplicados(true, true), config), config).evidencia("Ana", "Bea").fuerza;
    salida.push({ p: "P15 El mismo evento registrado dos veces cuenta una", ok: Math.abs(fUna - fDup) < EPS && fDos > fUna + EPS,
                  detalle: "una vez " + fUna.toFixed(3) + " · duplicado " + fDup.toFixed(3) + " · otro día " + fDos.toFixed(3) });

    // P16 (nueva). Pocos registrados no hacen íntimo un evento; muchos registrados sí lo hacen grande.
    const ePoco = new Grafo(ent, derivarParejas(ent, intermediariosTamano(2), config), config).evidencia("Ana", "Bea");
    const eMucho = new Grafo(ent, derivarParejas(ent, intermediariosTamano(100), config), config).evidencia("Ana", "Bea");
    const techoFuerza = PESOS.Exposition * PARAMETROS.topeCoincidencia;
    salida.push({ p: "P16 Pocos registrados no hacen íntimo un evento", ok: ePoco.fuerza <= techoFuerza + EPS && eMucho.fuerza < ePoco.fuerza - EPS,
                  detalle: "2 registrados: fuerza " + ePoco.fuerza.toFixed(3) + ", certeza " + ePoco.certeza.toFixed(3)
                           + " · 100 registrados: fuerza " + eMucho.fuerza.toFixed(3) });
    return salida;
}

// ---------- Informe ----------

function contar(lista) {
    let n = 0;
    for (let i = 0; i < lista.length; i++) { if (lista[i].ok) { n = n + 1; } }
    return n;
}

function informe() {
    console.log("=== Propiedades ===");
    const claves = ["v3", "v4"];
    for (let i = 0; i < claves.length; i++) {
        const lista = propiedades(CONFIG[claves[i]]);
        console.log("\n" + CONFIG[claves[i]].nombre + ": " + contar(lista) + "/" + lista.length);
        for (let j = 0; j < lista.length; j++) {
            let marca = "✘";
            if (lista[j].ok) { marca = "✔"; }
            console.log("  " + marca + " " + lista[j].p.padEnd(54) + lista[j].detalle);
        }
    }
    console.log("\n=== Ejemplo de Ana con v4 (S = relevancia; R = fuerza; C = certeza) ===");
    const orden = ["Huerta", "Joaquín", "Luis", "Taller", "Marta", "Paseo", "Museo", "Juan", "Retrato", "Pedro"];
    const res = calcularEscenario(escenarioAna(), CONFIG.v4);
    for (let i = 0; i < orden.length; i++) {
        const r = res.get(orden[i]);
        let marca = " ";
        if (r.S >= PARAMETROS.umbral) { marca = "*"; }
        console.log("  " + orden[i].padEnd(9) + r.S.toFixed(2) + marca + "  (" + r.R.toFixed(2) + " / " + r.C.toFixed(2) + ")");
    }
    console.log("(* = supera el umbral " + PARAMETROS.umbral + ")");
}

function robustez() {
    console.log("\n=== Robustez de v4 al mover λ y δ ===");
    const original = { lambda: PARAMETROS.lambda, delta: PARAMETROS.delta };
    const lambdas = [0.3, 0.5, 0.7];
    const deltas = [0.4, 0.5, 0.7, 0.9];
    const fallos = [];
    for (let i = 0; i < lambdas.length; i++) {
        for (let j = 0; j < deltas.length; j++) {
            PARAMETROS.lambda = lambdas[i];
            PARAMETROS.delta = deltas[j];
            const lista = propiedades(CONFIG.v4);
            for (let n = 0; n < lista.length; n++) {
                if (!lista[n].ok) { fallos.push(lista[n].p + " con λ=" + lambdas[i] + " δ=" + deltas[j]); }
            }
        }
    }
    PARAMETROS.lambda = original.lambda;
    PARAMETROS.delta = original.delta;
    console.log("Combinaciones probadas: " + lambdas.length * deltas.length);
    if (fallos.length === 0) { console.log("Todas cumplen las 17 propiedades."); }
    for (let i = 0; i < fallos.length; i++) { console.log("  " + fallos[i]); }
}

informe();
robustez();
