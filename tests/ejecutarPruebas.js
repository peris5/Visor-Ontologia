/*
 * Punto de entrada de pruebas.html.
 *
 * Importa el mini sistema de pruebas y todos los archivos de pruebas. Al
 * importarse, cada archivo apunta sus pruebas con prueba(); después se
 * ejecutan todas y se pinta el resultado.
 *
 * Las pruebas de la lógica del subgrafo (repositorio, relevancia,
 * constructor, centralidad, paleta y configuración) están ahora en Python:
 * se ejecutan con "python -m pytest" (carpeta servidor/tests/).
 *
 * Para añadir un archivo de pruebas nuevo, basta con añadir aquí su import.
 */
import { ejecutarPruebas } from './miniPruebas.js';
import './pruebasModelo.js';
import './pruebasClienteServicio.js';
import './pruebasSimulacionFuerzas.js';
import './pruebasCalculadorDisposicion.js';
import './pruebasFabricaNodosVisuales.js';
import './pruebasEnlaceVisual.js';
import './pruebasLeyenda.js';

ejecutarPruebas();
