"""«interface» AlmacenRelevancias: dónde se guarda la relevancia asignada."""
from abc import ABC, abstractmethod


class AlmacenRelevancias(ABC):
    """Lee y guarda la relevancia de un elemento de la base de datos: un nodo
    intermediario (todas las parejas que crea comparten valor) o una
    relación directa entre entidades (ANALISIS_BD_NEO4J.md §4.1).

    Se guarda junto a la relevancia de dónde sale ("auto" si la calcula la
    aplicación, "manual" si la pone una persona) y con qué versión de la
    tabla de pesos se calculó.

    Va detrás de una interfaz por el conflicto con RNF-11 (acceso solo de
    lectura, §5 del análisis). Implementaciones:
     - AlmacenRelevanciasEnGrafo: escribe en el propio grafo (datos
       simulados; con Neo4j sería la opción 1, permiso de escritura solo
       sobre estas tres propiedades).
     - (incremento 4, si no hay permiso de escritura) un almacén propio del
       servidor, con esta misma interfaz. El resto no cambiaría.

    Requisitos: RF-09, RNF-11, RNF-17.
    """

    @abstractmethod
    def leer(self, id_elemento: str) -> dict | None:
        """{"valor", "origen": "auto" | "manual", "version"} o None si no tiene."""

    @abstractmethod
    def guardar(self, id_elemento: str, valor: float, version: int) -> None:
        """Guarda una relevancia automática. NUNCA sobrescribe una manual."""
