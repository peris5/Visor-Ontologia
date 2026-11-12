"""Genera servidor/datos/datos_ejemplo.json: un grafo inventado con la forma de Neo4j.

Se ejecuta desde la carpeta del proyecto:
    .venv\\Scripts\\python.exe -m servidor.datos.generar_datos_ejemplo

Herramienta de desarrollo: la aplicación no la usa. Con la semilla fija
(random.seed(2026)) genera siempre exactamente los mismos datos.
"""
import asyncio
import json
import random
from pathlib import Path
from typing import Any

CARPETA_DATOS = Path(__file__).resolve().parent
ARCHIVO_DATOS = CARPETA_DATOS / "datos_ejemplo.json"
ARCHIVO_VECINDARIO_PRUEBAS = CARPETA_DATOS.parent.parent / "tests" / "vecindarioEjemplo.json"
SEMILLA = 2026

COMENTARIO = (
    "Datos INVENTADOS (ninguna persona real) con la misma estructura que el diseño de la base de datos "
    "Neo4j del proyecto REFRACTS (docs/diseno_bd_refracts.json). Los genera "
    "servidor/datos/generar_datos_ejemplo.py. Las etiquetas, tipos de relación y propiedades son "
    "EXACTAMENTE los del diseño, erratas incluidas (Ubication, Employement, OCURRED_AT, coworking...): no "
    "se corrigen porque la aplicación tiene que funcionar con los nombres tal cual estén en la BD real. "
    "Solo se han quitado los espacios del final de algunas etiquetas del diseño ('Death ', 'Friendship '...). "
    "Igual que la BD real, ninguna relación tiene 'relevance': se asigna al consultar. "
    "'jerarquia' copia los IS_A del diseño (cada etiqueta -> su padre). Se supone que en la BD real los "
    "subtipos son varias etiquetas en el mismo nodo (:Event:Creation:Paint); falta confirmar si son una "
    "taxonomía aparte. Del diseño se ha quitado 'Event IS_A Creation', que con 'Creation IS_A Event' "
    "formaría un ciclo. Los elementos con '_comentario' no están en el diseño: son de prueba."
)

COMENTARIO_PRUEBA_APRENDIZAJE = ("DE PRUEBA: Apprenticeship no está en el diseño. Sirve para comprobar que "
                                 "un subtipo nuevo funciona sin tocar el código.")
COMENTARIO_PRUEBA_ALUMNO = ("DE PRUEBA: STUDENT_OF no está en el diseño. Sirve para comprobar que una "
                            "relación directa entre personas funciona sin tocar el código.")

# Los IS_A del diseño (cada etiqueta -> su padre), más Apprenticeship (de prueba).
JERARQUIA = {
    "Creator": "Person", "Painter": "Creator", "Designer": "Creator",
    "Birth": "Event", "Death": "Event", "Live": "Event", "Work": "Event", "Fund": "Event",
    "Wedding": "Event", "Exposition": "Event", "Creation": "Event",
    "Paint": "Creation", "Design": "Creation",
    "Related": "Relationship", "Professional": "Relationship", "Friendship": "Relationship",
    "Mentorship": "Relationship", "Marriage": "Related", "Filiation": "Related",
    "Employement": "Professional", "coworking": "Professional",
    "Book": "ExternalSource", "API": "ExternalSource", "Web": "ExternalSource",
    "Apprenticeship": "Professional",
    "_comentarioApprenticeship": COMENTARIO_PRUEBA_APRENDIZAJE,
}

NOMBRES_MUJER = ["Elena", "Amparo", "Carmela", "Rosario", "Vicenta", "Pilar", "Dolores", "Teresa", "Josefa",
                 "Inmaculada", "Remedios", "Encarna", "Leonor", "Matilde", "Consuelo", "Asunción", "Genoveva",
                 "Zoraida", "Ximena", "Blanca", "Marina", "Irene", "Lucía", "Adela", "Eulalia"]
NOMBRES_HOMBRE = ["Joaquín", "Vicent", "Ramón", "Salvador", "Bernat", "Desiderio", "Fausto", "Tomás", "Casimiro",
                  "Luis", "Ernesto", "Gaspar", "Rafael", "Ignacio", "Nicasio", "Ulises", "Ferran", "Andreu",
                  "Jaume", "Lorenzo", "Mateo", "Julián", "Óscar", "Baltasar", "Ricard"]
APELLIDOS = ["Ferrando", "Peris", "Albereda", "Hortolà", "Belloch", "Sanchis", "Orellana", "Llorach", "Castellví",
             "Zaragozí", "Juncosa", "Monfort", "Herranz", "Valldecabres", "Tormo", "Pastor", "Lacasta", "Ortells",
             "Nebot", "Mascarell", "Peñarroja", "Barberà", "Climent", "Gisbert", "Estellés", "Roig", "Soler",
             "Vidal", "Escrivà", "Ballester"]

# (nombre en castellano, en valenciano, en inglés) de lugares para las organizaciones.
TOPONIMOS = [("Santa Brígida", "Santa Brígida", "Saint Brigid"), ("Montcabrer", "Montcabrer", "Montcabrer"),
             ("Les Arenes", "Les Arenes", "Les Arenes"), ("Torrealta", "Torrealta", "Torrealta"),
             ("Penyagolosa", "Penyagolosa", "Penyagolosa"), ("San Telmo", "Sant Telm", "Saint Elmo"),
             ("El Pilar", "El Pilar", "El Pilar"), ("Valldigna", "Valldigna", "Valldigna"),
             ("Bellavista", "Bellavista", "Bellavista"), ("Las Rocas", "Les Roques", "The Rocks")]
