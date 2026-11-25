import { prueba, comprobar, comprobarIgual, redondear } from './miniPruebas.js';
import { EquivalenciasTipos } from '../src/logica/EquivalenciasTipos.js';
import { TipoRelacion } from '../src/modelo/TipoRelacion.js';
import { RepositorioVecindario } from '../src/datos/RepositorioVecindario.js';
import { EscenariosPrueba } from '../src/laboratorio/EscenariosPrueba.js';
import { MedidasRelevancia } from '../src/laboratorio/MedidasRelevancia.js';
import { configuracionEscenario, contextoEscenario, crearPiezas, construirDatos, escenarioAna } from './escenarioPrototipo.js';
import {
  CONFIGURACION_RELEVANCIA, CONTEXTO_PRUEBAS, RELACIONES_EJEMPLO, crearRelevanciaPruebas
} from './utilidadesPruebas.js';

/*
 * Pruebas de EquivalenciasTipos (src/logica/) y de rolesPorDireccion: un
 * tipo nuevo que se comporta como otro (STUDENT_OF y Apprenticeship, como
 * Mentorship).
 */

const JERARQUIA = { Mentorship: ["Relationship"], Apprenticeship: ["Professional", "Relationship"] };
const STUDENT_OF = new TipoRelacion("STUDENT_OF", "Student of", "#000000", []);
const APRENDIZAJE = new TipoRelacion("Apprenticeship", "Apprenticeship", "#000000", ["Professional", "Relationship"]);
const MENTORIA = new TipoRelacion("Mentorship", "Mentoría", "#000000", ["Relationship"]);
const CREACION = new TipoRelacion("Creation", "Creación", "#000000", ["Event"]);
const PINTURA = new TipoRelacion("Paint", "Pintura", "#000000", ["Creation", "Event"]);

function configuracionConEquivalencias() {
  const configuracion = configuracionEscenario();
  configuracion.tiposEquivalentes = { STUDENT_OF: "Mentorship", Apprenticeship: "Mentorship" };
  configuracion.rolesPorDireccion = { STUDENT_OF: { origen: "aprendiz", destino: "maestro" } };
  return configuracion;
}

prueba("Equivalencias: el propio tipo, aquel al que equivale y los padres de este", function () {
  const equivalencias = new EquivalenciasTipos(configuracionConEquivalencias(), JERARQUIA);
  comprobarIgual(equivalencias.getIds(STUDENT_OF).join(","), "STUDENT_OF,Mentorship,Relationship", "sin padres propios");
  comprobarIgual(equivalencias.getIds(APRENDIZAJE).join(","), "Apprenticeship,Mentorship,Relationship",
    "Professional deja de contar");
  comprobarIgual(equivalencias.getIds(PINTURA).join(","), "Paint,Creation,Event", "sin equivalencia, como siempre");
  const hijo = new TipoRelacion("TallerAprendizaje", "Aprendizaje en taller", "#000000", ["Apprenticeship", "Professional"]);
  comprobarIgual(equivalencias.getIds(hijo).join(","), "TallerAprendizaje,Apprenticeship,Mentorship,Relationship",
    "los hijos heredan la equivalencia");
  comprobarIgual(equivalencias.getEquivalente(hijo), "Mentorship", "a qué equivale");
  comprobarIgual(equivalencias.getEquivalente(MENTORIA), null, "la mentoría no equivale a nada");
});

prueba("Equivalencias: usa el peso, los pesos por rol, la tabla T y los pares temporales del otro tipo", function () {
  const piezas = crearPiezas(configuracionConEquivalencias());
  const tipos = [STUDENT_OF, APRENDIZAJE];
  for (let i = 0; i < tipos.length; i++) {
    const nombre = tipos[i].getId();
    comprobarIgual(piezas.compuesta.getPeso(tipos[i], null), 0.95, nombre + ": peso");
    comprobarIgual(piezas.compuesta.getPeso(tipos[i], "maestro"), 0.95, nombre + ": peso del maestro");
    comprobarIgual(piezas.compuesta.getPeso(tipos[i], "aprendiz"), 0.6, nombre + ": peso del aprendiz");
    comprobarIgual(piezas.tabla.getT(tipos[i], "maestro", PINTURA), 0.8, nombre + ": la obra del maestro");
    comprobarIgual(piezas.tabla.getT(tipos[i], "aprendiz", CREACION), 0.5, nombre + ": la obra del aprendiz");
    comprobarIgual(piezas.tabla.getT(MENTORIA, "maestro", tipos[i]), 0.6, nombre + ": también como segundo tramo");
    comprobarIgual(piezas.temporal.buscarPar(tipos[i], PINTURA).modo, "antesODurante", nombre + ": par temporal");
  }
  const sin = crearPiezas(configuracionEscenario());
  comprobarIgual(sin.compuesta.getPeso(STUDENT_OF, "maestro"), 0.4, "sin equivalencias, el peso por defecto");
  comprobarIgual(sin.compuesta.getPeso(APRENDIZAJE, "maestro"), 0.6, "sin equivalencias, el de Professional");
});

