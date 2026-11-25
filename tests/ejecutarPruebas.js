/*
 * Punto de entrada de pruebas.html.
 *
 * Importa el mini sistema de pruebas y todos los archivos de pruebas. Al
 * importarse, cada archivo apunta sus pruebas con prueba(); después se
 * ejecutan todas y se pinta el resultado. Las del servidor están en Python
 * ("python -m pytest").
 *
 * SelectorInteraccion y EscenaGrafo necesitan WebGL y se comprueban a mano.
 *
 * Para añadir un archivo de pruebas nuevo, basta con añadir aquí su import.
 */
import { ejecutarPruebas } from './miniPruebas.js';
import './pruebasModelo.js';
import './pruebasFabricaEntidades.js';
import './pruebasTipoRelacion.js';
import './pruebasRelevancia.js';
import './pruebasCalculadorEvidencia.js';
import './pruebasTablaTransferencia.js';
import './pruebasNormalizadorRoles.js';
import './pruebasPenalizacionGrado.js';
import './pruebasCompatibilidadTemporal.js';
import './pruebasRefuerzoEntreDirectos.js';
import './pruebasPropiedadesRelevancia.js';
import './pruebasDeduccionPorTipos.js';
import './pruebasRelevanciaNodosTresCapas.js';
import './pruebasCentralidad.js';
import './pruebasPaletaColores.js';
import './pruebasConstructorSubgrafo.js';
import './pruebasRepositorioVecindario.js';
import './pruebasClienteServicio.js';
import './pruebasGestorSubgrafos.js';
import './pruebasAjustadorUmbral.js';
import './pruebasBuscador.js';
import './pruebasHistorialNavegacion.js';
import './pruebasFiltroVisualizacion.js';
import './pruebasControladorExploracion.js';
import './pruebasSimulacionFuerzas.js';
import './pruebasCalculadorDisposicion.js';
import './pruebasDisposicion.js';
import './pruebasFabricaNodosVisuales.js';
import './pruebasEnlaceVisual.js';
import './pruebasLeyenda.js';
import './pruebasPanelBusqueda.js';
import './pruebasPanelInformacion.js';

ejecutarPruebas();