TIPOS_ORGANIZACION = [
    ("Academia de Bellas Artes de {0}", "Acadèmia de Belles Arts de {1}", "{2} Academy of Fine Arts"),
    ("Museo de {0}", "Museu de {1}", "{2} Museum"),
    ("Escuela de Artes y Oficios de {0}", "Escola d'Arts i Oficis de {1}", "{2} School of Arts and Crafts"),
    ("Taller de {0}", "Taller de {1}", "{2} Workshop"),
    ("Fundación {0}", "Fundació {1}", "{2} Foundation"),
    ("Galería {0}", "Galeria {1}", "{2} Gallery"),
    ("Círculo de Artistas de {0}", "Cercle d'Artistes de {1}", "{2} Artists' Circle"),
]
COSAS = [("granadas", "magranes", "pomegranates"), ("naranjas", "taronges", "oranges"),
         ("jarra azul", "gerra blava", "blue jug"), ("flores secas", "flors seques", "dried flowers"),
         ("peces", "peixos", "fish"), ("abanico", "ventall", "fan")]
PAISAJES = [("la albufera", "l'albufera", "the lagoon"), ("la huerta", "l'horta", "the orchards"),
            ("el puerto", "el port", "the harbour"), ("la montaña", "la muntanya", "the mountain"),
            ("la playa al amanecer", "la platja a l'alba", "the beach at dawn"), ("el mercado", "el mercat", "the market")]
ACTIVIDADES_TRABAJO = ["restaurador/a", "conservador/a", "profesor/a", "ilustrador/a", "copista"]

# (castellano, valenciano, inglés, nivel administrativo, latitud, longitud, provincia o país en el que está)
LUGARES = [
    ("España", "Espanya", "Spain", "pais", 40.4, -3.7, None),
    ("Valencia", "València", "Valencia", "provincia", 39.47, -0.38, "España"),
    ("Castellón", "Castelló", "Castellón", "provincia", 39.99, -0.05, "España"),
    ("Alicante", "Alacant", "Alicante", "provincia", 38.35, -0.48, "España"),
    ("Barcelona", "Barcelona", "Barcelona", "provincia", 41.39, 2.17, "España"),
    ("Valencia", "València", "Valencia", "municipio", 39.47, -0.38, "Valencia"),
    ("Gandía", "Gandia", "Gandia", "municipio", 38.97, -0.18, "Valencia"),
    ("Játiva", "Xàtiva", "Xàtiva", "municipio", 38.99, -0.52, "Valencia"),
    ("Alcira", "Alzira", "Alzira", "municipio", 39.15, -0.43, "Valencia"),
    ("Castellón de la Plana", "Castelló de la Plana", "Castellón de la Plana", "municipio", 39.99, -0.05, "Castellón"),
    ("Villarreal", "Vila-real", "Vila-real", "municipio", 39.94, -0.10, "Castellón"),
    ("Alicante", "Alacant", "Alicante", "municipio", 38.35, -0.48, "Alicante"),
    ("Elche", "Elx", "Elche", "municipio", 38.27, -0.70, "Alicante"),
    ("Alcoy", "Alcoi", "Alcoy", "municipio", 38.70, -0.47, "Alicante"),
    ("Barcelona", "Barcelona", "Barcelona", "municipio", 41.39, 2.17, "Barcelona"),
]

NUMERO_PERSONAS = 120
NUMERO_ORGANIZACIONES = 25
NUMERO_OBRAS = 60
NUMERO_GRUPOS = 10


