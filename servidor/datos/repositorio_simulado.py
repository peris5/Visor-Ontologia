"""RepositorioSimulado: los datos de ejemplo, con la forma de Neo4j, en memoria."""
import asyncio
from typing import Any

from servidor.datos.almacen_relevancias import AlmacenRelevancias
from servidor.datos.almacen_relevancias_en_grafo import AlmacenRelevanciasEnGrafo
from servidor.datos.proyector_relaciones import ProyectorRelaciones
from servidor.datos.repositorio_datos import EntidadNoEncontrada, RepositorioDatos
from servidor.logica.asignador_relevancia import AsignadorRelevancia
from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.configuracion import Configuracion
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia
from servidor.logica.relevancia_por_tipo import RelevanciaPorTipo
from servidor.modelo.vecindario import Vecindario


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
       entre entidades);
     - el AlmacenRelevanciasEnGrafo y el AsignadorRelevancia, que asignan y
       GUARDAN en el grafo la relevancia de lo que se recorre.

    Puede simular la espera de la red con un pequeño retardo.

    Requisitos: RNF-17; RF-09 (relevancia asignada y guardada); RF-39.
    """

    # Propiedades que forman el nombre de una entidad (las del diseño:
    # name y lastName en Person; name_es, name_ca y name_en en el resto).
    PROPIEDADES_DE_NOMBRE = ["name", "lastName", "name_es", "name_ca", "name_en"]
    # Propiedades de relevancia: las escribe el almacén y no se envían al navegador
    # como propiedades de los nodos (la relevancia ya va en cada relación).
    PROPIEDADES_DE_RELEVANCIA = ["relevance", "relevanceSource", "relevanceVersion"]
    PROPIEDAD_ORDEN = "order"

    def __init__(self, datos: dict[str, Any], retardo_ms: float, configuracion: Configuracion,
                 estrategia: EstrategiaRelevancia | None = None) -> None:
        """datos: con el formato de arriba (se copian: el repositorio no
        cambia el diccionario que recibe). retardo_ms: espera simulada (0 en
        las pruebas). configuracion: ya comprobada. estrategia: la de la
        relevancia; si no se indica, RelevanciaPorTipo.
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
        self.__relaciones = self.__cargar_relaciones(datos["relaciones"])
        self.__adyacencia = self.__indexar()

        self.__clasificador = ClasificadorEtiquetas(configuracion, RepositorioSimulado.__leer_jerarquia(datos))
        self.__proyector = ProyectorRelaciones(self.__nodos, self.__adyacencia, self.__clasificador, configuracion)
        self.__almacen = AlmacenRelevanciasEnGrafo(self.__nodos, self.__relaciones)
        if estrategia is None:
            estrategia = RelevanciaPorTipo(configuracion, self.__clasificador)
        self.__asignador = AsignadorRelevancia(estrategia, self.__almacen, configuracion.get_version_pesos())

    def get_clasificador(self) -> ClasificadorEtiquetas:
        """El clasificador de etiquetas (con la jerarquía de estos datos)."""
        return self.__clasificador

    def get_almacen(self) -> AlmacenRelevancias:
        """El almacén de relevancias (para las pruebas: ver qué se ha guardado)."""
        return self.__almacen

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

    async def obtener_vecindario(self, id_entidad: str, umbral: float, max_entidades: int) -> Vecindario:
        """Recorrido EN ANCHURA desde la entidad por las relaciones derivadas.
        Para cada relación que encuentra, pide su relevancia al
        AsignadorRelevancia (que la calcula y la guarda si falta) y SOLO la
        sigue si supera el umbral.

        ¿Por qué el vecindario contiene seguro todo lo que necesita el navegador?
          La relevancia de un nodo es el producto de las relevancias de las
          relaciones de su camino, todas entre 0 y 1, y un producto así nunca
          es mayor que ninguno de sus factores. Si un nodo supera el umbral,
          todas las relaciones de su camino lo superan también, y este
          recorrido pasa por ellas. Lo que sobre, lo descarta el navegador.

        Solo se asigna relevancia a las relaciones que se encuentran: las de
        las zonas del grafo a las que no se llega no se calculan.
        """
        await self.__esperar()
        self.__comprobar_entidad(id_entidad)
        antes = self.__asignador.get_estadisticas()

        encontrados: set[str] = {id_entidad}
        relaciones: dict[str, dict[str, Any]] = {}
        # Relevancia de cada intermediario ya vista en ESTA petición: un mismo
        # intermediario crea varias parejas y se pide una sola vez.
        valores: dict[str, float] = {}
        recortado = False
        cola = [id_entidad]
        posicion = 0
        while posicion < len(cola):
            id_actual = cola[posicion]
            posicion = posicion + 1
            for relacion in self.__proyector.relaciones_de(id_actual):
                valor = self.__valor_de(relacion, valores)
                if valor > umbral:
                    if relacion["id"] not in relaciones:
                        con_valor = dict(relacion)
                        con_valor["valor"] = valor
                        relaciones[relacion["id"]] = con_valor
                    id_otra = relacion["origen"]
                    if id_otra == id_actual:
                        id_otra = relacion["destino"]
                    if id_otra not in encontrados:
                        if len(encontrados) < max_entidades:
                            encontrados.add(id_otra)
                            cola.append(id_otra)
                        else:
                            # No cabe: el vecindario queda incompleto. Se sigue
                            # recorriendo la cola sin añadir entidades.
                            recortado = True

        despues = self.__asignador.get_estadisticas()
        return Vecindario(self.__entidades_en_orden(encontrados),
                          self.__relaciones_entre(relaciones, encontrados),
                          recortado,
                          despues["asignadas"] - antes["asignadas"],
                          despues["reutilizadas"] - antes["reutilizadas"])

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

    # ───────────── Privados: vecindario ─────────────

    def __comprobar_entidad(self, id_entidad: str) -> None:
        """(Privado) EntidadNoEncontrada si no existe o no es una entidad."""
        if id_entidad not in self.__nodos:
            raise EntidadNoEncontrada("No existe la entidad " + id_entidad)
        if not self.__clasificador.es_entidad(self.__nodos[id_entidad]["etiquetas"]):
            raise EntidadNoEncontrada("No existe la entidad " + id_entidad)

    def __valor_de(self, relacion: dict[str, Any], valores: dict[str, float]) -> float:
        """(Privado) Relevancia de la relación: la del intermediario (o de la
        relación directa) que la produce, pedida una sola vez por petición.
        """
        id_elemento = relacion["idIntermedio"]
        if id_elemento not in valores:
            valores[id_elemento] = self.__asignador.obtener(id_elemento, relacion["tipo"])
        return valores[id_elemento]

    def __entidades_en_orden(self, encontrados: set[str]) -> list[dict[str, Any]]:
        """(Privado) Las entidades encontradas, en bruto y en el orden de los datos."""
        entidades: list[dict[str, Any]] = []
        for id_nodo in self.__orden_nodos:
            if id_nodo in encontrados:
                nodo = self.__nodos[id_nodo]
                entidades.append({
                    "id": id_nodo,
                    "etiquetas": list(nodo["etiquetas"]),
                    "propiedades": RepositorioSimulado.__sin_relevancia(nodo["propiedades"]),
                })
        return entidades

    @staticmethod
    def __relaciones_entre(relaciones: dict[str, dict[str, Any]], encontrados: set[str]) -> list[dict[str, Any]]:
        """(Privado) Solo las relaciones con sus dos extremos en el vecindario
        (si está recortado, alguna puede apuntar a una entidad que no cabía).
        """
        resultado: list[dict[str, Any]] = []
        for relacion in relaciones.values():
            if relacion["origen"] in encontrados and relacion["destino"] in encontrados:
                resultado.append(relacion)
        return resultado

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
