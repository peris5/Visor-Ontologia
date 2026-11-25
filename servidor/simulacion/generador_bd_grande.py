"""GeneradorBDGrande: unas 25.000 entidades inventadas con la forma de Neo4j."""
import random
from typing import Any

from servidor.datos.generar_datos_ejemplo import JERARQUIA
from servidor.simulacion.constructor_grafo import ConstructorGrafo


class GeneradorBDGrande:
    """Genera una base de datos simulada GRANDE, para medir el cálculo de la
    relevancia en el laboratorio. Con la misma semilla y los mismos tamaños
    da siempre el mismo grafo.

    Lo que hay:
     - creadores (pintores, diseñadores y otros) con una FAMA de cola larga:
       unos pocos tienen cientos de obras y de contactos y la mayoría, pocos;
       además, personas que no crean, obras y organizaciones (academias,
       talleres, museos, galerías, círculos y empresas);
     - mentorías con pocos maestros, casi siempre famosos (la mitad con
       OCURRED_AT al taller del maestro), talleres compartidos, empleos,
       colaboraciones, amistades, matrimonios con boda e invitados,
       filiaciones, fundaciones y tertulias;
     - exposiciones pequeñas y medianas, en las que cada artista suele
       exponer en unas pocas salas, y salones abiertos a todos (algunos
       superan maxParticipantesEvidencia, para comprobar que se ignoran);
     - un porcentaje de eventos registrados DOS VECES (misma organización y
       misma fecha con día, con una parte de los participantes), como si
       vinieran de otra fuente, para probar la deduplicación. Los demás
       eventos solo tienen el año.

    La regla genérica que deriva las relaciones es la misma que con la BD
    real: aquí solo se crean nodos y relaciones de Neo4j.

    Los nombres son CÓDIGOS (C0001, P0001, H00001, AC01...): ninguna persona
    real.
    """

    # Valores si faltan en simulacionGrande (servidor/configuracion.json).
    POR_DEFECTO = {
        "semilla": 2026, "porcentajeDuplicados": 3, "creadores": 2000, "personas": 1500, "obras": 22000,
        "academias": 3, "talleres": 40, "museos": 25, "galerias": 40, "circulos": 20, "empresas": 15,
        "exposicionesPequenas": 1600, "exposicionesMedianas": 350, "salones": 30, "tertulias": 300,
    }
    ROLES_MAESTRO = ["maestro", "maestra", "mestre", "Maestro"]
    ROLES_APRENDIZ = ["aprendiz", "alumno", "alumna", "deixeble"]
    # Entre cuántos creadores al azar se elige, por fama: cuantos más, más
    # fácil que salga uno muy famoso.
    CANDIDATOS = 12
    CANDIDATOS_A_MAESTRO = 40
    PRIMER_NACIMIENTO = 1820
    ULTIMO_NACIMIENTO = 1920

    def __init__(self, parametros: dict[str, Any]) -> None:
        """parametros: la sección simulacionGrande de la configuración."""
        self.__parametros = dict(GeneradorBDGrande.POR_DEFECTO)
        for clave in parametros:
            self.__parametros[clave] = parametros[clave]
        self.__azar = random.Random(self.__parametros["semilla"])
        self.__grafo = ConstructorGrafo()
        self.__creadores: list[str] = []
        self.__personas: list[str] = []
        self.__nacimiento: dict[str, int] = {}
        self.__fama: dict[str, float] = {}
        self.__obras_de: dict[str, list[str]] = {}
        self.__tipo_de_obra: dict[str, list[str]] = {}
        # Los artistas habituales de cada sala.
        self.__artistas_de: dict[str, list[str]] = {}
        self.__taller_de: dict[str, str] = {}
        self.__organizaciones: dict[str, list[str]] = {}
        # Los creadores por año de nacimiento, para buscar contemporáneos.
        self.__por_anio: dict[int, list[str]] = {}
        # Los eventos con lugar, para registrar algunos dos veces.
        self.__eventos: list[dict[str, Any]] = []

    def generar(self) -> dict[str, Any]:
        """El grafo, con el mismo formato que datos_ejemplo.json. Usar un
        objeto nuevo cada vez.
        """
        self.__crear_creadores()
        self.__crear_personas()
        self.__crear_organizaciones()
        self.__crear_obras()
        self.__repartir_salas()
        self.__mentorias()
        self.__empleos()
        self.__colaboraciones()
        self.__amistades()
        self.__matrimonios()
        self.__filiaciones()
        self.__fundaciones()
        self.__tertulias()
        self.__exposiciones(self.__parametros["exposicionesPequenas"], 1, 5, 2, "galerias")
        self.__exposiciones(self.__parametros["exposicionesMedianas"], 6, 18, 1, "museos")
        self.__salones()
        self.__registrar_dos_veces()
        jerarquia: dict[str, str] = {}
        for etiqueta in JERARQUIA:
            if not etiqueta.startswith("_"):
                jerarquia[etiqueta] = JERARQUIA[etiqueta]
        return {"jerarquia": jerarquia, "nodos": self.__grafo.get_nodos(), "relaciones": self.__grafo.get_relaciones()}

    # ───────────── Entidades ─────────────

    def __crear_creadores(self) -> None:
        """(Privado) Los creadores: C0001 es el más famoso. La fama baja como
        una potencia del puesto (cola larga).
        """
        for indice in range(self.__parametros["creadores"]):
            id_creador = "C" + str(indice + 1).rjust(4, "0")
            etiquetas = ["Person", "Creator", "Painter"]
            self.__tipo_de_obra[id_creador] = ["Event", "Creation", "Paint"]
            suerte = self.__azar.random()
            if suerte > 0.85:
                etiquetas = ["Person", "Creator"]
                self.__tipo_de_obra[id_creador] = ["Event", "Creation"]
            elif suerte > 0.7:
                etiquetas = ["Person", "Creator", "Designer"]
                self.__tipo_de_obra[id_creador] = ["Event", "Creation", "Design"]
            self.__grafo.nodo(id_creador, etiquetas, {"name": id_creador})
            nacimiento = self.__azar.randint(GeneradorBDGrande.PRIMER_NACIMIENTO, GeneradorBDGrande.ULTIMO_NACIMIENTO)
            self.__creadores.append(id_creador)
            self.__nacimiento[id_creador] = nacimiento
            self.__fama[id_creador] = (indice + 1) ** -0.7
            self.__obras_de[id_creador] = []
            if nacimiento not in self.__por_anio:
                self.__por_anio[nacimiento] = []
            self.__por_anio[nacimiento].append(id_creador)

    def __crear_personas(self) -> None:
        """(Privado) Personas que no crean."""
        for indice in range(self.__parametros["personas"]):
            id_persona = "P" + str(indice + 1).rjust(4, "0")
            self.__grafo.nodo(id_persona, ["Person"], {"name": id_persona})
            self.__personas.append(id_persona)
            self.__nacimiento[id_persona] = self.__azar.randint(GeneradorBDGrande.PRIMER_NACIMIENTO,
                                                               GeneradorBDGrande.ULTIMO_NACIMIENTO)

    def __crear_organizaciones(self) -> None:
        """(Privado) Academias, talleres, museos, galerías, círculos y empresas."""
        for clase in ["academias", "talleres", "museos", "galerias", "circulos", "empresas"]:
            self.__organizaciones[clase] = []
            for indice in range(self.__parametros[clase]):
                codigo = clase[0:2].upper() + str(indice + 1).rjust(2, "0")
                self.__grafo.nodo(codigo, ["Organization"], {"name_es": codigo})
                self.__organizaciones[clase].append(codigo)

    def __crear_obras(self) -> None:
        """(Privado) Las obras, repartidas según la fama, con su Creation."""
        pesos: list[float] = []
        for id_creador in self.__creadores:
            pesos.append(self.__fama[id_creador] * self.__azar.uniform(0.4, 1.6))
        autores = self.__azar.choices(self.__creadores, weights=pesos, k=self.__parametros["obras"])
        for indice in range(len(autores)):
            autor = autores[indice]
            id_obra = "H" + str(indice + 1).rjust(5, "0")
            self.__grafo.nodo(id_obra, ["HeritageItem"], {"name_es": id_obra})
            participantes = [(autor, "autor")]
            if self.__azar.random() < 0.04:
                coautor = self.__contemporaneo(autor, 15)
                if coautor is not None:
                    participantes.append((coautor, "coautor"))
                    self.__obras_de[coautor].append(id_obra)
            self.__obras_de[autor].append(id_obra)
            anios = None
            if self.__azar.random() < 0.9:
                anio = self.__nacimiento[autor] + self.__azar.randint(18, 70)
                anios = (anio, anio)
            id_evento = self.__grafo.intermediario(list(self.__tipo_de_obra[autor]), participantes, anios, None, None)
            self.__grafo.relacion("PRODUCED", id_evento, id_obra, {})
            if self.__azar.random() < 0.1:
                self.__grafo.relacion("CREATE", id_evento, id_obra, {})

    def __repartir_salas(self) -> None:
        """(Privado) Las salas habituales de cada artista: de una a tres
        galerías o museos, y alguna más si es muy famoso.
        """
        salas = self.__organizaciones["galerias"] + self.__organizaciones["museos"]
        for sala in salas:
            self.__artistas_de[sala] = []
        for creador in self.__creadores:
            cuantas = self.__azar.randint(1, 3)
            if self.__fama[creador] > 0.1:
                cuantas = cuantas + 2
            for sala in self.__azar.sample(salas, min(cuantas, len(salas))):
                self.__artistas_de[sala].append(creador)

    # ───────────── Relaciones ─────────────

    def __mentorias(self) -> None:
        """(Privado) Algo más de la mitad de los creadores tiene un maestro
        (a veces dos), entre 12 y 45 años mayor; los famosos tienen muchos
        alumnos. La mitad, en el taller del maestro.
        """
        for alumno in self.__creadores:
            numero = 0
            suerte = self.__azar.random()
            if suerte < 0.08:
                numero = 2
            elif suerte < 0.6:
                numero = 1
            vistos: list[str] = []
            for _ in range(numero):
                maestro = self.__elegir_por_fama(self.__nacimiento[alumno] - 45, self.__nacimiento[alumno] - 12, alumno,
                                                 GeneradorBDGrande.CANDIDATOS_A_MAESTRO)
                if maestro is not None and maestro not in vistos:
                    vistos.append(maestro)
                    desde = self.__nacimiento[alumno] + self.__azar.randint(14, 22)
                    anios: tuple[int, int] | None = (desde, desde + self.__azar.randint(2, 8))
                    if self.__azar.random() < 0.1:
                        anios = None
                    taller = None
                    if self.__azar.random() < 0.5:
                        taller = self.__taller(maestro)
                    self.__grafo.intermediario(
                        ["Relationship", "Mentorship"],
                        [(maestro, self.__azar.choice(GeneradorBDGrande.ROLES_MAESTRO)),
                         (alumno, self.__azar.choice(GeneradorBDGrande.ROLES_APRENDIZ))], anios, taller, None)

    def __taller(self, maestro: str) -> str:
        """(Privado) El taller del maestro (varios maestros comparten taller)."""
        if maestro not in self.__taller_de:
            self.__taller_de[maestro] = self.__azar.choice(self.__organizaciones["talleres"])
        return self.__taller_de[maestro]

    def __empleos(self) -> None:
        """(Privado) Empleos: muchos en las academias, algunos en talleres y
        empresas; miembros de círculos (Professional) y conservadores de
        museos (evento Work).
        """
        for creador in self.__creadores:
            if self.__azar.random() < 0.45:
                self.__empleo(creador, self.__azar.choice(self.__organizaciones["academias"]), "profesor")
            if self.__azar.random() < 0.25:
                self.__empleo(creador, self.__azar.choice(self.__organizaciones["talleres"]), "oficial")
            if self.__azar.random() < 0.2:
                desde = self.__nacimiento[creador] + self.__azar.randint(20, 40)
                self.__grafo.intermediario(["Relationship", "Professional"], [(creador, "miembro")],
                                           (desde, desde + self.__azar.randint(3, 20)),
                                           self.__azar.choice(self.__organizaciones["circulos"]), None)
        for persona in self.__personas:
            suerte = self.__azar.random()
            if suerte < 0.3:
                self.__empleo(persona, self.__azar.choice(self.__organizaciones["empresas"]), "empleado")
            elif suerte < 0.4:
                anio = self.__nacimiento[persona] + self.__azar.randint(25, 45)
                self.__evento(["Event", "Work"], [(persona, "conservador")], anio,
                              self.__azar.choice(self.__organizaciones["museos"]), [])

    def __empleo(self, persona: str, organizacion: str, rol: str) -> None:
        """(Privado) Un empleo de una persona en una organización."""
        desde = self.__nacimiento[persona] + self.__azar.randint(20, 45)
        self.__grafo.intermediario(["Relationship", "Professional", "Employement"], [(persona, rol)],
                                   (desde, desde + self.__azar.randint(2, 20)), organizacion, None)

    def __colaboraciones(self) -> None:
        """(Privado) coworking entre creadores de la misma época."""
        for creador in self.__creadores:
            if self.__azar.random() < 0.3:
                otro = self.__contemporaneo(creador, 12)
                if otro is not None:
                    desde = max(self.__nacimiento[creador], self.__nacimiento[otro]) + self.__azar.randint(20, 40)
                    self.__grafo.intermediario(["Relationship", "Professional", "coworking"],
                                               [(creador, "colaborador"), (otro, "colaborador")],
                                               (desde, desde + self.__azar.randint(1, 6)), None, None)

    def __amistades(self) -> None:
        """(Privado) Amistades entre creadores (más los famosos) y con personas."""
        vistas: set[tuple[str, str]] = set()
        for creador in self.__creadores:
            for _ in range(self.__azar.choices([0, 1, 2, 3, 5], weights=[25, 30, 25, 15, 5])[0]):
                amigo = None
                if self.__azar.random() < 0.2:
                    amigo = self.__azar.choice(self.__personas)
                else:
                    amigo = self.__elegir_por_fama(self.__nacimiento[creador] - 15, self.__nacimiento[creador] + 15, creador)
                if amigo is not None:
                    pareja = (min(creador, amigo), max(creador, amigo))
                    if pareja not in vistas:
                        vistas.add(pareja)
                        anios = None
                        if self.__azar.random() < 0.5:
                            desde = self.__nacimiento[creador] + self.__azar.randint(18, 40)
                            anios = (desde, desde + self.__azar.randint(5, 30))
                        self.__grafo.intermediario(["Relationship", "Friendship"], [(creador, "amigo"), (amigo, "amigo")],
                                                   anios, None, None)

    def __matrimonios(self) -> None:
        """(Privado) Matrimonios de creadores, casi siempre con alguien que no
        crea, y la boda (Wedding) de la mayoría, con invitados.
        """
        for creador in self.__creadores:
            if self.__azar.random() < 0.45:
                conyuge: str | None = self.__azar.choice(self.__personas)
                if self.__azar.random() < 0.15:
                    conyuge = self.__contemporaneo(creador, 8)
                if conyuge is not None:
                    anio = self.__nacimiento[creador] + self.__azar.randint(22, 40)
                    self.__grafo.intermediario(["Relationship", "Related", "Marriage"],
                                               [(creador, "cónyuge"), (conyuge, "cónyuge")],
                                               (anio, anio + self.__azar.randint(5, 40)), None, None)
                    if self.__azar.random() < 0.6:
                        participantes = [(creador, "contrayente"), (conyuge, "contrayente")]
                        for _ in range(self.__azar.randint(2, 20)):
                            invitado = self.__azar.choice(self.__personas)
                            if self.__azar.random() < 0.3:
                                invitado = self.__azar.choice(self.__creadores)
                            GeneradorBDGrande.__anadir_sin_repetir(participantes, invitado, "invitado")
                        self.__evento(["Event", "Wedding"], participantes, anio, None, [])

    def __filiaciones(self) -> None:
        """(Privado) Padres e hijos."""
        for creador in self.__creadores:
            if self.__azar.random() < 0.25:
                pariente: str | None = self.__azar.choice(self.__personas)
                if self.__azar.random() < 0.2:
                    pariente = self.__elegir_por_fama(self.__nacimiento[creador] - 40, self.__nacimiento[creador] - 18,
                                                      creador)
                if pariente is not None:
                    self.__grafo.intermediario(["Relationship", "Related", "Filiation"],
                                               [(creador, "hijo"), (pariente, "progenitor")], None, None, None)

    def __fundaciones(self) -> None:
        """(Privado) Quién fundó los talleres, las galerías y los círculos (Fund)."""
        for clase in ["talleres", "galerias", "circulos"]:
            for organizacion in self.__organizaciones[clase]:
                participantes: list[tuple[str, str]] = []
                for _ in range(self.__azar.randint(1, 3)):
                    GeneradorBDGrande.__anadir_sin_repetir(participantes, self.__azar.choice(self.__creadores), "fundador")
                anio = self.__nacimiento[participantes[0][0]] + self.__azar.randint(25, 45)
                id_evento = self.__grafo.intermediario(["Event", "Fund"], participantes, (anio, anio), None, None)
                self.__grafo.relacion("CREATE", id_evento, organizacion, {})

    # ───────────── Eventos ─────────────

    def __tertulias(self) -> None:
        """(Privado) Tertulias (Event sin subtipo) en un círculo."""
        for _ in range(self.__parametros["tertulias"]):
            anio = self.__azar.randint(1850, 1960)
            participantes: list[tuple[str, str]] = []
            for _ in range(self.__azar.randint(3, 14)):
                asistente = self.__elegir_por_fama(anio - 65, anio - 20, "")
                if self.__azar.random() < 0.25:
                    asistente = self.__azar.choice(self.__personas)
                if asistente is not None:
                    GeneradorBDGrande.__anadir_sin_repetir(participantes, asistente, "asistente")
            if len(participantes) > 0:
                self.__evento(["Event"], participantes, anio, self.__azar.choice(self.__organizaciones["circulos"]), [])

    def __exposiciones(self, numero: int, minimo: int, maximo: int, obras_por_artista: int, clase: str) -> None:
        """(Privado) Exposiciones con entre «minimo» y «maximo» artistas y sus obras."""
        for _ in range(numero):
            anio = self.__azar.randint(1850, 1970)
            lugar = self.__azar.choice(self.__organizaciones[clase])
            artistas: list[str] = []
            for _ in range(self.__azar.randint(minimo, maximo)):
                artista = self.__habitual(lugar, anio)
                if self.__azar.random() < 0.1 or artista is None:
                    artista = self.__elegir_por_fama(anio - 70, anio - 20, "")
                if artista is not None:
                    artistas.append(artista)
            self.__exposicion(anio, artistas, obras_por_artista, lugar)

    def __habitual(self, sala: str, anio: int) -> str | None:
        """(Privado) Un artista habitual de la sala activo ese año (más los
        famosos); None si no hay ninguno.
        """
        candidatos: list[str] = []
        pesos: list[float] = []
        for creador in self.__artistas_de[sala]:
            if anio - 70 <= self.__nacimiento[creador] <= anio - 20:
                candidatos.append(creador)
                pesos.append(self.__fama[creador] ** 0.5)
        if len(candidatos) == 0:
            return None
        return self.__azar.choices(candidatos, weights=pesos)[0]

    def __salones(self) -> None:
        """(Privado) Salones: exposiciones de 30 a 90 artistas y, uno de cada
        diez, de más de 200 (se ignoran por maxParticipantesEvidencia).
        """
        for indice in range(self.__parametros["salones"]):
            cuantos = self.__azar.randint(30, 90)
            if indice % 10 == 9:
                cuantos = 300
            anio = self.__azar.randint(1860, 1960)
            artistas: list[str] = []
            for _ in range(cuantos):
                artista = self.__elegir_por_fama(anio - 70, anio - 20, "", 3)
                if artista is not None:
                    artistas.append(artista)
            self.__exposicion(anio, artistas, 1, self.__azar.choice(self.__organizaciones["museos"]))

    def __exposicion(self, anio: int, artistas: list[str], obras_por_artista: int, lugar: str) -> None:
        """(Privado) Una exposición: los artistas (sin repetir), alguna de sus
        obras (IS_EXPOSED) y el lugar.
        """
        participantes: list[tuple[str, str]] = []
        obras: list[str] = []
        for artista in artistas:
            GeneradorBDGrande.__anadir_sin_repetir(participantes, artista, "expositor")
        for participante in participantes:
            for _ in range(self.__azar.randint(0, obras_por_artista)):
                if len(self.__obras_de[participante[0]]) > 0:
                    obra = self.__azar.choice(self.__obras_de[participante[0]])
                    if obra not in obras:
                        obras.append(obra)
        if len(participantes) > 0:
            self.__evento(["Event", "Exposition"], participantes, anio, lugar, obras)

    def __evento(self, etiquetas: list[str], participantes: list[tuple[str, str]], anio: int, lugar: str | None,
                 obras: list[str]) -> None:
        """(Privado) Un evento con su año y, si tiene, su lugar y sus obras.
        Los que tienen lugar se apuntan para registrar algunos dos veces.
        """
        self.__eventos.append({"etiquetas": etiquetas, "participantes": participantes, "anio": anio, "lugar": lugar,
                               "obras": obras})

    def __registrar_dos_veces(self) -> None:
        """(Privado) Crea los eventos apuntados. Un porcentaje de los que
        tienen lugar (sin lugar no se podrían juntar) se registra dos veces: los
        dos con la misma fecha con día, uno con parte de los participantes (si
        solo hay uno, con ese).
        """
        porcentaje = self.__parametros["porcentajeDuplicados"]
        for evento in self.__eventos:
            fecha = str(evento["anio"])
            se_duplica = False
            if evento["lugar"] is not None:
                se_duplica = self.__azar.random() * 100 < porcentaje
            if se_duplica:
                fecha = fecha + "-" + str(self.__azar.randint(1, 12)).rjust(2, "0")
                fecha = fecha + "-" + str(self.__azar.randint(1, 28)).rjust(2, "0")
                cuantos = self.__azar.randint(1, max(1, len(evento["participantes"]) - 1))
                self.__crear_evento(evento, self.__azar.sample(evento["participantes"], cuantos), fecha, [])
            self.__crear_evento(evento, evento["participantes"], fecha, evento["obras"])

    def __crear_evento(self, evento: dict[str, Any], participantes: list[tuple[str, str]], fecha: str,
                       obras: list[str]) -> None:
        """(Privado) El nodo del evento con esos participantes y obras."""
        id_evento = self.__grafo.intermediario(list(evento["etiquetas"]), participantes,
                                               (evento["anio"], evento["anio"]), evento["lugar"], fecha)
        for obra in obras:
            self.__grafo.relacion("IS_EXPOSED", id_evento, obra, {})

    # ───────────── Ayudas ─────────────

    def __elegir_por_fama(self, desde: int, hasta: int, distinto_de: str, entre: int = CANDIDATOS) -> str | None:
        """(Privado) Un creador nacido entre esos años, más probable cuanto
        más famoso; None si no hay ninguno.
        """
        candidatos: list[str] = []
        pesos: list[float] = []
        # Se miran unos cuantos al azar y se elige entre ellos por fama: más
        # rápido que recorrer todos y con el mismo efecto de cola larga.
        for _ in range(entre):
            anio = self.__azar.randint(desde, hasta)
            if anio in self.__por_anio:
                candidato = self.__azar.choice(self.__por_anio[anio])
                if candidato != distinto_de:
                    candidatos.append(candidato)
                    pesos.append(self.__fama[candidato])
        if len(candidatos) == 0:
            return None
        return self.__azar.choices(candidatos, weights=pesos)[0]

    def __contemporaneo(self, creador: str, margen: int) -> str | None:
        """(Privado) Otro creador de edad parecida."""
        return self.__elegir_por_fama(self.__nacimiento[creador] - margen, self.__nacimiento[creador] + margen, creador)

    @staticmethod
    def __anadir_sin_repetir(participantes: list[tuple[str, str]], id_persona: str, rol: str) -> None:
        """(Privado) Añade (persona, rol) si la persona no estaba."""
        for participante in participantes:
            if participante[0] == id_persona:
                return
        participantes.append((id_persona, rol))
