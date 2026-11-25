import { EscenariosPrueba } from './EscenariosPrueba.js';
import { OrigenRelevancia } from '../modelo/OrigenRelevancia.js';

/**
 * Las propiedades P0–P16 que debe cumplir la relevancia, con los mismos
 * escenarios y comprobaciones que propiedades() de
 * docs/prototipo_relevancia_v4.mjs. Las usan la pestaña «Propiedades» del
 * laboratorio y pruebasPropiedadesRelevancia.js.
 *
 * Se calculan con f_t = 1 (EscenariosPrueba.conTiempoNeutro): la época de la
 * central no forma parte de ellas.
 */
export class PropiedadesRelevancia {
  static EPS = 0.000001;
  static UMBRAL = 0.3;
  static MAX_NODOS = 150;
  // Los valores con los que se repite todo (botón «Robustez»).
  static RHOS = [0.3, 0.5, 0.7];
  static DELTAS = [0.4, 0.5, 0.7, 0.9];

  #configuracion;
  #deduplicar;

  /**
   * @param {Object} configuracion - la de public/relevancia.json.
   * @param {boolean} deduplicarEventos - si el servidor junta los eventos
   *   repetidos (P15); true si no se indica.
   */
  constructor(configuracion, deduplicarEventos) {
    this.#configuracion = EscenariosPrueba.conTiempoNeutro(configuracion);
    // Las propiedades son de las tres capas, también si está elegido el mejor camino.
    this.#configuracion.estrategiaNodos = "tresCapas";
    this.#deduplicar = deduplicarEventos !== false;
  }

  /**
   * Comprueba todas.
   *
   * @returns {Object[]} [{ clave: "P1", nombre, ok, detalle }]
   */
  comprobar() {
    const base = this.#calcular(EscenariosPrueba.ana());
    const salida = [];
    this.#anotar(salida, "P0", "El cálculo rápido da lo mismo que la fórmula", this.#p0());
    this.#anotar(salida, "P1", "Añadir una relación no baja a nadie", this.#p1(base));
    this.#anotar(salida, "P2", "Ningún directo baja de su propia evidencia", this.#p2(base));
    this.#anotar(salida, "P3", "Un deducido sin evidencia propia no supera a su mejor padre", this.#p3(base));
    this.#anotar(salida, "P4", "Cuatro tipos de vínculo pesan más que diez exposiciones", this.#p4());
    this.#anotar(salida, "P5", "El compañero de un taller pequeño pesa más que el de una academia de 300", this.#p5());
    this.#anotar(salida, "P6", "El maestro pesa más para la alumna que la alumna para el maestro", this.#p6(base));
    this.#anotar(salida, "P7", "La obra de la época de la mentoría pesa más que una 35 años posterior", this.#p7());
    this.#anotar(salida, "P8", "Entra «Paseo» y no Pedro", this.#p8(base));
    this.#anotar(salida, "P9", "Dos nodos en la misma situación reciben lo mismo", this.#p9());
    this.#anotar(salida, "P10", "Más evidencia nunca baja, tampoco al pasar a directo", this.#p10());
    this.#anotar(salida, "P11", "Los coexpositores del maestro no rebajan su obra", this.#p11());
    this.#anotar(salida, "P12", "Las obras propias no tapan a las personas", this.#p12());
    this.#anotar(salida, "P13", "Coexponer no es una relación declarada", this.#p13());
    this.#anotar(salida, "P14", "Las obras y el lugar no diluyen a las personas", this.#p14());
    this.#anotar(salida, "P15", "El mismo evento registrado dos veces cuenta una", this.#p15());
    this.#anotar(salida, "P16", "Pocos registrados no hacen íntimo un evento", this.#p16());
    return salida;
  }

