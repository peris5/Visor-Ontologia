"""RepositorioDatos: todo el acceso a la base de datos."""
from abc import ABC, abstractmethod
from typing import Any


class EntidadNoEncontrada(LookupError):
    """Se pide algo de una entidad que no existe (la API responde 404)."""


class RepositorioDatos(ABC):
    """Todo el acceso a los datos pasa por aquí. El resto de la aplicación no
    sabe si los datos vienen de un archivo de ejemplo (RepositorioSimulado) o
    de la base de datos Neo4j real: basta con cambiar la implementación.

    Los datos tienen la forma de Neo4j: nodos con etiquetas y propiedades, y
    las entidades unidas a través de nodos intermediarios. Cada
    implementación DERIVA las relaciones entre entidades (en la simulada,
    ProyectorRelaciones; en Neo4j, consultas Cypher).

    El repositorio SOLO LEE: no calcula ninguna relevancia ni escribe nada en
    la base de datos. La relevancia la calcula siempre el navegador.

    Los métodos son asíncronos (async def) porque la base de datos real
    responderá a través de la red. Mientras espera, el servidor puede
    atender otras peticiones.
    """

    @abstractmethod
    async def obtener_tipos(self) -> list[dict[str, Any]]:
        """Los tipos de relación que hay en los datos, con sus padres:
        [{"id": "Marriage", "padres": ["Related", "Relationship"]}].
        Se calculan a partir de los datos: un tipo nuevo sale aquí solo.
        """

    @abstractmethod
    async def obtener_jerarquia(self) -> dict[str, list[str]]:
        """Cada etiqueta de la jerarquía con sus padres, del más cercano al
        más lejano: {"Painter": ["Creator", "Person"], ...}. El navegador la
        necesita para heredar los factores por tipo de entidad.
        """

    @abstractmethod
    async def obtener_nombres(self) -> list[dict[str, Any]]:
        """Todas las entidades, solo con sus propiedades de nombre:
        [{"id", "etiquetas", "propiedades"}] (el índice del buscador).
        """

    @abstractmethod
    async def obtener_relaciones(self, ids: list[str]) -> dict[str, Any]:
        """Todas las relaciones derivadas en las que participa alguna de las
        entidades pedidas (las que se dibujan y las que solo son evidencia,
        con su campo "dibujable"), y las entidades de sus extremos, en bruto:
          { "entidades": [{"id", "etiquetas", "propiedades"}],
            "relaciones": [relación derivada (ver ProyectorRelaciones)] }

        Lanza EntidadNoEncontrada si alguna de las entidades no existe.
        """

    @abstractmethod
    async def obtener_detalle(self, id_entidad: str) -> dict[str, Any]:
        """En bruto, lo que se muestra al seleccionar una entidad: sus eventos
        (también nacimiento, muerte y residencia), imágenes, fuentes externas
        y ubicación. Lanza EntidadNoEncontrada si no existe.
        """

    @abstractmethod
    async def obtener_muestra(self, numero: int, semilla: int) -> dict[str, Any]:
        """Para el laboratorio: los creadores (etiquetasCreador) con más
        relaciones y otros al azar con esa semilla, hasta «numero» (si no hay
        bastantes creadores, se completa con otras entidades):
          { "ids": [...], "creadores": cuántos de ellos son creadores,
            "entidades": cuántas hay en la base de datos,
            "intermediariosIgnorados": {tipo: cuántos},
            "eventosJuntados": {tipo: cuántos} }
        Con la misma semilla, siempre los mismos. Solo lee.
        """

    async def cerrar(self) -> None:
        """Libera lo que use el repositorio (por ejemplo, la conexión con la
        base de datos real). El servidor lo llama al pararse. Por defecto no
        hace nada: el repositorio simulado no tiene nada que cerrar.
        """
        return None
