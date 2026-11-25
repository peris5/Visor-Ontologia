import { prueba, comprobarIgual } from './miniPruebas.js';
import { NormalizadorRoles } from '../src/logica/NormalizadorRoles.js';
import { configuracionEscenario } from './escenarioPrototipo.js';

/*
 * Pruebas de NormalizadorRoles (src/logica/).
 */

prueba("NormalizadorRoles: «Maestra», «teacher » y «Mestre» → maestro", function () {
  const normalizador = new NormalizadorRoles(configuracionEscenario());
  comprobarIgual(normalizador.normalizar("Maestra"), "maestro", "Maestra");
  comprobarIgual(normalizador.normalizar("teacher "), "maestro", "teacher con espacio");
  comprobarIgual(normalizador.normalizar("Mestre"), "maestro", "Mestre");
  comprobarIgual(normalizador.normalizar("Alumna"), "aprendiz", "Alumna");
});

prueba("NormalizadorRoles: un rol desconocido, vacío o que no es texto → null", function () {
  const normalizador = new NormalizadorRoles(configuracionEscenario());
  comprobarIgual(normalizador.normalizar("mecenas"), null, "desconocido");
  comprobarIgual(normalizador.normalizar(""), null, "vacío");
  comprobarIgual(normalizador.normalizar(null), null, "null");
  comprobarIgual(new NormalizadorRoles({}).normalizar("maestro"), null, "sin rolesEquivalentes no se conoce ninguno");
});
