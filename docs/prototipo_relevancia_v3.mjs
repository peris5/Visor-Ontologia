// Prototipo v3 de la relevancia artística (no es código de la aplicación).
// Compara cuatro variantes sobre escenarios que ponen a prueba diez propiedades deseables:
//   V0  la del primer prompt: circuito, certeza mezclada con la fuerza, sin mejoras
//   V1  todas las mejoras, con el circuito en la capa 2
//   V2  todas las mejoras, con refuerzo simétrico entre directos y deducción aparte (incumple P10)
//   V3  todas las mejoras, con UNA sola fórmula para todos los nodos (PROPUESTA)
// Mejoras: rol (asimetría), multiplexidad, penalización de intermediarios muy conectados,
// caminos que respetan el tiempo y certeza separada de la fuerza (lógica subjetiva simplificada).
// Ejecutar: node prototipo_relevancia_v3.mjs  →  debe decir «V3 fórmula única: 10/10».
// Estilo: sin flechas, ternarios, ?., ??, map ni filter.

// ---------- Perfil artístico ----------

const PESOS = {
    Creation: 1.00, Mentorship: 0.95, coworking: 0.85, Fund: 0.85, Exposition: 0.70,
    Employement: 0.65, Professional: 0.60, Work: 0.60, Friendship: 0.50, Marriage: 0.50,
    Related: 0.45, Filiation: 0.45, Wedding: 0.20, Event: 0.30
};
const PESO_POR_DEFECTO = 0.40;

// Peso según el rol que tiene el OTRO extremo, visto desde la entidad que mira.
// "Mentorship.maestro": el otro es mi maestro. "Mentorship.aprendiz": el otro es mi alumno.
const PESOS_ROL = {
    "Mentorship.maestro": 0.95,
    "Mentorship.aprendiz": 0.60
};

// Clave "tipo1[:rol1]>tipo2": tipo1 y rol1 = relación central–padre (rol del padre); tipo2 = padre–hijo.
const TABLA_T = {
    "Mentorship:maestro>Creation": 0.8, "Mentorship:aprendiz>Creation": 0.5,
    "Mentorship:maestro>Mentorship": 0.6, "Mentorship:aprendiz>Mentorship": 0.3,
    "Mentorship>Creation": 0.8, "Mentorship>Mentorship": 0.6,
    "Creation>Exposition": 0.8, "coworking>Creation": 0.6, "Marriage>Creation": 0.5,
    "Employement>Employement": 0.5, "Exposition>Creation": 0.4, "Friendship>Friendship": 0.4,
    "Exposition>Exposition": 0.3, "Friendship>Marriage": 0.3, "Friendship>Creation": 0.2
};
const T_POR_DEFECTO = 0.3;

// Pares de tipos en los que importa el orden en el tiempo, y cómo.
//   antesODurante: el segundo tramo empieza antes de que acabe el primero (más un margen)
//   solapa: los dos tramos coinciden en el tiempo (con margen)
const PARES_TEMPORALES = {
    "Mentorship>Creation": "antesODurante",
    "Mentorship>Mentorship": "solapa",
    "Employement>Employement": "solapa",
    "Friendship>Marriage": "solapa"
};

const FACTOR_ENTIDAD = { Creator: 1.0, HeritageItem: 1.0, Organization: 0.8, Person: 0.6 };

const PARAMETROS = {
    beta: 1,
    probabilidadCoincidencia: 0.4,
    umbralDirecto: 0.05,
    umbral: 0.3,
    rho: 0.5,               // rendimiento decreciente de las pruebas repetidas del mismo tipo
    delta: 0.7,             // descuento por deducir (transitividad)
    cierreTriadico: 0.3,    // certeza que aporta «es amigo de alguien que conoces»
    gradoReferencia: 10,    // a partir de este grado se penaliza un intermediario
    margenAnios: 5,
    factorFueraDeTiempo: 0.3,
    factorTiempoSinFecha: 1,
    gamma: 0.3,
    toleranciaCircuito: 0.000001,
    maxVueltasCircuito: 2000
};

export const VARIANTES = {
    V0: { nombre: "V0 actual", usarRol: false, usarMultiplex: false, usarHub: false, usarTiempo: false,
          certezaSeparada: false, capa2: "circuito" },
    V1: { nombre: "V1 mejoras + circuito", usarRol: true, usarMultiplex: true, usarHub: true, usarTiempo: true,
          certezaSeparada: true, capa2: "circuito" },
    V2: { nombre: "V2 mejoras + refuerzo", usarRol: true, usarMultiplex: true, usarHub: true, usarTiempo: true,
          certezaSeparada: true, capa2: "refuerzo" },
    V3: { nombre: "V3 fórmula única", usarRol: true, usarMultiplex: true, usarHub: true, usarTiempo: true,
          certezaSeparada: true, capa2: "unificado" }
};

