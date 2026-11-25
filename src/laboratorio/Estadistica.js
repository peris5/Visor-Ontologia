/**
 * Cálculos sencillos que comparten las clases del laboratorio.
 */
export class Estadistica {
  /**
   * El valor que deja por debajo esa fracción de la lista (0,5 = mediana).
   *
   * @param {number[]} valores
   * @param {number} fraccion - entre 0 y 1.
   * @returns {number|null} null si la lista está vacía.
   */
  static percentil(valores, fraccion) {
    if (valores.length === 0) {
      return null;
    }
    const ordenados = valores.slice();
    ordenados.sort(function (a, b) {
      return a - b;
    });
    const posicion = Math.min(ordenados.length - 1, Math.floor(fraccion * ordenados.length));
    return ordenados[posicion];
  }

  static mediana(valores) {
    return Estadistica.percentil(valores, 0.5);
  }

  /**
   * @returns {number|null} el mayor, o null si la lista está vacía.
   */
  static maximo(valores) {
    return Estadistica.percentil(valores, 1);
  }

  static minimo(valores) {
    return Estadistica.percentil(valores, 0);
  }

  /**
   * @returns {number|null} 100 · parte / total, o null si no hay ninguno.
   */
  static porcentaje(parte, total) {
    if (total === 0) {
      return null;
    }
    return 100 * parte / total;
  }

  /** Suma uno (o lo que se indique) a un contador de un Map. */
  static contar(mapa, clave, cantidad) {
    let suma = 1;
    if (typeof cantidad === "number") {
      suma = cantidad;
    }
    if (mapa.has(clave)) {
      suma = suma + mapa.get(clave);
    }
    mapa.set(clave, suma);
  }

  /**
   * Un generador de números al azar con semilla (mulberry32): con la misma
   * semilla, siempre los mismos, para que una medida se pueda repetir.
   *
   * @param {number} semilla
   * @returns {Function} sin parámetros; devuelve un número en [0, 1).
   */
  static crearAzar(semilla) {
    let estado = semilla >>> 0;
    return function () {
      estado = (estado + 0x6D2B79F5) >>> 0;
      let t = estado;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** «12,3 %», o «–» si no hay valor. */
  static textoPorcentaje(valor) {
    if (valor === null) {
      return "–";
    }
    return valor.toFixed(1).replace(".", ",") + " %";
  }

  /** «0,123», o «–» si no hay valor. */
  static textoNumero(valor, decimales) {
    if (valor === null) {
      return "–";
    }
    return valor.toFixed(decimales).replace(".", ",");
  }
}
