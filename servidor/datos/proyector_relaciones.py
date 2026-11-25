"""ProyectorRelaciones: deriva las relaciones entre entidades (regla genérica)."""
import re
from typing import Any

from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.configuracion import Configuracion

# Consulta Cypher de REFERENCIA para el repositorio de Neo4j (no se usa todavía).
# Obtiene, para las entidades pedidas ($ids), las otras entidades unidas a
# cada una por un mismo intermediario, SIN nombrar ninguna etiqueta de
# intermediario: las etiquetas de entidad, las auxiliares, los tipos sin
# relación, las relaciones ignoradas y los límites llegan como parámetros
# desde la configuración. Por eso sirve aunque la BD añada tipos nuevos.
#
# Solo devuelve las parejas en las que está una entidad pedida, nunca todas
# las parejas de un evento: un evento de 150 personas da 149 filas por cada
# entidad pedida, no 150 × 149 / 2.
#
#   MATCH (a)-[r1]-(i)
#   WHERE elementId(a) IN $ids
#     AND none(e IN labels(i) WHERE e IN $etiquetasEntidad + $etiquetasAuxiliares + $tiposSinRelacion)
#     AND NOT type(r1) IN $relacionesIgnoradas
#   MATCH (i)-[r2]-(b)
#   WHERE any(e IN labels(b) WHERE e IN $etiquetasEntidad) AND NOT type(r2) IN $relacionesIgnoradas
#   WITH a, i, type(r1) AS viaA, b, head(collect(type(r2))) AS viaB
#   WITH a, i, viaA, collect({nodo: b, via: viaB}) AS todas
#   WHERE size(todas) >= 2 AND size(todas) <= $maxParticipantesEvidencia
#   UNWIND todas AS otra
#   WITH a, i, viaA, otra, todas, size(todas) AS participantes
#   WHERE a <> otra.nodo
#   RETURN elementId(a) AS idPedida, elementId(i) AS idIntermedio, labels(i) AS etiquetas, viaA,
#          elementId(otra.nodo) AS idOtra, labels(otra.nodo) AS etiquetasOtra, otra.via AS viaB, participantes,
#          [x IN todas | labels(x.nodo)] AS etiquetasDeTodas,       // para participantesPorClase
#          participantes <= $maxParticipantesIntermediario AS dibujable
#
# Los eventos repetidos (deduplicarEventos) se buscan UNA vez al arrancar,
# solo leyendo, y se juntan en memoria:
#
#   MATCH (i)-[r]-(lugar)
#   WHERE type(r) IN $relacionesLugar AND any(e IN labels(i) WHERE e IN $tiposCoincidencia)
#     AND r.date =~ '\\d{4}-\\d{2}-\\d{2}'
#   WITH labels(i) AS etiquetas, lugar, r.date AS fecha, collect(elementId(i)) AS registros
#   WHERE size(registros) > 1
#   RETURN etiquetas, fecha, registros          // se comprueba además que el tipo más específico es el mismo
#
# (La relación directa entre dos entidades es otra consulta, más sencilla:
#  MATCH (a)-[r]-(b) con a en $ids, b entidad y type(r) no ignorado;
#  participantes = 2 y dibujable = true.)
#
# La consulta NO lee ni escribe ninguna propiedad de relevancia: la
# relevancia la calcula siempre el navegador.