// ---------- Utilidades ----------

function noisyOr(valores) {
    let producto = 1;
    for (let i = 0; i < valores.length; i++) {
        producto = producto * (1 - valores[i]);
    }
    return 1 - producto;
}

function menor(x, y) {
    if (x < y) { return x; }
    return y;
}

function pesoPrueba(prueba, idOtro, v) {
    if (v.usarRol && prueba.roles !== undefined && prueba.roles[idOtro] !== undefined) {
        const clave = prueba.tipo + "." + prueba.roles[idOtro];
        if (PESOS_ROL[clave] !== undefined) {
            return PESOS_ROL[clave];
        }
    }
    if (PESOS[prueba.tipo] !== undefined) {
        return PESOS[prueba.tipo];
    }
    return PESO_POR_DEFECTO;
}

function factorT(tipo1, rol1, tipo2, v) {
    if (v.usarRol && rol1 !== null) {
        const conRol = tipo1 + ":" + rol1 + ">" + tipo2;
        if (TABLA_T[conRol] !== undefined) {
            return TABLA_T[conRol];
        }
    }
    const sinRol = tipo1 + ">" + tipo2;
    if (TABLA_T[sinRol] !== undefined) {
        return TABLA_T[sinRol];
    }
    return T_POR_DEFECTO;
}

// T de un camino cuyo primer tramo (central–padre) puede tener varios tipos de relación:
// con las mejoras, media de T ponderada por la fuerza de cada tipo; sin ellas, el tipo principal.
function tEfectiva(primerTramo, tipo2, v) {
    if (!v.usarMultiplex) {
        return factorT(primerTramo.tipo, primerTramo.rol, tipo2, v);
    }
    let suma = 0;
    let pesos = 0;
    for (let i = 0; i < primerTramo.tipos.length; i++) {
        const t = primerTramo.tipos[i];
        suma = suma + t.fuerza * factorT(t.tipo, t.rol, tipo2, v);
        pesos = pesos + t.fuerza;
    }
    if (pesos === 0) {
        return T_POR_DEFECTO;
    }
    return suma / pesos;
}

// V3: lo que transmite el primer tramo (central–padre) hacia un segundo tramo de tipo tipo2.
// Cada tipo del primer tramo transmite su parte y se combinan con noisy-OR, así que añadir
// un tipo o una prueba nunca baja la transmisión (con la media ponderada sí podía bajar).
// El tiempo se mira para cada tipo con su propio periodo.
function transmision(primerTramo, segundoTramo, v) {
    const valores = [];
    for (let i = 0; i < primerTramo.tipos.length; i++) {
        const t = primerTramo.tipos[i];
        const tau = factorTiempoTipo(t, segundoTramo, v);
        valores.push(t.fuerza * factorT(t.tipo, t.rol, segundoTramo.tipo, v) * tau);
    }
    return noisyOr(valores);
}

function factorTiempoTipo(tipoPrimero, segundoTramo, v) {
    if (!v.usarTiempo) {
        return 1;
    }
    const modo = PARES_TEMPORALES[tipoPrimero.tipo + ">" + segundoTramo.tipo];
    if (modo === undefined) {
        return 1;
    }
    // El mejor factor entre todas las pruebas de este tipo: así añadir una prueba nunca lo baja.
    let mejor = 0;
    for (let k = 0; k < tipoPrimero.periodos.length; k++) {
        const valor = compatibilidad(modo, tipoPrimero.periodos[k], segundoTramo.periodo);
        if (valor > mejor) { mejor = valor; }
    }
    return mejor;
}

function compatibilidad(modo, p1, p2) {
    if (p1 === null || p2 === null) {
        return PARAMETROS.factorTiempoSinFecha;
    }
    const m = PARAMETROS.margenAnios;
    let compatible = false;
    if (modo === "antesODurante") {
        compatible = p2.desde <= p1.hasta + m;
    } else {
        compatible = p2.desde <= p1.hasta + m && p2.hasta >= p1.desde - m;
    }
    if (compatible) {
        return 1;
    }
    return PARAMETROS.factorFueraDeTiempo;
}

// ---------- Grafo y capa 0 (evidencia dirigida: B visto desde A) ----------