  /**
   * Repite las propiedades moviendo ρ (λ en el prototipo) y δ.
   *
   * @returns {Object} { combinaciones, fallos: [{ clave, rho, delta, detalle }] }
   */
  robustez() {
    const fallos = [];
    let combinaciones = 0;
    for (let i = 0; i < PropiedadesRelevancia.RHOS.length; i++) {
      for (let j = 0; j < PropiedadesRelevancia.DELTAS.length; j++) {
        const configuracion = Object.assign({}, this.#configuracion);
        configuracion.rho = PropiedadesRelevancia.RHOS[i];
        configuracion.delta = PropiedadesRelevancia.DELTAS[j];
        const lista = new PropiedadesRelevancia(configuracion, this.#deduplicar).comprobar();
        combinaciones = combinaciones + 1;
        for (let n = 0; n < lista.length; n++) {
          if (!lista[n].ok) {
            fallos.push({ clave: lista[n].clave, rho: configuracion.rho, delta: configuracion.delta,
              detalle: lista[n].detalle });
          }
        }
      }
    }
    return { combinaciones: combinaciones, fallos: fallos };
  }

  // ───────────── Privados: una función por propiedad, devuelven { ok, detalle } ─────────────

  #p0() {
    const escenarios = [EscenariosPrueba.ana(), EscenariosPrueba.academia(), EscenariosPrueba.circulo(),
      EscenariosPrueba.maestroProlifico(true)];
    let maxima = 0;
    let iguales = true;
    for (let i = 0; i < escenarios.length; i++) {
      const cache = EscenariosPrueba.cache(escenarios[i]);
      const central = cache.entidad(escenarios[i].central);
      const estrategia = EscenariosPrueba.piezas(this.#configuracion).estrategia;
      const rapido = estrategia.calcular(central, cache);
      const literal = estrategia.calcularReferencia(central, cache);
      iguales = iguales && rapido.size === literal.size;
      for (const [id, resultado] of literal) {
        if (rapido.has(id)) {
          maxima = Math.max(maxima, Math.abs(resultado.getRelevancia() - rapido.get(id).getRelevancia()));
        } else {
          iguales = false;
        }
      }
    }
    return { ok: iguales && maxima < 1e-12, detalle: "diferencia máxima " + maxima.toExponential(1) };
  }

  #p1(base) {
    const sinVinculo = this.#calcular(EscenariosPrueba.sinPareja(EscenariosPrueba.ana(), "luis", "marta"));
    let ok = true;
    let detalle = "";
    for (const [id, resultado] of sinVinculo) {
      const antes = resultado.getRelevancia();
      if (base.has(id) && base.get(id).getRelevancia() < antes - PropiedadesRelevancia.EPS) {
        ok = false;
        detalle = id + " baja de " + antes.toFixed(3) + " a " + base.get(id).getRelevancia().toFixed(3);
      }
    }
    return { ok: ok, detalle: detalle };
  }

  #p2(base) {
    let ok = true;
    let detalle = "";
    for (const [id, resultado] of base) {
      const esDirecto = resultado.getOrigen() === OrigenRelevancia.DECLARADA ||
        resultado.getOrigen() === OrigenRelevancia.COINCIDENCIAS;
      if (esDirecto && resultado.getRelevancia() < resultado.getEvidenciaPropia() - PropiedadesRelevancia.EPS) {
        ok = false;
        detalle = id + ": evidencia " + resultado.getEvidenciaPropia().toFixed(3) + " → " +
          resultado.getRelevancia().toFixed(3);
      }
    }
    return { ok: ok, detalle: detalle };
  }

