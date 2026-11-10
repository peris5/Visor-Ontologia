"""GeneradorDatosEjemplo: crea los datos de ejemplo grandes del repositorio simulado.

Es una HERRAMIENTA de desarrollo, no forma parte de la aplicación: el
servidor no la usa. Sirve para tener muchos datos con los que comprobar que
la visualización 3D funciona bien con grafos grandes (hasta 150 nodos).

Uso, desde la carpeta del proyecto:
    python -m servidor.herramientas.generador_datos_ejemplo

Lee servidor/datos/datos_ejemplo.json, se queda con las 16 entidades y las
27 relaciones originales del incremento 1 (las primeras del archivo, de las
que dependen las pruebas) y le añade los datos generados. Vuelve a escribir
el mismo archivo.

Es DETERMINISTA: usa siempre la misma semilla para los números al azar, así
que cada vez genera exactamente los mismos datos. Ejecutarlo dos veces da
el mismo archivo.

TODOS LOS DATOS SON INVENTADOS: ninguna persona, organización ni obra es real.
"""
import json
import random
from pathlib import Path
from typing import Any

ARCHIVO_DATOS = Path(__file__).resolve().parent.parent / "datos" / "datos_ejemplo.json"

NOMBRES = ["Adela", "Bernat", "Carmela", "Damián", "Estela", "Fausto", "Gracia", "Hilario", "Irene", "Jacinto",
           "Leonor", "Marcelo", "Nieves", "Octavio", "Pilar", "Quintín", "Rosalía", "Silvestre", "Teresa", "Ulises",
           "Valentina", "Wenceslao", "Ximena", "Yago", "Zoraida", "Amparo", "Bautista", "Consuelo", "Desiderio",
           "Eulalia", "Fermín", "Genoveva", "Honorato", "Inmaculada", "Joaquina", "Lázaro", "Mercedes", "Nicasio",
           "Olvido", "Pascual", "Remedios", "Severino", "Trinidad", "Vicenta", "Amadeo", "Blanca", "Casimiro",
           "Dolores", "Emilio", "Felisa"]
APELLIDOS = ["Aranzueque", "Belloch", "Cantavella", "Doménech", "Escrivà", "Folgueral", "Garrigós", "Herranz",
             "Ibarrola", "Juncosa", "Llorach", "Mascarell", "Navarrés", "Ortells", "Peñarroja", "Querol", "Rovira",
             "Sanchis", "Tormo", "Ubeda", "Vallcanera", "Xirivella", "Zaragozí", "Alcañiz", "Bolinches", "Castellví",
             "Durbán", "Estellés", "Faus", "Gimeno", "Hortolà", "Isern", "Lacasta", "Monfort", "Nebot", "Olmos",
             "Pastor", "Ribelles", "Soler", "Tarín", "Valldecabres", "Almela"]
NACIONALIDADES = ["Española", "Española", "Española", "Española", "Española", "Española",
                  "Francesa", "Italiana", "Portuguesa", "Belga"]
CIUDADES = ["Ciudad de Almará", "Puerto de Sella", "Villa de la Ribera", "Montecalvo", "San Telmo del Llano",
            "Aguasvivas", "Torrealta", "Benimuel"]
TIPOS_ORGANIZACION = [
    ["Taller", "Taller de pintura y escultura."],
    ["Academia", "Academia de formación artística."],
    ["Círculo", "Círculo de artistas y críticos."],
    ["Sociedad", "Sociedad de amigos de las artes."],
]
LUGARES_ORGANIZACION = ["de San Lucas", "del Portal Nuevo", "de la Lonja", "del Mar", "de las Huertas", "del Pilar",
                        "de Santa Clara", "de los Tintoreros", "del Arrabal", "de la Alameda", "del Convento Viejo",
                        "de la Plaza Mayor"]
MUSEOS = ["Museo de Bellas Artes de Montecalvo", "Pinacoteca de Torrealta", "Museo del Grabado de Aguasvivas",
          "Galería Municipal de Benimuel", "Colección Belloch", "Museo Diocesano de San Telmo"]
SUJETOS = ["Retrato", "Paisaje", "Bodegón", "Alegoría", "Vista", "Escena", "Estudio", "Interior", "Marina",
           "Procesión", "Mercado", "Jardín", "Busto", "Relieve", "Capitel", "Tapiz"]