class Grafo {
    constructor(escenario, variante) {
        this.escenario = escenario;
        this.v = variante;
        this.pruebas = new Map();      // "a|b" -> pruebas
        this.vecinos = new Map();
        this.cacheEvidencia = new Map();
        for (let i = 0; i < escenario.parejas.length; i++) {
            const pareja = escenario.parejas[i];
            this.anadir(pareja.a, pareja.b, pareja.pruebas);
        }
    }

    anadir(a, b, pruebas) {
        let lista = this.pruebas.get(this.clave(a, b));
        if (lista === undefined) {
            lista = [];
            this.pruebas.set(this.clave(a, b), lista);
        }
        for (let i = 0; i < pruebas.length; i++) {
            lista.push(pruebas[i]);
        }
        this.vecinoDe(a).add(b);
        this.vecinoDe(b).add(a);
    }

    clave(a, b) {
        if (a < b) { return a + "|" + b; }
        return b + "|" + a;
    }

    vecinoDe(nodo) {
        if (!this.vecinos.has(nodo)) {
            this.vecinos.set(nodo, new Set());
        }
        return this.vecinos.get(nodo);
    }

    grado(nodo) {
        return this.vecinoDe(nodo).size;
    }

    factorEntidad(nodo) {
        const clase = this.escenario.entidades[nodo];
        if (FACTOR_ENTIDAD[clase] !== undefined) {
            return FACTOR_ENTIDAD[clase];
        }
        return 1;
    }

    // Penalización de intermediarios muy conectados (idea de Adamic-Adar).
    factorHub(nodo) {
        if (!this.v.usarHub) {
            return 1;
        }
        const k0 = PARAMETROS.gradoReferencia;
        const factor = Math.log(2 + k0) / Math.log(2 + this.grado(nodo));
        return menor(1, factor);
    }

    evidencia(a, b) {
        const claveCache = a + ">" + b;
        if (this.cacheEvidencia.has(claveCache)) {
            return this.cacheEvidencia.get(claveCache);
        }
        const pruebas = this.pruebas.get(this.clave(a, b));
        if (pruebas === undefined) {
            return null;
        }
        const p = PARAMETROS;
        const porTipo = new Map();
        let productoCerteza = 1;
        let declarada = false;
        let numeroEventos = 0;
        for (let i = 0; i < pruebas.length; i++) {
            const prueba = pruebas[i];
            const factorParticipantes = Math.pow(2 / prueba.participantes, p.beta);
            const r = pesoPrueba(prueba, b, this.v) * factorParticipantes * prueba.factorTiempo;
            if (!porTipo.has(prueba.tipo)) {
                porTipo.set(prueba.tipo, []);
            }
            porTipo.get(prueba.tipo).push({ r: r, prueba: prueba });
            if (prueba.declarada) {
                declarada = true;
            } else {
                numeroEventos = numeroEventos + 1;
                productoCerteza = productoCerteza * (1 - p.probabilidadCoincidencia * factorParticipantes);
            }
        }
        const fuerzas = [];
        const tipos = [];
        let tipoPrincipal = null;
        let rolPrincipal = null;
        let periodoPrincipal = null;
        let mejor = -1;
        for (const [tipo, lista] of porTipo) {
            lista.sort(function (x, y) { return y.r - x.r; });
            const valores = [];
            for (let k = 0; k < lista.length; k++) {
                let atenuacion = 1;
                if (this.v.usarMultiplex) {
                    atenuacion = Math.pow(p.rho, k);
                }
                valores.push(lista[k].r * atenuacion);
            }
            const fuerzaTipo = noisyOr(valores);
            fuerzas.push(fuerzaTipo);
            let rolTipo = null;
            if (lista[0].prueba.roles !== undefined && lista[0].prueba.roles[b] !== undefined) {
                rolTipo = lista[0].prueba.roles[b];
            }
            // Periodos de TODAS las pruebas de este tipo (null = prueba sin fecha).
            const periodosTipo = [];
            for (let k = 0; k < lista.length; k++) {
                let per = null;
                if (lista[k].prueba.periodo !== undefined) { per = lista[k].prueba.periodo; }
                periodosTipo.push(per);
            }
            tipos.push({ tipo: tipo, rol: rolTipo, fuerza: fuerzaTipo, periodos: periodosTipo });
            // V0 elige el tipo principal por la prueba más fuerte (como el prompt actual).
            let criterio = lista[0].r;
            if (this.v.usarMultiplex) {
                criterio = fuerzaTipo;
            }
            if (criterio > mejor) {
                mejor = criterio;
                tipoPrincipal = tipo;
                rolPrincipal = null;
                if (lista[0].prueba.roles !== undefined && lista[0].prueba.roles[b] !== undefined) {
                    rolPrincipal = lista[0].prueba.roles[b];
                }
                periodoPrincipal = null;
                if (lista[0].prueba.periodo !== undefined) {
                    periodoPrincipal = lista[0].prueba.periodo;
                }
            }
        }
        let certeza = 1 - productoCerteza;
        if (declarada) {
            certeza = 1;
        }
        const resultado = { fuerza: noisyOr(fuerzas), certeza: certeza, tipo: tipoPrincipal, rol: rolPrincipal, tipos: tipos,
                            periodo: periodoPrincipal, declarada: declarada, numeroEventos: numeroEventos };
        this.cacheEvidencia.set(claveCache, resultado);
        return resultado;
    }

