/**
 * Buscador
 *
 * Busca entidades por su nombre en el índice de nombres que la página
 * descarga UNA vez al arrancar (GET /api/nombres). Como todo está en
 * memoria, las sugerencias salen al instante, sin preguntar al servidor
 * cada vez que se escribe una letra.
 *
 * Es tolerante:
 *  - a mayúsculas, tildes y diéresis ("jose" encuentra "José"), y
 *  - a erratas de hasta distanciaMaxima letras ("picaso" encuentra
 *    "Pablo Picasso").
 *
 * Desde el incremento 3b cada entidad puede tener VARIOS nombres (en
 * castellano, valenciano e inglés; nombre y apellidos por separado): se
 * busca en todos, así «Museu» y «Museo» encuentran la misma organización.
 * Las sugerencias muestran el nombre en el idioma configurado.
 *
 * Requisitos: RF-01 (buscar por nombre), RF-02 (sugerencias mientras se
 * escribe), RF-03 (filtro por tipo), RF-04 (sin distinguir mayúsculas ni
 * tildes), RF-05 (tolerante a erratas), RF-06 (sin resultados), RNF-03
 * (sugerencias rápidas), RNF-13 (entrada acotada a 100 caracteres).
 */
export class Buscador {
  static LONGITUD_MAXIMA_TEXTO = 100;

  #indice;
  #longitudMinima;
  #maxSugerencias;
  #maxResultados;
  #distanciaMaxima;

