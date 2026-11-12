"""ProyectorRelaciones: deriva las relaciones entre entidades (regla genérica)."""
from typing import Any

from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.configuracion import Configuracion

# Consulta Cypher de REFERENCIA para el incremento 4 (no se usa todavía).
# Obtiene, para una entidad, las otras entidades unidas a ella por un mismo
# intermediario, SIN nombrar ninguna etiqueta de intermediario: las
# etiquetas de entidad, las auxiliares, los tipos sin relación, las
# relaciones ignoradas y el límite llegan como parámetros desde la
# configuración. Por eso sirve aunque la BD añada tipos nuevos.
#
#   MATCH (a)-[r1]-(i)-[r2]-(b)
#   WHERE elementId(a) = $id
#     AND any(e IN labels(a) WHERE e IN $etiquetasEntidad)
#     AND any(e IN labels(b) WHERE e IN $etiquetasEntidad)
#     AND none(e IN labels(i) WHERE e IN $etiquetasEntidad + $etiquetasAuxiliares + $tiposSinRelacion)
#     AND NOT type(r1) IN $relacionesIgnoradas AND NOT type(r2) IN $relacionesIgnoradas
#     AND a <> b
#   WITH a, i, collect(DISTINCT b) AS otras, collect(DISTINCT r1.role)[0] AS rolA
#   WHERE size(otras) + 1 <= $maxParticipantes
#   UNWIND otras AS b
#   RETURN elementId(i) AS idIntermedio, labels(i) AS etiquetas, i.relevance AS relevancia,
#          elementId(b) AS idOtra, rolA
#
# (La relación directa entre dos entidades es otra consulta, más sencilla:
#  MATCH (a)-[r]-(b) con a y b entidades y type(r) no ignorado.)