    // Compatibilidad temporal del camino central–padre–hijo.
    factorTiempo(central, padre, hijo) {
        if (!this.v.usarTiempo) {
            return 1;
        }
        const primero = this.evidencia(central, padre);
        const segundo = this.evidencia(padre, hijo);
        const modo = PARES_TEMPORALES[primero.tipo + ">" + segundo.tipo];
        if (modo === undefined) {
            return 1;
        }
        if (primero.periodo === null || segundo.periodo === null) {
            return PARAMETROS.factorTiempoSinFecha;
        }
        const m = PARAMETROS.margenAnios;
        const p1 = primero.periodo;
        const p2 = segundo.periodo;
        let compatible = false;
        if (modo === "antesODurante") {
            compatible = p2.desde <= p1.hasta + m;
        } else {
            compatible = p2.desde <= p1.hasta + m && p2.hasta >= p1.desde - m;
        }
        if (compatible) {
            return 1;
        }
        return PARAMETROS.factorFueraDeTiempo;
    }
}

// ---------- Cálculo ----------

export function calcular(escenario, varianteClave) {
    const v = VARIANTES[varianteClave];
    const g = new Grafo(escenario, v);
    const c = escenario.central;
    const p = PARAMETROS;

    // Valor de una evidencia tal y como la usa cada variante.
    function fuerzaUsada(e) {
        if (v.certezaSeparada) {
            return e.fuerza;
        }
        return e.fuerza * e.certeza;
    }

    // Nodos directos ordenados por evidencia propia (de mayor a menor).
    const directos = [];
    const propia = new Map();
    for (const nodo of g.vecinoDe(c)) {
        const e = g.evidencia(c, nodo);
        const s0 = e.fuerza * e.certeza * g.factorEntidad(nodo);
        propia.set(nodo, s0);
        if (s0 >= p.umbralDirecto) {
            directos.push(nodo);
        }
    }
    directos.sort(function (x, y) { return propia.get(y) - propia.get(x); });
    const esDirecto = new Set(directos);

    if (v.capa2 === "unificado") {
        return calcularUnificado(g, c, directos, esDirecto, propia, v);
    }

    const R = new Map();
    const C = new Map();

    // Capas 1 y 2.
    if (v.capa2 === "circuito") {
        const tension = resolverCircuito(g, c, directos, esDirecto, v, fuerzaUsada);
        for (let i = 0; i < directos.length; i++) {
            R.set(directos[i], tension.get(directos[i]));
        }
    } else {
        // Refuerzo simétrico de un paso: cada directo recibe de TODOS los demás directos con los que
        // tiene relación, usando la evidencia PROPIA del otro (no su valor ya reforzado). Así el
        // resultado no depende del orden y dos nodos en la misma situación reciben lo mismo.
        for (let i = 0; i < directos.length; i++) {
            const x = directos[i];
            const valores = [fuerzaUsada(g.evidencia(c, x)) * g.factorEntidad(x)];
            for (let j = 0; j < directos.length; j++) {
                if (j === i) { continue; }
                const y = directos[j];
                const e = g.evidencia(y, x);
                if (e === null) { continue; }
                const propiaY = fuerzaUsada(g.evidencia(c, y)) * g.factorEntidad(y);
                const t = tEfectiva(g.evidencia(c, y), e.tipo, v);
                valores.push(propiaY * fuerzaUsada(e) * t * g.factorEntidad(x) * g.factorHub(y));
            }
            R.set(x, noisyOr(valores));
        }
    }
    // Certeza de los directos: propia, reforzada por cierre triádico desde los demás directos (simétrico).
    for (let i = 0; i < directos.length; i++) {
        const x = directos[i];
        if (!v.certezaSeparada) {
            C.set(x, 1);
            continue;
        }
        const valores = [g.evidencia(c, x).certeza];
        for (let j = 0; j < directos.length; j++) {
            if (j === i) { continue; }
            const y = directos[j];
            const e = g.evidencia(y, x);
            if (e === null) { continue; }
            valores.push(g.evidencia(c, y).certeza * e.certeza * p.cierreTriadico);
        }
        C.set(x, noisyOr(valores));
    }

    // Capa 3: deducción a dos saltos.
    const deducR = new Map();
    const deducC = new Map();
    const padres = new Map();
    for (let i = 0; i < directos.length; i++) {
        const padre = directos[i];
        const ecp = g.evidencia(c, padre);
        for (const hijo of g.vecinoDe(padre)) {
            if (hijo === c || esDirecto.has(hijo)) { continue; }
            const e = g.evidencia(padre, hijo);
            const t = tEfectiva(ecp, e.tipo, v);
            let dR = R.get(padre) * fuerzaUsada(e) * t * g.factorEntidad(hijo) * g.factorHub(padre)
                     * g.factorTiempo(c, padre, hijo);
            let dC = C.get(padre) * e.certeza * p.delta;
            if (!v.certezaSeparada) {
                dR = dR * p.delta;
                dC = 1;
            }
            if (!deducR.has(hijo)) {
                deducR.set(hijo, []);
                deducC.set(hijo, []);
                padres.set(hijo, []);
            }
            deducR.get(hijo).push(dR);
            deducC.get(hijo).push(dC);
            padres.get(hijo).push(padre);
        }
    }

    const resultados = new Map();
    for (let i = 0; i < directos.length; i++) {
        const x = directos[i];
        let origen = "coincidencias";
        if (g.evidencia(c, x).declarada) { origen = "declarada"; }
        resultados.set(x, { S: R.get(x) * C.get(x), R: R.get(x), C: C.get(x), origen: origen, padres: [],
                            propia: propia.get(x) });
    }
    for (const [hijo, lista] of deducR) {
        let rPropia = 0;
        let cPropia = 0;
        const e = g.evidencia(c, hijo);
        if (e !== null) {
            rPropia = fuerzaUsada(e) * g.factorEntidad(hijo);
            cPropia = e.certeza;
        }
        const valoresR = [rPropia];
        for (let i = 0; i < lista.length; i++) { valoresR.push(lista[i]); }
        const r = noisyOr(valoresR);
        let cc = 1;
        if (v.certezaSeparada) {
            const valoresC = [cPropia];
            const listaC = deducC.get(hijo);
            for (let i = 0; i < listaC.length; i++) { valoresC.push(listaC[i]); }
            cc = noisyOr(valoresC);
        }
        resultados.set(hijo, { S: r * cc, R: r, C: cc, origen: "deducida", padres: padres.get(hijo),
                               propia: rPropia * cPropia });
    }
    return resultados;
}

