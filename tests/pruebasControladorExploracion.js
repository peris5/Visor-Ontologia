import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { ControladorExploracion } from '../src/logica/ControladorExploracion.js';
import { EstadoCarga } from '../src/logica/EstadoCarga.js';
import { Subgrafo } from '../src/modelo/Subgrafo.js';
import { NodoRelevante } from '../src/modelo/NodoRelevante.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { TipoEntidad } from '../src/modelo/TipoEntidad.js';
import { Persona } from '../src/modelo/Persona.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';

/*
 * Pruebas de ControladorExploracion (src/logica/).
 *
 * El controlador habla con cuatro piezas. En estas pruebas todas son
 * DOBLES DE PRUEBA: objetos falsos con los mismos métodos que las de
 * verdad, que apuntan lo que se les pide. Así se prueba el controlador
 * solo, sin servidor, sin WebGL y sin página.
 */

/**
 * Un subgrafo pequeño cuya central es "id": la central (persona) y una
 * obra unidas por una relación autor_de.
 *
 * @param {string} id
 * @param {number} umbral
 * @returns {Subgrafo}
 */
function crearSubgrafoDe(id, umbral) {
  const central = new Persona({ id: id, propiedades: { name: "Persona " + id } });
  const obra = new ObraDeArte({ id: "obra-" + id, propiedades: { name_es: "Obra de " + id } });
  const subgrafo = new Subgrafo(central, umbral);
  subgrafo.agregarNodo(new NodoRelevante(obra, 0.8, 1));
  subgrafo.agregarRelacion(new Relacion("r-" + id, central, obra, new TipoRelacion("autor_de", "Autor de", "#ff0000"), 0.8));
  return subgrafo;
}

/**
 * Doble de GestorSubgrafos. En modo automático contesta enseguida; en modo
 * manual guarda las peticiones para que la prueba decida cuándo y en qué
 * orden llegan las respuestas.
 */
class GestorFalso {
  constructor() {
    this.peticiones = [];
    this.manual = false;
    this.pendientes = [];
    this.detallesPedidos = [];
    this.detalleFalla = false;
  }

  obtenerDetalle(idEntidad) {
    this.detallesPedidos.push(idEntidad);
    const falla = this.detalleFalla;
    // Contesta en la siguiente vuelta del temporizador, como una petición de verdad.
    return new Promise(function (resolver, rechazar) {
      setTimeout(function () {
        if (falla) {
          rechazar(new Error("sin detalle"));
        } else {
          resolver({ idEntidad: idEntidad });
        }
      }, 0);
    });
  }

  obtenerSubgrafo(idEntidad, umbral) {
    this.peticiones.push({ id: idEntidad, umbral: umbral });
    if (this.manual) {
      const gestor = this;
      return new Promise(function (resolver, rechazar) {
        gestor.pendientes.push({ id: idEntidad, umbral: umbral, resolver: resolver, rechazar: rechazar });
      });
    }
    if (idEntidad === "X") {
      return Promise.reject(new Error("No existe la entidad X"));
    }
    return Promise.resolve(crearSubgrafoDe(idEntidad, umbral));
  }

  /**
   * Contesta la petición pendiente de esa entidad.
   *
   * @param {string} idEntidad
   */
  contestar(idEntidad) {
    for (let i = 0; i < this.pendientes.length; i++) {
      const pendiente = this.pendientes[i];
      if (pendiente.id === idEntidad) {
        this.pendientes.splice(i, 1);
        pendiente.resolver(crearSubgrafoDe(pendiente.id, pendiente.umbral));
        return;
      }
    }
  }
}

/**
 * Doble de Buscador: cuenta las llamadas.
 */
class BuscadorFalso {
  constructor() {
    this.llamadas = 0;
  }

  sugerir(texto, tipo) {
    this.llamadas = this.llamadas + 1;
    return [{ id: "A", nombre: "Persona A", tipo: TipoEntidad.PERSONA }];
  }
}

/**
 * Doble de EscenaGrafo: apunta lo que se le pide.
 */
