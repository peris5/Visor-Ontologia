import { ClienteServicio } from '../datos/ClienteServicio.js';
import { crear } from '../interfaz/ComponenteUI.js';
import { PropiedadesRelevancia } from './PropiedadesRelevancia.js';
import { MedidorMuestra } from './MedidorMuestra.js';
import { PruebaMonotonia } from './PruebaMonotonia.js';
import { InformeLaboratorio } from './InformeLaboratorio.js';
import { Estadistica } from './Estadistica.js';

/**
 * La página laboratorio.html: solo pinta. Todo lo que calcula está en las
 * demás clases de src/laboratorio/, que usan las mismas clases que la
 * aplicación. Es una página de desarrollo: no se enlaza desde el visor.
 *
 * Cuatro pestañas: «Propiedades» (P0–P16 y robustez), «Medir sobre los datos»,
 * «Comparar configuraciones» y «Tipos y datos». Las tres primeras usan la
 * PRIMERA configuración de «Comparar» (al abrir, la de public/relevancia.json).
 */
export class Laboratorio {
  static CENTRALES_MONOTONIA = 60;
  static SEMILLA_MONOTONIA = 11;
  // Cuántas de las entidades que entran en una medida se enseñan.
  static MAX_ENTRAN = 300;
  static ORIGEN_GRANDE = "simuladaGrande";
  static PESTANAS = ["propiedades", "medir", "comparar", "tipos"];

  #cliente;
  #servidor;
  #contexto;
  #jerarquia;
  #propiedades;
  #robustez;
  #medicion;
  #monotonia;
  #comparacion;
  #muestraUsada;
  #ocupado;

  constructor() {
    this.#cliente = null;
    this.#servidor = null;
    this.#contexto = null;
    this.#jerarquia = {};
    this.#propiedades = null;
    this.#robustez = null;
    this.#medicion = null;
    this.#monotonia = null;
    this.#comparacion = null;
    this.#muestraUsada = null;
    this.#ocupado = false;
  }

  /** Punto de entrada (laboratorio.html). */
  static async main() {
    const laboratorio = new Laboratorio();
    laboratorio.#conectarBotones();
    try {
      const respuesta = await fetch("./relevancia.json");
      const texto = JSON.stringify(await respuesta.json(), null, 2);
      Laboratorio.#elemento("configuracionUna").value = texto;
      Laboratorio.#elemento("configuracionOtra").value = texto;
    } catch (error) {
      Laboratorio.#avisar("No se puede leer public/relevancia.json: " + error.message, true);
      return laboratorio;
    }
    try {
      await laboratorio.#conectarConElServidor();
    } catch (error) {
      Laboratorio.#avisar(error.message + ". Las propiedades se pueden comprobar sin servidor; el resto, no.", true);
    }
    laboratorio.#comprobarPropiedades();
    return laboratorio;
  }

  async #conectarConElServidor() {
    this.#cliente = new ClienteServicio("/api");
    const respuestas = await Promise.all([this.#cliente.obtenerConfiguracion(), this.#cliente.obtenerTipos(),
      this.#cliente.obtenerJerarquia()]);
    this.#servidor = respuestas[0];
    this.#jerarquia = respuestas[2];
    this.#contexto = {
      idioma: this.#servidor.idioma, nombresTipos: this.#servidor.nombresTipos,
      etiquetasEntidad: this.#servidor.etiquetasEntidad, tipos: respuestas[1]
    };
    let duplicados = "se juntan";
    if (!this.#servidor.deduplicarEventos) {
      duplicados = "no se juntan";
    }
    Laboratorio.#elemento("fuente").textContent = "Datos: " + this.#servidor.origenDatos + " · umbral " +
      this.#servidor.umbralPorDefecto + " · máximo " + this.#servidor.maxNodos + " nodos · los eventos repetidos " + duplicados;
  }

  // ───────────── Botones y pestañas ─────────────