// V3: una sola fórmula para todos los nodos (directos y deducidos). Cada nodo recibe, en un solo
// paso, de los nodos directos con los que tiene relación, usando la evidencia PROPIA de cada
// directo. Ser directo solo decide quién puede transmitir; la fórmula del que recibe no cambia,
// así que cruzar el umbral de directo nunca hace bajar a nadie.
function calcularUnificado(g, c, directos, esDirecto, propia, v) {
    const p = PARAMETROS;
    const candidatos = new Set();
    for (const n of g.vecinoDe(c)) { candidatos.add(n); }
    for (let i = 0; i < directos.length; i++) {
        for (const n of g.vecinoDe(directos[i])) {
            if (n !== c) { candidatos.add(n); }
        }
    }
    const resultados = new Map();
    for (const x of candidatos) {
        const e0 = g.evidencia(c, x);
        let r0 = 0;
        let c0 = 0;
        if (e0 !== null) {
            r0 = e0.fuerza * g.factorEntidad(x);
            c0 = e0.certeza;
        }
        const valoresR = [r0];
        const valoresC = [c0];
        const padres = [];
        for (let j = 0; j < directos.length; j++) {
            const y = directos[j];
            if (y === x) { continue; }
            const e = g.evidencia(y, x);
            if (e === null) { continue; }
            const ecy = g.evidencia(c, y);
            const tr = transmision(ecy, e, v);
            valoresR.push(g.factorEntidad(y) * tr * e.fuerza * g.factorEntidad(x) * g.factorHub(y));
            valoresC.push(ecy.certeza * e.certeza * p.delta);
            padres.push(y);
        }
        const r = noisyOr(valoresR);
        const cc = noisyOr(valoresC);
        let origen = "deducida";
        if (esDirecto.has(x)) {
            origen = "coincidencias";
            if (e0.declarada) { origen = "declarada"; }
        }
        resultados.set(x, { S: r * cc, R: r, C: cc, origen: origen, padres: padres, propia: r0 * c0 });
    }
    return resultados;
}