class EscenaFalsa {
  constructor() {
    this.mostrados = [];
    this.filtrosAplicados = 0;
    this.nodoResaltado = null;
    this.relacionResaltada = null;
    this.camaraRestablecida = 0;
  }

  mostrarSubgrafo(subgrafo) {
    this.mostrados.push(subgrafo.getEntidadCentral().getId());
  }

  aplicarFiltro(filtro) {
    this.filtrosAplicados = this.filtrosAplicados + 1;
    this.ultimoFiltro = filtro;
  }

  getRelacionesVisiblesPorTipo() {
    return new Map();
  }

  resaltarNodo(id) {
    this.nodoResaltado = id;
  }

  resaltarRelacion(id) {
    this.relacionResaltada = id;
  }

  restablecerCamara() {
    this.camaraRestablecida = this.camaraRestablecida + 1;
  }
}

/**
 * Doble de InterfazUsuario: apunta lo que se le pide.
 */
class InterfazFalsa {
  constructor() {
    this.estados = [];
    this.errores = [];
    this.entidadesMostradas = [];
    this.relacionesMostradas = [];
    this.sugerencias = null;
    this.habilitadoVolver = null;
    this.umbral = null;
    this.leyendas = [];
    this.detalles = [];
    this.erroresDetalle = [];
  }

  mostrarDetalle(idEntidad, detalle) {
    this.detalles.push(idEntidad);
  }

  mostrarErrorDetalle(idEntidad, mensaje) {
    this.erroresDetalle.push(idEntidad + ": " + mensaje);
  }

  mostrarEntidad(entidad, nodo, subgrafo) {
    this.entidadesMostradas.push(entidad.getId());
  }

  mostrarRelacion(relacion, subgrafo) {
    this.relacionesMostradas.push(relacion.getId());
  }

  mostrarSugerencias(lista, texto) {
    this.sugerencias = lista;
  }

  mostrarEstado(estado) {
    this.estados.push(estado);
  }

  mostrarError(mensaje) {
    this.errores.push(mensaje);
  }

  setHabilitadoVolver(habilitado) {
    this.habilitadoVolver = habilitado;
  }

  setUmbral(valor) {
    this.umbral = valor;
  }

  actualizarLeyenda(datos) {
    this.leyendas.push(datos);
  }
}

/**
 * Un controlador conectado a sus dobles.
 *
 * @returns {Object} { controlador, gestor, buscador, escena, interfaz }
 */
function crearControladorDePrueba() {
  const gestor = new GestorFalso();
  const buscador = new BuscadorFalso();
  const escena = new EscenaFalsa();
  const interfaz = new InterfazFalsa();
  const controlador = new ControladorExploracion(gestor, buscador, 0.3);
  controlador.conectar(escena, interfaz);
  return { controlador: controlador, gestor: gestor, buscador: buscador, escena: escena, interfaz: interfaz };
}

prueba("Controlador: iniciar pasa por CARGANDO y LISTO", async function () {
  const p = crearControladorDePrueba();
  comprobarIgual(p.controlador.getEstado(), EstadoCarga.INACTIVO, "antes de iniciar");
  await p.controlador.iniciar("A");
  comprobarIgual(p.interfaz.estados.join(","), "CARGANDO,LISTO", "estados por los que ha pasado");
  comprobarIgual(p.controlador.getEstado(), EstadoCarga.LISTO, "estado final");
  comprobarIgual(p.escena.mostrados.join(","), "A", "subgrafo mostrado en la escena");
  comprobarIgual(p.interfaz.entidadesMostradas.join(","), "A", "información de la central en el panel");
  comprobarIgual(p.interfaz.umbral, 0.3, "umbral en su control");
  comprobarIgual(p.interfaz.habilitadoVolver, false, "«Volver» deshabilitado al principio");
});

prueba("Controlador: navegarA registra en el historial y volver regresa sin registrar", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await p.controlador.navegarA("B");
  comprobarIgual(p.interfaz.habilitadoVolver, true, "ya se puede volver");
  await p.controlador.navegarA("C");
  await p.controlador.volver();
  comprobarIgual(p.controlador.getSubgrafoActual().getEntidadCentral().getId(), "B", "vuelve a B");
  await p.controlador.volver();
  comprobarIgual(p.controlador.getSubgrafoActual().getEntidadCentral().getId(), "A", "vuelve a A");
  comprobarIgual(p.interfaz.habilitadoVolver, false, "no queda nada a lo que volver");
  await p.controlador.volver();
  comprobarIgual(p.escena.mostrados.join(","), "A,B,C,B,A", "volver con el historial vacío no hace nada");
});

