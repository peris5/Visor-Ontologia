// Prototipo de la relevancia en tres capas (no es código de la aplicación).
// Capa 0: evidencia de cada pareja (relaciones declaradas + eventos compartidos).
// Capas 1 y 2: circuito eléctrico entre el nodo central y sus nodos directos.
// Capa 3: deducción a dos saltos con noisy-OR, tabla T y descuento δ.
// Dos perfiles de pesos: "personal" (los de analisis_bd_neo4j.md) y "artistico".
// Estilo: sin flechas, ternarios, ?., ??, map ni filter.

// ---------- Parámetros generales ----------

export const PARAMETROS_BASE = {
    beta: 1,
    probabilidadCoincidencia: 0.4,   // certeza que aporta una coincidencia en un evento de 2 entidades
    umbralDirecto: 0.05,             // evidencia mínima con el centro para ser nodo directo
    gamma: 0.3,                      // fuga a tierra de los nodos directos
    delta: 0.7,                      // descuento por especular en la capa 3
    umbral: 0.3,
    toleranciaCircuito: 0.000001,
    maxVueltasCircuito: 1000
};

// ---------- Perfiles de pesos ----------

export const PERFIL_PERSONAL = {
    nombre: "personal",
    pesos: {
        Marriage: 0.95, Filiation: 0.90, Mentorship: 0.85, Friendship: 0.75, Related: 0.70,
        coworking: 0.65, Employement: 0.60, Professional: 0.55,
        Creation: 0.90, Fund: 0.85, Work: 0.60, Wedding: 0.60, Exposition: 0.50, Event: 0.40
    },
    pesoPorDefecto: 0.5,
    tablaT: {
        "Friendship>Marriage": 0.8, "Friendship>Creation": 0.1, "Friendship>Friendship": 0.6,
        "Mentorship>Creation": 0.6, "Filiation>Filiation": 0.7, "Employement>Employement": 0.2
    },
    tPorDefecto: 0.3,
    factorEntidad: { Creator: 1, Person: 1, HeritageItem: 1, Organization: 1 }
};

export const PERFIL_ARTISTICO = {
    nombre: "artistico",
    pesos: {
        Mentorship: 0.95,                 // maestro–discípulo: la formación marca el estilo
        coworking: 0.85,                  // colaboración artística
        Creation: 1.00,                   // autoría: el núcleo de la trayectoria
        Fund: 0.85,                       // fundar un grupo, academia o institución
        Exposition: 0.70,                 // coexposición: mismo circuito artístico
        Employement: 0.65, Professional: 0.60, Work: 0.60,   // taller, academia, encargo
        Friendship: 0.50,                 // círculo personal: cuenta si es artístico (factor entidad)
        Marriage: 0.50, Related: 0.45, Filiation: 0.45,      // familia: importa si son artistas
        Wedding: 0.20, Event: 0.30
    },
    pesoPorDefecto: 0.4,
    tablaT: {
        "Mentorship>Creation": 0.8,       // la obra de tu maestro
        "Mentorship>Mentorship": 0.6,     // maestro de tu maestro, condiscípulos
        "coworking>Creation": 0.6,        // la obra de tu colaborador
        "Creation>Exposition": 0.8,       // dónde se expuso tu obra
        "Employement>Employement": 0.5,   // compañeros de taller o academia
        "Exposition>Creation": 0.4,       // obra de quien expuso contigo
        "Exposition>Exposition": 0.3,
        "Friendship>Friendship": 0.4,     // círculo, tertulias
        "Friendship>Creation": 0.2,       // la obra de tu amigo
        "Friendship>Marriage": 0.3,       // la pareja de tu amigo
        "Marriage>Creation": 0.5          // la obra de tu pareja
    },
    tPorDefecto: 0.3,
    // Lo que no es creación artística transmite menos (subtipos IS_A de la BD).
    factorEntidad: { Creator: 1, Person: 0.6, HeritageItem: 1, Organization: 0.8 }
};

function pesoTipo(perfil, tipo) {
    if (perfil.pesos[tipo] !== undefined) {
        return perfil.pesos[tipo];
    }
    return perfil.pesoPorDefecto;
}

function factorT(perfil, tipoPrimero, tipoSegundo) {
    const clave = tipoPrimero + ">" + tipoSegundo;
    if (perfil.tablaT[clave] !== undefined) {
        return perfil.tablaT[clave];
    }
    return perfil.tPorDefecto;
}

function factorEntidad(perfil, datos, nodo) {
    const clase = datos.entidades[nodo];
    if (perfil.factorEntidad[clase] !== undefined) {
        return perfil.factorEntidad[clase];
    }
    return 1;
}

// ---------- Datos del ejemplo ----------

function declarada(tipo) {
    return { tipo: tipo, participantes: 2, factorTiempo: 1, declarada: true };
}

function evento(tipo, participantes) {
    return { tipo: tipo, participantes: participantes, factorTiempo: 1, declarada: false };
}