prueba("Equivalencias: si el tipo tiene valor propio, manda el suyo", function () {
  const configuracion = configuracionConEquivalencias();
  configuracion.pesosRelevancia.STUDENT_OF = 0.7;
  const piezas = crearPiezas(configuracion);
  comprobarIgual(piezas.compuesta.getPeso(STUDENT_OF, null), 0.7, "su peso");
  comprobarIgual(piezas.tabla.getT(STUDENT_OF, "maestro", CREACION), 0.8, "lo demás, el de la mentoría");
});

prueba("Equivalencias: rechaza un tipo que equivale a sí mismo o a nada", function () {
  const malos = [{ A: "A" }, { A: "" }, { A: 3 }];
  for (let i = 0; i < malos.length; i++) {
    let fallo = false;
    try {
      new EquivalenciasTipos({ tiposEquivalentes: malos[i] }, {});
    } catch (error) {
      fallo = true;
    }
    comprobar(fallo, "rechaza " + JSON.stringify(malos[i]));
  }
});

/** El ejemplo de Ana cambiando la mentoría con Joaquín por una relación directa «origen STUDENT_OF destino». */
function anaConStudentOf(origen, destino, configuracion) {
  const datos = construirDatos(EscenariosPrueba.sinPareja(escenarioAna(), "ana", "joaquin"));
  datos.relaciones.push({
    id: "d|ana|joaquin", idIntermedio: "d", origen: origen, destino: destino, tipo: "STUDENT_OF", padres: [], roles: {},
    via: {}, nombre: "", periodo: null, lugar: null, fecha: null, participantes: 2, participantesPorClase: { PERSONA: 2 },
    dibujable: true
  });
  const cache = new RepositorioVecindario(datos, contextoEscenario());
  return crearPiezas(configuracion).estrategia.calcular(cache.entidad("ana"), cache);
}

prueba("Equivalencias: «Ana STUDENT_OF Joaquín» da lo mismo que la mentoría (maestro 0,95 y su obra dentro)", function () {
  const resultados = anaConStudentOf("ana", "joaquin", configuracionConEquivalencias());
  comprobarIgual(redondear(resultados.get("joaquin").getRelevancia()), 0.95, "Joaquín es el maestro");
  comprobarIgual(redondear(resultados.get("paseo").getRelevancia()), redondear(0.532), "Paseo, la obra de su maestro");
  comprobarIgual(resultados.get("joaquin").getTextoExplicacion(), "Student of (su maestro)", "explicación con el rol");
});

prueba("Equivalencias: al revés, «Joaquín STUDENT_OF Ana», él es el aprendiz (0,60)", function () {
  const resultados = anaConStudentOf("joaquin", "ana", configuracionConEquivalencias());
  comprobarIgual(redondear(resultados.get("joaquin").getRelevancia()), 0.6, "Joaquín es el aprendiz");
  comprobarIgual(redondear(resultados.get("paseo").getFuerza()), redondear(0.6 * 0.5), "y su obra transmite menos");
});

prueba("Equivalencias: sin configurar nada, STUDENT_OF sigue con el peso por defecto", function () {
  const resultados = anaConStudentOf("ana", "joaquin", configuracionEscenario());
  comprobarIgual(redondear(resultados.get("joaquin").getRelevancia()), 0.4, "0,40, sin asimetría");
});

prueba("Equivalencias: con la configuración y los datos de verdad, STUDENT_OF y Apprenticeship son mentorías", function () {
  comprobarIgual(CONFIGURACION_RELEVANCIA.tiposEquivalentes.STUDENT_OF, "Mentorship", "STUDENT_OF");
  comprobarIgual(CONFIGURACION_RELEVANCIA.tiposEquivalentes.Apprenticeship, "Mentorship", "Apprenticeship");
  const piezas = crearRelevanciaPruebas();
  const cache = new RepositorioVecindario({ ids: [], entidades: RELACIONES_EJEMPLO.entidades,
    relaciones: RELACIONES_EJEMPLO.relaciones }, CONTEXTO_PRUEBAS);
  const normalizador = piezas.calculador.getNormalizador();
  const vistos = { STUDENT_OF: 0, Apprenticeship: 0 };
  const relaciones = cache.todasLasRelaciones();
  for (let i = 0; i < relaciones.length; i++) {
    const relacion = relaciones[i];
    const id = relacion.getTipo().getId();
    if (Object.prototype.hasOwnProperty.call(vistos, id)) {
      vistos[id] = vistos[id] + 1;
      const roles = [normalizador.rolDe(relacion, relacion.getOrigen()), normalizador.rolDe(relacion, relacion.getDestino())];
      roles.sort();
      comprobarIgual(roles.join(","), "aprendiz,maestro", relacion.getId() + ": uno es el maestro y el otro, el aprendiz");
      if (id === "STUDENT_OF") {
        comprobarIgual(normalizador.rolDe(relacion, relacion.getOrigen()), "aprendiz", relacion.getId() +
          ": el origen de la flecha es el alumno");
      }
      comprobar(piezas.equivalencias.getIds(relacion.getTipo()).includes(MedidasRelevancia.TIPOS.MENTORIA),
        "cuenta como mentoría también en el laboratorio");
    }
  }
  comprobarIgual(vistos.STUDENT_OF + "," + vistos.Apprenticeship, "6,10", "las que hay en los datos");
});