prueba("Controlador: navegar a la entidad actual no hace nada", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await p.controlador.navegarA("A");
  comprobarIgual(p.gestor.peticiones.length, 1, "solo la petición del principio");
  comprobarIgual(p.interfaz.habilitadoVolver, false, "no se ha apuntado en el historial");
});

prueba("Controlador: seleccionarEntidad (del buscador) es como navegarA", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await p.controlador.seleccionarEntidad("B");
  comprobarIgual(p.escena.mostrados.join(","), "A,B", "subgrafos mostrados");
  comprobarIgual(p.interfaz.habilitadoVolver, true, "se puede volver a A");
});

prueba("Controlador: cambiarUmbral recarga la misma entidad sin tocar el historial", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await p.controlador.cambiarUmbral(0.6);
  const ultima = p.gestor.peticiones[p.gestor.peticiones.length - 1];
  comprobarIgual(ultima.id, "A", "misma entidad");
  comprobarIgual(ultima.umbral, 0.6, "umbral nuevo");
  comprobarIgual(p.interfaz.habilitadoVolver, false, "el historial sigue vacío");
});

prueba("Controlador: una respuesta tardía se ignora", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  p.gestor.manual = true;
  const navegacionB = p.controlador.navegarA("B");
  const navegacionC = p.controlador.navegarA("C");
  // Llega antes la respuesta de C (la última que se pidió) y después la de B.
  p.gestor.contestar("C");
  await navegacionC;
  p.gestor.contestar("B");
  await navegacionB;
  comprobarIgual(p.escena.mostrados.join(","), "A,C", "la respuesta de B, que llega tarde, no se dibuja");
  comprobarIgual(p.controlador.getSubgrafoActual().getEntidadCentral().getId(), "C", "subgrafo actual");
  comprobarIgual(p.controlador.getEstado(), EstadoCarga.LISTO, "estado");
});

prueba("Controlador: si el gestor falla, estado ERROR, mensaje y se mantiene el grafo anterior", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await p.controlador.navegarA("X");
  comprobarIgual(p.controlador.getEstado(), EstadoCarga.ERROR, "estado");
  comprobarIgual(p.interfaz.errores.join(","), "No existe la entidad X", "mensaje");
  comprobarIgual(p.escena.mostrados.join(","), "A", "la escena no ha cambiado");
  comprobarIgual(p.controlador.getSubgrafoActual().getEntidadCentral().getId(), "A", "se mantiene el subgrafo anterior");
});

prueba("Controlador: alternar un filtro aplica el filtro en la escena y actualiza la leyenda", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  const filtrosAntes = p.escena.filtrosAplicados;
  const leyendasAntes = p.interfaz.leyendas.length;
  p.controlador.alternarFiltroNodo(TipoEntidad.OBRA_DE_ARTE);
  comprobarIgual(p.escena.filtrosAplicados, filtrosAntes + 1, "aplicarFiltro en la escena");
  comprobarIgual(p.interfaz.leyendas.length, leyendasAntes + 1, "leyenda actualizada");
  const datos = p.interfaz.leyendas[p.interfaz.leyendas.length - 1];
  let obraActiva = null;
  for (let i = 0; i < datos.nodos.length; i++) {
    if (datos.nodos[i].tipo === TipoEntidad.OBRA_DE_ARTE) {
      obraActiva = datos.nodos[i].activo;
    }
  }
  comprobarIgual(obraActiva, false, "en la leyenda, la casilla de las obras está desmarcada");
  comprobar(!p.escena.ultimoFiltro.esTipoNodoActivo(TipoEntidad.OBRA_DE_ARTE), "el filtro de la escena oculta las obras");
});