export function datosEjemplo() {
    const entidades = {
        "Tú": "Creator", "Luis": "Creator", "Marta": "Creator", "Pedro": "Person",
        "Juan": "Creator", "Joaquín": "Creator", "Taller": "Organization", "Museo": "Organization",
        "Retrato": "HeritageItem", "Paseo": "HeritageItem", "TuObra": "HeritageItem"
    };
    const parejas = [];
    const pruebasLuis = [declarada("Friendship")];
    for (let i = 0; i < 5; i++) {
        pruebasLuis.push(evento("Exposition", 4));
    }
    parejas.push({ a: "Tú", b: "Luis", pruebas: pruebasLuis });
    parejas.push({ a: "Tú", b: "Marta", pruebas: [evento("Exposition", 3), evento("Exposition", 6), evento("Exposition", 40)] });
    parejas.push({ a: "Tú", b: "Taller", pruebas: [declarada("Employement")] });
    parejas.push({ a: "Tú", b: "Pedro", pruebas: [evento("Exposition", 12)] });
    parejas.push({ a: "Tú", b: "Joaquín", pruebas: [declarada("Mentorship")] });
    parejas.push({ a: "Tú", b: "TuObra", pruebas: [declarada("Creation")] });
    parejas.push({ a: "Luis", b: "Marta", pruebas: [declarada("Friendship")] });
    parejas.push({ a: "Luis", b: "Pedro", pruebas: [declarada("Marriage")] });
    parejas.push({ a: "Luis", b: "Retrato", pruebas: [declarada("Creation")] });
    parejas.push({ a: "Taller", b: "Juan", pruebas: [declarada("Employement")] });
    parejas.push({ a: "Joaquín", b: "Paseo", pruebas: [declarada("Creation")] });
    parejas.push({ a: "TuObra", b: "Museo", pruebas: [declarada("Exposition")] });
    return { central: "Tú", entidades: entidades, parejas: parejas };
}

// ---------- Capa 0: evidencia de una pareja ----------

function evidenciaPareja(pruebas, perfil, p) {
    let productoFuerza = 1;
    let productoCerteza = 1;
    let hayDeclarada = false;
    let tipoPrincipal = null;
    let mejorValor = -1;
    for (let i = 0; i < pruebas.length; i++) {
        const prueba = pruebas[i];
        const factorParticipantes = Math.pow(2 / prueba.participantes, p.beta);
        const valor = pesoTipo(perfil, prueba.tipo) * factorParticipantes * prueba.factorTiempo;
        productoFuerza = productoFuerza * (1 - valor);
        if (prueba.declarada) {
            hayDeclarada = true;
        } else {
            productoCerteza = productoCerteza * (1 - p.probabilidadCoincidencia * factorParticipantes);
        }
        if (valor > mejorValor) {
            mejorValor = valor;
            tipoPrincipal = prueba.tipo;
        }
    }
    let certeza = 1 - productoCerteza;
    if (hayDeclarada) {
        certeza = 1;
    }
    const fuerza = 1 - productoFuerza;
    return { fuerza: fuerza, certeza: certeza, valor: certeza * fuerza,
             tipo: tipoPrincipal, declarada: hayDeclarada };
}

function construirGrafo(datos, perfil, p) {
    const vecinos = new Map();
    for (let i = 0; i < datos.parejas.length; i++) {
        const pareja = datos.parejas[i];
        const evidencia = evidenciaPareja(pareja.pruebas, perfil, p);
        anadirVecino(vecinos, pareja.a, pareja.b, evidencia);
        anadirVecino(vecinos, pareja.b, pareja.a, evidencia);
    }
    return vecinos;
}

function anadirVecino(vecinos, desde, hacia, evidencia) {
    if (!vecinos.has(desde)) {
        vecinos.set(desde, new Map());
    }
    vecinos.get(desde).set(hacia, evidencia);
}

// ---------- Capas 1 y 2: circuito ----------

function resolverCircuito(datos, directos, vecinos, perfil, p) {
    const central = datos.central;
    const tension = new Map();
    for (let i = 0; i < directos.length; i++) {
        tension.set(directos[i], 0);
    }
    const esDirecto = new Set(directos);
    for (let vuelta = 0; vuelta < p.maxVueltasCircuito; vuelta++) {
        let cambioMaximo = 0;
        for (let i = 0; i < directos.length; i++) {
            const nodo = directos[i];
            let suma = 0;
            let conductanciaTotal = p.gamma;
            for (const [vecino, evidencia] of vecinos.get(nodo)) {
                let conductancia = 0;
                let tensionVecino = 0;
                if (vecino === central) {
                    conductancia = evidencia.valor * factorEntidad(perfil, datos, nodo);
                    tensionVecino = 1;
                } else if (esDirecto.has(vecino)) {
                    conductancia = evidencia.valor * tEntreDirectos(central, nodo, vecino, evidencia, vecinos, perfil)
                                   * menor(factorEntidad(perfil, datos, nodo), factorEntidad(perfil, datos, vecino));
                    tensionVecino = tension.get(vecino);
                }
                suma = suma + conductancia * tensionVecino;
                conductanciaTotal = conductanciaTotal + conductancia;
            }
            const nueva = suma / conductanciaTotal;
            const cambio = Math.abs(nueva - tension.get(nodo));
            if (cambio > cambioMaximo) {
                cambioMaximo = cambio;
            }
            tension.set(nodo, nueva);
        }
        if (cambioMaximo < p.toleranciaCircuito) {
            break;
        }
    }
    return tension;
}

