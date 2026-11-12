/*
 * Punto de entrada de pruebas.html.
 *
 * Importa el mini sistema de pruebas y todos los archivos de pruebas. Al
 * importarse, cada archivo apunta sus pruebas con prueba(); después se
 * ejecutan todas y se pinta el resultado.
 *
 * Desde el incremento 3 el cálculo del subgrafo vuelve a estar en el
 * navegador, así que vuelven sus pruebas (relevancia, centralidad, paleta y
 * constructor). En Python quedan las del modelo, el repositorio, el
 * vecindario, la configuración y la API ("python -m pytest").
 *
 * SelectorInteraccion y EscenaGrafo necesitan WebGL y se comprueban a mano
 * (lista de comprobación del README).
 *
 * Para añadir un archivo de pruebas nuevo, basta con añadir aquí su import.
 */
import { ejecutarPruebas } from './miniPruebas.js';
import './pruebasModelo.js';
import './pruebasFabricaEntidades.js';
import './pruebasTipoRelacion.js';
import './pruebasRelevancia.js';
import './pruebasCentralidad.js';
import './pruebasPaletaColores.js';
import './pruebasConstructorSubgrafo.js';
import './pruebasRepositorioVecindario.js';
import './pruebasClienteServicio.js';
import './pruebasGestorSubgrafos.js';
import './pruebasBuscador.js';
import './pruebasHistorialNavegacion.js';
import './pruebasFiltroVisualizacion.js';
import './pruebasControladorExploracion.js';
import './pruebasSimulacionFuerzas.js';
import './pruebasCalculadorDisposicion.js';
import './pruebasFabricaNodosVisuales.js';
import './pruebasEnlaceVisual.js';
import './pruebasLeyenda.js';
import './pruebasPanelBusqueda.js';
import './pruebasPanelInformacion.js';

ejecutarPruebas();