prueba("Controlador: «Ninguna» y «Todas» cambian todos los tipos de relación", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  p.controlador.mostrarTodasLasRelaciones(false);
  let datos = p.interfaz.leyendas[p.interfaz.leyendas.length - 1];
  comprobarIgual(datos.relaciones[0].activo, false, "Ninguna");
  p.controlador.mostrarTodasLasRelaciones(true);
  datos = p.interfaz.leyendas[p.interfaz.leyendas.length - 1];
  comprobarIgual(datos.relaciones[0].activo, true, "Todas");
});

prueba("Controlador: los filtros se mantienen al navegar a otra entidad", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  p.controlador.alternarFiltroNodo(TipoEntidad.OBRA_DE_ARTE);
  await p.controlador.navegarA("B");
  comprobar(!p.escena.ultimoFiltro.esTipoNodoActivo(TipoEntidad.OBRA_DE_ARTE), "las obras siguen ocultas");
});

prueba("Controlador: buscar con 1 carácter no llama al buscador", function () {
  const p = crearControladorDePrueba();
  p.controlador.buscar("a", "");
  comprobarIgual(p.buscador.llamadas, 0, "llamadas al buscador");
  comprobarIgual(p.interfaz.sugerencias.length, 0, "sugerencias vacías");
  p.controlador.buscar("an", "");
  comprobarIgual(p.buscador.llamadas, 1, "con 2 caracteres sí");
  comprobarIgual(p.interfaz.sugerencias.length, 1, "sugerencias del buscador");
});

prueba("Controlador: seleccionar un nodo o una relación los resalta y muestra su información", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  const subgrafo = p.controlador.getSubgrafoActual();
  p.controlador.seleccionarNodo(subgrafo.getNodo("obra-A"));
  comprobarIgual(p.escena.nodoResaltado, "obra-A", "nodo resaltado");
  comprobarIgual(p.interfaz.entidadesMostradas[p.interfaz.entidadesMostradas.length - 1], "obra-A", "información del nodo");
  p.controlador.seleccionarRelacion(subgrafo.getRelaciones()[0]);
  comprobarIgual(p.escena.relacionResaltada, "r-A", "relación resaltada");
  comprobarIgual(p.interfaz.relacionesMostradas.join(","), "r-A", "información de la relación");
  p.controlador.restablecerVista();
  comprobarIgual(p.escena.camaraRestablecida, 1, "vista inicial");
});

/**
 * Espera a que terminen las promesas pendientes (el detalle se pide sin await).
 *
 * @returns {Promise<void>}
 */
function esperarUnMomento() {
  return new Promise(function (resolver) {
    setTimeout(resolver, 0);
  });
}

prueba("Controlador: al cargar y al seleccionar un nodo pide su detalle y se lo da a la interfaz", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  await esperarUnMomento();
  comprobarIgual(p.gestor.detallesPedidos.join(","), "A", "detalle de la central");
  comprobarIgual(p.interfaz.detalles.join(","), "A", "mostrado en el panel");
  p.controlador.seleccionarNodo(p.controlador.getSubgrafoActual().getNodo("obra-A"));
  await esperarUnMomento();
  comprobarIgual(p.interfaz.detalles.join(","), "A,obra-A", "detalle del nodo seleccionado");
});

prueba("Controlador: si el detalle falla, aviso en el panel y el grafo sigue", async function () {
  const p = crearControladorDePrueba();
  p.gestor.detalleFalla = true;
  await p.controlador.iniciar("A");
  await esperarUnMomento();
  comprobarIgual(p.interfaz.erroresDetalle.join(","), "A: sin detalle", "aviso");
  comprobarIgual(p.controlador.getEstado(), EstadoCarga.LISTO, "el estado no cambia");
});

prueba("Controlador: un detalle que llega cuando ya se ha seleccionado otra cosa se ignora", async function () {
  const p = crearControladorDePrueba();
  await p.controlador.iniciar("A");
  // Antes de que llegue el detalle de A, se selecciona una relación.
  p.controlador.seleccionarRelacion(p.controlador.getSubgrafoActual().getRelaciones()[0]);
  await esperarUnMomento();
  comprobarIgual(p.interfaz.detalles.length, 0, "no se muestra");
});