class ProyectorRelaciones:
    """Convierte el grafo de Neo4j, donde las entidades NO se relacionan
    directamente sino a través de nodos intermediarios (Relationship, Event...),
    en relaciones entre entidades, que es lo que dibuja la aplicación.

    Regla genérica (ANALISIS_BD_NEO4J.md §3.2), sin ningún nombre de etiqueta
    ni de relación escrito en el código (todo sale del ClasificadorEtiquetas y
    de la configuración):
      1. POR INTERMEDIARIO: si un intermediario está unido (por cualquier
         relación no ignorada y en cualquier sentido) a dos o más entidades,
         se crea una relación por cada PAREJA de esas entidades. Tipo = la
         etiqueta más específica del intermediario.
      2. DIRECTA: una relación (no ignorada) entre dos entidades se toma tal
         cual. Tipo = el tipo de la relación.
      3. LÍMITES: no se aplica a los tiposSinRelacion (nacimiento, muerte,
         residencia: van al detalle) ni a intermediarios con más de
         maxParticipantesIntermediario entidades (un evento con 50
         asistentes daría 1225 parejas).
      4. DATOS: roles (propiedad "role" de la relación que une cada entidad
         al intermediario), periodo, lugar y fecha.

    Cada relación derivada es un diccionario:
      { "id": "<idIntermedio>|<idA>|<idB>", "idIntermedio", "origen": idA,
        "destino": idB, "tipo", "padres", "roles": {idA: rol, ...},
        "periodo": {...} o None, "lugar": "..." o None, "fecha": "..." o None }
    con la pareja ordenada por id (idA < idB). "valor" (la relevancia) lo
    añade el repositorio con el AsignadorRelevancia.

    Esto trabaja sobre el grafo EN MEMORIA de los datos simulados. En el
    repositorio real (incremento 4) lo harán consultas Cypher (ver la
    consulta de referencia de arriba).

    Requisitos: RF-08 (relaciones de la entidad), RF-38 (varias relaciones
    entre el mismo par), RF-39 (tipos no conocidos de antemano), nuevo RNF
    de mantenibilidad.
    """

    # Propiedades de las relaciones de Neo4j que se leen (son nombres de
    # PROPIEDADES del diseño, no de etiquetas ni de tipos de relación).
    PROPIEDAD_ROL = "role"
    PROPIEDAD_FECHA = "date"

    def __init__(self, nodos: dict[str, dict[str, Any]], adyacencia: dict[str, list[dict[str, Any]]],
                 clasificador: ClasificadorEtiquetas, configuracion: Configuracion) -> None:
        """nodos: id → {"id", "etiquetas", "propiedades"}.
        adyacencia: id de nodo → [{"relacion": relación del grafo, "otro": id del otro extremo}].
        """
        self.__nodos = nodos
        self.__adyacencia = adyacencia
        self.__clasificador = clasificador
        self.__ignoradas = configuracion.get_relaciones_ignoradas()
        self.__sin_relacion = configuracion.get_tipos_sin_relacion()
        self.__maximo = configuracion.get_max_participantes_intermediario()
        self.__papeles = configuracion.get_papeles_auxiliares()
        self.__idioma = configuracion.get_idioma()

    def relaciones_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """Todas las relaciones derivadas en las que participa la entidad (sin
        repetir, aunque la entidad esté unida dos veces al mismo
        intermediario, por ejemplo con PRODUCED y CREATE).
        """
        resultado: list[dict[str, Any]] = []
        ids_vistos: set[str] = set()
        for enlace in self.__enlaces_utiles(id_entidad):
            otro = self.__nodos[enlace["otro"]]
            if self.__clasificador.es_entidad(otro["etiquetas"]):
                if otro["id"] != id_entidad:
                    self.__anadir(resultado, ids_vistos, self.__relacion_directa(enlace["relacion"]))
            elif self.es_intermediario_con_relaciones(otro["etiquetas"]):
                for relacion in self.__relaciones_por_intermediario(otro["id"], id_entidad):
                    self.__anadir(resultado, ids_vistos, relacion)
        return resultado

    def es_relacion_directa(self, relacion: dict[str, Any]) -> bool:
        """¿La relación del grafo une directamente dos entidades distintas y
        no es de un tipo ignorado? (regla 2)
        """
        if relacion["tipo"] in self.__ignoradas or relacion["desde"] == relacion["hasta"]:
            return False
        desde = self.__nodos[relacion["desde"]]["etiquetas"]
        hasta = self.__nodos[relacion["hasta"]]["etiquetas"]
        return self.__clasificador.es_entidad(desde) and self.__clasificador.es_entidad(hasta)

    def es_intermediario_con_relaciones(self, etiquetas: list[str]) -> bool:
        """¿Es un intermediario que crea relaciones (no es de tiposSinRelacion)?"""
        if not self.__clasificador.es_intermediario(etiquetas):
            return False
        return not self.es_sin_relacion(etiquetas)

    def es_sin_relacion(self, etiquetas: list[str]) -> bool:
        """¿Es de un tipo sin relación (nacimiento, muerte, residencia)?"""
        for etiqueta in etiquetas:
            if etiqueta in self.__sin_relacion:
                return True
            for padre in self.__clasificador.padres(etiqueta):
                if padre in self.__sin_relacion:
                    return True
        return False

    def participantes(self, id_intermediario: str) -> list[str]:
        """Ids de las entidades unidas al intermediario (sin repetir)."""
        ids: list[str] = []
        for enlace in self.__enlaces_utiles(id_intermediario):
            otro = self.__nodos[enlace["otro"]]
            if self.__clasificador.es_entidad(otro["etiquetas"]) and otro["id"] not in ids:
                ids.append(otro["id"])
        return ids

    def rol(self, id_intermediario: str, id_entidad: str) -> str | None:
        """El rol con que la entidad participa en el intermediario, si lo tiene."""
        for enlace in self.__enlaces_utiles(id_intermediario):
            if enlace["otro"] == id_entidad:
                rol = enlace["relacion"]["propiedades"].get(ProyectorRelaciones.PROPIEDAD_ROL)
                if isinstance(rol, str) and rol != "":
                    return rol
        return None

    def auxiliar(self, id_nodo: str, papel: str) -> dict[str, Any] | None:
        """El primer nodo auxiliar unido al nodo con ese papel ("periodo",
        "lugar", "imagen", "fuente"), o None. El papel de cada etiqueta
        auxiliar sale de papelesAuxiliares; ninguna etiqueta está en el código.
        """
        for enlace in self.__adyacencia.get(id_nodo, []):
            otro = self.__nodos[enlace["otro"]]
            if self.papel_de(otro["etiquetas"]) == papel:
                return otro
        return None

    def papel_de(self, etiquetas: list[str]) -> str | None:
        """Papel de un nodo auxiliar ("periodo", "lugar"...) o None."""
        for etiqueta in etiquetas:
            if etiqueta in self.__papeles:
                return self.__papeles[etiqueta]
            for padre in self.__clasificador.padres(etiqueta):
                if padre in self.__papeles:
                    return self.__papeles[padre]
        return None

    def fecha(self, id_nodo: str) -> str | None:
        """La fecha ("date") de alguna relación del nodo, si la tiene."""
        for enlace in self.__adyacencia.get(id_nodo, []):
            fecha = enlace["relacion"]["propiedades"].get(ProyectorRelaciones.PROPIEDAD_FECHA)
            if isinstance(fecha, str) and fecha != "":
                return fecha
        return None

    def nombre_en_idioma(self, propiedades: dict[str, Any]) -> str:
        """El nombre de un nodo en el idioma configurado (name_es...); si no
        lo tiene, en el primero que haya (es, ca, en) o en "name".
        """
        orden = ["name_" + self.__idioma, "name_es", "name_ca", "name_en", "name"]
        for clave in orden:
            valor = propiedades.get(clave)
            if isinstance(valor, str) and valor != "":
                return valor
        return ""

    def __enlaces_utiles(self, id_nodo: str) -> list[dict[str, Any]]:
        """(Privado) Los enlaces del nodo por relaciones que NO están en relacionesIgnoradas."""
        utiles: list[dict[str, Any]] = []
        for enlace in self.__adyacencia.get(id_nodo, []):
            if enlace["relacion"]["tipo"] not in self.__ignoradas:
                utiles.append(enlace)
        return utiles

    def __relaciones_por_intermediario(self, id_intermediario: str, id_entidad: str) -> list[dict[str, Any]]:
        """(Privado) Regla 1: una relación por cada pareja (entidad, otra
        participante) del intermediario, si no supera el límite.
        """
        participantes = self.participantes(id_intermediario)
        if len(participantes) < 2 or len(participantes) > self.__maximo:
            return []
        intermediario = self.__nodos[id_intermediario]
        tipo = self.__clasificador.mas_especifica(intermediario["etiquetas"])
        periodo = None
        nodo_periodo = self.auxiliar(id_intermediario, "periodo")
        if nodo_periodo is not None:
            periodo = nodo_periodo["propiedades"]
        lugar = None
        nodo_lugar = self.auxiliar(id_intermediario, "lugar")
        if nodo_lugar is not None:
            lugar = self.nombre_en_idioma(nodo_lugar["propiedades"])
        fecha = self.fecha(id_intermediario)

        relaciones: list[dict[str, Any]] = []
        for id_otra in participantes:
            if id_otra != id_entidad:
                roles: dict[str, str] = {}
                self.__anadir_rol(roles, id_intermediario, id_entidad)
                self.__anadir_rol(roles, id_intermediario, id_otra)
                relaciones.append(self.__crear(id_intermediario, id_entidad, id_otra, tipo, roles,
                                               periodo, lugar, fecha))
        return relaciones

    def __relacion_directa(self, relacion: dict[str, Any]) -> dict[str, Any]:
        """(Privado) Regla 2: la relación entre dos entidades, tal cual."""
        roles: dict[str, str] = {}
        return self.__crear(relacion["id"], relacion["desde"], relacion["hasta"], relacion["tipo"],
                            roles, None, None, relacion["propiedades"].get(ProyectorRelaciones.PROPIEDAD_FECHA))

    def __anadir_rol(self, roles: dict[str, str], id_intermediario: str, id_entidad: str) -> None:
        """(Privado) Apunta el rol de la entidad, si lo tiene."""
        rol = self.rol(id_intermediario, id_entidad)
        if rol is not None:
            roles[id_entidad] = rol

    def __crear(self, id_intermedio: str, id_uno: str, id_otro: str, tipo: str, roles: dict[str, str],
                periodo: dict[str, Any] | None, lugar: str | None, fecha: str | None) -> dict[str, Any]:
        """(Privado) La relación derivada, con la pareja ordenada por id: así
        la misma pareja da el mismo id la busque desde un lado o desde el otro.
        """
        id_a = id_uno
        id_b = id_otro
        if id_b < id_a:
            id_a = id_otro
            id_b = id_uno
        return {
            "id": id_intermedio + "|" + id_a + "|" + id_b,
            "idIntermedio": id_intermedio,
            "origen": id_a,
            "destino": id_b,
            "tipo": tipo,
            "padres": self.__clasificador.padres(tipo),
            "roles": roles,
            "periodo": periodo,
            "lugar": lugar,
            "fecha": fecha,
        }

    @staticmethod
    def __anadir(resultado: list[dict[str, Any]], ids_vistos: set[str], relacion: dict[str, Any]) -> None:
        """(Privado) Añade la relación si no estaba ya."""
        if relacion["id"] not in ids_vistos:
            ids_vistos.add(relacion["id"])
            resultado.append(relacion)
