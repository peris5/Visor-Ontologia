"""RepositorioSimulado: los datos de ejemplo, con la forma de Neo4j, en memoria."""
import asyncio
import random
from typing import Any

from servidor.datos.proyector_relaciones import ProyectorRelaciones
from servidor.datos.repositorio_datos import EntidadNoEncontrada, RepositorioDatos
from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.configuracion import Configuracion


class RepositorioSimulado(RepositorioDatos):
    """Repositorio que lee un grafo de ejemplo con la MISMA forma que la base
    de datos Neo4j del proyecto (ver servidor/datos/datos_ejemplo.json):

      { "jerarquia": { etiqueta: su padre },          (los IS_A del diseño)
        "nodos": [ { "id", "etiquetas", "propiedades" } ],
        "relaciones": [ { "id", "tipo", "desde", "hasta", "propiedades" } ] }

    Al crearse prepara, UNA vez:
     - el grafo en memoria y un índice de las relaciones de cada nodo;
     - el ClasificadorEtiquetas (con la jerarquía de los datos);
     - el ProyectorRelaciones (la regla genérica que deriva las relaciones
       entre entidades).

    Solo lee: no calcula ninguna relevancia ni cambia nada del grafo.

    Puede simular la espera de la red con un pequeño retardo.
    """

    # Propiedades que forman el nombre de una entidad (las del diseño:
    # name y lastName en Person; name_es, name_ca y name_en en el resto).
    PROPIEDADES_DE_NOMBRE = ["name", "lastName", "name_es", "name_ca", "name_en"]
    # Propiedades de relevancia que pudiera tener la BD: no se envían al
    # navegador, que calcula siempre la relevancia por su cuenta.
    PROPIEDADES_DE_RELEVANCIA = ["relevance", "relevanceSource", "relevanceVersion"]
    PROPIEDAD_ORDEN = "order"
    # Cuántos de los creadores con más relaciones entran en la muestra.
    MAS_RELACIONADOS_EN_LA_MUESTRA = 25

    def __init__(self, datos: dict[str, Any], retardo_ms: float, configuracion: Configuracion) -> None:
        """datos: con el formato de arriba (se copian: el repositorio no
        cambia el diccionario que recibe). retardo_ms: espera simulada (0 en
        las pruebas). configuracion: ya comprobada.
        """
        if not isinstance(datos, dict):
            raise ValueError("El repositorio simulado necesita unos datos.")
        if not isinstance(datos.get("nodos"), list) or not isinstance(datos.get("relaciones"), list):
            raise ValueError("Los datos deben tener una lista 'nodos' y una lista 'relaciones'.")

        self.__retardo_ms = 0.0
        if isinstance(retardo_ms, (int, float)) and retardo_ms > 0:
            self.__retardo_ms = retardo_ms

        self.__orden_nodos: list[str] = []
        self.__nodos = self.__cargar_nodos(datos["nodos"])
        self.__posicion: dict[str, int] = {}
        for id_nodo in self.__orden_nodos:
            self.__posicion[id_nodo] = len(self.__posicion)
        self.__relaciones = self.__cargar_relaciones(datos["relaciones"])
        self.__adyacencia = self.__indexar()

        self.__clasificador = ClasificadorEtiquetas(configuracion, RepositorioSimulado.__leer_jerarquia(datos))
        self.__proyector = ProyectorRelaciones(self.__nodos, self.__adyacencia, self.__clasificador, configuracion)
        self.__jerarquia = RepositorioSimulado.__leer_jerarquia(datos)
        self.__etiquetas_creador = configuracion.get_etiquetas_creador()

    def get_clasificador(self) -> ClasificadorEtiquetas:
        """El clasificador de etiquetas (con la jerarquía de estos datos)."""
        return self.__clasificador

    def get_grafo(self) -> dict[str, Any]:
        """Copia del grafo en memoria (para las pruebas: comprobar que el
        repositorio no escribe nada).
        """
        nodos: list[dict[str, Any]] = []
        for id_nodo in self.__orden_nodos:
            nodo = self.__nodos[id_nodo]
            nodos.append({"id": id_nodo, "etiquetas": list(nodo["etiquetas"]),
                          "propiedades": dict(nodo["propiedades"])})
        relaciones: list[dict[str, Any]] = []
        for relacion in self.__relaciones.values():
            relaciones.append({"id": relacion["id"], "tipo": relacion["tipo"], "desde": relacion["desde"],
                               "hasta": relacion["hasta"], "propiedades": dict(relacion["propiedades"])})
        return {"nodos": nodos, "relaciones": relaciones}

    async def obtener_tipos(self) -> list[dict[str, Any]]:
        """Etiquetas de los intermediarios que crean relaciones y tipos de las
        relaciones directas entre entidades, con sus padres, ordenados por id.
        Salen de los DATOS: si aparece un tipo nuevo, sale aquí.
        """
        await self.__esperar()
        ids: list[str] = []
        for id_nodo in self.__orden_nodos:
            etiquetas = self.__nodos[id_nodo]["etiquetas"]
            if self.__proyector.es_intermediario_con_relaciones(etiquetas):
                for etiqueta in etiquetas:
                    if etiqueta not in ids:
                        ids.append(etiqueta)
        for relacion in self.__relaciones.values():
            if self.__es_relacion_directa(relacion) and relacion["tipo"] not in ids:
                ids.append(relacion["tipo"])
        ids.sort()
        tipos: list[dict[str, Any]] = []
        for id_tipo in ids:
            tipos.append({"id": id_tipo, "padres": self.__clasificador.padres(id_tipo)})
        return tipos

    async def obtener_nombres(self) -> list[dict[str, Any]]:
        """Todas las entidades con solo sus propiedades de nombre."""
        await self.__esperar()
        nombres: list[dict[str, Any]] = []
        for id_nodo in self.__orden_nodos:
            nodo = self.__nodos[id_nodo]
            if self.__clasificador.es_entidad(nodo["etiquetas"]):
                nombres.append(self.__con_solo_nombre(nodo))
        return nombres

    async def obtener_jerarquia(self) -> dict[str, list[str]]:
        """Cada etiqueta de la jerarquía (y cada padre) con sus padres."""
        await self.__esperar()
        jerarquia: dict[str, list[str]] = {}
        for etiqueta in self.__jerarquia:
            jerarquia[etiqueta] = self.__clasificador.padres(etiqueta)
            padre = self.__jerarquia[etiqueta]
            if padre not in jerarquia:
                jerarquia[padre] = self.__clasificador.padres(padre)
        return jerarquia

    async def obtener_relaciones(self, ids: list[str]) -> dict[str, Any]:
        """Las relaciones derivadas de las entidades pedidas (sin repetir) y
        las entidades de sus extremos, en el orden de los datos.

        Se devuelven TODAS: las que se dibujan (dibujable) y las que solo son
        evidencia, porque el navegador las necesita todas para calcular la
        relevancia. No se recorre nada más allá de las entidades pedidas: el
        navegador sabe qué tiene que pedir (ver GestorSubgrafos.js).
        """
        await self.__esperar()
        for id_entidad in ids:
            self.__comprobar_entidad(id_entidad)
        encontradas: set[str] = set()
        relaciones: list[dict[str, Any]] = []
        ids_vistos: set[str] = set()
        for id_entidad in ids:
            encontradas.add(id_entidad)
            for relacion in self.__proyector.relaciones_de(id_entidad):
                if relacion["id"] not in ids_vistos:
                    ids_vistos.add(relacion["id"])
                    relaciones.append(relacion)
                    encontradas.add(relacion["origen"])
                    encontradas.add(relacion["destino"])
        return {"entidades": self.__entidades_en_orden(encontradas), "relaciones": relaciones}

    async def obtener_detalle(self, id_entidad: str) -> dict[str, Any]:
        """En bruto: la entidad, sus eventos (y relaciones), imágenes, fuentes
        y ubicación. Qué relación lleva a cada auxiliar NO está escrito: se
        reconoce por la etiqueta del auxiliar (papelesAuxiliares).
        """
        await self.__esperar()
        self.__comprobar_entidad(id_entidad)
        nodo = self.__nodos[id_entidad]
        return {
            "id": id_entidad,
            "etiquetas": list(nodo["etiquetas"]),
            "propiedades": RepositorioSimulado.__sin_relevancia(nodo["propiedades"]),
            "eventos": self.__eventos_de(id_entidad),
            "imagenes": self.__imagenes_de(id_entidad),
            "fuentes": self.__fuentes_de(id_entidad),
            "ubicacion": self.__ubicacion_de(id_entidad),
        }

    async def obtener_muestra(self, numero: int, semilla: int) -> dict[str, Any]:
        """Los creadores con más relaciones y otros al azar con la semilla."""
        await self.__esperar()
        # Para ordenar, tuplas (−relaciones, posición, id): de más a menos
        # relaciones y, a igualdad, en el orden de los datos.
        creadores: list[tuple[int, int, str]] = []
        otras: list[str] = []
        for id_nodo in self.__orden_nodos:
            etiquetas = self.__nodos[id_nodo]["etiquetas"]
            if self.__clasificador.es_entidad(etiquetas):
                if self.__es_creador(etiquetas):
                    creadores.append((-self.__proyector.numero_de_relaciones(id_nodo), len(creadores), id_nodo))
                else:
                    otras.append(id_nodo)
        creadores.sort()
        ids: list[str] = []
        resto: list[str] = []
        for tupla in creadores:
            if len(ids) < RepositorioSimulado.MAS_RELACIONADOS_EN_LA_MUESTRA and len(ids) < numero:
                ids.append(tupla[2])
            else:
                resto.append(tupla[2])
        azar = random.Random(semilla)
        azar.shuffle(resto)
        azar.shuffle(otras)
        for id_nodo in resto + otras:
            if len(ids) < numero:
                ids.append(id_nodo)
        return {
            "ids": ids,
            "creadores": min(len(creadores), len(ids)),
            "entidades": len(creadores) + len(otras),
            "intermediariosIgnorados": self.__proyector.intermediarios_ignorados(),
            "eventosJuntados": self.__proyector.eventos_juntados(),
        }

    def __es_creador(self, etiquetas: list[str]) -> bool:
        """(Privado) ¿Alguna etiqueta (o padre) está en etiquetasCreador?"""
        for etiqueta in etiquetas:
            if etiqueta in self.__etiquetas_creador:
                return True
            for padre in self.__clasificador.padres(etiqueta):
                if padre in self.__etiquetas_creador:
                    return True
        return False

    # ───────────── Privados: carga del grafo ─────────────

    def __cargar_nodos(self, lista: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        """(Privado) Copia cada nodo y lo guarda por id."""
        nodos: dict[str, dict[str, Any]] = {}
        for datos_nodo in lista:
            id_nodo = datos_nodo.get("id")
            if not isinstance(id_nodo, str) or id_nodo == "":
                raise ValueError("Hay un nodo sin id.")
            if id_nodo in nodos:
                raise ValueError("Hay dos nodos con el mismo id: " + id_nodo + ".")
            nodos[id_nodo] = {
                "id": id_nodo,
                "etiquetas": list(datos_nodo.get("etiquetas", [])),
                "propiedades": dict(datos_nodo.get("propiedades", {})),
            }
            self.__orden_nodos.append(id_nodo)
        return nodos

    def __cargar_relaciones(self, lista: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        """(Privado) Copia cada relación, comprobando que sus nodos existen."""
        relaciones: dict[str, dict[str, Any]] = {}
        for datos_relacion in lista:
            id_relacion = datos_relacion["id"]
            for extremo in [datos_relacion["desde"], datos_relacion["hasta"]]:
                if extremo not in self.__nodos:
                    raise ValueError("La relación " + id_relacion + " usa un nodo que no existe: " + extremo + ".")
            relaciones[id_relacion] = {
                "id": id_relacion,
                "tipo": datos_relacion["tipo"],
                "desde": datos_relacion["desde"],
                "hasta": datos_relacion["hasta"],
                "propiedades": dict(datos_relacion.get("propiedades", {})),
            }
        return relaciones

    def __indexar(self) -> dict[str, list[dict[str, Any]]]:
        """(Privado) Índice id de nodo → sus relaciones (en los dos sentidos)
        y el nodo del otro extremo. Se prepara UNA vez, como hará la BD real
        con sus propios índices.
        """
        adyacencia: dict[str, list[dict[str, Any]]] = {}
        for id_nodo in self.__orden_nodos:
            adyacencia[id_nodo] = []
        for relacion in self.__relaciones.values():
            adyacencia[relacion["desde"]].append({"relacion": relacion, "otro": relacion["hasta"]})
            if relacion["hasta"] != relacion["desde"]:
                adyacencia[relacion["hasta"]].append({"relacion": relacion, "otro": relacion["desde"]})
        return adyacencia

    @staticmethod
    def __leer_jerarquia(datos: dict[str, Any]) -> dict[str, str]:
        """(Privado) La jerarquía etiqueta → padre, sin los comentarios ("_...")."""
        jerarquia: dict[str, str] = {}
        leida = datos.get("jerarquia", {})
        for etiqueta in leida:
            if not etiqueta.startswith("_"):
                jerarquia[etiqueta] = leida[etiqueta]
        return jerarquia

    # ───────────── Privados: relaciones ─────────────

    def __comprobar_entidad(self, id_entidad: str) -> None:
        """(Privado) EntidadNoEncontrada si no existe o no es una entidad."""
        if id_entidad not in self.__nodos:
            raise EntidadNoEncontrada("No existe la entidad " + id_entidad)
        if not self.__clasificador.es_entidad(self.__nodos[id_entidad]["etiquetas"]):
            raise EntidadNoEncontrada("No existe la entidad " + id_entidad)

    def __entidades_en_orden(self, encontrados: set[str]) -> list[dict[str, Any]]:
        """(Privado) Las entidades encontradas, en bruto y en el orden de los datos."""
        # Se ordenan solo las encontradas: recorrer todos los nodos en cada
        # petición sería lento con los datos grandes.
        posiciones: list[int] = []
        for id_nodo in encontrados:
            posiciones.append(self.__posicion[id_nodo])
        posiciones.sort()
        entidades: list[dict[str, Any]] = []
        for posicion in posiciones:
            nodo = self.__nodos[self.__orden_nodos[posicion]]
            entidades.append({
                "id": nodo["id"],
                "etiquetas": list(nodo["etiquetas"]),
                "propiedades": RepositorioSimulado.__sin_relevancia(nodo["propiedades"]),
            })
        return entidades

    def __es_relacion_directa(self, relacion: dict[str, Any]) -> bool:
        """(Privado) ¿Une directamente dos entidades (y no está ignorada)?"""
        return self.__proyector.es_relacion_directa(relacion)

    # ───────────── Privados: detalle ─────────────

    def __eventos_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """(Privado) Los intermediarios en los que participa la entidad
        (eventos, también nacimiento, muerte y residencia, y relaciones), con
        su rol, periodo, lugar, fecha y los demás participantes. Ordenados por
        el comienzo de su periodo.
        """
        para_ordenar: list[tuple[str, int, dict[str, Any]]] = []
        vistos: set[str] = set()
        for id_intermediario in self.__vecinos(id_entidad):
            nodo = self.__nodos[id_intermediario]
            if id_intermediario not in vistos and self.__clasificador.es_intermediario(nodo["etiquetas"]):
                vistos.add(id_intermediario)
                evento = self.__evento(nodo, id_entidad)
                comienzo = ""
                if evento["periodo"] is not None:
                    comienzo = str(evento["periodo"].get("from", ""))
                # Se ordenan tuplas (comienzo, posición, evento): la posición
                # es distinta en cada una, así nunca hace falta comparar eventos.
                para_ordenar.append((comienzo, len(para_ordenar), evento))
        para_ordenar.sort()
        eventos: list[dict[str, Any]] = []
        for tupla in para_ordenar:
            eventos.append(tupla[2])
        return eventos

    def __evento(self, nodo: dict[str, Any], id_entidad: str) -> dict[str, Any]:
        """(Privado) Un intermediario del detalle, en bruto."""
        periodo = None
        nodo_periodo = self.__proyector.auxiliar(nodo["id"], "periodo")
        if nodo_periodo is not None:
            periodo = dict(nodo_periodo["propiedades"])
        lugar = None
        nodo_lugar = self.__proyector.auxiliar(nodo["id"], "lugar")
        if nodo_lugar is not None:
            lugar = dict(nodo_lugar["propiedades"])
        participantes: list[dict[str, Any]] = []
        for id_otra in self.__proyector.participantes(nodo["id"]):
            if id_otra != id_entidad:
                participantes.append(self.__con_solo_nombre(self.__nodos[id_otra]))
        tipo = self.__clasificador.mas_especifica(nodo["etiquetas"])
        return {
            "id": nodo["id"],
            "etiquetas": list(nodo["etiquetas"]),
            "propiedades": RepositorioSimulado.__sin_relevancia(nodo["propiedades"]),
            "tipo": tipo,
            "padres": self.__clasificador.padres(tipo),
            "sinRelacion": self.__proyector.es_sin_relacion(nodo["etiquetas"]),
            "rol": self.__proyector.rol(nodo["id"], id_entidad),
            "periodo": periodo,
            "lugar": lugar,
            "fecha": self.__proyector.fecha(nodo["id"]),
            "participantes": participantes,
        }

    def __imagenes_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """(Privado) Las imágenes de la entidad, ordenadas por "order"."""
        para_ordenar: list[tuple[float, int, dict[str, Any]]] = []
        for enlace in self.__adyacencia[id_entidad]:
            otro = self.__nodos[enlace["otro"]]
            if self.__proyector.papel_de(otro["etiquetas"]) == "imagen":
                orden = enlace["relacion"]["propiedades"].get(RepositorioSimulado.PROPIEDAD_ORDEN)
                if not isinstance(orden, (int, float)):
                    orden = 0
                imagen = {"id": otro["id"], "propiedades": dict(otro["propiedades"]), "orden": orden}
                para_ordenar.append((orden, len(para_ordenar), imagen))
        para_ordenar.sort()
        imagenes: list[dict[str, Any]] = []
        for tupla in para_ordenar:
            imagenes.append(tupla[2])
        return imagenes

    def __fuentes_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """(Privado) Las fuentes externas de la entidad, con los datos de la
        relación que las une (dateUpdated, externalId).
        """
        fuentes: list[dict[str, Any]] = []
        for enlace in self.__adyacencia[id_entidad]:
            otro = self.__nodos[enlace["otro"]]
            if self.__proyector.papel_de(otro["etiquetas"]) == "fuente":
                propiedades_enlace = enlace["relacion"]["propiedades"]
                fuentes.append({
                    "id": otro["id"],
                    "etiquetas": list(otro["etiquetas"]),
                    "propiedades": dict(otro["propiedades"]),
                    "tipo": self.__clasificador.mas_especifica(otro["etiquetas"]),
                    "dateUpdated": propiedades_enlace.get("dateUpdated"),
                    "externalId": propiedades_enlace.get("externalId"),
                })
        return fuentes

    def __ubicacion_de(self, id_entidad: str) -> list[dict[str, Any]]:
        """(Privado) El lugar unido directamente a la entidad y la cadena de
        lugares que lo contienen (ciudad → provincia → país), siguiendo las
        relaciones que SALEN de un lugar hacia otro lugar (las IS_IN, sin
        escribir su nombre).
        """
        cadena: list[dict[str, Any]] = []
        actual = self.__proyector.auxiliar(id_entidad, "lugar")
        vistos: set[str] = set()
        while actual is not None and actual["id"] not in vistos:
            vistos.add(actual["id"])
            cadena.append(dict(actual["propiedades"]))
            siguiente = None
            for enlace in self.__adyacencia[actual["id"]]:
                otro = self.__nodos[enlace["otro"]]
                sale_de_aqui = enlace["relacion"]["desde"] == actual["id"]
                if sale_de_aqui and self.__proyector.papel_de(otro["etiquetas"]) == "lugar":
                    siguiente = otro
            actual = siguiente
        return cadena

    def __vecinos(self, id_nodo: str) -> list[str]:
        """(Privado) Ids de los nodos unidos al nodo (pueden repetirse)."""
        ids: list[str] = []
        for enlace in self.__adyacencia[id_nodo]:
            ids.append(enlace["otro"])
        return ids

    # ───────────── Privados: ayudas ─────────────

    @staticmethod
    def __con_solo_nombre(nodo: dict[str, Any]) -> dict[str, Any]:
        """(Privado) El nodo con solo sus propiedades de nombre."""
        propiedades: dict[str, Any] = {}
        for clave in RepositorioSimulado.PROPIEDADES_DE_NOMBRE:
            if clave in nodo["propiedades"]:
                propiedades[clave] = nodo["propiedades"][clave]
        return {"id": nodo["id"], "etiquetas": list(nodo["etiquetas"]), "propiedades": propiedades}

    @staticmethod
    def __sin_relevancia(propiedades: dict[str, Any]) -> dict[str, Any]:
        """(Privado) Copia de las propiedades sin las de relevancia."""
        copia: dict[str, Any] = {}
        for clave in propiedades:
            if clave not in RepositorioSimulado.PROPIEDADES_DE_RELEVANCIA:
                copia[clave] = propiedades[clave]
        return copia

    async def __esperar(self) -> None:
        """(Privado) Simula la latencia de la red esperando retardo_ms milisegundos."""
        await asyncio.sleep(self.__retardo_ms / 1000)
