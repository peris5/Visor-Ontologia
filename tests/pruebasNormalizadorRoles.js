import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { NormalizadorRoles } from '../src/logica/NormalizadorRoles.js';
import { Relacion } from '../src/modelo/Relacion.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { Persona } from '../src/modelo/Persona.js';
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

prueba("NormalizadorRoles: «maestro/a» es «maestro» y «profesor/a», «profesor»", function () {
  const normalizador = new NormalizadorRoles(configuracionEscenario());
  comprobarIgual(normalizador.normalizar("maestro/a"), "maestro", "maestro/a");
  comprobarIgual(normalizador.normalizar(" Alumno / a "), "aprendiz", "con espacios y mayúsculas");
  comprobarIgual(normalizador.normalizar("discípulo/a"), "aprendiz", "discípulo/a");
  comprobarIgual(NormalizadorRoles.limpiar("profesor/a"), "profesor", "profesor/a");
  comprobarIgual(NormalizadorRoles.limpiar("comisario/as"), "comisario", "el plural");
  comprobarIgual(NormalizadorRoles.limpiar("guía/acompañante"), "guía/acompañante", "no es un «/a» final");
  const conProfesor = new NormalizadorRoles({ rolesEquivalentes: { maestro: ["profesor/a"] } });
  comprobarIgual(conProfesor.normalizar("Profesor"), "maestro", "también en la configuración");
});

/** Una relación directa (sin vías) o por intermediario entre a (origen) y b. */
function relacion(idTipo, datos) {
  return new Relacion("r", new Persona({ id: "z_origen" }), new Persona({ id: "a_destino" }),
    new TipoRelacion(idTipo, idTipo, "#000000", []), 0, datos);
}

prueba("NormalizadorRoles: en una relación directa, el rol sale del sentido de la flecha", function () {
  const normalizador = new NormalizadorRoles({
    rolesEquivalentes: configuracionEscenario().rolesEquivalentes,
    rolesPorDireccion: { STUDENT_OF: { origen: "aprendiz", destino: "maestra" } }
  });
  const directa = relacion("STUDENT_OF", {});
  comprobarIgual(normalizador.rolDe(directa, directa.getOrigen()), "aprendiz", "el origen es el alumno");
  comprobarIgual(normalizador.rolDe(directa, directa.getDestino()), "maestro", "el destino, el maestro (normalizado)");
  const conRol = relacion("STUDENT_OF", { roles: { z_origen: "Maestro" } });
  comprobarIgual(normalizador.rolDe(conRol, conRol.getOrigen()), "maestro", "si tiene rol en la base de datos, manda");
  const otroTipo = relacion("COLLABORATES_WITH", {});
  comprobarIgual(normalizador.rolDe(otroTipo, otroTipo.getOrigen()), null, "otro tipo directo: sin rol");
  const porIntermediario = relacion("STUDENT_OF", { via: { z_origen: "HAS_ROLE_IN", a_destino: "HAS_ROLE_IN" } });
  comprobarIgual(normalizador.rolDe(porIntermediario, porIntermediario.getOrigen()), null,
    "con intermediario la flecha no dice nada");
});

prueba("NormalizadorRoles: rolesPorDireccion necesita los dos roles", function () {
  let fallo = false;
  try {
    new NormalizadorRoles({ rolesPorDireccion: { STUDENT_OF: { origen: "aprendiz" } } });
  } catch (error) {
    fallo = true;
  }
  comprobar(fallo, "falta el destino");
});

prueba("NormalizadorRoles: un rol desconocido, vacío o que no es texto → null", function () {
  const normalizador = new NormalizadorRoles(configuracionEscenario());
  comprobarIgual(normalizador.normalizar("mecenas"), null, "desconocido");
  comprobarIgual(normalizador.normalizar(""), null, "vacío");
  comprobarIgual(normalizador.normalizar(null), null, "null");
  comprobarIgual(new NormalizadorRoles({}).normalizar("maestro"), null, "sin rolesEquivalentes no se conoce ninguno");
});
