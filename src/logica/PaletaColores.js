/**
 * PaletaColores
 *
 * Da un color distinto a cada tipo de relación. Como los tipos no se conocen
 * de antemano, no podemos tener una lista fija: generamos los colores
 * con una fórmula a partir de un número (el índice del tipo).
 *
 * Requisitos: RF-20 y RF-39.
 */
export class PaletaColores {
  /**
   * Ángulo áureo en grados. Si avanzamos el tono del color en este ángulo
   * cada vez, los colores quedan bien repartidos por el círculo cromático
   * y nunca se repite exactamente el mismo tono.
   */
  static ANGULO_AUREO = 137.508;

  /**
   * Color para un índice. Índices distintos dan colores distintos.
   *
   * @param {number} indice - número entero mayor o igual que 0.
   * @returns {string} color "#rrggbb".
   */
  static colorPara(indice) {
    if (!Number.isInteger(indice) || indice < 0) {
      throw new Error("El índice del color debe ser un número entero mayor o igual que 0.");
    }
    // Tono: avanzamos el ángulo áureo por cada índice y nos quedamos con
    // el resto de dividir entre 360 (una vuelta completa).
    const tono = (indice * PaletaColores.ANGULO_AUREO) % 360;
    // Luminosidad: la variamos en tres niveles para que dos tonos
    // parecidos se distingan también por lo claros u oscuros que son.
    const nivelDeLuminosidad = indice % 3;
    const luminosidad = 0.42 + nivelDeLuminosidad * 0.1;
    const saturacion = 0.7;
    return PaletaColores.#convertirHslAHexadecimal(tono, saturacion, luminosidad);
  }

  /**
   * Asigna un color a cada id, en el orden en que llegan.
   * Es determinista: la misma lista en el mismo orden da siempre los mismos colores.
   * Si un id aparece repetido, conserva el color de la primera vez.
   *
   * @param {string[]} idsTipos
   * @returns {Map<string, string>} id → color "#rrggbb".
   */
  static asignar(idsTipos) {
    const coloresPorId = new Map();
    let siguienteIndice = 0;
    for (let i = 0; i < idsTipos.length; i++) {
      const idTipo = idsTipos[i];
      if (!coloresPorId.has(idTipo)) {
        coloresPorId.set(idTipo, PaletaColores.colorPara(siguienteIndice));
        siguienteIndice = siguienteIndice + 1;
      }
    }
    return coloresPorId;
  }

  /**
   * (Privado) Convierte un color HSL (tono, saturación, luminosidad)
   * en el formato "#rrggbb". Es la fórmula estándar de conversión.
   *
   * @param {number} tono - de 0 a 360 grados.
   * @param {number} saturacion - de 0 a 1.
   * @param {number} luminosidad - de 0 a 1.
   * @returns {string}
   */
  static #convertirHslAHexadecimal(tono, saturacion, luminosidad) {
    // "croma": cuánto color puro hay.
    const croma = (1 - Math.abs(2 * luminosidad - 1)) * saturacion;
    const sector = tono / 60;
    const intermedio = croma * (1 - Math.abs((sector % 2) - 1));
    const ajuste = luminosidad - croma / 2;

    let rojo = 0;
    let verde = 0;
    let azul = 0;
    if (sector < 1) {
      rojo = croma;
      verde = intermedio;
    } else if (sector < 2) {
      rojo = intermedio;
      verde = croma;
    } else if (sector < 3) {
      verde = croma;
      azul = intermedio;
    } else if (sector < 4) {
      verde = intermedio;
      azul = croma;
    } else if (sector < 5) {
      rojo = intermedio;
      azul = croma;
    } else {
      rojo = croma;
      azul = intermedio;
    }

    const textoRojo = PaletaColores.#componenteAHexadecimal(rojo + ajuste);
    const textoVerde = PaletaColores.#componenteAHexadecimal(verde + ajuste);
    const textoAzul = PaletaColores.#componenteAHexadecimal(azul + ajuste);
    return "#" + textoRojo + textoVerde + textoAzul;
  }

  /**
   * (Privado) Convierte un componente entre 0 y 1 en dos cifras hexadecimales ("00" a "ff").
   *
   * @param {number} componente
   * @returns {string}
   */
  static #componenteAHexadecimal(componente) {
    const valorDe0a255 = Math.round(componente * 255);
    let texto = valorDe0a255.toString(16);
    if (texto.length < 2) {
      texto = "0" + texto;
    }
    return texto;
  }
}