function resolverCircuito(g, c, directos, esDirecto, v, fuerzaUsada) {
    const p = PARAMETROS;
    const tension = new Map();
    for (let i = 0; i < directos.length; i++) {
        tension.set(directos[i], 0);
    }
    for (let vuelta = 0; vuelta < p.maxVueltasCircuito; vuelta++) {
        let cambioMaximo = 0;
        for (let i = 0; i < directos.length; i++) {
            const x = directos[i];
            let suma = 0;
            let total = p.gamma;
            for (const y of g.vecinoDe(x)) {
                let conductancia = 0;
                let tensionY = 0;
                if (y === c) {
                    conductancia = fuerzaUsada(g.evidencia(c, x)) * g.factorEntidad(x);
                    tensionY = 1;
                } else if (esDirecto.has(y)) {
                    const e = g.evidencia(x, y);
                    const ecx = g.evidencia(c, x);
                    const ecy = g.evidencia(c, y);
                    let t = tEfectiva(ecx, e.tipo, v);
                    const t2 = tEfectiva(ecy, e.tipo, v);
                    if (t2 > t) { t = t2; }
                    conductancia = fuerzaUsada(e) * t * menor(g.factorEntidad(x), g.factorEntidad(y))
                                   * menor(g.factorHub(x), g.factorHub(y));
                    tensionY = tension.get(y);
                }
                suma = suma + conductancia * tensionY;
                total = total + conductancia;
            }
            const nueva = suma / total;
            const cambio = Math.abs(nueva - tension.get(x));
            if (cambio > cambioMaximo) { cambioMaximo = cambio; }
            tension.set(x, nueva);
        }
        if (cambioMaximo < p.toleranciaCircuito) { break; }
    }
    return tension;
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

// Ejemplo de Ana Ferrer (el del prompt), con roles y periodos.
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

// Diez exposiciones con X frente a cuatro tipos distintos de vínculo con Y.
function escenarioDiversidad() {
    const e = { central: "Ana", entidades: { Ana: "Creator", X: "Creator", Y: "Creator" }, parejas: [] };
    const x = [rel("Friendship")];
    const expos = repetir(evento("Exposition", 4), 10);
    for (let i = 0; i < expos.length; i++) { x.push(expos[i]); }
    e.parejas.push({ a: "Ana", b: "X", pruebas: x });
    e.parejas.push({ a: "Ana", b: "Y", pruebas: [rel("Friendship"), evento("Exposition", 4), rel("coworking"), evento("Work", 2)] });
    return e;
}

// Un compañero de un taller pequeño frente a uno de una academia enorme.
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

// Joaquín como centro: tiene 40 alumnos, Ana entre ellos.
function escenarioMaestro() {
    const e = escenarioAna();
    const copia = { central: "Joaquín", entidades: e.entidades, parejas: e.parejas.slice() };
    for (let i = 0; i < 39; i++) {
        copia.entidades["Alumno" + i] = "Creator";
        copia.parejas.push({ a: "Joaquín", b: "Alumno" + i,
                             pruebas: [rel("Mentorship", { "Joaquín": "maestro" })] });
        copia.parejas[copia.parejas.length - 1].pruebas[0].roles["Alumno" + i] = "aprendiz";
    }
    return copia;
}

// Dos obras del maestro: una durante la mentoría y otra 35 años después.
function escenarioTiempo() {
    const e = escenarioAna();
    e.entidades["Tardía"] = "HeritageItem";
    e.parejas.push({ a: "Joaquín", b: "Tardía", pruebas: [rel("Creation", null, { desde: 1945, hasta: 1945 })] });
    return e;
}

// Un maestro y un círculo de 25 contactos flojos (solo coincidencias), todos amigos entre sí.
function escenarioCirculo() {
    const e = { central: "Ana", entidades: { Ana: "Creator", "Joaquín": "Creator" }, parejas: [] };
    e.parejas.push({ a: "Ana", b: "Joaquín", pruebas: [rel("Mentorship", { "Ana": "aprendiz", "Joaquín": "maestro" })] });
    for (let i = 0; i < 25; i++) {
        e.entidades["C" + i] = "Creator";
        e.parejas.push({ a: "Ana", b: "C" + i, pruebas: [evento("Exposition", 6), evento("Exposition", 8)] });
        for (let j = 0; j < i; j++) {
            e.parejas.push({ a: "C" + j, b: "C" + i, pruebas: [rel("Friendship")] });
        }
    }
    return e;
}

// ---------- Propiedades ----------

const EPS = 0.000001;

function propiedades(clave) {
    const salida = [];
    const base = calcular(escenarioAna(), clave);

    // P1. Monotonía: añadir una relación (Luis–Marta) no baja a nadie.
    const sinVinculo = calcular(copiaSinPareja(escenarioAna(), "Luis", "Marta"), clave);
    let monotona = true;
    let detalle = "";
    for (const [nodo, r] of sinVinculo) {
        if (base.has(nodo) && base.get(nodo).S < r.S - EPS) {
            monotona = false;
            detalle = nodo + " baja de " + r.S.toFixed(2) + " a " + base.get(nodo).S.toFixed(2);
        }
    }
    salida.push({ p: "P1 Añadir una relación no baja a nadie", ok: monotona, detalle: detalle });

    // P2. Suelo: ningún directo queda por debajo de su evidencia propia.
    let suelo = true;
    detalle = "";
    for (const [nodo, r] of base) {
        if (r.origen !== "deducida" && r.S < r.propia - EPS) {
            suelo = false;
            detalle = nodo + ": evidencia " + r.propia.toFixed(2) + " → " + r.S.toFixed(2);
        }
    }
    salida.push({ p: "P2 Nadie baja de su propia evidencia", ok: suelo, detalle: detalle });

    // P3. Un deducido sin evidencia propia nunca supera a su mejor padre.
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

    // P4. Cuatro tipos distintos de vínculo pesan más que diez exposiciones repetidas.
    const div = calcular(escenarioDiversidad(), clave);
    salida.push({ p: "P4 Variedad > repetición", ok: div.get("Y").S > div.get("X").S,
                  detalle: "10 expos " + div.get("X").S.toFixed(2) + " · 4 tipos " + div.get("Y").S.toFixed(2) });

    // P5. El compañero de un taller pequeño pesa más que el de una academia de 300.
    const hub = calcular(escenarioHub(), clave);
    salida.push({ p: "P5 Penaliza intermediarios enormes", ok: hub.get("CompaneroTaller").S > hub.get("CompaneroAcademia").S + EPS,
                  detalle: "taller " + hub.get("CompaneroTaller").S.toFixed(3) + " · academia " + hub.get("CompaneroAcademia").S.toFixed(3) });

    // P6. Asimetría: el maestro es más relevante para la alumna que la alumna para el maestro.
    const maestro = calcular(escenarioMaestro(), clave);
    salida.push({ p: "P6 Maestro para alumna > alumna para maestro", ok: base.get("Joaquín").S > maestro.get("Ana").S + EPS,
                  detalle: "Joaquín desde Ana " + base.get("Joaquín").S.toFixed(2) + " · Ana desde Joaquín " + maestro.get("Ana").S.toFixed(2) });

    // P7. Tiempo: la obra del maestro durante la mentoría pesa más que una 35 años posterior.
    const tiempo = calcular(escenarioTiempo(), clave);
    salida.push({ p: "P7 Respeta el orden en el tiempo", ok: tiempo.get("Paseo").S > tiempo.get("Tardía").S + EPS,
                  detalle: "Paseo " + tiempo.get("Paseo").S.toFixed(2) + " · Tardía " + tiempo.get("Tardía").S.toFixed(2) });

    // P8. Sentido artístico del ejemplo: entra la obra del maestro y no el marido no artista del amigo.
    const u = PARAMETROS.umbral;
    salida.push({ p: "P8 Entra «Paseo» y no Pedro", ok: base.get("Paseo").S > u && base.get("Pedro").S <= u,
                  detalle: "Paseo " + base.get("Paseo").S.toFixed(2) + " · Pedro " + base.get("Pedro").S.toFixed(2) });

    // P9. Simetría: nodos en la misma situación reciben la misma relevancia (el orden no influye).
    const circulo = calcular(escenarioCirculo(), clave);
    let minimo = 2;
    let maximo = -1;
    for (let i = 0; i < 25; i++) {
        const valor = circulo.get("C" + i).S;
        if (valor < minimo) { minimo = valor; }
        if (valor > maximo) { maximo = valor; }
    }
    salida.push({ p: "P9 Iguales reciben lo mismo (no importa el orden)", ok: maximo - minimo < 0.001,
                  detalle: "círculo de 25: de " + minimo.toFixed(2) + " a " + maximo.toFixed(2) });

    // P10. Más evidencia nunca baja: Pedro gana coincidencias cada vez más fuertes con Ana
    // (y cruza el umbral de directo por el camino).
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
        const valor = calcular(esc, clave).get("Pedro").S;
        valoresP.push(valor.toFixed(3));
        if (valor < anterior - EPS) { crece = false; }
        anterior = valor;
    }
    salida.push({ p: "P10 Más evidencia nunca baja", ok: crece, detalle: "Pedro: " + valoresP.join(" → ") });
    return salida;
}