class GeneradorDatosEjemplo:
    """Crea el grafo de ejemplo. Primero las entidades (así la persona n1 es
    la primera) y los lugares, y después, grupo a grupo (talleres), las
    relaciones (nodos Relationship) y los eventos (nodos Event), con sus
    periodos, lugares, imágenes y fuentes.

    Hay de todo lo que necesitan las pruebas: todos los tipos del diseño,
    varias relaciones entre el mismo par, caminos de 3 o más saltos,
    intermediarios con más de 10 entidades, relaciones que se ignoran
    (PROMPTED, TRIGGERED, LED_TO), y los dos elementos de prueba que no están
    en el diseño (Apprenticeship y STUDENT_OF).
    """

    def __init__(self) -> None:
        self.__nodos: list[dict[str, Any]] = []
        self.__relaciones: list[dict[str, Any]] = []
        self.__mujeres: set[str] = set()
        self.__nombres: dict[str, str] = {}
        self.__ciudades: list[str] = []
        self.__ciudad_de_organizacion: dict[str, str] = {}
        self.__fuentes: list[str] = []

    def generar(self) -> dict[str, Any]:
        """Genera los datos (siempre los mismos). Usar un objeto nuevo cada vez."""
        random.seed(SEMILLA)
        personas = self.__crear_personas()
        organizaciones = self.__crear_organizaciones()
        obras = self.__crear_obras()
        self.__crear_lugares()
        self.__crear_fuentes()
        self.__situar_organizaciones(organizaciones)
        grupos = self.__formar_grupos(personas, organizaciones)
        for grupo in grupos:
            self.__relaciones_del_grupo(grupo)
        self.__crear_obras_de_los_grupos(grupos, obras)
        self.__relaciones_entre_grupos(personas, grupos)
        self.__fundaciones(organizaciones, personas)
        self.__exposiciones(organizaciones, obras, personas)
        self.__trabajos(organizaciones, personas)
        self.__eventos_generales(personas)
        self.__vidas(personas)
        self.__alumnos_de_prueba(grupos)
        self.__imagenes(personas, organizaciones, obras)
        self.__fuentes_de_las_entidades(personas, organizaciones, obras)
        return {
            "_comentario": COMENTARIO,
            "jerarquia": dict(JERARQUIA),
            "nodos": self.__nodos,
            "relaciones": self.__relaciones,
        }

    # ───────────── Entidades y auxiliares ─────────────

    def __crear_personas(self) -> list[str]:
        """120 personas: 30 pintoras/es, 10 diseñadoras/es, 10 creadoras/es y el resto sin subtipo."""
        personas: list[str] = []
        combinaciones_usadas: set[str] = set()
        for indice in range(NUMERO_PERSONAS):
            es_mujer = indice % 2 == 0
            if indice == 0:
                nombre = "Elena"
                apellidos = "Ferrando Peris"
            else:
                nombre = self.__elegir_nombre(es_mujer)
                apellidos = random.choice(APELLIDOS) + " " + random.choice(APELLIDOS)
                while nombre + apellidos in combinaciones_usadas:
                    apellidos = random.choice(APELLIDOS) + " " + random.choice(APELLIDOS)
            combinaciones_usadas.add(nombre + apellidos)
            etiquetas = ["Person"]
            if indice < 30:
                etiquetas = ["Person", "Creator", "Painter"]
            elif indice < 40:
                etiquetas = ["Person", "Creator", "Designer"]
            elif indice < 50:
                etiquetas = ["Person", "Creator"]
            id_persona = self.__nodo(etiquetas, {"name": nombre, "lastName": apellidos})
            if es_mujer:
                self.__mujeres.add(id_persona)
            self.__nombres[id_persona] = nombre + " " + apellidos
            personas.append(id_persona)
        return personas

    @staticmethod
    def __elegir_nombre(es_mujer: bool) -> str:
        """(Privado) Un nombre propio al azar."""
        if es_mujer:
            return random.choice(NOMBRES_MUJER)
        return random.choice(NOMBRES_HOMBRE)

    def __crear_organizaciones(self) -> list[str]:
        """25 organizaciones con su nombre en castellano, valenciano e inglés."""
        organizaciones: list[str] = []
        usados: set[str] = set()
        indice = 0
        while len(organizaciones) < NUMERO_ORGANIZACIONES:
            plantilla = TIPOS_ORGANIZACION[indice % len(TIPOS_ORGANIZACION)]
            toponimo = TOPONIMOS[(indice * 3) % len(TOPONIMOS)]
            indice = indice + 1
            nombre_es = plantilla[0].format(toponimo[0], toponimo[1], toponimo[2])
            if nombre_es in usados:
                toponimo = random.choice(TOPONIMOS)
                nombre_es = plantilla[0].format(toponimo[0], toponimo[1], toponimo[2])
            if nombre_es not in usados:
                usados.add(nombre_es)
                propiedades = {
                    "name_es": nombre_es,
                    "name_ca": plantilla[1].format(toponimo[0], toponimo[1], toponimo[2]),
                    "name_en": plantilla[2].format(toponimo[0], toponimo[1], toponimo[2]),
                }
                id_organizacion = self.__nodo(["Organization"], propiedades)
                self.__nombres[id_organizacion] = nombre_es
                organizaciones.append(id_organizacion)
        return organizaciones

    def __crear_obras(self) -> list[str]:
        """60 obras (HeritageItem) con nombre en tres idiomas y dimensiones."""
        obras: list[str] = []
        usados: set[str] = set()
        while len(obras) < NUMERO_OBRAS:
            nombres = self.__titulo_de_obra()
            if nombres[0] not in usados:
                usados.add(nombres[0])
                alto = random.randint(3, 25) * 10
                ancho = random.randint(3, 25) * 10
                propiedades = {"name_es": nombres[0], "name_ca": nombres[1], "name_en": nombres[2],
                               "dimensions": str(alto) + " × " + str(ancho) + " cm"}
                id_obra = self.__nodo(["HeritageItem"], propiedades)
                self.__nombres[id_obra] = nombres[0]
                obras.append(id_obra)
        return obras

    @staticmethod
    def __titulo_de_obra() -> tuple[str, str, str]:
        """(Privado) Un título inventado en tres idiomas."""
        clase = random.randint(0, 2)
        if clase == 0:
            cosa = random.choice(COSAS)
            return ("Bodegón con " + cosa[0], "Natura morta amb " + cosa[1], "Still life with " + cosa[2])
        if clase == 1:
            paisaje = random.choice(PAISAJES)
            return ("Vista de " + paisaje[0], "Vista de " + paisaje[1], "View of " + paisaje[2])
        nombre = random.choice(NOMBRES_MUJER + NOMBRES_HOMBRE)
        return ("Retrato de " + nombre, "Retrat de " + nombre, "Portrait of " + nombre)

    def __crear_lugares(self) -> None:
        """15 lugares (Ubication): un país, 4 provincias y 10 municipios, con IS_IN."""
        por_nombre_y_nivel: dict[str, str] = {}
        for lugar in LUGARES:
            propiedades = {"name_es": lugar[0], "name_ca": lugar[1], "name_en": lugar[2], "adminLevel": lugar[3],
                           "coordinates": {"latitude": lugar[4], "longitude": lugar[5]}}
            id_lugar = self.__nodo(["Ubication"], propiedades)
            por_nombre_y_nivel[lugar[0] + "|" + lugar[3]] = id_lugar
            if lugar[3] == "municipio":
                self.__ciudades.append(id_lugar)
            if lugar[6] is not None:
                nivel_del_que_lo_contiene = "provincia"
                if lugar[3] == "provincia":
                    nivel_del_que_lo_contiene = "pais"
                self.__relacion("IS_IN", id_lugar, por_nombre_y_nivel[lugar[6] + "|" + nivel_del_que_lo_contiene], {})

    def __crear_fuentes(self) -> None:
        """Seis fuentes externas inventadas: dos de cada subtipo (Book, API, Web)."""
        libros = [("Diccionario de pintores levantinos", "978-84-0000-001-1", "Ediciones del Turia", "1998"),
                  ("Talleres y academias del siglo XIX", "978-84-0000-002-8", "Editorial Mediterránea", "2005")]
        for libro in libros:
            self.__fuentes.append(self.__nodo(["ExternalSource", "Book"], {
                "name": libro[0], "url": "", "lastUpdated": libro[3] + "-01-01", "isAutomated": False,
                "ISBN": libro[1], "Editorial": libro[2], "Published": libro[3]}))
        apis = ["Catálogo Digital de Patrimonio", "Registro de Bienes Culturales"]
        for indice in range(len(apis)):
            self.__fuentes.append(self.__nodo(["ExternalSource", "API"], {
                "name": apis[indice], "url": "https://example.org/api/fuente" + str(indice + 1),
                "lastUpdated": "2026-10-0" + str(indice + 1), "isAutomated": True}))
        webs = ["Archivo de la Academia", "Enciclopedia del Arte Valenciano"]
        for indice in range(len(webs)):
            self.__fuentes.append(self.__nodo(["ExternalSource", "Web"], {
                "name": webs[indice], "url": "https://example.org/web/fuente" + str(indice + 1),
                "lastUpdated": "2026-09-1" + str(indice), "isAutomated": False, "scrapable": indice == 0}))

    def __situar_organizaciones(self, organizaciones: list[str]) -> None:
        """Cada organización está en un municipio (LOCATED_IN)."""
        for id_organizacion in organizaciones:
            ciudad = random.choice(self.__ciudades)
            self.__ciudad_de_organizacion[id_organizacion] = ciudad
            self.__relacion("LOCATED_IN", id_organizacion, ciudad, {})

    # ───────────── Grupos (talleres) ─────────────

    def __formar_grupos(self, personas: list[str], organizaciones: list[str]) -> list[dict[str, Any]]:
        """10 grupos: cada uno con un maestro (de las 10 primeras personas,
        pintoras), 11 miembros, una organización y un año de comienzo.
        """
        resto = list(personas[NUMERO_GRUPOS:])
        random.shuffle(resto)
        grupos: list[dict[str, Any]] = []
        por_grupo = len(resto) // NUMERO_GRUPOS
        for indice in range(NUMERO_GRUPOS):
            miembros = resto[indice * por_grupo:(indice + 1) * por_grupo]
            organizacion = organizaciones[indice]
            grupos.append({
                "maestro": personas[indice],
                "miembros": miembros,
                "organizacion": organizacion,
                "ciudad": self.__ciudad_de_organizacion[organizacion],
                "comienzo": random.randint(1880, 1905),
            })
        return grupos

    def __relaciones_del_grupo(self, grupo: dict[str, Any]) -> None:
        """Mentorías, aprendizaje (de prueba), empleo, colaboraciones y amistades del grupo."""
        maestro = grupo["maestro"]
        miembros = grupo["miembros"]
        comienzo = grupo["comienzo"]
        for discipulo in miembros[0:3]:
            self.__intermediario(["Relationship", "Mentorship"],
                                 [(maestro, self.__segun_genero(maestro, "maestra", "maestro")),
                                  (discipulo, self.__segun_genero(discipulo, "discípula", "discípulo"))],
                                 (comienzo, comienzo + random.randint(4, 10)), grupo["ciudad"], None, None)
        self.__intermediario(["Relationship", "Professional", "Apprenticeship"],
                             [(maestro, self.__segun_genero(maestro, "maestra", "maestro")),
                              (miembros[3], "aprendiz")],
                             (comienzo + 1, comienzo + 4), grupo["ciudad"], None, COMENTARIO_PRUEBA_APRENDIZAJE)
        self.__intermediario(["Relationship", "Professional", "Employement"],
                             [(maestro, self.__segun_genero(maestro, "directora", "director"))],
                             (comienzo, comienzo + 20), None, grupo["organizacion"], None)
        for empleado in miembros[4:6]:
            self.__intermediario(["Relationship", "Professional", "Employement"],
                                 [(empleado, self.__segun_genero(empleado, "profesora", "profesor"))],
                                 (comienzo + 3, comienzo + 12), None, grupo["organizacion"], None)
        for indice in range(3):
            primero = miembros[6 + indice]
            segundo = miembros[(7 + indice * 2) % len(miembros)]
            if primero != segundo:
                self.__intermediario(["Relationship", "Professional", "coworking"],
                                     [(primero, self.__segun_genero(primero, "colaboradora", "colaborador")),
                                      (segundo, self.__segun_genero(segundo, "colaboradora", "colaborador"))],
                                     (comienzo + 2, comienzo + 6), grupo["ciudad"], grupo["organizacion"], None)
        for indice in range(3):
            primero = miembros[indice]
            segundo = miembros[len(miembros) - 1 - indice]
            self.__intermediario(["Relationship", "Friendship"],
                                 [(primero, self.__segun_genero(primero, "amiga", "amigo")),
                                  (segundo, self.__segun_genero(segundo, "amiga", "amigo"))],
                                 None, None, None, None)
        # El mismo par con dos relaciones: el maestro y su primer discípulo también colaboran.
        self.__intermediario(["Relationship", "Professional", "coworking"],
                             [(maestro, self.__segun_genero(maestro, "colaboradora", "colaborador")),
                              (miembros[0], self.__segun_genero(miembros[0], "colaboradora", "colaborador"))],
                             (comienzo + 8, comienzo + 12), grupo["ciudad"], None, None)

    def __crear_obras_de_los_grupos(self, grupos: list[dict[str, Any]], obras: list[str]) -> None:
        """Cada obra la crea alguien de un grupo (evento Creation, Paint o Design)."""
        for indice in range(len(obras)):
            obra = obras[indice]
            grupo = grupos[indice % len(grupos)]
            autores = [grupo["maestro"]] + grupo["miembros"]
            autor = random.choice(autores)
            participantes = [(autor, self.__segun_genero(autor, "autora", "autor"))]
            if random.random() < 0.2:
                coautor = random.choice(autores)
                if coautor != autor:
                    participantes.append((coautor, self.__segun_genero(coautor, "coautora", "coautor")))
            etiquetas = ["Event", "Creation"]
            if self.__tiene_etiqueta(autor, "Painter"):
                etiquetas = ["Event", "Creation", "Paint"]
            elif self.__tiene_etiqueta(autor, "Designer"):
                etiquetas = ["Event", "Creation", "Design"]
            anio = grupo["comienzo"] + random.randint(0, 25)
            titulo = self.__nombres[obra]
            nombres = ("Creación de «" + titulo + "»", "Creació de «" + titulo + "»", "Creation of «" + titulo + "»")
            id_evento = self.__evento(etiquetas, nombres, participantes, (anio, anio), grupo["ciudad"], str(anio), None)
            self.__relacion("PRODUCED", id_evento, obra, {})
            # En el diseño, Creation tiene PRODUCED y CREATE hacia la obra. Algunas
            # creaciones usan las dos: la obra no debe salir dos veces.
            if indice % 5 == 0:
                self.__relacion("CREATE", id_evento, obra, {})

    def __relaciones_entre_grupos(self, personas: list[str], grupos: list[dict[str, Any]]) -> None:
        """Matrimonios (y bodas), filiaciones, parentescos, amistades y otras
        relaciones entre personas de distintos grupos. También LED_TO y TRIGGERED,
        que se ignoran.
        """
        # La primera persona (n1) se casa con su primer discípulo, con quien
        # también colabora: dos relaciones distintas entre el mismo par.
        parejas = [(personas[0], grupos[0]["miembros"][0])]
        while len(parejas) < 15:
            una = random.choice(personas)
            otra = random.choice(personas)
            if una != otra and (una in self.__mujeres) != (otra in self.__mujeres):
                parejas.append((una, otra))
        for indice in range(len(parejas)):
            una = parejas[indice][0]
            otra = parejas[indice][1]
            anio = random.randint(1885, 1915)
            id_matrimonio = self.__intermediario(
                ["Relationship", "Related", "Marriage"],
                [(una, self.__segun_genero(una, "esposa", "esposo")), (otra, self.__segun_genero(otra, "esposa", "esposo"))],
                (anio, anio + random.randint(10, 40)), random.choice(self.__ciudades), None, None)
            if indice < 8:
                testigos = [random.choice(personas), random.choice(personas)]
                participantes = [(una, self.__segun_genero(una, "novia", "novio")),
                                 (otra, self.__segun_genero(otra, "novia", "novio"))]
                for testigo in testigos:
                    if testigo != una and testigo != otra:
                        participantes.append((testigo, "testigo"))
                nombres = ("Boda de " + self.__nombres[una] + " y " + self.__nombres[otra],
                           "Boda de " + self.__nombres[una] + " i " + self.__nombres[otra],
                           "Wedding of " + self.__nombres[una] + " and " + self.__nombres[otra])
                id_boda = self.__evento(["Event", "Wedding"], nombres, participantes, (anio, anio),
                                        random.choice(self.__ciudades), str(anio), None)
                self.__relacion("TRIGGERED", id_boda, id_matrimonio, {})
        for indice in range(12):
            madre_o_padre = personas[random.randint(0, 59)]
            hija_o_hijo = personas[random.randint(60, NUMERO_PERSONAS - 1)]
            self.__intermediario(["Relationship", "Related", "Filiation"],
                                 [(madre_o_padre, self.__segun_genero(madre_o_padre, "madre", "padre")),
                                  (hija_o_hijo, self.__segun_genero(hija_o_hijo, "hija", "hijo"))],
                                 None, None, None, None)
        for indice in range(3):
            self.__pareja_de_personas(personas, ["Relationship", "Related"], "prima", "primo")
        for indice in range(15):
            id_amistad = self.__pareja_de_personas(personas, ["Relationship", "Friendship"], "amiga", "amigo")
            if indice < 3:
                id_socios = self.__pareja_de_personas(personas, ["Relationship", "Professional"], "socia", "socio")
                self.__relacion("LED_TO", id_amistad, id_socios, {})
        for indice in range(2):
            self.__pareja_de_personas(personas, ["Relationship"], "conocida", "conocido")

    def __pareja_de_personas(self, personas: list[str], etiquetas: list[str], rol_mujer: str, rol_hombre: str) -> str:
        """(Privado) Un intermediario entre dos personas distintas al azar."""
        una = random.choice(personas)
        otra = random.choice(personas)
        while otra == una:
            otra = random.choice(personas)
        return self.__intermediario(etiquetas, [(una, self.__segun_genero(una, rol_mujer, rol_hombre)),
                                                (otra, self.__segun_genero(otra, rol_mujer, rol_hombre))],
                                    None, None, None, None)

    def __fundaciones(self, organizaciones: list[str], personas: list[str]) -> None:
        """Cada organización tiene un evento Fund con sus fundadores (CREATE)."""
        for id_organizacion in organizaciones:
            fundadores = [random.choice(personas)]
            if random.random() < 0.4:
                otro = random.choice(personas)
                if otro != fundadores[0]:
                    fundadores.append(otro)
            participantes: list[tuple[str, str]] = []
            for fundador in fundadores:
                participantes.append((fundador, self.__segun_genero(fundador, "fundadora", "fundador")))
            anio = random.randint(1860, 1900)
            nombre = self.__nombres[id_organizacion]
            nombres = ("Fundación de " + nombre, "Fundació de " + nombre, "Founding of " + nombre)
            id_evento = self.__evento(["Event", "Fund"], nombres, participantes, (anio, anio),
                                      self.__ciudad_de_organizacion[id_organizacion], str(anio), None)
            self.__relacion("CREATE", id_evento, id_organizacion, {})

    def __exposiciones(self, organizaciones: list[str], obras: list[str], personas: list[str]) -> None:
        """8 exposiciones con 2-5 obras y una comisaria, y una muy grande con 12
        obras (más del límite de participantes: no crea relaciones).
        """
        for indice in range(9):
            sede = random.choice(organizaciones)
            numero_de_obras = random.randint(2, 5)
            if indice == 8:
                numero_de_obras = 12
            expuestas = random.sample(obras, numero_de_obras)
            comisario = random.choice(personas)
            anio = random.randint(1895, 1935)
            nombre_sede = self.__nombres[sede]
            nombres = ("Exposición en " + nombre_sede, "Exposició a " + nombre_sede, "Exhibition at " + nombre_sede)
            id_evento = self.__evento(["Event", "Exposition"], nombres,
                                      [(comisario, self.__segun_genero(comisario, "comisaria", "comisario"))],
                                      (anio, anio), None, str(anio), sede)
            for obra in expuestas:
                self.__relacion("IS_EXPOSED", id_evento, obra, {})

    def __trabajos(self, organizaciones: list[str], personas: list[str]) -> None:
        """20 eventos Work: una persona trabaja en una organización."""
        for indice in range(20):
            trabajador = random.choice(personas)
            lugar_de_trabajo = random.choice(organizaciones)
            anio = random.randint(1890, 1935)
            nombre = self.__nombres[lugar_de_trabajo]
            nombres = ("Trabajo en " + nombre, "Treball a " + nombre, "Work at " + nombre)
            self.__evento(["Event", "Work"], nombres, [(trabajador, random.choice(ACTIVIDADES_TRABAJO))],
                          (anio, anio + random.randint(1, 6)), None, str(anio), lugar_de_trabajo)

    def __eventos_generales(self, personas: list[str]) -> None:
        """Dos congresos con 14 asistentes (más del límite) y tres tertulias
        con 4 (co-participación en un evento). Una mentoría PROMPTED la primera tertulia.
        """
        for indice in range(5):
            numero = 4
            nombres = ("Tertulia del café " + str(indice - 1), "Tertúlia del cafè " + str(indice - 1),
                       "Café gathering " + str(indice - 1))
            if indice < 2:
                numero = 14
                nombres = ("Congreso de Bellas Artes " + str(1900 + indice * 10),
                           "Congrés de Belles Arts " + str(1900 + indice * 10),
                           "Fine Arts Congress " + str(1900 + indice * 10))
            asistentes = random.sample(personas, numero)
            participantes: list[tuple[str, str]] = []
            for asistente in asistentes:
                participantes.append((asistente, "asistente"))
            anio = random.randint(1895, 1925)
            id_evento = self.__evento(["Event"], nombres, participantes, (anio, anio),
                                      random.choice(self.__ciudades), str(anio), None)
            if indice == 2:
                for relacion in self.__relaciones:
                    if relacion["tipo"] == "HAS_ROLE_IN" and relacion["desde"] == asistentes[0]:
                        self.__relacion("PROMPTED", relacion["hasta"], id_evento, {})
                        break

    def __vidas(self, personas: list[str]) -> None:
        """Nacimiento de todas, defunción de la mayoría y residencia de la mitad
        (Birth, Death y Live: no crean relaciones, van al detalle).
        """
        for persona in personas:
            nacimiento = random.randint(1840, 1895)
            nombre = self.__nombres[persona]
            self.__evento(["Event", "Birth"], ("Nacimiento de " + nombre, "Naixement de " + nombre, "Birth of " + nombre),
                          [(persona, "")], (nacimiento, nacimiento), random.choice(self.__ciudades),
                          str(nacimiento), None)
            if random.random() < 0.5:
                desde = nacimiento + random.randint(20, 30)
                self.__evento(["Event", "Live"], ("Residencia de " + nombre, "Residència de " + nombre,
                                                  "Residence of " + nombre),
                              [(persona, "")], (desde, desde + random.randint(5, 30)),
                              random.choice(self.__ciudades), None, None)
            if random.random() < 0.7:
                defuncion = nacimiento + random.randint(50, 85)
                self.__evento(["Event", "Death"], ("Defunción de " + nombre, "Defunció de " + nombre, "Death of " + nombre),
                              [(persona, "")], (defuncion, defuncion), random.choice(self.__ciudades),
                              str(defuncion), None)

    def __alumnos_de_prueba(self, grupos: list[dict[str, Any]]) -> None:
        """Relaciones DIRECTAS STUDENT_OF (de prueba, no están en el diseño):
        un miembro de cada uno de los 6 primeros grupos es alumno del maestro
        del grupo siguiente.
        """
        for indice in range(6):
            alumno = grupos[indice]["miembros"][10]
            maestro = grupos[indice + 1]["maestro"]
            self.__relacion("STUDENT_OF", alumno, maestro, {}, COMENTARIO_PRUEBA_ALUMNO)

    def __imagenes(self, personas: list[str], organizaciones: list[str], obras: list[str]) -> None:
        """Imágenes (Image, HAS_IMAGE con "order") de 40 personas, todas las
        organizaciones y todas las obras. La primera persona tiene dos.
        """
        entidades = personas[0:40] + organizaciones + obras
        for id_entidad in entidades:
            numero = 1
            if id_entidad == personas[0] or random.random() < 0.15:
                numero = 2
            for orden in range(1, numero + 1):
                pie = self.__nombres[id_entidad]
                if orden > 1:
                    pie = pie + " (detalle)"
                id_imagen = self.__nodo(["Image"], {"url": "", "caption": pie})
                self.__nodo_por_id(id_imagen)["propiedades"]["url"] = "https://example.org/imagenes/" + id_imagen + ".jpg"
                self.__relacion("HAS_IMAGE", id_entidad, id_imagen, {"order": orden})

    def __fuentes_de_las_entidades(self, personas: list[str], organizaciones: list[str], obras: list[str]) -> None:
        """Cada entidad tiene una o dos fuentes externas; también algunas
        relaciones y eventos (HAS_EXTERNAL_SOURCE con dateUpdated y externalId).
        """
        numero_de_referencia = 1
        for id_entidad in personas + organizaciones + obras:
            fuentes = [random.choice(self.__fuentes)]
            if id_entidad == personas[0] or random.random() < 0.3:
                otra = random.choice(self.__fuentes)
                if otra != fuentes[0]:
                    fuentes.append(otra)
            if id_entidad == personas[0]:
                fuentes = [self.__fuentes[0], self.__fuentes[2], self.__fuentes[4]]
            for fuente in fuentes:
                self.__relacion("HAS_EXTERNAL_SOURCE", id_entidad, fuente, {
                    "dateUpdated": "2026-" + str(random.randint(1, 9)).rjust(2, "0") + "-15",
                    "externalId": "REF-" + str(numero_de_referencia).rjust(5, "0")})
                numero_de_referencia = numero_de_referencia + 1
        for nodo in list(self.__nodos):
            es_relacion_o_evento = "Relationship" in nodo["etiquetas"] or "Exposition" in nodo["etiquetas"]
            if es_relacion_o_evento and random.random() < 0.1:
                self.__relacion("HAS_EXTERNAL_SOURCE", nodo["id"], random.choice(self.__fuentes), {
                    "dateUpdated": "2026-10-01", "externalId": "REF-" + str(numero_de_referencia).rjust(5, "0")})
                numero_de_referencia = numero_de_referencia + 1

    # ───────────── Ayudas ─────────────

    def __intermediario(self, etiquetas: list[str], participantes: list[tuple[str, str]],
                        periodo: tuple[int, int] | None, lugar: str | None, organizacion: str | None,
                        comentario: str | None) -> str:
        """(Privado) Un nodo Relationship (o subtipo) con HAS_ROLE_IN de cada persona."""
        id_nodo = self.__nodo(etiquetas, {}, comentario)
        for participante in participantes:
            self.__relacion("HAS_ROLE_IN", participante[0], id_nodo, {"role": participante[1]})
        self.__completar(id_nodo, periodo, lugar, None, organizacion)
        return id_nodo

    def __evento(self, etiquetas: list[str], nombres: tuple[str, str, str], participantes: list[tuple[str, str]],
                 periodo: tuple[int, int] | None, lugar: str | None, fecha: str | None,
                 organizacion: str | None) -> str:
        """(Privado) Un nodo Event (o subtipo) con PARTICIPATES_IN de cada persona."""
        id_nodo = self.__nodo(etiquetas, {"name_es": nombres[0], "name_ca": nombres[1], "name_en": nombres[2]})
        for participante in participantes:
            propiedades: dict[str, Any] = {}
            if participante[1] != "":
                propiedades = {"role": participante[1]}
            self.__relacion("PARTICIPATES_IN", participante[0], id_nodo, propiedades)
        self.__completar(id_nodo, periodo, lugar, fecha, organizacion)
        return id_nodo

    def __completar(self, id_nodo: str, periodo: tuple[int, int] | None, lugar: str | None,
                    fecha: str | None, organizacion: str | None) -> None:
        """(Privado) Periodo (OCURRED_DURING), lugar (TOOK_PLACE_AT) y
        organización (OCURRED_AT) de un intermediario. La fecha ("date") va en
        TOOK_PLACE_AT y OCURRED_AT, como en el diseño.
        """
        propiedades_fecha: dict[str, Any] = {}
        if fecha is not None:
            propiedades_fecha = {"date": fecha}
        if periodo is not None:
            descripcion = ""
            if periodo[0] != periodo[1]:
                descripcion = "Entre " + str(periodo[0]) + " y " + str(periodo[1])
            id_periodo = self.__nodo(["Period"], {"from": str(periodo[0]), "to": str(periodo[1]),
                                                  "description": descripcion})
            self.__relacion("OCURRED_DURING", id_nodo, id_periodo, {})
        if lugar is not None:
            self.__relacion("TOOK_PLACE_AT", id_nodo, lugar, dict(propiedades_fecha))
        if organizacion is not None:
            self.__relacion("OCURRED_AT", id_nodo, organizacion, dict(propiedades_fecha))

    def __nodo(self, etiquetas: list[str], propiedades: dict[str, Any], comentario: str | None = None) -> str:
        """(Privado) Añade un nodo y devuelve su id (n1, n2...)."""
        id_nodo = "n" + str(len(self.__nodos) + 1)
        nodo: dict[str, Any] = {"id": id_nodo, "etiquetas": etiquetas, "propiedades": propiedades}
        if comentario is not None:
            nodo["_comentario"] = comentario
        self.__nodos.append(nodo)
        return id_nodo

    def __nodo_por_id(self, id_nodo: str) -> dict[str, Any]:
        """(Privado) El nodo con ese id (los ids son n + posición)."""
        return self.__nodos[int(id_nodo[1:]) - 1]

    def __relacion(self, tipo: str, desde: str, hasta: str, propiedades: dict[str, Any],
                   comentario: str | None = None) -> None:
        """(Privado) Añade una relación (r1, r2...)."""
        relacion: dict[str, Any] = {"id": "r" + str(len(self.__relaciones) + 1), "tipo": tipo, "desde": desde,
                                    "hasta": hasta, "propiedades": propiedades}
        if comentario is not None:
            relacion["_comentario"] = comentario
        self.__relaciones.append(relacion)

    def __segun_genero(self, id_persona: str, femenino: str, masculino: str) -> str:
        """(Privado) El rol en femenino o en masculino."""
        if id_persona in self.__mujeres:
            return femenino
        return masculino

    def __tiene_etiqueta(self, id_nodo: str, etiqueta: str) -> bool:
        """(Privado) ¿Tiene el nodo esa etiqueta?"""
        return etiqueta in self.__nodo_por_id(id_nodo)["etiquetas"]