  #p3(base) {
    let ok = true;
    let detalle = "";
    for (const [id, resultado] of base) {
      if (resultado.esDeducido() && resultado.getEvidenciaPropia() < PropiedadesRelevancia.EPS) {
        const padres = resultado.getPadres();
        let mejor = 0;
        for (let i = 0; i < padres.length; i++) {
          mejor = Math.max(mejor, base.get(padres[i].getId()).getRelevancia());
        }
        if (resultado.getRelevancia() > mejor + PropiedadesRelevancia.EPS) {
          ok = false;
          detalle = id;
        }
      }
    }
    return { ok: ok, detalle: detalle };
  }

  #p4() {
    const resultados = this.#calcular(EscenariosPrueba.diversidad());
    const x = resultados.get("x").getRelevancia();
    const y = resultados.get("y").getRelevancia();
    return { ok: y > x, detalle: "10 exposiciones " + x.toFixed(3) + " · 4 tipos " + y.toFixed(3) };
  }

  #p5() {
    const resultados = this.#calcular(EscenariosPrueba.academia());
    const taller = resultados.get("companeroTaller").getRelevancia();
    const academia = resultados.get("companeroAcademia").getRelevancia();
    return { ok: taller > academia + PropiedadesRelevancia.EPS,
      detalle: "taller " + taller.toFixed(3) + " · academia " + academia.toFixed(3) };
  }

  #p6(base) {
    const joaquin = base.get("joaquin").getRelevancia();
    const ana = this.#calcular(EscenariosPrueba.maestro()).get("ana").getRelevancia();
    return { ok: joaquin > ana + PropiedadesRelevancia.EPS,
      detalle: "Joaquín desde Ana " + joaquin.toFixed(3) + " · Ana desde Joaquín " + ana.toFixed(3) };
  }

  #p7() {
    const resultados = this.#calcular(EscenariosPrueba.tiempo());
    const paseo = resultados.get("paseo").getRelevancia();
    const tardia = resultados.get("tardia").getRelevancia();
    return { ok: paseo > tardia + PropiedadesRelevancia.EPS,
      detalle: "Paseo " + paseo.toFixed(3) + " · Tardía " + tardia.toFixed(3) };
  }

  #p8(base) {
    const paseo = base.get("paseo").getRelevancia();
    const pedro = base.get("pedro").getRelevancia();
    return { ok: paseo > PropiedadesRelevancia.UMBRAL && pedro <= PropiedadesRelevancia.UMBRAL,
      detalle: "Paseo " + paseo.toFixed(3) + " · Pedro " + pedro.toFixed(3) };
  }

  #p9() {
    const resultados = this.#calcular(EscenariosPrueba.circulo());
    let minimo = 2;
    let maximo = -1;
    for (let i = 0; i < 25; i++) {
      const valor = resultados.get("c" + i).getRelevancia();
      minimo = Math.min(minimo, valor);
      maximo = Math.max(maximo, valor);
    }
    return { ok: maximo - minimo < 0.001,
      detalle: "círculo de 25: de " + minimo.toFixed(3) + " a " + maximo.toFixed(3) };
  }

  #p10() {
    const pasos = [[], [12], [8], [4], [3], [3, 4]];
    const valores = [];
    let ok = true;
    let anterior = -1;
    for (let i = 0; i < pasos.length; i++) {
      const valor = this.#calcular(EscenariosPrueba.pedroCoincide(pasos[i])).get("pedro").getRelevancia();
      valores.push(valor.toFixed(3));
      if (valor < anterior - PropiedadesRelevancia.EPS) {
        ok = false;
      }
      anterior = valor;
    }
    return { ok: ok, detalle: "Pedro: " + valores.join(" → ") };
  }

  #p11() {
    const con = this.#calcular(EscenariosPrueba.maestroProlifico(true)).get("paseo").getRelevancia();
    const sin = this.#calcular(EscenariosPrueba.maestroProlifico(false)).get("paseo").getRelevancia();
    return { ok: Math.abs(con - sin) < PropiedadesRelevancia.EPS,
      detalle: "Paseo con 400 coexpositores " + con.toFixed(2) + " · sin ellos " + sin.toFixed(2) };
  }

  #p12() {
    const escenario = EscenariosPrueba.artistaProlifica();
    const resultados = this.#calcular(escenario);
    const elegibles = EscenariosPrueba.piezas(this.#configuracion).seleccionador.elegibles(resultados, escenario.central,
      true);
    const dentro = new Set();
    for (let i = 0; i < elegibles.length && dentro.size < PropiedadesRelevancia.MAX_NODOS - 1; i++) {
      if (elegibles[i].getRelevancia() > PropiedadesRelevancia.UMBRAL) {
        dentro.add(elegibles[i].getEntidad().getId());
      }
    }
    let alumnas = 0;
    for (let i = 0; i < 12; i++) {
      if (dentro.has("alumna" + i)) {
        alumnas = alumnas + 1;
      }
    }
    let maestro = "no";
    if (dentro.has("joaquin")) {
      maestro = "sí";
    }
    return { ok: maestro === "sí" && alumnas === 12,
      detalle: "200 obras propias: maestro " + maestro + ", alumnas " + alumnas + "/12" };
  }

  #p13() {
    const datos = this.#derivar(EscenariosPrueba.exposicion(true));
    const obras = this.#evidencia(datos, "huerta", "marina").getCerteza();
    const lugar = this.#evidencia(datos, "huerta", "galeria").getCerteza();
    return { ok: obras < 1 && lugar === 1,
      detalle: "certeza Huerta–Marina " + obras.toFixed(2) + " · Huerta–Galería " + lugar.toFixed(2) };
  }

  #p14() {
    const exponerCon = this.#evidencia(this.#derivar(EscenariosPrueba.exposicion(true)), "ana", "bea").getFuerza();
    const exponerSin = this.#evidencia(this.#derivar(EscenariosPrueba.exposicion(false)), "ana", "bea").getFuerza();
    const mentoriaCon = this.#evidencia(this.#derivar(EscenariosPrueba.mentoria(true)), "ana", "joaquin").getFuerza();
    const mentoriaSin = this.#evidencia(this.#derivar(EscenariosPrueba.mentoria(false)), "ana", "joaquin").getFuerza();
    return {
      ok: Math.abs(exponerCon - exponerSin) < PropiedadesRelevancia.EPS &&
        Math.abs(mentoriaCon - mentoriaSin) < PropiedadesRelevancia.EPS,
      detalle: "exponer juntas " + exponerCon.toFixed(2) + " y " + exponerSin.toFixed(2) + " · mentoría " +
        mentoriaCon.toFixed(2) + " y " + mentoriaSin.toFixed(2)
    };
  }

  #p15() {
    const una = this.#evidencia(this.#derivar(EscenariosPrueba.duplicados(null)), "ana", "bea").getFuerza();
    const duplicado = this.#evidencia(this.#derivar(EscenariosPrueba.duplicados("1920-05-14")), "ana", "bea").getFuerza();
    const otroDia = this.#evidencia(this.#derivar(EscenariosPrueba.duplicados("1920-06-02")), "ana", "bea").getFuerza();
    return { ok: Math.abs(una - duplicado) < PropiedadesRelevancia.EPS && otroDia > una + PropiedadesRelevancia.EPS,
      detalle: "una vez " + una.toFixed(3) + " · duplicado " + duplicado.toFixed(3) + " · otro día " + otroDia.toFixed(3) };
  }

  #p16() {
    const poco = this.#evidencia(this.#derivar(EscenariosPrueba.registrados(2)), "ana", "bea");
    const mucho = this.#evidencia(this.#derivar(EscenariosPrueba.registrados(100)), "ana", "bea");
    const compuesta = EscenariosPrueba.piezas(this.#configuracion).compuesta;
    const tope = compuesta.getReparto().getTope();
    // Sin tope no hay techo que cumplir: la propiedad falla, como en la v3.
    let techo = 0;
    if (tope !== null) {
      techo = compuesta.getPeso(poco.getTipoPrincipal()) * tope;
    }
    return {
      ok: poco.getFuerza() <= techo + PropiedadesRelevancia.EPS &&
        mucho.getFuerza() < poco.getFuerza() - PropiedadesRelevancia.EPS,
      detalle: "2 registrados: fuerza " + poco.getFuerza().toFixed(3) + ", certeza " + poco.getCerteza().toFixed(3) +
        " · 100 registrados: fuerza " + mucho.getFuerza().toFixed(3)
    };
  }

  // ───────────── Privados: ayudas ─────────────

  #calcular(escenario) {
    return EscenariosPrueba.calcular(escenario, this.#configuracion);
  }

  #derivar(intermediarios) {
    return EscenariosPrueba.derivarDatos(EscenariosPrueba.entidadesEventos(), intermediarios, this.#deduplicar);
  }

  #evidencia(datos, desde, hacia) {
    return EscenariosPrueba.evidencia(datos, this.#configuracion, desde, hacia);
  }

  #anotar(salida, clave, nombre, resultado) {
    salida.push({ clave: clave, nombre: nombre, ok: resultado.ok, detalle: resultado.detalle });
  }
}