COMPLEMENTOS = ["de la dama de azul", "del puerto viejo", "con granadas", "de la primavera", "del río Turbio",
                "de pescadores", "en la huerta", "de la torre", "del mendigo", "al atardecer", "con laúd",
                "de las lavanderas", "de la tormenta", "del caballero", "de la azotea", "nocturno",
                "de los naranjos", "de la feria", "con espejo", "del claustro"]
SUFIJOS_OBRA = ["(I)", "(II)", "(III)", "(estudio)", "(boceto)"]
TECNICAS = ["Óleo sobre lienzo", "Acuarela", "Aguafuerte", "Mármol tallado", "Bronce fundido", "Temple sobre tabla",
            "Carboncillo", "Litografía", "Tapiz de lana", "Madera policromada"]
OFICIOS = ["Pintora.", "Pintor.", "Escultor.", "Escultora.", "Grabador.", "Dibujante.", "Ceramista.", "Arquitecto."]

NUMERO_DE_GRUPOS = 12
NUMERO_DE_MECENAS = 10
NUMERO_DE_RESTAURADORAS = 8
NUMERO_DE_RETRATOS = 25
NUMERO_DE_PAREJAS = 12
ENTIDADES_ORIGINALES = 16
RELACIONES_ORIGINALES = 27
SEMILLA = 20261110


