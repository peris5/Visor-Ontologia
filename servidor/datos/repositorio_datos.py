"""«interface» RepositorioDatos: todo el acceso a la base de datos."""
from abc import ABC, abstractmethod
from typing import Any

from servidor.modelo.vecindario import Vecindario


class EntidadNoEncontrada(LookupError):
    """Se pide algo de una entidad que no existe (la API responde 404)."""


class RepositorioDatos(ABC):
    """Todo el acceso a los datos pasa por aquí. El resto de la aplicación no
    sabe si los datos vienen de un archivo de ejemplo (RepositorioSimulado) o
    de la base de datos Neo4j real (RepositorioBDConocimiento, incremento 4):
    basta con cambiar la implementación.

    Desde el incremento 3b los datos tienen la forma de Neo4j: nodos con
    etiquetas y propiedades, y las entidades unidas a través de nodos
    intermediarios. Cada implementación DERIVA las relaciones entre entidades
    (en la simulada, ProyectorRelaciones; en Neo4j, consultas Cypher) y asigna
    la relevancia a las que recorre (AsignadorRelevancia).

    Los métodos son asíncronos (async def) porque la base de datos real
    responderá a través de la red. Mientras espera, el servidor puede
    atender otras peticiones.

    Requisitos: RNF-17, RF-09, RF-39.
    """

    @abstractmethod
    async def obtener_tipos(self) -> list[dict[str, Any]]:
        """Los tipos de relación que hay en los datos, con sus padres:
        [{"id": "Marriage", "padres": ["Related", "Relationship"]}] (RF-39).
        Se calculan a partir de los datos: un tipo nuevo sale aquí solo.
        """

    @abstractmethod
    async def obtener_nombres(self) -> list[dict[str, Any]]:
        """Todas las entidades, solo con sus propiedades de nombre:
        [{"id", "etiquetas", "propiedades"}] (el índice del buscador).
        """

    @abstractmethod
    async def obtener_vecindario(self, id_entidad: str, umbral: float, max_entidades: int) -> Vecindario:
        """Recorrido en anchura desde la entidad por las relaciones derivadas
        cuya relevancia (asignada por el camino si faltaba) supera el umbral,
        con un máximo de max_entidades entidades.

        Con Neo4j será una consulta con caminos de longitud variable filtrados
        por la relevancia (y la asignación de las que falten).

        Lanza EntidadNoEncontrada si la entidad no existe.
        """

    @abstractmethod
    async def obtener_detalle(self, id_entidad: str) -> dict[str, Any]:
        """En bruto, lo que se muestra al seleccionar una entidad: sus eventos
        (también nacimiento, muerte y residencia), imágenes, fuentes externas
        y ubicación. Lanza EntidadNoEncontrada si no existe.
        """

    async def cerrar(self) -> None:
        """Libera lo que use el repositorio (por ejemplo, la conexión con la
        base de datos real). El servidor lo llama al pararse. Por defecto no
        hace nada: el repositorio simulado no tiene nada que cerrar.
        """
        return None