  /**
   * @param {Object[]} nombres - [{ id, nombre, tipo, nombresAlternativos }]:
   *   nombre es el que se muestra; nombresAlternativos (opcional), los demás
   *   en los que también se busca. Los prepara Aplicacion a partir de /api/nombres.
   */
  constructor(nombres) {
    if (!Array.isArray(nombres)) {
      throw new Error("El buscador necesita la lista de nombres.");
    }
    this.#longitudMinima = 2;
    this.#maxSugerencias = 8;
    this.#maxResultados = 50;
    this.#distanciaMaxima = 2;

    // Los nombres se normalizan UNA sola vez, aquí, y no en cada búsqueda:
    // así cada búsqueda solo tiene que normalizar el texto escrito.
    this.#indice = [];
    for (let i = 0; i < nombres.length; i++) {
      const entrada = nombres[i];
      const normalizados = [this.#normalizar(entrada.nombre)];
      if (Array.isArray(entrada.nombresAlternativos)) {
        for (let j = 0; j < entrada.nombresAlternativos.length; j++) {
          const alternativo = this.#normalizar(entrada.nombresAlternativos[j]);
          if (alternativo !== "" && !normalizados.includes(alternativo)) {
            normalizados.push(alternativo);
          }
        }
      }
      this.#indice.push({
        id: entrada.id,
        nombre: entrada.nombre,
        tipo: entrada.tipo,
        nombreNormalizado: normalizados[0],
        normalizados: normalizados
      });
    }
  }

  /**
   * Resultados de una búsqueda completa (hasta maxResultados).
   *
   * @param {string} texto - lo que ha escrito el usuario.
   * @param {string} tipo - un valor de TipoEntidad, o "" para todos.
   * @returns {Object[]} [{ id, nombre, tipo }], los que mejor coinciden primero.
   */
  buscar(texto, tipo) {
    return this.#consultar(texto, tipo, this.#maxResultados);
  }

  /**
   * Sugerencias mientras se escribe (hasta maxSugerencias).
   *
   * @param {string} texto
   * @param {string} tipo - un valor de TipoEntidad, o "" para todos.
   * @returns {Object[]} [{ id, nombre, tipo }]
   */
  sugerir(texto, tipo) {
    return this.#consultar(texto, tipo, this.#maxSugerencias);
  }

  /**
   * Distancia de edición (de Levenshtein) entre dos textos: el número
   * mínimo de letras que hay que cambiar, añadir o quitar para pasar de uno
   * a otro. "casa" → "caza" es 1 (cambiar la s por la z).
   *
   * Es pública para poder probarla.
   *
   * Se calcula con una tabla. La celda tabla[i][j] guarda la distancia
   * entre las i primeras letras de a y las j primeras letras de b:
   *  - La fila 0 y la columna 0 son fáciles: pasar de "" a j letras cuesta
   *    j (añadirlas todas), y pasar de i letras a "" cuesta i (quitarlas).
   *  - Para las demás se mira la última letra de cada trozo:
   *      · si son iguales, no hay que hacer nada con ella:
   *        cuesta lo mismo que tabla[i-1][j-1];
   *      · si no, hay tres opciones, y nos quedamos con la más barata:
   *        cambiarla  → tabla[i-1][j-1] + 1
   *        quitarla   → tabla[i-1][j]   + 1
   *        añadir una → tabla[i][j-1]   + 1
   *  - La respuesta es la última celda: tabla[a.length][b.length].
   *
   * @param {string} a
   * @param {string} b
   * @returns {number}
   */
  distanciaEdicion(a, b) {
    const tabla = [];
    for (let i = 0; i <= a.length; i++) {
      const fila = [];
      for (let j = 0; j <= b.length; j++) {
        fila.push(0);
      }
      tabla.push(fila);
    }

    for (let i = 0; i <= a.length; i++) {
      tabla[i][0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      tabla[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          tabla[i][j] = tabla[i - 1][j - 1];
        } else {
          const cambiar = tabla[i - 1][j - 1] + 1;
          const quitar = tabla[i - 1][j] + 1;
          const anadir = tabla[i][j - 1] + 1;
          tabla[i][j] = Math.min(cambiar, quitar, anadir);
        }
      }
    }
    return tabla[a.length][b.length];
  }

  /**
   * (Privado) Hace la búsqueda: prepara el texto, se queda con las
   * entidades que coinciden, las ordena y devuelve las primeras.
   *
   * @param {string} texto
   * @param {string} tipo - "" para todos.
   * @param {number} limite
   * @returns {Object[]}
   */
  #consultar(texto, tipo, limite) {
    if (typeof texto !== "string") {
      return [];
    }
    let textoLimpio = texto.trim();
    if (textoLimpio.length < this.#longitudMinima) {
      return [];
    }
    // RNF-13: nadie puede hacer trabajar al buscador con un texto enorme.
    if (textoLimpio.length > Buscador.LONGITUD_MAXIMA_TEXTO) {
      textoLimpio = textoLimpio.substring(0, Buscador.LONGITUD_MAXIMA_TEXTO);
    }
    const textoNormalizado = this.#normalizar(textoLimpio);
    if (textoNormalizado.length < this.#longitudMinima) {
      return [];
    }

    let hayFiltroDeTipo = false;
    if (typeof tipo === "string" && tipo !== "") {
      hayFiltroDeTipo = true;
    }

    const encontrados = [];
    for (let i = 0; i < this.#indice.length; i++) {
      const entrada = this.#indice[i];
      const esDeOtroTipo = hayFiltroDeTipo && entrada.tipo !== tipo;
      if (!esDeOtroTipo && this.#coincideAlguno(textoNormalizado, entrada.normalizados)) {
        encontrados.push(entrada);
      }
    }

    const ordenados = this.#ordenarPorCoincidencia(textoNormalizado, encontrados);
    const resultado = [];
    for (let i = 0; i < ordenados.length && i < limite; i++) {
      // Se devuelve una copia sin el nombre normalizado (es solo para buscar).
      resultado.push({ id: ordenados[i].id, nombre: ordenados[i].nombre, tipo: ordenados[i].tipo });
    }
    return resultado;
  }

  /**
   * (Privado) Prepara un texto para compararlo (RF-04):
   *  1. Minúsculas.
   *  2. Sin tildes ni diéresis. normalize("NFD") separa cada letra de su
   *     acento: "é" pasa a ser "e" seguida de una "marca de acento", que es
   *     un carácter aparte con un código entre 0x0300 y 0x036F. El bucle se
   *     salta esos caracteres. Con la ñ pasa lo mismo ("n" + la marca de la
   *     virgulilla), así que la ñ queda como n: "Muñoz" se encuentra
   *     escribiendo "munoz", que es lo que suele escribirse en un teclado
   *     sin ñ.
   *  3. Los espacios repetidos (o tabuladores) se convierten en uno solo, y
   *     se quitan los del principio y el final.
   *
   * @param {string} texto
   * @returns {string}
   */
  #normalizar(texto) {
    if (typeof texto !== "string") {
      return "";
    }
    const separado = texto.toLowerCase().normalize("NFD");
    let resultado = "";
    let anteriorEraEspacio = false;
    for (let i = 0; i < separado.length; i++) {
      const caracter = separado[i];
      const codigo = separado.charCodeAt(i);
      const esMarcaDeAcento = codigo >= 0x0300 && codigo <= 0x036f;
      // trim() de un solo carácter da "" si ese carácter es un espacio,
      // un tabulador o un salto de línea.
      const esEspacio = caracter.trim() === "";
      if (esEspacio) {
        if (!anteriorEraEspacio) {
          resultado = resultado + " ";
        }
        anteriorEraEspacio = true;
      } else if (!esMarcaDeAcento) {
        resultado = resultado + caracter;
        anteriorEraEspacio = false;
      }
    }
    return resultado.trim();
  }

  /**
   * (Privado) ¿Coincide alguno de los nombres de la entidad?
   *
   * @param {string} textoNormalizado
   * @param {string[]} normalizados
   * @returns {boolean}
   */
  #coincideAlguno(textoNormalizado, normalizados) {
    for (let i = 0; i < normalizados.length; i++) {
      if (this.#coincide(textoNormalizado, normalizados[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * (Privado) La mejor (la menor) puntuación de los nombres de la entidad.
   *
   * @param {string} textoNormalizado
   * @param {string[]} normalizados
   * @returns {number}
   */
  #puntuarMejor(textoNormalizado, normalizados) {
    let mejor = this.#puntuar(textoNormalizado, normalizados[0]);
    for (let i = 1; i < normalizados.length; i++) {
      const puntuacion = this.#puntuar(textoNormalizado, normalizados[i]);
      if (puntuacion < mejor) {
        mejor = puntuacion;
      }
    }
    return mejor;
  }

  /**
   * (Privado) ¿El nombre coincide con el texto? Basta con una de estas
   * condiciones (los dos textos ya están normalizados):
   *
   * @param {string} textoNormalizado
   * @param {string} nombreNormalizado
   * @returns {boolean}
   */
  #coincide(textoNormalizado, nombreNormalizado) {
    // 1. El nombre contiene el texto ("picas" en "pablo picasso").
    if (nombreNormalizado.includes(textoNormalizado)) {
      return true;
    }
    // 2. Todo el texto se parece a todo el nombre ("goyya" y "goya").
    if (this.distanciaEdicion(textoNormalizado, nombreNormalizado) <= this.#distanciaMaxima) {
      return true;
    }
    // 3. Con 4 letras o más, el texto se parece a una palabra del nombre o
    //    a su comienzo ("picaso" y "picasso"; "pablo picaso" y el comienzo
    //    de "pablo picasso..."). Con menos de 4 letras no se mira, porque
    //    casi cualquier palabra corta estaría a 2 letras de distancia.
    if (textoNormalizado.length >= 4) {
      if (this.#distanciaAPalabraOComienzo(textoNormalizado, nombreNormalizado) <= this.#distanciaMaxima) {
        return true;
      }
    }
    return false;
  }

  /**
   * (Privado) Lo bien que coincide un nombre con el texto (menos es mejor):
   *   0  el nombre es exactamente el texto;
   *   1  el nombre empieza por el texto;
   *   2  alguna palabra del nombre empieza por el texto;
   *   3  el nombre contiene el texto;
   *   4 + distancia  se ha encontrado por una errata.
   *
   * @param {string} textoNormalizado
   * @param {string} nombreNormalizado
   * @returns {number}
   */
  #puntuar(textoNormalizado, nombreNormalizado) {
    if (nombreNormalizado === textoNormalizado) {
      return 0;
    }
    if (nombreNormalizado.startsWith(textoNormalizado)) {
      return 1;
    }
    const palabras = nombreNormalizado.split(" ");
    for (let i = 0; i < palabras.length; i++) {
      if (palabras[i].startsWith(textoNormalizado)) {
        return 2;
      }
    }
    if (nombreNormalizado.includes(textoNormalizado)) {
      return 3;
    }
    let distancia = this.distanciaEdicion(textoNormalizado, nombreNormalizado);
    if (textoNormalizado.length >= 4) {
      const distanciaParcial = this.#distanciaAPalabraOComienzo(textoNormalizado, nombreNormalizado);
      if (distanciaParcial < distancia) {
        distancia = distanciaParcial;
      }
    }
    return 4 + distancia;
  }

  /**
   * (Privado) La menor distancia entre el texto y alguna palabra del nombre
   * o el comienzo del nombre con la misma longitud que el texto.
   *
   * @param {string} textoNormalizado
   * @param {string} nombreNormalizado
   * @returns {number}
   */
  #distanciaAPalabraOComienzo(textoNormalizado, nombreNormalizado) {
    const comienzo = nombreNormalizado.substring(0, textoNormalizado.length);
    let menor = this.distanciaEdicion(textoNormalizado, comienzo);
    const palabras = nombreNormalizado.split(" ");
    for (let i = 0; i < palabras.length; i++) {
      const distancia = this.distanciaEdicion(textoNormalizado, palabras[i]);
      if (distancia < menor) {
        menor = distancia;
      }
    }
    return menor;
  }

  /**
   * (Privado) Ordena los encontrados: primero los de menor puntuación y, a
   * igual puntuación, por orden alfabético.
   *
   * Se usa sort con una función de comparación (como en Leyenda): sort la
   * llama con dos elementos a y b, y la función responde un número negativo
   * si a va antes, positivo si va después y 0 si da igual. La puntuación se
   * calcula ANTES, una vez por elemento, y no dentro de la comparación
   * (sort compara cada elemento muchas veces).
   *
   * @param {string} textoNormalizado
   * @param {Object[]} resultados - entradas del índice.
   * @returns {Object[]} nueva lista ordenada.
   */
  #ordenarPorCoincidencia(textoNormalizado, resultados) {
    const conPuntuacion = [];
    for (let i = 0; i < resultados.length; i++) {
      const entrada = resultados[i];
      conPuntuacion.push({
        entrada: entrada,
        puntuacion: this.#puntuarMejor(textoNormalizado, entrada.normalizados)
      });
    }
    conPuntuacion.sort(Buscador.#compararPorCoincidencia);

    const ordenados = [];
    for (let i = 0; i < conPuntuacion.length; i++) {
      ordenados.push(conPuntuacion[i].entrada);
    }
    return ordenados;
  }

  /**
   * (Privado) Función de comparación para sort (ver ordenarPorCoincidencia).
   *
   * @param {Object} a - { entrada, puntuacion }
   * @param {Object} b - { entrada, puntuacion }
   * @returns {number}
   */
  static #compararPorCoincidencia(a, b) {
    if (a.puntuacion !== b.puntuacion) {
      return a.puntuacion - b.puntuacion;
    }
    // Se comparan los nombres normalizados: así "Ángel" va con la "a".
    if (a.entrada.nombreNormalizado < b.entrada.nombreNormalizado) {
      return -1;
    }
    if (a.entrada.nombreNormalizado > b.entrada.nombreNormalizado) {
      return 1;
    }
    return 0;
  }
}
