import { TipoEntidad } from '../modelo/TipoEntidad.js';
import { RelevanciaNodosTresCapas } from '../logica/RelevanciaNodosTresCapas.js';
import { NormalizadorRoles } from '../logica/NormalizadorRoles.js';
import { Estadistica } from './Estadistica.js';

/**
 * Lo que enseña la pestaña «Tipos y datos»: qué tipos, roles, vías, etiquetas y
 * eventos hay de verdad en los datos y cuáles no están previstos en
 * public/relevancia.json. Sirve cuando se añaden tipos o la base de datos no
 * es como se esperaba.
 *
 * Se llena durante la medición: anotarCamino con cada central (los pares de
 * tipos por los que se propaga) y anotarCache con cada caché de relaciones.
 */
export class AnalizadorTipos {
  static #FECHA_CON_DIA = /^\d{4}-\d{2}-\d{2}$/;
  static #SIN_ROL = "(sin rol)";

  #piezas;
  #configuracion;
  #jerarquia;
  #etiquetasEntidad;
  #relacionesVistas;
  #entidadesVistas;
  #tipos;
  // id del tipo → Map rol (limpio) → veces.
  #rolesDesconocidos;
  // Los tipos (de pesosPorRol y de las claves con rol de la tabla T) en los que el rol cambia algo.
  #tiposConRol;
  #vias;
  #eventos;
  #noDibujables;
  #etiquetas;
  #paresPorDefecto;
  #paresTemporales;

  /**
   * @param {Object} piezas - las de FabricaRelevancia.
   * @param {Object} configuracion - la de public/relevancia.json.
   * @param {Object} jerarquia - etiqueta → padres.
   * @param {Object} etiquetasEntidad - etiqueta → TipoEntidad.
   */
  constructor(piezas, configuracion, jerarquia, etiquetasEntidad) {
    this.#piezas = piezas;
    this.#configuracion = configuracion;
    this.#jerarquia = jerarquia;
    this.#etiquetasEntidad = etiquetasEntidad;
    this.#relacionesVistas = new Set();
    this.#entidadesVistas = new Set();
    this.#tipos = new Map();
    this.#rolesDesconocidos = new Map();
    this.#tiposConRol = AnalizadorTipos.#leerTiposConRol(configuracion);
    this.#vias = new Map();
    this.#eventos = new Map();
    this.#noDibujables = new Map();
    this.#etiquetas = new Map();
    this.#paresPorDefecto = new Map();
    this.#paresTemporales = new Map();
  }

  /**
   * Los pares de tipos (primer tramo > segundo tramo) por los que la central
   * recibe algo: cuáles caen en transferenciaPorDefecto y cuánta fuerza mueven
   * en total, y en cuáles de paresTemporales falta alguna fecha.
   */
  anotarCamino(central, cache) {
    if (!(this.#piezas.estrategia instanceof RelevanciaNodosTresCapas)) {
      return;
    }
    const preparado = this.#piezas.estrategia.preparar(central, cache);
    const deLaCentral = preparado.evidencias.get(central.getId());
    for (let i = 0; i < preparado.directos.length; i++) {
      const directo = preparado.directos[i];
      const primerTramo = deLaCentral.get(directo.getId());
      for (const [id, segundoTramo] of preparado.evidencias.get(directo.getId())) {
        if (id !== central.getId()) {
          this.#anotarPar(primerTramo, segundoTramo);
        }
      }
    }
  }

  #anotarPar(primerTramo, segundoTramo) {
    const tabla = this.#piezas.tabla;
    const tipo2 = segundoTramo.getTipoPrincipal();
    // Lo común a todos los tipos del primer tramo: fE(Y) · F(Y,X) · fE(X) · h(Y).
    const resto = tabla.getFactorEntidad(segundoTramo.getDesde()) * segundoTramo.getFuerza() *
      tabla.getFactorEntidad(segundoTramo.getHacia()) *
      this.#piezas.penalizacion.getFactor(segundoTramo.getDesde(), tipo2);
    const tipos = primerTramo.getTipos();
    for (let i = 0; i < tipos.length; i++) {
      const transferencia = tabla.buscarT(tipos[i].tipo, tipos[i].rol, tipo2);
      if (transferencia.clave === null) {
        let clave = tipos[i].tipo.getId();
        if (tipos[i].rol !== null) {
          clave = clave + ":" + tipos[i].rol;
        }
        clave = clave + ">" + tipo2.getId();
        const mueve = tipos[i].fuerza * transferencia.valor * this.#piezas.temporal.getFactor(tipos[i], segundoTramo) * resto;
        if (!this.#paresPorDefecto.has(clave)) {
          this.#paresPorDefecto.set(clave, { veces: 0, mueve: 0 });
        }
        const par = this.#paresPorDefecto.get(clave);
        par.veces = par.veces + 1;
        par.mueve = par.mueve + mueve;
      }
      const temporal = this.#piezas.temporal.buscarPar(tipos[i].tipo, tipo2);
      if (temporal !== null) {
        this.#anotarParTemporal(temporal.clave, tipos[i].periodos, segundoTramo.getPeriodoPrincipal());
      }
    }
  }

