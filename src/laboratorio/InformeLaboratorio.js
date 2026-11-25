import { Estadistica } from './Estadistica.js';

/**
 * El informe en Markdown del laboratorio: la fecha, la fuente de datos, la
 * configuración usada y todas las tablas que haya (de lo que no se ha medido
 * no pone nada).
 */
export class InformeLaboratorio {
  // Cuántas de las entidades que entran en cada medida se escriben.
  static MAX_ENTRAN = 20;
  static COLUMNAS_ENTRAN = ["Central", "Entra", "Clase", "S", "R", "C", "Origen", "Padres", "Por qué"];

  /**
   * @param {Object} datos - { fecha, origenDatos, muestra: { n, creadores, entidades } o null, semilla, umbral,
   *   configuracion, propiedades, robustez, medicion, monotonia, comparacion: { otraConfiguracion, propiedades,
   *   medicion } } (null lo que falte).
   * @returns {string}
   */
  static crear(datos) {
    let textoMuestra = "sin medir";
    if (datos.muestra !== null) {
      textoMuestra = InformeLaboratorio.textoMuestra(datos.muestra) + ", semilla " + datos.semilla;
    }
    const partes = ["# Informe del laboratorio de relevancia", "", "- Fecha: " + datos.fecha,
      "- Datos: " + datos.origenDatos,
      "- Muestra: " + textoMuestra + ", umbral " + datos.umbral,
      "- Los valores de la configuración son una propuesta pendiente de validar.", ""];
    if (datos.propiedades !== null) {
      partes.push("## Propiedades", "", InformeLaboratorio.#tablaPropiedades(datos.propiedades), "");
    }
    if (datos.robustez !== null) {
      partes.push("## Robustez", "", "Combinaciones de ρ y δ: " + datos.robustez.combinaciones + ". Fallos: " +
        datos.robustez.fallos.length + ".", "");
      for (let i = 0; i < datos.robustez.fallos.length; i++) {
        const fallo = datos.robustez.fallos[i];
        partes.push("- " + fallo.clave + " con ρ = " + fallo.rho + " y δ = " + fallo.delta + ": " + fallo.detalle);
      }
      partes.push("");
    }
    if (datos.medicion !== null) {
      partes.push("## Medición", "", InformeLaboratorio.#medicion(datos.medicion), "");
      partes.push("### Por qué entran", "", InformeLaboratorio.#porQueEntran(datos.medicion), "");
    }
    if (datos.monotonia !== null) {
      partes.push("## Monotonía", "", InformeLaboratorio.#monotonia(datos.monotonia), "");
    }
    if (datos.comparacion !== null) {
      partes.push("## Comparación con la segunda configuración", "",
        InformeLaboratorio.#comparacion(datos.comparacion.deLaPrimera, datos.comparacion.deLaSegunda), "",
        "Segunda configuración:", "", "```json", JSON.stringify(datos.comparacion.otraConfiguracion, null, 2), "```", "");
    }
    if (datos.medicion !== null) {
      partes.push("## Tipos y datos", "");
      for (let i = 0; i < datos.medicion.tipos.length; i++) {
        partes.push(InformeLaboratorio.#tablaTipos(datos.medicion.tipos[i]), "");
      }
    }
    partes.push("## Configuración", "", "```json", JSON.stringify(datos.configuracion, null, 2), "```", "");
    return partes.join("\n");
  }

  /**
   * «325 entidades (325 creadores) de las 25643 que hay».
   *
   * @param {Object} muestra - { n, creadores, entidades }
   */
  static textoMuestra(muestra) {
    return muestra.n + " entidades (" + muestra.creadores + " creadores) de las " + muestra.entidades + " que hay";
  }

  /** Las celdas de una entidad que entra (MedidasRelevancia), para COLUMNAS_ENTRAN. */
  static celdasEntra(ficha) {
    return [ficha.central, ficha.id, ficha.clase, Estadistica.textoNumero(ficha.s, 3), Estadistica.textoNumero(ficha.r, 3),
      Estadistica.textoNumero(ficha.c, 3), ficha.origen, ficha.padres, ficha.explicacion];
  }

  /** Una tabla Markdown. */
  static tabla(columnas, filas) {
    const lineas = ["| " + columnas.join(" | ") + " |"];
    let separador = "|";
    for (let i = 0; i < columnas.length; i++) {
      separador = separador + "---|";
    }
    lineas.push(separador);
    for (let i = 0; i < filas.length; i++) {
      const celdas = [];
      for (let j = 0; j < filas[i].length; j++) {
        // Una barra dentro de una celda partiría la tabla.
        celdas.push(String(filas[i][j]).split("|").join("\\|"));
      }
      lineas.push("| " + celdas.join(" | ") + " |");
    }
    return lineas.join("\n");
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

  static #tablaPropiedades(lista) {
    const filas = [];
    for (let i = 0; i < lista.length; i++) {
      filas.push([InformeLaboratorio.#marca(lista[i].ok), lista[i].clave, lista[i].nombre, lista[i].detalle]);
    }
    return InformeLaboratorio.tabla(["", "", "Propiedad", "Detalle"], filas);
  }

  static #medicion(medicion) {
    const filas = [];
    for (let i = 0; i < medicion.filas.length; i++) {
      const fila = medicion.filas[i];
      filas.push([fila.nombre, fila.total, fila.dentro, Estadistica.textoPorcentaje(fila.porcentaje),
        Estadistica.textoNumero(fila.mediana, 3), Estadistica.textoNumero(fila.maxima, 3), fila.esperado,
        InformeLaboratorio.#marca(fila.ok)]);
    }
    const partes = [InformeLaboratorio.tabla(["Medida", "Hay", "Entran", "%", "S mediana", "S máxima", "Esperado", ""], filas),
      "", InformeLaboratorio.tabla(["Tamaño", ""], medicion.tamano), "",
      InformeLaboratorio.tabla(["Clase", "% de lo dibujado"], InformeLaboratorio.#enPorcentaje(medicion.clases)), "",
      InformeLaboratorio.tabla(["Origen", "% de lo dibujado"], InformeLaboratorio.#enPorcentaje(medicion.origenes))];
    return partes.join("\n");
  }

  /** Las entidades de más S que entran en cada medida, con sus padres y su explicación. */
  static #porQueEntran(medicion) {
    const partes = [];
    for (let i = 0; i < medicion.filas.length; i++) {
      const fila = medicion.filas[i];
      if (fila.entran.length > 0) {
        let titulo = "#### " + fila.nombre + " (" + fila.entran.length + ")";
        if (fila.entran.length > InformeLaboratorio.MAX_ENTRAN) {
          titulo = titulo + ": las " + InformeLaboratorio.MAX_ENTRAN + " de más S";
        }
        const celdas = [];
        for (let j = 0; j < fila.entran.length && j < InformeLaboratorio.MAX_ENTRAN; j++) {
          celdas.push(InformeLaboratorio.celdasEntra(fila.entran[j]));
        }
        partes.push(titulo, "", InformeLaboratorio.tabla(InformeLaboratorio.COLUMNAS_ENTRAN, celdas), "");
      }
    }
    return partes.join("\n");
  }

  static #enPorcentaje(filas) {
    const resultado = [];
    for (let i = 0; i < filas.length; i++) {
      resultado.push([filas[i][0], Estadistica.textoPorcentaje(filas[i][1])]);
    }
    return resultado;
  }

  static #monotonia(monotonia) {
    return InformeLaboratorio.tabla(["Penalización por grado", "Centrales", "Valores de S comparados", "Bajan",
      "Mayor bajada"], [["activada"].concat(InformeLaboratorio.filaMonotonia(monotonia.con)),
      ["desactivada"].concat(InformeLaboratorio.filaMonotonia(monotonia.sin))]);
  }

  /** Las celdas de un resultado de PruebaMonotonia. */
  static filaMonotonia(resultado) {
    return [String(resultado.probadas), String(resultado.comparados), String(resultado.bajan),
      Estadistica.textoNumero(resultado.mayorBajada, 4)];
  }

  /**
   * Las filas de la comparación: cada propiedad y cada medida con las dos
   * configuraciones.
   *
   * @param {Object} una - { propiedades, medicion }
   * @param {Object} otra - { propiedades, medicion }
   * @returns {Object[]} [{ celdas: [nombre, primera, segunda, diferencia], cambia }]
   */
  static filasComparacion(una, otra) {
    const filas = [];
    for (let i = 0; i < una.propiedades.length; i++) {
      const a = una.propiedades[i];
      const b = otra.propiedades[i];
      let diferencia = "";
      if (a.ok !== b.ok) {
        diferencia = "cambia";
      }
      filas.push({ celdas: [a.clave + " " + a.nombre, InformeLaboratorio.#marca(a.ok) + " " + a.detalle,
        InformeLaboratorio.#marca(b.ok) + " " + b.detalle, diferencia], cambia: a.ok !== b.ok });
    }
    for (let i = 0; i < una.medicion.filas.length; i++) {
      const a = una.medicion.filas[i];
      const b = otra.medicion.filas[i];
      let diferencia = "";
      let cambia = false;
      if (a.porcentaje !== null && b.porcentaje !== null && Math.abs(b.porcentaje - a.porcentaje) >= 0.05) {
        diferencia = Estadistica.textoNumero(b.porcentaje - a.porcentaje, 1) + " puntos";
        if (b.porcentaje > a.porcentaje) {
          diferencia = "+" + diferencia;
        }
        cambia = true;
      }
      filas.push({ celdas: [a.nombre, InformeLaboratorio.#textoMedida(a), InformeLaboratorio.#textoMedida(b), diferencia],
        cambia: cambia });
    }
    for (let i = 0; i < una.medicion.tamano.length; i++) {
      const a = una.medicion.tamano[i];
      const b = otra.medicion.tamano[i];
      // Los tiempos siempre varían un poco: no se resaltan.
      const cambia = a[1] !== b[1] && !a[0].startsWith("Tiempo");
      let diferencia = "";
      if (cambia) {
        diferencia = "cambia";
      }
      filas.push({ celdas: [a[0], a[1], b[1], diferencia], cambia: cambia });
    }
    return filas;
  }

  static #textoMedida(fila) {
    return Estadistica.textoPorcentaje(fila.porcentaje) + " (S mediana " + Estadistica.textoNumero(fila.mediana, 3) + ") " +
      InformeLaboratorio.#marca(fila.ok);
  }

  static #comparacion(una, otra) {
    const filas = InformeLaboratorio.filasComparacion(una, otra);
    const celdas = [];
    for (let i = 0; i < filas.length; i++) {
      celdas.push(filas[i].celdas);
    }
    return InformeLaboratorio.tabla(["", "Primera", "Segunda", "Diferencia"], celdas);
  }

  static #tablaTipos(tabla) {
    const filas = [];
    for (let i = 0; i < tabla.filas.length; i++) {
      let aviso = "";
      if (tabla.filas[i].aviso) {
        aviso = "⚠";
      }
      filas.push(tabla.filas[i].celdas.concat([aviso]));
    }
    return "### " + tabla.titulo + "\n\n" + tabla.nota + "\n\n" +
      InformeLaboratorio.tabla(tabla.columnas.concat([""]), filas);
  }
}