// ---------- Informe ----------

function informe() {
    const claves = ["V0", "V1", "V2", "V3"];
    console.log("=== Propiedades ===");
    for (let i = 0; i < claves.length; i++) {
        const lista = propiedades(claves[i]);
        let cumplidas = 0;
        for (let j = 0; j < lista.length; j++) { if (lista[j].ok) { cumplidas = cumplidas + 1; } }
        console.log("\n" + VARIANTES[claves[i]].nombre + ": " + cumplidas + "/" + lista.length);
        for (let j = 0; j < lista.length; j++) {
            let marca = "✘";
            if (lista[j].ok) { marca = "✔"; }
            console.log("  " + marca + " " + lista[j].p.padEnd(46) + lista[j].detalle);
        }
    }
    console.log("\n=== Ejemplo de Ana (S = relevancia final; R = fuerza; C = certeza) ===");
    const orden = ["Huerta", "Joaquín", "Luis", "Taller", "Marta", "Paseo", "Museo", "Juan", "Retrato", "Pedro"];
    const resultados = [];
    for (let i = 0; i < claves.length; i++) { resultados.push(calcular(escenarioAna(), claves[i])); }
    console.log("Nodo       V0 S   V1 S   V2 S   V3 S  (V3 R / C)");
    for (let i = 0; i < orden.length; i++) {
        const n = orden[i];
        let linea = n.padEnd(10);
        for (let j = 0; j < resultados.length; j++) {
            let marca = " ";
            if (resultados[j].get(n).S > PARAMETROS.umbral) { marca = "*"; }
            linea = linea + " " + resultados[j].get(n).S.toFixed(2) + marca + " ";
        }
        const r2 = resultados[3].get(n);
        linea = linea + " (" + r2.R.toFixed(2) + " / " + r2.C.toFixed(2) + ")";
        console.log(linea);
    }
    console.log("(* = supera el umbral " + PARAMETROS.umbral + ")");
}

