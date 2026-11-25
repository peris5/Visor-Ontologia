import { FabricaRelevancia } from '../logica/FabricaRelevancia.js';
import { Relacion } from '../modelo/Relacion.js';
import { Estadistica } from './Estadistica.js';

/**
 * ¿Añadir una relación puede bajar a alguien? Con cada central, añade EN
 * MEMORIA una relación al azar (declarada, sin fecha, entre dos) que una dos
 * nodos de su zona que no estaban relacionados, recalcula, cuenta cuántos S
 * bajan y cuánto, y la quita.
 *
 * Se hace con la penalización por grado y sin ella (gradoReferencia enorme,
 * así h = 1 siempre): al unir dos nodos que no tenían relación, lo único que
 * puede hacer bajar a alguien es que un contacto más baje un poco h. Sin la
 * penalización no debe bajar ninguno.
 *
 * No prueba a añadir OTRO tipo a una pareja que ya tiene relación: ahí sí
 * puede bajar alguien, si cambia el tipo principal de la pareja y el nuevo
 * tiene una T menor (ver PropagacionDesdeDirectos).
 */
export class PruebaMonotonia {
  static TOLERANCIA = 1e-9;
  static INTENTOS = 60;

  #medidor;
  #jerarquia;
  #contexto;

  /**
   * @param {MedidorMuestra} medidor - crea los gestores.
   * @param {Object} contexto - { tipos, ... }
   * @param {Object} jerarquia - etiqueta → padres.
   */
  constructor(medidor, contexto, jerarquia) {
    this.#medidor = medidor;
    this.#contexto = contexto;
    this.#jerarquia = jerarquia;
  }

  /**
   * @param {string[]} ids - las centrales.
   * @param {Object} configuracion
   * @param {number} semilla - del azar.
   * @param {Function} alAvanzar - opcional: recibe cuántas van.
   * @returns {Promise<Object>} { con, sin }, cada uno { probadas, comparados, bajan, mayorBajada }
   */
  async comprobar(ids, configuracion, semilla, alAvanzar) {
    const sinPenalizacion = Object.assign({}, configuracion);
    sinPenalizacion.gradoReferencia = Number.MAX_SAFE_INTEGER;
    const con = await this.#probar(ids, configuracion, semilla, alAvanzar);
    const sin = await this.#probar(ids, sinPenalizacion, semilla, alAvanzar);
    return { con: con, sin: sin };
  }

  async #probar(ids, configuracion, semilla, alAvanzar) {
    const azar = Estadistica.crearAzar(semilla);
    const piezas = FabricaRelevancia.crear(configuracion, this.#jerarquia);
    const salida = { probadas: 0, comparados: 0, bajan: 0, mayorBajada: 0 };
    for (let i = 0; i < ids.length; i++) {
      const gestor = this.#medidor.crearGestor(piezas);
      await gestor.obtenerSubgrafo(ids[i], 0);
      const cache = gestor.getCache();
      const central = cache.entidad(ids[i]);
      const antes = gestor.getResultados();
      const nueva = this.#relacionAlAzar(cache, antes, piezas, azar);
      if (nueva !== null) {
        cache.anadirRelacion(nueva);
        const despues = piezas.estrategia.calcular(central, cache);
        cache.quitarRelacion(nueva.getId());
        salida.probadas = salida.probadas + 1;
        for (const [id, resultado] of antes) {
          let s = 0;
          if (despues.has(id)) {
            s = despues.get(id).getRelevancia();
          }
          salida.comparados = salida.comparados + 1;
          const bajada = resultado.getRelevancia() - s;
          if (bajada > PruebaMonotonia.TOLERANCIA) {
            salida.bajan = salida.bajan + 1;
            salida.mayorBajada = Math.max(salida.mayorBajada, bajada);
          }
        }
      }
      if (typeof alAvanzar === "function") {
        await alAvanzar(i + 1);
      }
    }
    return salida;
  }

  /** Una relación nueva entre dos nodos de la zona sin relación, o null si no se encuentra. */
  #relacionAlAzar(cache, resultados, piezas, azar) {
    const nodos = [];
    for (const resultado of resultados.values()) {
      nodos.push(resultado.getEntidad());
    }
    const tipos = this.#tiposDeclarados(cache, piezas);
    if (nodos.length < 2 || tipos.length === 0) {
      return null;
    }
    for (let intento = 0; intento < PruebaMonotonia.INTENTOS; intento++) {
      const a = nodos[Math.floor(azar() * nodos.length)];
      const b = nodos[Math.floor(azar() * nodos.length)];
      const tipo = tipos[Math.floor(azar() * tipos.length)];
      if (a !== b && !PruebaMonotonia.#estanRelacionados(cache, a, b)) {
        return new Relacion("laboratorio|" + a.getId() + "|" + b.getId(), a, b, tipo, 0, {});
      }
    }
    return null;
  }

  #tiposDeclarados(cache, piezas) {
    const tipos = [];
    for (let i = 0; i < this.#contexto.tipos.length; i++) {
      const tipo = cache.getTipo(this.#contexto.tipos[i].id);
      if (tipo !== null && !piezas.compuesta.getReparto().esTipoDeCoincidencia(tipo)) {
        tipos.push(tipo);
      }
    }
    return tipos;
  }

  static #estanRelacionados(cache, a, b) {
    const relaciones = cache.relacionesDe(a.getId());
    for (let i = 0; i < relaciones.length; i++) {
      if (relaciones[i].getOtroExtremo(a) === b) {
        return true;
      }
    }
    return false;
  }
}