def convertir_a_texto(datos: dict[str, Any]) -> str:
    """El JSON con un nodo o una relación por línea (fácil de leer y de
    comparar con Git).
    """
    lineas = ["{"]
    lineas.append('  "_comentario": ' + json.dumps(datos["_comentario"], ensure_ascii=False) + ",")
    lineas.append('  "jerarquia": ' + json.dumps(datos["jerarquia"], ensure_ascii=False) + ",")
    lineas.append('  "nodos": [')
    lineas.append(",\n".join(lineas_json(datos["nodos"])))
    lineas.append("  ],")
    lineas.append('  "relaciones": [')
    lineas.append(",\n".join(lineas_json(datos["relaciones"])))
    lineas.append("  ]")
    lineas.append("}")
    return "\n".join(lineas) + "\n"


def lineas_json(elementos: list[dict[str, Any]]) -> list[str]:
    """Cada elemento como texto JSON en una sola línea, con sangría."""
    lineas: list[str] = []
    for elemento in elementos:
        lineas.append("    " + json.dumps(elemento, ensure_ascii=False))
    return lineas


def vecindario_de_pruebas(datos: dict[str, Any]) -> str:
    """El texto de tests/vecindarioEjemplo.json: los tipos (/api/tipos) y el
    vecindario completo de la entidad inicial con umbral 0 (/api/vecindario),
    calculados por el servidor sobre estos datos. Lo usan las pruebas del
    navegador, que así trabajan con el mismo formato que envía el servidor.
    """
    # Se importan aquí para que el generador no dependa del resto del
    # servidor cuando solo se generan los datos.
    from servidor.api.conversor_json import ConversorJson
    from servidor.datos.repositorio_simulado import RepositorioSimulado
    from servidor.logica.configuracion import Configuracion

    configuracion = Configuracion()
    configuracion.cargar_archivo(CARPETA_DATOS.parent / "configuracion.json")
    configuracion.comprobar()
    repositorio = RepositorioSimulado(datos, 0, configuracion)
    id_central = configuracion.get_entidad_inicial()
    tipos = asyncio.run(repositorio.obtener_tipos())
    vecindario = asyncio.run(repositorio.obtener_vecindario(id_central, 0, 2000))
    diccionario = ConversorJson.vecindario_a_diccionario(id_central, 0, vecindario)
    lineas = ["{"]
    lineas.append('  "_comentario": "Generado por servidor/datos/generar_datos_ejemplo.py: tipos y vecindario '
                  'completo (umbral 0) de la entidad inicial, tal como los envía el servidor.",')
    lineas.append('  "tipos": ' + json.dumps(tipos, ensure_ascii=False) + ",")
    lineas.append('  "vecindario": {')
    for clave in ["idCentral", "umbral", "recortado", "relevanciasAsignadas", "relevanciasReutilizadas"]:
        lineas.append('    "' + clave + '": ' + json.dumps(diccionario[clave]) + ",")
    lineas.append('    "entidades": [')
    lineas.append(",\n".join(lineas_json(diccionario["entidades"])))
    lineas.append("    ],")
    lineas.append('    "relaciones": [')
    lineas.append(",\n".join(lineas_json(diccionario["relaciones"])))
    lineas.append("    ]")
    lineas.append("  }")
    lineas.append("}")
    return "\n".join(lineas) + "\n"


def principal() -> None:
    """Genera los datos y los guarda en servidor/datos/datos_ejemplo.json;
    además, el vecindario de pruebas del navegador (tests/vecindarioEjemplo.json).
    """
    datos = GeneradorDatosEjemplo().generar()
    with open(ARCHIVO_DATOS, "w", encoding="utf-8", newline="\n") as archivo:
        archivo.write(convertir_a_texto(datos))
    print("Escrito " + str(ARCHIVO_DATOS) + ": " + str(len(datos["nodos"])) + " nodos y "
          + str(len(datos["relaciones"])) + " relaciones.")
    with open(ARCHIVO_VECINDARIO_PRUEBAS, "w", encoding="utf-8", newline="\n") as archivo:
        archivo.write(vecindario_de_pruebas(datos))
    print("Escrito " + str(ARCHIVO_VECINDARIO_PRUEBAS) + ".")


if __name__ == "__main__":
    principal()