function robustez() {
    console.log("\n=== Robustez de V3: propiedades cumplidas al mover ρ y δ ===");
    const original = { rho: PARAMETROS.rho, delta: PARAMETROS.delta, cierreTriadico: PARAMETROS.cierreTriadico };
    const rhos = [0.3, 0.5, 0.7];
    const deltas = [0.4, 0.5, 0.7, 0.9];
    const cierres = [0.3];
    let combinaciones = 0;
    const fallos = new Map();
    for (let i = 0; i < rhos.length; i++) {
        for (let j = 0; j < deltas.length; j++) {
            for (let k = 0; k < cierres.length; k++) {
                PARAMETROS.rho = rhos[i];
                PARAMETROS.delta = deltas[j];
                PARAMETROS.cierreTriadico = cierres[k];
                combinaciones = combinaciones + 1;
                const lista = propiedades("V3");
                for (let n = 0; n < lista.length; n++) {
                    if (!lista[n].ok) {
                        let previo = fallos.get(lista[n].p);
                        if (previo === undefined) { previo = []; }
                        previo.push("ρ=" + rhos[i] + " δ=" + deltas[j] + " κ=" + cierres[k]);
                        fallos.set(lista[n].p, previo);
                    }
                }
            }
        }
    }
    PARAMETROS.rho = original.rho;
    PARAMETROS.delta = original.delta;
    PARAMETROS.cierreTriadico = original.cierreTriadico;
    console.log("Combinaciones probadas: " + combinaciones);
    if (fallos.size === 0) {
        console.log("Todas cumplen las 10 propiedades.");
    }
    for (const [prop, donde] of fallos) {
        console.log("  " + prop + " falla en " + donde.length + ": " + donde.join(" | "));
    }
}

informe();
robustez();