  #conectarBotones() {
    const laboratorio = this;
    for (let i = 0; i < Laboratorio.PESTANAS.length; i++) {
      const nombre = Laboratorio.PESTANAS[i];
      Laboratorio.#elemento("pestana-" + nombre).addEventListener("click", function () {
        Laboratorio.#mostrarPestana(nombre);
      });
    }
    this.#alPulsar("botonPropiedades", function () {
      laboratorio.#comprobarPropiedades();
    });
    this.#alPulsar("botonRobustez", function () {
      laboratorio.#comprobarRobustez();
    });
    this.#alPulsar("botonMedir", async function () {
      await laboratorio.#medir();
    });
    this.#alPulsar("botonMonotonia", async function () {
      await laboratorio.#comprobarMonotonia();
    });
    this.#alPulsar("botonComparar", async function () {
      await laboratorio.#comparar();
    });
    this.#alPulsar("botonDescargarConfiguracion", function () {
      const texto = JSON.stringify(Laboratorio.#leerConfiguracion("configuracionOtra"), null, 2) + "\n";
      Laboratorio.#descargar("relevancia.json", texto, "application/json");
    });
    this.#alPulsar("botonInforme", function () {
      Laboratorio.#descargar("informe_laboratorio.md", laboratorio.#informe(), "text/markdown");
    });
  }

  /** Hace algo al pulsar un botón, de uno en uno y avisando si falla. */
  #alPulsar(id, funcion) {
    const laboratorio = this;
    Laboratorio.#elemento(id).addEventListener("click", async function () {
      if (laboratorio.#ocupado) {
        return;
      }
      laboratorio.#ocupado = true;
      document.body.classList.add("laboratorio-ocupado");
      Laboratorio.#avisar("", false);
      try {
        await funcion();
      } catch (error) {
        Laboratorio.#avisar(error.message, true);
      }
      laboratorio.#ocupado = false;
      document.body.classList.remove("laboratorio-ocupado");
    });
  }

  static #mostrarPestana(nombre) {
    for (let i = 0; i < Laboratorio.PESTANAS.length; i++) {
      const esEsta = Laboratorio.PESTANAS[i] === nombre;
      Laboratorio.#elemento("pestana-" + Laboratorio.PESTANAS[i]).setAttribute("aria-selected", String(esEsta));
      Laboratorio.#elemento("panel-" + Laboratorio.PESTANAS[i]).hidden = !esEsta;
    }
  }

  // ───────────── Propiedades ─────────────

  #comprobarPropiedades() {
    const lista = this.#crearPropiedades("configuracionUna").comprobar();
    this.#propiedades = lista;
    const filas = [];
    for (let i = 0; i < lista.length; i++) {
      filas.push({ celdas: [Laboratorio.#marca(lista[i].ok), lista[i].clave, lista[i].nombre, lista[i].detalle],
        clase: Laboratorio.#claseDe(lista[i].ok) });
    }
    Laboratorio.#pintar("resultadoPropiedades", [Laboratorio.#tabla("Se cumplen " + Laboratorio.#cuantasOk(lista) + " de " +
      lista.length, ["", "", "Propiedad", "Detalle"], filas)]);
  }

  #comprobarRobustez() {
    const resultado = this.#crearPropiedades("configuracionUna").robustez();
    this.#robustez = resultado;
    const filas = [];
    for (let i = 0; i < resultado.fallos.length; i++) {
      const fallo = resultado.fallos[i];
      filas.push({ celdas: [fallo.clave, String(fallo.rho), String(fallo.delta), fallo.detalle], clase: "fila-mal" });
    }
    let titulo = "Robustez: " + resultado.combinaciones + " combinaciones de ρ (λ) y δ, " + filas.length + " fallos";
    if (filas.length === 0) {
      titulo = "Robustez: todas se cumplen en las " + resultado.combinaciones + " combinaciones de ρ (λ) y δ";
    }
    Laboratorio.#pintar("resultadoRobustez", [Laboratorio.#tabla(titulo, ["Propiedad", "ρ", "δ", "Detalle"], filas)]);
  }

  #crearPropiedades(idConfiguracion) {
    let deduplicar = true;
    if (this.#servidor !== null) {
      deduplicar = this.#servidor.deduplicarEventos;
    }
    return new PropiedadesRelevancia(Laboratorio.#leerConfiguracion(idConfiguracion), deduplicar);
  }

  // ───────────── Medir ─────────────

  async #medir() {
    const muestra = await this.#pedirMuestra();
    this.#medicion = await this.#crearMedidor().medir(muestra, Laboratorio.#leerConfiguracion("configuracionUna"),
      Laboratorio.#crearAvance("Midiendo", muestra.ids.length));
    Laboratorio.#avisar("", false);
    this.#pintarMedicion();
    this.#pintarTipos();
  }

  async #comprobarMonotonia() {
    const muestra = await this.#pedirMuestra();
    const ids = muestra.ids.slice(0, Laboratorio.CENTRALES_MONOTONIA);
    const prueba = new PruebaMonotonia(this.#crearMedidor(), this.#contexto, this.#jerarquia);
    this.#monotonia = await prueba.comprobar(ids, Laboratorio.#leerConfiguracion("configuracionUna"),
      Laboratorio.SEMILLA_MONOTONIA, Laboratorio.#crearAvance("Monotonía (dos veces)", ids.length));
    Laboratorio.#avisar("", false);
    const filas = [
      { celdas: ["activada"].concat(InformeLaboratorio.filaMonotonia(this.#monotonia.con)), clase: "" },
      { celdas: ["desactivada"].concat(InformeLaboratorio.filaMonotonia(this.#monotonia.sin)),
        clase: Laboratorio.#claseDe(this.#monotonia.sin.bajan === 0) }
    ];
    Laboratorio.#pintar("resultadoMonotonia", [Laboratorio.#tabla("Monotonía: ¿añadir una relación al azar baja a alguien?",
      ["Penalización por grado", "Centrales", "Valores de S comparados", "Bajan", "Mayor bajada"], filas)]);
  }

  #pintarMedicion() {
    const filas = [];
    for (let i = 0; i < this.#medicion.filas.length; i++) {
      const fila = this.#medicion.filas[i];
      filas.push({
        celdas: [fila.nombre, String(fila.total), String(fila.dentro), Estadistica.textoPorcentaje(fila.porcentaje),
          Estadistica.textoNumero(fila.mediana, 3), Estadistica.textoNumero(fila.maxima, 3), fila.esperado,
          Laboratorio.#marca(fila.ok)],
        clase: Laboratorio.#claseDe(fila.ok)
      });
    }
    Laboratorio.#pintar("resultadoMedir", [
      Laboratorio.#tabla("Quién entra", ["Medida", "Hay", "Entran", "%", "S mediana", "S máxima", "Esperado", ""], filas),
      this.#crearDesplegables(),
      Laboratorio.#tabla("Tamaño", ["", ""], Laboratorio.#filasSimples(this.#medicion.tamano)),
      Laboratorio.#tabla("Composición por clase", ["Clase", "% de lo dibujado"],
        Laboratorio.#filasPorcentaje(this.#medicion.clases)),
      Laboratorio.#tabla("Composición por origen", ["Origen", "% de lo dibujado"],
        Laboratorio.#filasPorcentaje(this.#medicion.origenes))
    ]);
  }

  /** Un desplegable por medida con las entidades que entran y por qué. */
  #crearDesplegables() {
    const seccion = crear("section", { clase: "laboratorio-tabla" }, [crear("h3", { texto: "Por qué entran" }, [])]);
    for (let i = 0; i < this.#medicion.filas.length; i++) {
      const fila = this.#medicion.filas[i];
      if (fila.entran.length > 0) {
        const desplegable = crear("details", { clase: "laboratorio-desplegable" },
          [crear("summary", { texto: fila.nombre + " (" + fila.entran.length + ")" }, [])]);
        // La tabla se crea al abrirlo: todas juntas serían miles de filas.
        desplegable.addEventListener("toggle", function () {
          if (desplegable.open && desplegable.childNodes.length === 1) {
            desplegable.appendChild(Laboratorio.#tablaEntran(fila));
          }
        });
        seccion.appendChild(desplegable);
      }
    }
    return seccion;
  }

  static #tablaEntran(fila) {
    const filas = [];
    for (let i = 0; i < fila.entran.length && i < Laboratorio.MAX_ENTRAN; i++) {
      filas.push({ celdas: InformeLaboratorio.celdasEntra(fila.entran[i]), clase: "" });
    }
    let titulo = "Todas, de más a menos S";
    if (fila.entran.length > filas.length) {
      titulo = "Las " + filas.length + " de más S, de " + fila.entran.length;
    }
    return Laboratorio.#tabla(titulo, InformeLaboratorio.COLUMNAS_ENTRAN, filas);
  }

  #pintarTipos() {
    const tablas = [];
    for (let i = 0; i < this.#medicion.tipos.length; i++) {
      const tabla = this.#medicion.tipos[i];
      const filas = [];
      for (let j = 0; j < tabla.filas.length; j++) {
        let clase = "";
        if (tabla.filas[j].aviso) {
          clase = "fila-aviso";
        }
        filas.push({ celdas: tabla.filas[j].celdas, clase: clase });
      }
      const elemento = Laboratorio.#tabla(tabla.titulo, tabla.columnas, filas);
      if (tabla.nota !== "") {
        elemento.insertBefore(crear("p", { clase: "laboratorio-nota", texto: tabla.nota }, []), elemento.childNodes[1]);
      }
      tablas.push(elemento);
    }
    Laboratorio.#pintar("resultadoTipos", tablas);
  }

  // ───────────── Comparar ─────────────

  async #comparar() {
    const una = Laboratorio.#leerConfiguracion("configuracionUna");
    const otra = Laboratorio.#leerConfiguracion("configuracionOtra");
    const muestra = await this.#pedirMuestra();
    const medidor = this.#crearMedidor();
    const deLaPrimera = { propiedades: this.#crearPropiedades("configuracionUna").comprobar(), medicion: null };
    const deLaSegunda = { propiedades: this.#crearPropiedades("configuracionOtra").comprobar(), medicion: null };
    deLaPrimera.medicion = await medidor.medir(muestra, una,
      Laboratorio.#crearAvance("Primera configuración", muestra.ids.length));
    deLaSegunda.medicion = await medidor.medir(muestra, otra,
      Laboratorio.#crearAvance("Segunda configuración", muestra.ids.length));
    Laboratorio.#avisar("", false);
    this.#comparacion = { otraConfiguracion: otra, deLaPrimera: deLaPrimera, deLaSegunda: deLaSegunda };
    const filas = [];
    const comparadas = InformeLaboratorio.filasComparacion(deLaPrimera, deLaSegunda);
    for (let i = 0; i < comparadas.length; i++) {
      let clase = "";
      if (comparadas[i].cambia) {
        clase = "fila-aviso";
      }
      filas.push({ celdas: comparadas[i].celdas, clase: clase });
    }
    Laboratorio.#pintar("resultadoComparar", [Laboratorio.#tabla("Las dos configuraciones sobre la misma muestra",
      ["", "Primera", "Segunda", "Diferencia"], filas)]);
  }

  // ───────────── Muestra e informe ─────────────

  #crearMedidor() {
    return new MedidorMuestra(this.#cliente, this.#contexto, this.#jerarquia, this.#servidor.umbralPorDefecto,
      this.#servidor.maxNodos);
  }

  /** Los ids de /api/muestra, con la n y la semilla de la página. */
  async #pedirMuestra() {
    if (this.#servidor === null) {
      throw new Error("No hay servidor: arráncalo y recarga la página.");
    }
    const n = parseInt(Laboratorio.#elemento("muestraN").value, 10);
    const semilla = parseInt(Laboratorio.#elemento("muestraSemilla").value, 10);
    const muestra = await this.#cliente.obtenerMuestra(n, semilla);
    this.#muestraUsada = { n: muestra.ids.length, creadores: muestra.creadores, entidades: muestra.entidades,
      semilla: semilla };
    this.#avisarDeLaMuestra(n);
    return muestra;
  }

  /**
   * Dice qué se está midiendo y avisa si la muestra no es comparable: con los
   * datos pequeños, o si no hay bastantes creadores y se ha completado con
   * obras y organizaciones como centrales (que bajan todas las medidas).
   */
  #avisarDeLaMuestra(pedidas) {
    const muestra = this.#muestraUsada;
    let texto = "Muestra: " + InformeLaboratorio.textoMuestra(muestra) + ".";
    let clase = "laboratorio-aviso";
    if (muestra.n < pedidas || muestra.creadores < muestra.n) {
      clase = "laboratorio-aviso laboratorio-atencion";
      texto = texto + " ATENCIÓN: no hay " + pedidas + " creadores, así que también se miden obras, organizaciones y otras " +
        "personas como centrales. No se puede comparar con una muestra solo de creadores.";
    }
    if (this.#servidor.origenDatos !== Laboratorio.ORIGEN_GRANDE && muestra.creadores < muestra.n) {
      texto = texto + " Los datos son «" + this.#servidor.origenDatos + "»: para medir con los grandes, arranca el servidor con " +
        "la variable VISOR_ORIGEN_DATOS=" + Laboratorio.ORIGEN_GRANDE + ".";
    }
    const aviso = Laboratorio.#elemento("avisoMuestra");
    aviso.textContent = texto;
    aviso.className = clase;
    aviso.hidden = false;
  }

  #informe() {
    let origenDatos = "sin servidor";
    let umbral = "–";
    if (this.#servidor !== null) {
      origenDatos = this.#servidor.origenDatos;
      umbral = this.#servidor.umbralPorDefecto;
    }
    let semilla = "–";
    if (this.#muestraUsada !== null) {
      semilla = this.#muestraUsada.semilla;
    }
    return InformeLaboratorio.crear({
      fecha: new Date().toLocaleString("es-ES"), origenDatos: origenDatos, muestra: this.#muestraUsada, semilla: semilla,
      umbral: umbral, configuracion: Laboratorio.#leerConfiguracion("configuracionUna"), propiedades: this.#propiedades,
      robustez: this.#robustez, medicion: this.#medicion, monotonia: this.#monotonia, comparacion: this.#comparacion
    });
  }

  // ───────────── Ayudas para pintar ─────────────

  static #elemento(id) {
    return document.getElementById(id);
  }

  static #leerConfiguracion(id) {
    try {
      return JSON.parse(Laboratorio.#elemento(id).value);
    } catch (error) {
      throw new Error("La configuración no es un JSON válido (" + error.message + ")");
    }
  }

  static #avisar(texto, esError) {
    const aviso = Laboratorio.#elemento("avisoLaboratorio");
    aviso.textContent = texto;
    aviso.hidden = texto === "";
    aviso.className = "laboratorio-aviso";
    if (esError) {
      aviso.className = "laboratorio-aviso laboratorio-error";
    }
  }

  /** La función que escribe cómo va, dejando que la página se repinte. */
  static #crearAvance(texto, total) {
    return async function (hechas) {
      Laboratorio.#avisar(texto + ": " + hechas + " de " + total, false);
      if (hechas % 5 === 0) {
        await new Promise(function (resolver) {
          setTimeout(resolver, 0);
        });
      }
    };
  }

  static #pintar(id, elementos) {
    const destino = Laboratorio.#elemento(id);
    destino.textContent = "";
    for (let i = 0; i < elementos.length; i++) {
      destino.appendChild(elementos[i]);
    }
  }

  /** Una sección con su título y una tabla: filas = [{ celdas, clase }]. */
  static #tabla(titulo, columnas, filas) {
    const cabeceras = [];
    for (let i = 0; i < columnas.length; i++) {
      cabeceras.push(crear("th", { scope: "col", texto: columnas[i] }, []));
    }
    const cuerpo = crear("tbody", {}, []);
    for (let i = 0; i < filas.length; i++) {
      const celdas = [];
      for (let j = 0; j < filas[i].celdas.length; j++) {
        celdas.push(crear("td", { texto: filas[i].celdas[j] }, []));
      }
      cuerpo.appendChild(crear("tr", { clase: filas[i].clase }, celdas));
    }
    const seccion = crear("section", { clase: "laboratorio-tabla" }, [crear("h3", { texto: titulo }, [])]);
    if (filas.length === 0) {
      seccion.appendChild(crear("p", { clase: "laboratorio-nota", texto: "Ninguno." }, []));
      return seccion;
    }
    seccion.appendChild(crear("div", { clase: "laboratorio-desplazable" },
      [crear("table", {}, [crear("thead", {}, [crear("tr", {}, cabeceras)]), cuerpo])]));
    return seccion;
  }

  static #filasSimples(pares) {
    const filas = [];
    for (let i = 0; i < pares.length; i++) {
      filas.push({ celdas: pares[i], clase: "" });
    }
    return filas;
  }

  static #filasPorcentaje(pares) {
    const filas = [];
    for (let i = 0; i < pares.length; i++) {
      filas.push({ celdas: [pares[i][0], Estadistica.textoPorcentaje(pares[i][1])], clase: "" });
    }
    return filas;
  }

  static #marca(ok) {
    if (ok === null) {
      return "";
    }
    if (ok) {
      return "✔";
    }
    return "✘";
  }

  static #claseDe(ok) {
    if (ok === null) {
      return "";
    }
    if (ok) {
      return "fila-bien";
    }
    return "fila-mal";
  }

  static #cuantasOk(lista) {
    let numero = 0;
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].ok) {
        numero = numero + 1;
      }
    }
    return numero;
  }

  /** Descarga un texto como archivo. */
  static #descargar(nombre, texto, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo + ";charset=utf-8" }));
    const enlace = crear("a", { href: url, download: nombre }, []);
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }
}
