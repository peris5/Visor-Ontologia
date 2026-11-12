import { prueba, comprobar, comprobarIgual } from './miniPruebas.js';
import { FabricaEntidades } from '../src/datos/FabricaEntidades.js';
import { Persona } from '../src/modelo/Persona.js';
import { Organizacion } from '../src/modelo/Organizacion.js';
import { ObraDeArte } from '../src/modelo/ObraDeArte.js';
import { Entidad } from '../src/modelo/Entidad.js';

/*
 * Pruebas de FabricaEntidades.crearDesdeNeo4j y de los nombres de Entidad.
 * La tabla etiquetasEntidad se escribe aquí: en la aplicación llega de la
 * configuración del servidor.
 */

const ETIQUETAS_ENTIDAD = { Person: "PERSONA", Organization: "ORGANIZACION", HeritageItem: "OBRA_DE_ARTE" };

prueba("FabricaEntidades: cada etiqueta de la tabla da su clase", function () {
  const persona = FabricaEntidades.crearDesdeNeo4j(["Person"], { name: "Ana" }, "a", "es", ETIQUETAS_ENTIDAD);
  const organizacion = FabricaEntidades.crearDesdeNeo4j(["Organization"], {}, "b", "es", ETIQUETAS_ENTIDAD);
  const obra = FabricaEntidades.crearDesdeNeo4j(["HeritageItem"], {}, "c", "es", ETIQUETAS_ENTIDAD);
  comprobar(persona instanceof Persona, "Person → Persona");
  comprobar(organizacion instanceof Organizacion, "Organization → Organizacion");
  comprobar(obra instanceof ObraDeArte, "HeritageItem → ObraDeArte");
  comprobarIgual(persona.getId(), "a", "id");
});

prueba("FabricaEntidades: las demás etiquetas son los subtipos", function () {
  const pintora = FabricaEntidades.crearDesdeNeo4j(["Person", "Creator", "Painter"], { name: "Ana" }, "a", "es",
    ETIQUETAS_ENTIDAD);
  comprobarIgual(pintora.getSubtipos().join(","), "Creator,Painter", "subtipos");
  // El orden de las etiquetas no importa para saber el tipo.
  const otra = FabricaEntidades.crearDesdeNeo4j(["Painter", "Person"], {}, "b", "es", ETIQUETAS_ENTIDAD);
  comprobar(otra instanceof Persona, "Painter, Person → Persona");
  comprobarIgual(otra.getSubtipos().join(","), "Painter", "subtipos");
});

prueba("FabricaEntidades: el nombre en el idioma configurado y sus alternativas", function () {
  const propiedades = { name_es: "Museo del Mar", name_ca: "Museu de la Mar", name_en: "Sea Museum" };
  const enCastellano = FabricaEntidades.crearDesdeNeo4j(["Organization"], propiedades, "m", "es", ETIQUETAS_ENTIDAD);
  const enValenciano = FabricaEntidades.crearDesdeNeo4j(["Organization"], propiedades, "m", "ca", ETIQUETAS_ENTIDAD);
  const enIngles = FabricaEntidades.crearDesdeNeo4j(["Organization"], propiedades, "m", "en", ETIQUETAS_ENTIDAD);
  comprobarIgual(enCastellano.getNombre(), "Museo del Mar", "es");
  comprobarIgual(enValenciano.getNombre(), "Museu de la Mar", "ca");
  comprobarIgual(enIngles.getNombre(), "Sea Museum", "en");
  // Sin nombre en inglés: el primero que haya en el orden es → ca → en.
  const soloValenciano = FabricaEntidades.crearDesdeNeo4j(["Organization"], { name_ca: "Museu" }, "n", "en",
    ETIQUETAS_ENTIDAD);
  comprobarIgual(soloValenciano.getNombre(), "Museu", "alternativa");
  const sinNombre = FabricaEntidades.crearDesdeNeo4j(["HeritageItem"], {}, "o", "es", ETIQUETAS_ENTIDAD);
  comprobarIgual(sinNombre.getNombre(), "(sin nombre)", "sin ningún nombre");
  comprobarIgual(enCastellano.getTodosLosNombres().join("|"), "Museo del Mar|Museu de la Mar|Sea Museum",
    "todos los nombres, para el buscador");
});

prueba("FabricaEntidades: una persona se llama «nombre apellidos»", function () {
  const persona = FabricaEntidades.crearDesdeNeo4j(["Person"], { name: "Elena", lastName: "Ferrando Peris" }, "n1",
    "es", ETIQUETAS_ENTIDAD);
  comprobarIgual(persona.getNombre(), "Elena Ferrando Peris", "nombre");
  comprobar(persona.getTodosLosNombres().includes("Ferrando Peris"), "los apellidos también sirven para buscar");
  const soloApellido = FabricaEntidades.crearDesdeNeo4j(["Person"], { lastName: "Peris" }, "n2", "es",
    ETIQUETAS_ENTIDAD);
  comprobarIgual(soloApellido.getNombre(), "Peris", "solo apellidos");
});

prueba("FabricaEntidades: las propiedades desconocidas van a los atributos", function () {
  const obra = FabricaEntidades.crearDesdeNeo4j(["HeritageItem"],
    { name_es: "Cuadro", dimensions: "10 × 20 cm", material: "lienzo", inventario: 1234, vacia: "" }, "c", "es",
    ETIQUETAS_ENTIDAD);
  const atributos = obra.getAtributos();
  comprobarIgual(atributos.get("dimensiones"), "10 × 20 cm", "dimensiones");
  comprobarIgual(atributos.get("material"), "lienzo", "propiedad nueva de la BD");
  comprobarIgual(atributos.get("inventario"), 1234, "otra propiedad nueva");
  comprobar(!atributos.has("name_es"), "el nombre no es un atributo");
  comprobar(!atributos.has("vacia"), "las propiedades vacías no se muestran");
});

prueba("FabricaEntidades: un nodo sin ninguna etiqueta de la tabla da un error claro", function () {
  let mensaje = "";
  try {
    FabricaEntidades.crearDesdeNeo4j(["Event", "Wedding"], {}, "e1", "es", ETIQUETAS_ENTIDAD);
  } catch (error) {
    mensaje = error.message;
  }
  comprobar(mensaje.includes("e1") && mensaje.includes("etiquetasEntidad"), "mensaje: " + mensaje);
});

prueba("Entidad: nombreEnIdioma para nodos que no son entidades (lugares, eventos)", function () {
  const lugar = { name_es: "Játiva", name_ca: "Xàtiva" };
  comprobarIgual(Entidad.nombreEnIdioma(lugar, "ca"), "Xàtiva", "ca");
  comprobarIgual(Entidad.nombreEnIdioma(lugar, "en"), "Játiva", "sin inglés: castellano");
  comprobarIgual(Entidad.nombreEnIdioma({ name: "Libro" }, "es"), "Libro", "name");
  comprobarIgual(Entidad.nombreEnIdioma(null, "es"), "", "sin propiedades");
});