class GeneradorDatosEjemplo:
    """Genera entidades y relaciones inventadas con una estructura parecida a
    la de un grafo de patrimonio real:

     - 12 GRUPOS (talleres, academias...), cada uno con su maestro, entre 6 y
       10 miembros y sus obras. Dentro de cada grupo las relaciones son
       fuertes (0,5 a 0,95), así se forman cúmulos en la vista 3D (RF-40).
     - Algunas parejas tienen varias relaciones a la vez (por ejemplo
       «Maestro de» y «Colaborador de»), para ver las curvas separadas (RF-38).
     - Museos, mecenas y restauradoras que conectan unos grupos con otros.
     - Relaciones débiles entre grupos, para que todo quede conectado.
     - Las entidades originales (p01...) se unen a los grupos, así su
       subgrafo llega al máximo de 150 nodos con el umbral por defecto.
    """

    def __init__(self, datos_originales: dict[str, Any]) -> None:
        """datos_originales: el contenido actual de datos_ejemplo.json."""
        # Un generador de números al azar propio con semilla fija: siempre
        # da la misma secuencia, por eso los datos salen siempre iguales.
        self.__azar = random.Random(SEMILLA)
        self.__entidades: list[dict[str, Any]] = []
        self.__relaciones: list[list[Any]] = []
        self.__nombres_usados: set[str] = set()
        self.__relaciones_usadas: set[str] = set()
        self.__contadores = {"p": 7, "o": 4, "a": 5, "r": RELACIONES_ORIGINALES}
        self.__copiar_originales(datos_originales)

    def generar(self) -> dict[str, Any]:
        """Genera todos los datos y los devuelve con el formato del repositorio
        simulado: { "entidades": [...], "relaciones": [...] }.
        """
        grupos = []
        for indice in range(NUMERO_DE_GRUPOS):
            grupos.append(self.__crear_grupo(indice))

        museos = []
        for nombre in MUSEOS:
            museos.append(self.__crear_organizacion(nombre, "Museo de bellas artes."))
        todas_las_obras = []
        for grupo in grupos:
            for id_obra in grupo["obras"]:
                todas_las_obras.append(id_obra)

        self.__repartir_obras_en_museos(todas_las_obras, museos)
        mecenas = self.__crear_mecenas(grupos, museos)
        self.__crear_restauradoras(todas_las_obras, museos)

        mecenas_y_maestros = []
        for id_mecenas in mecenas:
            mecenas_y_maestros.append(id_mecenas)
        for grupo in grupos:
            mecenas_y_maestros.append(grupo["maestro"])
        self.__crear_retratos_y_parejas(todas_las_obras, mecenas_y_maestros)

        self.__unir_grupos(grupos)
        self.__unir_originales(grupos, todas_las_obras, mecenas)
        return {"entidades": self.__entidades, "relaciones": self.__relaciones}

    def __copiar_originales(self, datos_originales: dict[str, Any]) -> None:
        """(Privado) Copia las entidades y relaciones del incremento 1 y
        apunta sus nombres y relaciones para no repetirlos.
        """
        for indice in range(ENTIDADES_ORIGINALES):
            entidad = datos_originales["entidades"][indice]
            self.__entidades.append(entidad)
            self.__nombres_usados.add(entidad["nombre"])
        for indice in range(RELACIONES_ORIGINALES):
            fila = datos_originales["relaciones"][indice]
            self.__relaciones.append(fila)
            self.__relaciones_usadas.add(fila[1] + "|" + fila[2] + "|" + fila[3])

    def __crear_grupo(self, indice: int) -> dict[str, Any]:
        """(Privado) Un taller, academia, círculo o sociedad con su maestro,
        sus miembros, sus obras y las relaciones fuertes entre ellos.
        """
        tipo_de_organizacion = TIPOS_ORGANIZACION[indice % len(TIPOS_ORGANIZACION)]
        nombre_del_tipo = tipo_de_organizacion[0]
        id_organizacion = self.__crear_organizacion(nombre_del_tipo + " " + LUGARES_ORGANIZACION[indice],
                                                    tipo_de_organizacion[1])
        maestro = self.__crear_persona("Pintor y maestro de taller.")
        miembros = [maestro]
        numero_de_miembros = self.__azar.randint(6, 10)
        for _ in range(numero_de_miembros):
            oficio = self.__azar.choice(OFICIOS)
            miembros.append(self.__crear_persona(oficio))
        self.__crear_relacion(maestro, id_organizacion, "fundador_de", 0.75, 0.95)

        obras_del_grupo = []
        for miembro in miembros:
            self.__crear_relacion(miembro, id_organizacion, "miembro_de", 0.55, 0.9)
            if miembro != maestro:
                self.__crear_relacion(maestro, miembro, "maestro_de", 0.6, 0.95)
                # A veces, una segunda relación con el mismo par (curvas separadas).
                if self.__azar.random() < 0.35:
                    self.__crear_relacion(maestro, miembro, "colaborador_de", 0.4, 0.75)
            numero_de_obras = self.__azar.randint(1, 3)
            for _ in range(numero_de_obras):
                id_obra = self.__crear_obra("Obra de un miembro del " + nombre_del_tipo.lower() + ".")
                obras_del_grupo.append(id_obra)
                self.__crear_relacion(miembro, id_obra, "autor_de", 0.7, 0.98)

        # Relaciones fuertes entre miembros: son las que forman los cúmulos.
        for _ in range(len(miembros)):
            pareja = self.__azar.sample(miembros, 2)
            self.__crear_relacion(pareja[0], pareja[1], "colaborador_de", 0.5, 0.85)
        for _ in range(len(miembros) // 3):
            pareja = self.__azar.sample(miembros, 2)
            self.__crear_relacion(pareja[0], pareja[1], "amigo_de", 0.4, 0.8)
        for _ in range(len(obras_del_grupo) // 4):
            pareja = self.__azar.sample(obras_del_grupo, 2)
            self.__crear_relacion(pareja[0], pareja[1], "inspirado_en", 0.3, 0.7)

        return {"organizacion": id_organizacion, "maestro": maestro, "miembros": miembros, "obras": obras_del_grupo}

    def __repartir_obras_en_museos(self, todas_las_obras: list[str], museos: list[str]) -> None:
        """(Privado) Algo más de la mitad de las obras están en un museo y
        algunas se han expuesto en otro.
        """
        for id_obra in todas_las_obras:
            if self.__azar.random() < 0.55:
                museo = self.__azar.choice(museos)
                self.__crear_relacion(museo, id_obra, "conserva", 0.45, 0.85)
            if self.__azar.random() < 0.2:
                museo = self.__azar.choice(museos)
                self.__crear_relacion(id_obra, museo, "expuesto_en", 0.2, 0.5)

    def __crear_mecenas(self, grupos: list[dict[str, Any]], museos: list[str]) -> list[str]:
        """(Privado) Mecenas que apoyan a uno, dos o tres grupos y encargan obras."""
        mecenas = []
        for _ in range(NUMERO_DE_MECENAS):
            id_mecenas = self.__crear_persona("Comerciante y mecenas de las artes.")
            mecenas.append(id_mecenas)
            numero_de_grupos = self.__azar.randint(1, 3)
            for grupo in self.__azar.sample(grupos, numero_de_grupos):
                self.__crear_relacion(id_mecenas, grupo["maestro"], "mecenas_de", 0.5, 0.85)
                obra_encargada = self.__azar.choice(grupo["obras"])
                self.__crear_relacion(id_mecenas, obra_encargada, "encargo_de", 0.4, 0.8)
            if self.__azar.random() < 0.5:
                museo = self.__azar.choice(museos)
                self.__crear_relacion(id_mecenas, museo, "fundador_de", 0.6, 0.9)
        return mecenas

    def __crear_restauradoras(self, todas_las_obras: list[str], museos: list[str]) -> None:
        """(Privado) Restauradoras de un museo que han restaurado varias obras."""
        for _ in range(NUMERO_DE_RESTAURADORAS):
            id_restauradora = self.__crear_persona("Restauradora de pintura antigua.")
            museo = self.__azar.choice(museos)
            self.__crear_relacion(id_restauradora, museo, "miembro_de", 0.5, 0.8)
            numero_de_obras = self.__azar.randint(2, 5)
            for id_obra in self.__azar.sample(todas_las_obras, numero_de_obras):
                self.__crear_relacion(id_restauradora, id_obra, "restaurador_de", 0.3, 0.7)

    def __crear_retratos_y_parejas(self, todas_las_obras: list[str], mecenas_y_maestros: list[str]) -> None:
        """(Privado) Obras que retratan a mecenas o maestros, y parejas entre ellos."""
        for _ in range(NUMERO_DE_RETRATOS):
            id_obra = self.__azar.choice(todas_las_obras)
            retratado = self.__azar.choice(mecenas_y_maestros)
            self.__crear_relacion(id_obra, retratado, "retrato_de", 0.35, 0.75)
        for _ in range(NUMERO_DE_PAREJAS):
            pareja = self.__azar.sample(mecenas_y_maestros, 2)
            self.__crear_relacion(pareja[0], pareja[1], "pareja_de", 0.6, 0.9)

    def __unir_grupos(self, grupos: list[dict[str, Any]]) -> None:
        """(Privado) Relaciones débiles entre cada grupo y el siguiente, para
        que todo el grafo esté conectado sin juntar los cúmulos.
        """
        for indice in range(len(grupos)):
            grupo = grupos[indice]
            siguiente = grupos[(indice + 1) % len(grupos)]
            self.__crear_relacion(grupo["maestro"], siguiente["maestro"], "colaborador_de", 0.3, 0.6)
            for _ in range(3):
                miembro = self.__azar.choice(grupo["miembros"])
                miembro_del_siguiente = self.__azar.choice(siguiente["miembros"])
                self.__crear_relacion(miembro, miembro_del_siguiente, "amigo_de", 0.15, 0.45)

    def __unir_originales(self, grupos: list[dict[str, Any]], todas_las_obras: list[str], mecenas: list[str]) -> None:
        """(Privado) Une las entidades del incremento 1 (p01...p07, o01...o04)
        con los datos nuevos.
        """
        personas_originales = ["p01", "p02", "p03", "p04", "p05", "p06", "p07"]
        for indice in range(len(personas_originales)):
            id_persona = personas_originales[indice]
            grupo = grupos[indice]
            self.__crear_relacion(id_persona, grupo["organizacion"], "miembro_de", 0.45, 0.8)
            self.__crear_relacion(id_persona, grupo["maestro"], "colaborador_de", 0.4, 0.75)
            amigo = self.__azar.choice(grupo["miembros"])
            self.__crear_relacion(id_persona, amigo, "amigo_de", 0.35, 0.7)
        for id_organizacion in ["o01", "o02", "o03", "o04"]:
            for id_obra in self.__azar.sample(todas_las_obras, 3):
                self.__crear_relacion(id_organizacion, id_obra, "conserva", 0.4, 0.75)
        self.__crear_relacion("p01", grupos[0]["maestro"], "maestro_de", 0.8, 0.9)
        self.__crear_relacion("p01", grupos[1]["maestro"], "pareja_de", 0.7, 0.8)
        self.__crear_relacion("p04", mecenas[0], "colaborador_de", 0.6, 0.8)

    def __crear_persona(self, descripcion: str) -> str:
        """(Privado) Persona con nombre inventado y fechas coherentes. Devuelve su id."""
        nacimiento = self.__azar.randint(1820, 1900)
        identificador = self.__nuevo_id("p")
        nombre = self.__nombre_de_persona()
        anos_vividos = self.__azar.randint(35, 85)
        nacionalidad = self.__azar.choice(NACIONALIDADES)
        self.__entidades.append({
            "id": identificador, "tipo": "PERSONA", "nombre": nombre, "descripcion": descripcion,
            "fechaNacimiento": str(nacimiento), "fechaDefuncion": str(nacimiento + anos_vividos),
            "nacionalidad": nacionalidad,
        })
        return identificador

    def __crear_organizacion(self, nombre: str, descripcion: str) -> str:
        """(Privado) Organización con ese nombre. Devuelve su id."""
        self.__nombres_usados.add(nombre)
        identificador = self.__nuevo_id("o")
        fundacion = self.__azar.randint(1700, 1920)
        sede = self.__azar.choice(CIUDADES)
        self.__entidades.append({
            "id": identificador, "tipo": "ORGANIZACION", "nombre": nombre, "descripcion": descripcion,
            "fechaFundacion": str(fundacion), "sede": sede,
        })
        return identificador

    def __crear_obra(self, descripcion: str) -> str:
        """(Privado) Obra con título inventado. Devuelve su id."""
        identificador = self.__nuevo_id("a")
        titulo = self.__titulo_de_obra()
        creacion = self.__azar.randint(1840, 1950)
        tecnica = self.__azar.choice(TECNICAS)
        self.__entidades.append({
            "id": identificador, "tipo": "OBRA_DE_ARTE", "nombre": titulo, "descripcion": descripcion,
            "fechaCreacion": str(creacion), "tecnica": tecnica,
        })
        return identificador

    def __crear_relacion(self, origen: str, destino: str, tipo: str, minimo: float, maximo: float) -> None:
        """(Privado) Relación con un valor al azar entre mínimo y máximo.
        No crea relaciones de una entidad consigo misma ni repite una que ya
        exista (mismo origen, destino y tipo).
        """
        clave = origen + "|" + destino + "|" + tipo
        if origen == destino or clave in self.__relaciones_usadas:
            return
        self.__relaciones_usadas.add(clave)
        identificador = self.__nuevo_id("r")
        valor = round(self.__azar.uniform(minimo, maximo), 2)
        self.__relaciones.append([identificador, origen, destino, tipo, valor])

    def __nombre_de_persona(self) -> str:
        """(Privado) Nombre y uno o dos apellidos, sin repetir ninguno."""
        while True:
            nombre = self.__azar.choice(NOMBRES) + " " + self.__azar.choice(APELLIDOS)
            if self.__azar.random() < 0.3:
                nombre = nombre + " " + self.__azar.choice(APELLIDOS)
            if nombre not in self.__nombres_usados:
                self.__nombres_usados.add(nombre)
                return nombre

    def __titulo_de_obra(self) -> str:
        """(Privado) Título de obra sin repetir; si ya existe, se le añade un sufijo."""
        while True:
            titulo = self.__azar.choice(SUJETOS) + " " + self.__azar.choice(COMPLEMENTOS)
            if titulo in self.__nombres_usados:
                titulo = titulo + " " + self.__azar.choice(SUFIJOS_OBRA)
            if titulo not in self.__nombres_usados:
                self.__nombres_usados.add(titulo)
                return titulo

    def __nuevo_id(self, letra: str) -> str:
        """(Privado) Siguiente id con esa letra: p08, p09... (dos cifras como mínimo)."""
        self.__contadores[letra] = self.__contadores[letra] + 1
        return letra + format(self.__contadores[letra], "02d")

    @staticmethod
    def convertir_a_texto(datos: dict[str, Any]) -> str:
        """Texto JSON con una entidad o relación por línea, para que el
        archivo sea fácil de leer y de comparar con Git.
        """
        lineas = ["{", "  \"entidades\": ["]
        GeneradorDatosEjemplo.__anadir_elementos(lineas, datos["entidades"])
        lineas.append("  ],")
        lineas.append("  \"relaciones\": [")
        GeneradorDatosEjemplo.__anadir_elementos(lineas, datos["relaciones"])
        lineas.append("  ]")
        lineas.append("}")
        return "\n".join(lineas) + "\n"

    @staticmethod
    def __anadir_elementos(lineas: list[str], elementos: list[Any]) -> None:
        """(Privado) Una línea por elemento, con coma en todas menos la última."""
        for indice in range(len(elementos)):
            coma = ""
            if indice < len(elementos) - 1:
                coma = ","
            lineas.append("    " + json.dumps(elementos[indice], ensure_ascii=False) + coma)


def principal() -> None:
    """Lee el archivo, genera los datos y lo vuelve a escribir."""
    with open(ARCHIVO_DATOS, encoding="utf-8") as archivo:
        datos_originales = json.load(archivo)
    datos = GeneradorDatosEjemplo(datos_originales).generar()
    with open(ARCHIVO_DATOS, "w", encoding="utf-8", newline="\n") as archivo:
        archivo.write(GeneradorDatosEjemplo.convertir_a_texto(datos))
    print("Escrito " + str(ARCHIVO_DATOS) + ": " + str(len(datos["entidades"])) + " entidades y "
          + str(len(datos["relaciones"])) + " relaciones.")


if __name__ == "__main__":
    principal()
