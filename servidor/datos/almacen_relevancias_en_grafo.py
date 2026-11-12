"""AlmacenRelevanciasEnGrafo implements AlmacenRelevancias."""
from typing import Any

from servidor.datos.almacen_relevancias import AlmacenRelevancias


class AlmacenRelevanciasEnGrafo(AlmacenRelevancias):
    """Guarda la relevancia en el propio grafo (en memoria, con los datos
    simulados), en las propiedades relevance, relevanceSource y
    relevanceVersion del nodo intermediario o de la relación directa.

    Con Neo4j (incremento 4) guardar será una consulta como:
        MATCH (n) WHERE elementId(n) = $id
        SET n.relevance = coalesce(n.relevance, $valor), ...
    (coalesce: si dos usuarios la asignan a la vez, el valor es el mismo).
    Si no se consigue permiso de escritura (RNF-11), se hará otra
    implementación de AlmacenRelevancias con un almacén propio del servidor,
    sin cambiar nada más.

    Requisitos: RF-09, RNF-11.
    """

    def __init__(self, nodos: dict[str, dict[str, Any]], relaciones: dict[str, dict[str, Any]]) -> None:
        """nodos y relaciones: id → elemento del grafo en memoria (los mismos
        diccionarios que usa el repositorio: lo que se guarda aquí lo ve él).
        """
        self.__nodos = nodos
        self.__relaciones = relaciones

    def leer(self, id_elemento: str) -> dict | None:
        """La relevancia guardada, o None si no tiene (o no existe)."""
        propiedades = self.__propiedades_de(id_elemento)
        if propiedades is None or "relevance" not in propiedades:
            return None
        origen = "auto"
        if propiedades.get("relevanceSource") == "manual":
            origen = "manual"
        return {
            "valor": propiedades["relevance"],
            "origen": origen,
            "version": propiedades.get("relevanceVersion"),
        }

    def guardar(self, id_elemento: str, valor: float, version: int) -> None:
        """Guarda una relevancia automática, salvo que haya una manual."""
        propiedades = self.__propiedades_de(id_elemento)
        if propiedades is None:
            raise ValueError("No existe ningún elemento con el id " + id_elemento + ".")
        if propiedades.get("relevanceSource") == "manual":
            return
        propiedades["relevance"] = valor
        propiedades["relevanceSource"] = "auto"
        propiedades["relevanceVersion"] = version

    def __propiedades_de(self, id_elemento: str) -> dict[str, Any] | None:
        """(Privado) Propiedades del nodo o de la relación con ese id."""
        if id_elemento in self.__nodos:
            return self.__nodos[id_elemento]["propiedades"]
        if id_elemento in self.__relaciones:
            return self.__relaciones[id_elemento]["propiedades"]
        return None