function menor(x, y) {
    if (x < y) {
        return x;
    }
    return y;
}

// El cable entre dos directos tiene que ser simétrico: se usa el mayor T de los dos sentidos.
function tEntreDirectos(central, a, b, evidencia, vecinos, perfil) {
    const tDesdeA = factorT(perfil, vecinos.get(central).get(a).tipo, evidencia.tipo);
    const tDesdeB = factorT(perfil, vecinos.get(central).get(b).tipo, evidencia.tipo);
    if (tDesdeA > tDesdeB) {
        return tDesdeA;
    }
    return tDesdeB;
}

// ---------- Capa 3 y combinación ----------

export function calcularRelevancias(datos, perfil, p) {
    const vecinos = construirGrafo(datos, perfil, p);
    const central = datos.central;
    const directos = [];
    for (const [nodo, evidencia] of vecinos.get(central)) {
        if (evidencia.valor >= p.umbralDirecto) {
            directos.push(nodo);
        }
    }
    const tension = resolverCircuito(datos, directos, vecinos, perfil, p);
    const resultados = new Map();
    for (let i = 0; i < directos.length; i++) {
        const nodo = directos[i];
        const evidencia = vecinos.get(central).get(nodo);
        let origen = "coincidencias";
        if (evidencia.declarada) {
            origen = "declarada";
        }
        resultados.set(nodo, { relevancia: tension.get(nodo), origen: origen,
                               explicacion: [evidencia.tipo] });
    }
    const esDirecto = new Set(directos);
    const productos = new Map();
    const explicaciones = new Map();
    for (let i = 0; i < directos.length; i++) {
        const padre = directos[i];
        const tipoPadre = vecinos.get(central).get(padre).tipo;
        for (const [hijo, evidencia] of vecinos.get(padre)) {
            if (hijo === central || esDirecto.has(hijo)) {
                continue;
            }
            const t = factorT(perfil, tipoPadre, evidencia.tipo);
            const deducida = tension.get(padre) * evidencia.valor * t * p.delta
                             * factorEntidad(perfil, datos, hijo);
            if (!productos.has(hijo)) {
                let propia = 0;
                if (vecinos.get(central).has(hijo)) {
                    propia = vecinos.get(central).get(hijo).valor;
                }
                productos.set(hijo, 1 - propia);
                explicaciones.set(hijo, []);
            }
            productos.set(hijo, productos.get(hijo) * (1 - deducida));
            explicaciones.get(hijo).push(evidencia.tipo + " de " + padre);
        }
    }
    for (const [hijo, producto] of productos) {
        resultados.set(hijo, { relevancia: 1 - producto, origen: "deducida", explicacion: explicaciones.get(hijo) });
    }
    return resultados;
}

// ---------- Ejecución ----------

function dosDecimales(x) {
    return (Math.round(x * 100) / 100).toFixed(2);
}

function ordenar(resultados) {
    const filas = [];
    for (const [nodo, r] of resultados) {
        filas.push({ nodo: nodo, relevancia: r.relevancia, origen: r.origen, explicacion: r.explicacion });
    }
    filas.sort(function (x, y) { return y.relevancia - x.relevancia; });
    return filas;
}

const datos = datosEjemplo();
const perfiles = [PERFIL_PERSONAL, PERFIL_ARTISTICO];
const todos = [];
for (let i = 0; i < perfiles.length; i++) {
    todos.push(calcularRelevancias(datos, perfiles[i], PARAMETROS_BASE));
}
console.log("γ = " + PARAMETROS_BASE.gamma + ", δ = " + PARAMETROS_BASE.delta + ", umbral = " + PARAMETROS_BASE.umbral);
console.log("Nodo      Personal    Artístico   Origen         Por qué");
const filas = ordenar(todos[1]);
for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const personal = todos[0].get(f.nodo).relevancia;
    let marcaP = " ";
    if (personal > PARAMETROS_BASE.umbral) { marcaP = "*"; }
    let marcaA = " ";
    if (f.relevancia > PARAMETROS_BASE.umbral) { marcaA = "*"; }
    console.log(f.nodo.padEnd(10) + dosDecimales(personal) + marcaP + "       " +
                dosDecimales(f.relevancia) + marcaA + "       " + f.origen.padEnd(15) + f.explicacion.join(", "));
}
console.log("(* = supera el umbral)");