class ProyectorRelaciones:
    """Convierte el grafo de Neo4j, donde las entidades NO se relacionan
    directamente sino a través de nodos intermediarios (Relationship, Event...),
    en relaciones entre entidades, que es lo que dibuja la aplicación.

    Regla genérica, sin ningún nombre de etiqueta
    ni de relación escrito en el código (todo sale del ClasificadorEtiquetas y
    de la configuración):
      1. POR INTERMEDIARIO: si un intermediario está unido (por cualquier
         relación no ignorada y en cualquier sentido) a dos o más entidades,
         se crea una relación por cada PAREJA de esas entidades. Tipo = la
         etiqueta más específica del intermediario.
      2. DIRECTA: una relación (no ignorada) entre dos entidades se toma tal
         cual. Tipo = el tipo de la relación.
      3. LÍMITES: no se aplica a los tiposSinRelacion (nacimiento, muerte,
         residencia: van al detalle). Un intermediario con más de
         maxParticipantesIntermediario entidades da relaciones con
         dibujable = False: el navegador no las dibuja, pero cuentan como
         evidencia para la relevancia (coincidir en una exposición grande
         dice algo, aunque poco). Con más de maxParticipantesEvidencia se
         ignora del todo.
      4. DATOS: roles (propiedad "role" de la relación que une cada entidad
         al intermediario), nombre del intermediario, periodo, lugar y fecha.
      5. EVENTOS REPETIDOS (deduplicarEventos): el mismo acto puede estar
         registrado varias veces, porque los eventos vienen de fuentes
         distintas (una anécdota y un vídeo), y sus coincidencias contarían
         doble. Crandall y otros (2010) cuentan las coincidencias en lugares y
         momentos DISTINTOS precisamente para no contar dos veces la misma.
         Dos intermediarios cuyo tipo exacto está en tiposCoincidencia, con el
         mismo lugar (relacionesLugar) y la misma fecha exacta, CON DÍA, se
         juntan en uno con todos los participantes de los dos. Sin lugar o
         sin día no se juntan: con solo el año, dos exposiciones distintas
         de la misma galería se confundirían. No se modifica nada en la BD:
         solo se juntan al derivar.

    Cada relación derivada es un diccionario:
      { "id": "<idIntermedio>|<idA>|<idB>", "idIntermedio", "origen": idA,
        "destino": idB, "tipo", "padres", "roles": {idA: rol, ...},
        "nombre": nombre del intermediario en el idioma configurado ("" si no
        tiene o es una relación directa),
        "periodo": {...} o None, "lugar": "..." o None, "fecha": "..." o None,
        "participantes": número de entidades del intermediario (2 en una
        relación directa), "participantesPorClase": {"PERSONA": 3, ...},
        "via": {idA: tipo de la relación de la BD que la une al intermediario,
        en bruto ("PARTICIPATES_IN", "OCURRED_AT"...), idB: ...} ({} en una
        directa), "dibujable": True o False,
        "idsIntermediarios": [...] solo si se han juntado varios registros }
    con la pareja ordenada por id (idA < idB), salvo en las directas, que
    conservan el sentido de la flecha (origen → destino): en «A STUDENT_OF B»,
    A es el alumno. NO lleva relevancia: la calcula siempre el navegador (el
    servidor no calcula ni escribe nada).

    Esto trabaja sobre el grafo EN MEMORIA de los datos simulados. Con Neo4j
    lo harán consultas Cypher (ver la consulta de referencia de arriba).
    """

    # Propiedades de las relaciones de Neo4j que se leen (son nombres de
    # PROPIEDADES del diseño, no de etiquetas ni de tipos de relación).
    PROPIEDAD_ROL = "role"
    PROPIEDAD_FECHA = "date"
    # Una fecha exacta, con día.
    FECHA_CON_DIA = re.compile(r"\d{4}-\d{2}-\d{2}")

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
        self.__maximo_dibujable = configuracion.get_max_participantes_intermediario()
        self.__maximo_evidencia = configuracion.get_max_participantes_evidencia()
        self.__papeles = configuracion.get_papeles_auxiliares()
        self.__idioma = configuracion.get_idioma()
        self.__tipos_coincidencia = configuracion.get_tipos_coincidencia()
        self.__relaciones_lugar = configuracion.get_relaciones_lugar()
        # id de un registro repetido → id del registro con el que se junta, y
        # id de ese registro → todos los que se juntan en él.
        self.__principal: dict[str, str] = {}
        self.__registros: dict[str, list[str]] = {}
        if configuracion.get_deduplicar_eventos():
            self.__buscar_eventos_repetidos()
        # Lo que se sabe de cada intermediario (participantes, vías, roles...),
        # que es lo mismo para todas sus parejas: se prepara una vez.
        self.__datos_intermediarios: dict[str, dict[str, Any]] = {}

    def relaciones_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """Todas las relaciones derivadas en las que participa la entidad (sin
        repetir, aunque la entidad esté unida dos veces al mismo
        intermediario, por ejemplo con PRODUCED y CREATE).
        """
        resultado: list[dict[str, Any]] = []
        ids_vistos: set[str] = set()
        intermediarios_vistos: set[str] = set()
        for enlace in self.__enlaces_utiles(id_entidad):
            otro = self.__nodos[enlace["otro"]]
            if self.__clasificador.es_entidad(otro["etiquetas"]):
                if otro["id"] != id_entidad:
                    self.__anadir(resultado, ids_vistos, self.__relacion_directa(enlace["relacion"]))
            elif self.es_intermediario_con_relaciones(otro["etiquetas"]):
                id_intermediario = self.__id_principal(otro["id"])
                if id_intermediario not in intermediarios_vistos:
                    intermediarios_vistos.add(id_intermediario)
                    for relacion in self.__relaciones_por_intermediario(id_intermediario, id_entidad):
                        self.__anadir(resultado, ids_vistos, relacion)
        return resultado

    def numero_de_relaciones(self, id_entidad: str) -> int:
        """Cuántas relaciones derivadas tiene la entidad, sin crearlas (para
        elegir la muestra del laboratorio).
        """
        numero = 0
        vistos: set[str] = set()
        for enlace in self.__enlaces_utiles(id_entidad):
            otro = self.__nodos[enlace["otro"]]
            if self.__clasificador.es_entidad(otro["etiquetas"]):
                if otro["id"] != id_entidad:
                    numero = numero + 1
            elif self.es_intermediario_con_relaciones(otro["etiquetas"]):
                id_intermediario = self.__id_principal(otro["id"])
                participantes = len(self.__datos_de(id_intermediario)["participantes"])
                if id_intermediario not in vistos and participantes <= self.__maximo_evidencia:
                    vistos.add(id_intermediario)
                    numero = numero + participantes - 1
        return numero

    def intermediarios_ignorados(self) -> dict[str, int]:
        """Cuántos intermediarios de cada tipo se ignoran por tener más de
        maxParticipantesEvidencia entidades (para el laboratorio: no llegan
        nunca al navegador).
        """
        ignorados: dict[str, int] = {}
        for id_nodo in self.__nodos:
            es_registro_repetido = self.__id_principal(id_nodo) != id_nodo
            if not es_registro_repetido and self.es_intermediario_con_relaciones(self.__nodos[id_nodo]["etiquetas"]):
                datos = self.__datos_de(id_nodo)
                if len(datos["participantes"]) > self.__maximo_evidencia:
                    ignorados[datos["tipo"]] = ignorados.get(datos["tipo"], 0) + 1
        return ignorados

    def eventos_juntados(self) -> dict[str, int]:
        """Cuántos eventos de cada tipo tienen varios registros juntados, en
        toda la base de datos (para el laboratorio).
        """
        juntados: dict[str, int] = {}
        for id_principal in self.__registros:
            tipo = self.__clasificador.mas_especifica(self.__nodos[id_principal]["etiquetas"])
            juntados[tipo] = juntados.get(tipo, 0) + 1
        return juntados

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
        participante) del intermediario, si no supera maxParticipantesEvidencia.
        Con más de maxParticipantesIntermediario, no se dibujan.
        """
        datos = self.__datos_de(id_intermediario)
        participantes = datos["participantes"]
        if len(participantes) < 2 or len(participantes) > self.__maximo_evidencia:
            return []
        dibujable = len(participantes) <= self.__maximo_dibujable
        relaciones: list[dict[str, Any]] = []
        for id_otra in participantes:
            if id_otra != id_entidad:
                roles: dict[str, str] = {}
                via: dict[str, str] = {}
                for id_extremo in [id_entidad, id_otra]:
                    via[id_extremo] = participantes[id_extremo]["via"]
                    if participantes[id_extremo]["rol"] is not None:
                        roles[id_extremo] = participantes[id_extremo]["rol"]
                relacion = self.__crear(id_intermediario, id_entidad, id_otra, datos["tipo"], roles, via)
                relacion["nombre"] = datos["nombre"]
                relacion["periodo"] = datos["periodo"]
                relacion["lugar"] = datos["lugar"]
                relacion["fecha"] = datos["fecha"]
                relacion["participantes"] = len(participantes)
                relacion["participantesPorClase"] = datos["porClase"]
                relacion["dibujable"] = dibujable
                if len(datos["registros"]) > 1:
                    relacion["idsIntermediarios"] = datos["registros"]
                relaciones.append(relacion)
        return relaciones

    def __relacion_directa(self, relacion: dict[str, Any]) -> dict[str, Any]:
        """(Privado) Regla 2: la relación entre dos entidades, tal cual. El
        id lleva la pareja ordenada (es el mismo desde los dos lados), pero el
        origen y el destino son los de la flecha: de ellos salen los roles
        (rolesPorDireccion, en el navegador).
        """
        derivada = self.__crear(relacion["id"], relacion["desde"], relacion["hasta"], relacion["tipo"], {}, {})
        derivada["origen"] = relacion["desde"]
        derivada["destino"] = relacion["hasta"]
        derivada["fecha"] = relacion["propiedades"].get(ProyectorRelaciones.PROPIEDAD_FECHA)
        derivada["participantesPorClase"] = self.__contar_por_clase([relacion["desde"], relacion["hasta"]])
        return derivada

    def __crear(self, id_intermedio: str, id_uno: str, id_otro: str, tipo: str, roles: dict[str, str],
                via: dict[str, str]) -> dict[str, Any]:
        """(Privado) La relación derivada, con la pareja ordenada por id: así
        la misma pareja da el mismo id la busque desde un lado o desde el
        otro. Los demás campos, con los valores de una relación directa.
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
            "via": via,
            "nombre": "",
            "periodo": None,
            "lugar": None,
            "fecha": None,
            "participantes": 2,
            "participantesPorClase": {},
            "dibujable": True,
        }

    # ───────────── Privados: cada intermediario ─────────────

    def __datos_de(self, id_intermediario: str) -> dict[str, Any]:
        """(Privado) Lo que se sabe de un intermediario, con todos sus
        registros si se han juntado varios: sus participantes (id → vía y rol,
        en el orden en que aparecen; si una entidad está unida varias veces, la
        primera vía y el primer rol que haya), cuántos hay de cada clase y
        su tipo, nombre, periodo, lugar y fecha (los del primer registro que
        los tenga).
        """
        if id_intermediario in self.__datos_intermediarios:
            return self.__datos_intermediarios[id_intermediario]
        registros = self.__registros.get(id_intermediario, [id_intermediario])
        participantes: dict[str, dict[str, Any]] = {}
        datos: dict[str, Any] = {
            "registros": registros,
            "participantes": participantes,
            "tipo": self.__clasificador.mas_especifica(self.__nodos[id_intermediario]["etiquetas"]),
            "nombre": "",
            "periodo": None,
            "lugar": None,
            "fecha": None,
        }
        for id_registro in registros:
            for enlace in self.__enlaces_utiles(id_registro):
                otro = self.__nodos[enlace["otro"]]
                if self.__clasificador.es_entidad(otro["etiquetas"]):
                    if otro["id"] not in participantes:
                        participantes[otro["id"]] = {"via": enlace["relacion"]["tipo"], "rol": None}
                    rol = enlace["relacion"]["propiedades"].get(ProyectorRelaciones.PROPIEDAD_ROL)
                    if participantes[otro["id"]]["rol"] is None and isinstance(rol, str) and rol != "":
                        participantes[otro["id"]]["rol"] = rol
            self.__completar_datos(datos, id_registro)
        datos["porClase"] = self.__contar_por_clase(list(participantes))
        self.__datos_intermediarios[id_intermediario] = datos
        return datos

    def __completar_datos(self, datos: dict[str, Any], id_registro: str) -> None:
        """(Privado) Rellena con un registro lo que aún falte."""
        if datos["nombre"] == "":
            datos["nombre"] = self.nombre_en_idioma(self.__nodos[id_registro]["propiedades"])
        if datos["periodo"] is None:
            nodo_periodo = self.auxiliar(id_registro, "periodo")
            if nodo_periodo is not None:
                datos["periodo"] = nodo_periodo["propiedades"]
        if datos["lugar"] is None:
            nodo_lugar = self.auxiliar(id_registro, "lugar")
            if nodo_lugar is not None:
                datos["lugar"] = self.nombre_en_idioma(nodo_lugar["propiedades"])
        if datos["fecha"] is None:
            datos["fecha"] = self.fecha(id_registro)

    def __contar_por_clase(self, ids: list[str]) -> dict[str, int]:
        """(Privado) Cuántas entidades hay de cada TipoEntidad."""
        contador: dict[str, int] = {}
        for id_entidad in ids:
            clase = self.__clasificador.tipo_entidad(self.__nodos[id_entidad]["etiquetas"])
            contador[clase] = contador.get(clase, 0) + 1
        return contador

    def __id_principal(self, id_intermediario: str) -> str:
        """(Privado) El registro con el que se junta (él mismo si no se junta)."""
        return self.__principal.get(id_intermediario, id_intermediario)

    def __buscar_eventos_repetidos(self) -> None:
        """(Privado) Regla 5: agrupa los registros del mismo evento."""
        por_clave: dict[str, str] = {}
        for id_nodo in self.__nodos:
            clave = self.__clave_de_evento(id_nodo)
            if clave is not None:
                if clave in por_clave:
                    principal = por_clave[clave]
                    self.__principal[id_nodo] = principal
                    if principal not in self.__registros:
                        self.__registros[principal] = [principal]
                    self.__registros[principal].append(id_nodo)
                else:
                    por_clave[clave] = id_nodo

    def __clave_de_evento(self, id_nodo: str) -> str | None:
        """(Privado) "tipo|lugares|fecha" de un evento que se puede comparar
        con otros (tipo de tiposCoincidencia, con lugar y con una fecha con
        día), o None si no se puede.
        """
        etiquetas = self.__nodos[id_nodo]["etiquetas"]
        if not self.es_intermediario_con_relaciones(etiquetas):
            return None
        tipo = self.__clasificador.mas_especifica(etiquetas)
        if tipo not in self.__tipos_coincidencia:
            return None
        lugares: list[str] = []
        fecha_con_dia = ""
        for enlace in self.__adyacencia.get(id_nodo, []):
            relacion = enlace["relacion"]
            if relacion["tipo"] in self.__relaciones_lugar and enlace["otro"] not in lugares:
                lugares.append(enlace["otro"])
            fecha = relacion["propiedades"].get(ProyectorRelaciones.PROPIEDAD_FECHA)
            if fecha_con_dia == "" and isinstance(fecha, str):
                if ProyectorRelaciones.FECHA_CON_DIA.fullmatch(fecha) is not None:
                    fecha_con_dia = fecha
        if len(lugares) == 0 or fecha_con_dia == "":
            return None
        lugares.sort()
        return tipo + "|" + ",".join(lugares) + "|" + fecha_con_dia

    @staticmethod
    def __anadir(resultado: list[dict[str, Any]], ids_vistos: set[str], relacion: dict[str, Any]) -> None:
        """(Privado) Añade la relación si no estaba ya."""
        if relacion["id"] not in ids_vistos:
            ids_vistos.add(relacion["id"])
            resultado.append(relacion)