  /** Falta alguna fecha si no la tiene el segundo tramo o ninguna prueba del primero. */
  #anotarParTemporal(clave, periodosPrimero, periodoSegundo) {
    let primeroConFecha = false;
    for (let i = 0; i < periodosPrimero.length; i++) {
      if (periodosPrimero[i] !== null) {
        primeroConFecha = true;
      }
    }
    if (!this.#paresTemporales.has(clave)) {
      this.#paresTemporales.set(clave, { veces: 0, sinFecha: 0 });
    }
    const par = this.#paresTemporales.get(clave);
    par.veces = par.veces + 1;
    if (!primeroConFecha || periodoSegundo === null) {
      par.sinFecha = par.sinFecha + 1;
    }
  }

  /**
   * Las relaciones y entidades de una caché (las que ya se han visto en otra
   * no se repiten).
   */
  anotarCache(cache) {
    const relaciones = cache.todasLasRelaciones();
    for (let i = 0; i < relaciones.length; i++) {
      const relacion = relaciones[i];
      if (!this.#relacionesVistas.has(relacion.getId())) {
        this.#relacionesVistas.add(relacion.getId());
        this.#anotarRelacion(relacion);
      }
    }
  }

  #anotarRelacion(relacion) {
    const idTipo = relacion.getTipo().getId();
    if (!this.#tipos.has(idTipo)) {
      this.#tipos.set(idTipo, { tipo: relacion.getTipo(), veces: 0 });
    }
    this.#tipos.get(idTipo).veces = this.#tipos.get(idTipo).veces + 1;
    const extremos = [relacion.getOrigen(), relacion.getDestino()];
    for (let i = 0; i < extremos.length; i++) {
      this.#anotarRol(relacion, extremos[i]);
      let via = relacion.getVia(extremos[i]);
      if (via === "") {
        via = "(directa, sin intermediario)";
      }
      Estadistica.contar(this.#vias, via);
      this.#anotarEntidad(extremos[i]);
    }
    if (!relacion.esDibujable()) {
      this.#noDibujables.set(relacion.getIdIntermedio(), idTipo);
    }
    this.#anotarEvento(relacion);
  }

  /**
   * Los roles que no se reconocen, por tipo de relación (en minúsculas y sin
   * «/a»). En los tipos en los que el rol cambia algo se apunta también el
   * que falta («(sin rol)»): una mentoría sin roles pierde la asimetría.
   */
  #anotarRol(relacion, entidad) {
    if (this.#piezas.calculador.getNormalizador().rolDe(relacion, entidad) !== null) {
      return;
    }
    let rol = NormalizadorRoles.limpiar(relacion.getRol(entidad));
    if (rol === "") {
      // El lugar donde ocurrió (el taller de una mentoría) no tiene por qué tener rol.
      const esElLugar = this.#piezas.compuesta.getReparto().esElLugar(relacion, entidad);
      if (esElLugar || !this.#importaElRol(relacion.getTipo())) {
        return;
      }
      rol = AnalizadorTipos.#SIN_ROL;
    }
    const idTipo = relacion.getTipo().getId();
    if (!this.#rolesDesconocidos.has(idTipo)) {
      this.#rolesDesconocidos.set(idTipo, new Map());
    }
    Estadistica.contar(this.#rolesDesconocidos.get(idTipo), rol);
  }

  /** ¿Hay pesos por rol o claves con rol en la tabla T para ese tipo (o sus padres o equivalente)? */
  #importaElRol(tipo) {
    const ids = this.#piezas.equivalencias.getIds(tipo);
    for (let i = 0; i < ids.length; i++) {
      if (this.#tiposConRol.has(ids[i])) {
        return true;
      }
    }
    return false;
  }

  /** De «Mentorship.maestro» (pesosPorRol) y «Mentorship:maestro>Creation» (tabla T), «Mentorship». */
  static #leerTiposConRol(configuracion) {
    const tipos = new Set();
    if (configuracion.pesosPorRol !== undefined && configuracion.pesosPorRol !== null) {
      for (const clave of Object.keys(configuracion.pesosPorRol)) {
        tipos.add(clave.split(".")[0]);
      }
    }
    if (configuracion.tablaTransferencia !== undefined && configuracion.tablaTransferencia !== null) {
      for (const clave of Object.keys(configuracion.tablaTransferencia)) {
        const primerTipo = clave.split(">")[0];
        if (primerTipo.includes(":")) {
          tipos.add(primerTipo.split(":")[0]);
        }
      }
    }
    return tipos;
  }

  #anotarEntidad(entidad) {
    if (this.#entidadesVistas.has(entidad.getId())) {
      return;
    }
    this.#entidadesVistas.add(entidad.getId());
    const etiquetas = entidad.getEtiquetas();
    for (let i = 0; i < etiquetas.length; i++) {
      Estadistica.contar(this.#etiquetas, etiquetas[i]);
    }
  }

  #anotarEvento(relacion) {
    const reparto = this.#piezas.compuesta.getReparto();
    if (!reparto.esTipoDeCoincidencia(relacion.getTipo())) {
      return;
    }
    const id = relacion.getIdIntermedio();
    if (!this.#eventos.has(id)) {
      const fecha = relacion.getFecha();
      this.#eventos.set(id, {
        tipo: relacion.getTipo().getId(),
        personas: relacion.getParticipantesDeClase(TipoEntidad.PERSONA),
        conLugar: false,
        conDia: fecha !== null && AnalizadorTipos.#FECHA_CON_DIA.test(fecha),
        registros: relacion.getIdsIntermediarios().length
      });
    }
    if (reparto.uneConElLugar(relacion)) {
      this.#eventos.get(id).conLugar = true;
    }
  }

  /**
   * @param {Object} muestra - de /api/muestra: { intermediariosIgnorados: tipo → los
   *   que el servidor ignora por pasar de maxParticipantesEvidencia, eventosJuntados:
   *   tipo → los que tienen varios registros en toda la base de datos }.
   * @returns {Object[]} tablas para enseñar: [{ titulo, nota, columnas, filas: [{ celdas, aviso }] }]
   */
  resumen(muestra) {
    return [
      this.#tablaTipos(),
      this.#tablaRoles(),
      this.#tablaParesPorDefecto(),
      this.#tablaParesTemporales(),
      this.#tablaContador("Relaciones «via»", "Qué relación de la base de datos une cada extremo con su intermediario. " +
        "Las de relacionesLugar (" + this.#relacionesLugar() + ") marcan el lugar del evento.", "Relación", this.#vias),
      this.#tablaIntermediarios(AnalizadorTipos.#objeto(muestra.intermediariosIgnorados)),
      this.#tablaEventos(AnalizadorTipos.#objeto(muestra.eventosJuntados)),
      this.#tablaEtiquetas()
    ];
  }

  #relacionesLugar() {
    if (Array.isArray(this.#configuracion.relacionesLugar)) {
      return this.#configuracion.relacionesLugar.join(", ");
    }
    return "ninguna";
  }

  #tablaTipos() {
    const filas = [];
    for (const [id, datos] of this.#tipos) {
      const peso = this.#piezas.compuesta.buscarPeso(datos.tipo, null);
      let deDonde = "exacto";
      const equivalente = this.#piezas.equivalencias.getEquivalente(datos.tipo);
      if (peso.clave === null) {
        deDonde = "por defecto";
      } else if (peso.clave !== id && equivalente !== null) {
        deDonde = "equivalente a " + equivalente;
      } else if (peso.clave !== id) {
        deDonde = "heredado de " + peso.clave;
      }
      filas.push({ orden: datos.veces, celdas: [id, String(datos.veces), Estadistica.textoNumero(peso.valor, 2), deDonde],
        aviso: peso.clave === null });
    }
    return AnalizadorTipos.#tabla("Tipos de relación", "Los resaltados reciben pesoPorDefecto: habría que darles un " +
      "peso en pesosRelevancia.", ["Tipo", "Relaciones", "Peso", "De dónde sale"], filas);
  }

  /** Por tipo de relación; primero los tipos en los que el rol cambia algo (los resaltados). */
  #tablaRoles() {
    const filas = [];
    for (const [idTipo, roles] of this.#rolesDesconocidos) {
      const tipo = this.#tipos.get(idTipo).tipo;
      const importa = this.#importaElRol(tipo);
      const textos = [];
      let total = 0;
      const ordenados = Array.from(roles.entries());
      ordenados.sort(AnalizadorTipos.#compararRoles);
      for (let i = 0; i < ordenados.length; i++) {
        textos.push(ordenados[i][0] + " (" + ordenados[i][1] + ")");
        total = total + ordenados[i][1];
      }
      let textoImporta = "no";
      let orden = total;
      if (importa) {
        textoImporta = "SÍ";
        orden = Number.MAX_SAFE_INTEGER;
      }
      filas.push({ orden: orden, celdas: [idTipo, textos.join(", "), textoImporta], aviso: importa });
    }
    const conRol = Array.from(this.#tiposConRol).join(", ");
    return AnalizadorTipos.#tabla("Roles sin equivalencia", "Por tipo de relación, sin distinguir mayúsculas ni «/a». Solo " +
      "importan en los tipos con pesos por rol o con claves con rol en la tabla T (" + conRol + ") y en los que heredan de " +
      "ellos o les equivalen: los resaltados se añaden a rolesEquivalentes. Los demás no cambian nada.",
    ["Tipo de relación", "Roles (veces)", "Importa"], filas);
  }

  #tablaParesPorDefecto() {
    const filas = [];
    for (const [clave, par] of this.#paresPorDefecto) {
      filas.push({ orden: par.mueve, celdas: [clave, String(par.veces), Estadistica.textoNumero(par.mueve, 1)], aviso: false });
    }
    return AnalizadorTipos.#tabla("Pares de tipos con transferenciaPorDefecto", "Primer tramo > segundo tramo, de más " +
      "a menos relevancia movida en total (suma de sus aportaciones). Los primeros son los que habría que añadir a " +
      "tablaTransferencia.", ["Par", "Caminos", "Fuerza que mueven"], filas);
  }

  #tablaParesTemporales() {
    const filas = [];
    for (const [clave, par] of this.#paresTemporales) {
      filas.push({ orden: par.veces, celdas: [clave, String(par.veces),
        Estadistica.textoPorcentaje(Estadistica.porcentaje(par.sinFecha, par.veces))], aviso: false });
    }
    return AnalizadorTipos.#tabla("Pares temporales", "En qué parte de sus caminos falta alguna fecha (y se usa " +
      "transferenciaSinFecha).", ["Par", "Caminos", "Sin alguna fecha"], filas);
  }

  #tablaIntermediarios(ignorados) {
    const filas = [];
    for (const tipo of Object.keys(ignorados)) {
      filas.push({ orden: ignorados[tipo], celdas: [tipo, "ignorados (más de maxParticipantesEvidencia, en toda la base " +
        "de datos)", String(ignorados[tipo])], aviso: true });
    }
    const porTipo = new Map();
    for (const tipo of this.#noDibujables.values()) {
      Estadistica.contar(porTipo, tipo);
    }
    for (const [tipo, numero] of porTipo) {
      filas.push({ orden: numero, celdas: [tipo, "no dibujables (más de maxParticipantesIntermediario, en lo cargado)",
        String(numero)], aviso: false });
    }
    return AnalizadorTipos.#tabla("Intermediarios grandes", "", ["Tipo", "Qué pasa con ellos", "Cuántos"], filas);
  }

  #tablaEventos(juntadosEnTodaLaBase) {
    const porTipo = new Map();
    for (const evento of this.#eventos.values()) {
      if (!porTipo.has(evento.tipo)) {
        porTipo.set(evento.tipo, { personas: [], enElTope: 0, bajan: 0, sinLugar: 0, sinDia: 0, juntados: 0 });
      }
      const datos = porTipo.get(evento.tipo);
      datos.personas.push(evento.personas);
      const reparto = this.#piezas.compuesta.getReparto();
      if (reparto.getTope() !== null && reparto.getFactorDeNumero(evento.personas) >= reparto.getTope()) {
        datos.enElTope = datos.enElTope + 1;
      } else {
        datos.bajan = datos.bajan + 1;
      }
      if (!evento.conLugar) {
        datos.sinLugar = datos.sinLugar + 1;
      }
      if (!evento.conDia) {
        datos.sinDia = datos.sinDia + 1;
      }
      if (evento.registros > 1) {
        datos.juntados = datos.juntados + 1;
      }
    }
    const filas = [];
    for (const [tipo, datos] of porTipo) {
      filas.push({ orden: datos.personas.length, celdas: [tipo, String(datos.personas.length),
        Estadistica.minimo(datos.personas) + " / " + Estadistica.mediana(datos.personas) + " / " +
        Estadistica.maximo(datos.personas), String(datos.enElTope), String(datos.bajan), String(datos.sinLugar),
      String(datos.sinDia), String(datos.juntados), String(AnalizadorTipos.#numero(juntadosEnTodaLaBase[tipo]))],
      aviso: false });
    }
    return AnalizadorTipos.#tabla("Eventos", "Por cada tipo de tiposCoincidencia, en lo cargado. «En el tope»: sus " +
      "coincidencias entre personas valen topeCoincidencia; «bajan»: tienen tantas personas registradas que valen menos. " +
      "«Juntados»: los que el servidor ha unido por estar registrados varias veces.",
    ["Tipo", "Eventos", "Personas registradas (mín / mediana / máx)", "En el tope", "Bajan", "Sin lugar", "Sin día",
      "Juntados", "Juntados en toda la BD"], filas);
  }

  #tablaEtiquetas() {
    const filas = [];
    for (const [etiqueta, veces] of this.#etiquetas) {
      const conClase = this.#tieneClase(etiqueta);
      const conFactor = this.#piezas.tabla.tieneFactor(etiqueta);
      let textoClase = "sí";
      if (!conClase) {
        textoClase = "NO";
      }
      let textoFactor = "sí";
      if (!conFactor) {
        textoFactor = "NO (se usa 1)";
      }
      filas.push({ orden: veces, celdas: [etiqueta, String(veces), textoClase, textoFactor], aviso: !conClase || !conFactor });
    }
    return AnalizadorTipos.#tabla("Etiquetas de entidad", "Con clase: la etiqueta o un padre suyo está en " +
      "etiquetasEntidad. Con factor: está en factorEntidad.", ["Etiqueta", "Entidades", "Con clase", "Con factor"], filas);
  }

  #tieneClase(etiqueta) {
    const candidatas = [etiqueta];
    if (Array.isArray(this.#jerarquia[etiqueta])) {
      for (let i = 0; i < this.#jerarquia[etiqueta].length; i++) {
        candidatas.push(this.#jerarquia[etiqueta][i]);
      }
    }
    for (let i = 0; i < candidatas.length; i++) {
      if (Object.prototype.hasOwnProperty.call(this.#etiquetasEntidad, candidatas[i])) {
        return true;
      }
    }
    return false;
  }

  #tablaContador(titulo, nota, columna, mapa) {
    const filas = [];
    for (const [clave, veces] of mapa) {
      filas.push({ orden: veces, celdas: [clave, String(veces)], aviso: false });
    }
    return AnalizadorTipos.#tabla(titulo, nota, [columna, "Veces"], filas);
  }

  /** Para ordenar [rol, veces]: de más a menos veces y, a igualdad, por el nombre. */
  static #compararRoles(a, b) {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    if (a[0] < b[0]) {
      return -1;
    }
    return 1;
  }

  static #objeto(valor) {
    if (valor === undefined || valor === null) {
      return {};
    }
    return valor;
  }

  static #numero(valor) {
    if (typeof valor === "number") {
      return valor;
    }
    return 0;
  }

  /** La tabla con las filas de mayor a menor «orden». */
  static #tabla(titulo, nota, columnas, filas) {
    filas.sort(function (a, b) {
      return b.orden - a.orden;
    });
    return { titulo: titulo, nota: nota, columnas: columnas, filas: filas };
  }
}
