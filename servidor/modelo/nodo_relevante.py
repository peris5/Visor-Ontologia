"""NodoRelevante (traducción de src/modelo/NodoRelevante.js)."""
from servidor.modelo.entidad import Entidad


class NodoRelevante:
    """Una entidad dentro de un subgrafo, junto con los datos que solo tienen
    sentido en ese subgrafo:
     - relevancia: producto de las relevancias del camino desde la central.
     - nivel: número de saltos desde la entidad central (la central es 0).
     - centralidad: importancia del nodo dentro del subgrafo (entre 0 y 1).

    Requisitos: RF-08 a RF-12 (relevancia y nivel) y RF-37 (centralidad).
    """

    def __init__(self, entidad: Entidad, relevancia: float, nivel: int) -> None:
        """relevancia: entre 0 y 1. nivel: saltos desde la entidad central."""
        if not isinstance(entidad, Entidad):
            raise ValueError("Un NodoRelevante necesita una Entidad.")
        self.__entidad = entidad
        self.__relevancia = relevancia
        self.__nivel = nivel
        # La centralidad se calcula al final, cuando el subgrafo está completo.
        self.__centralidad = 0.0

    def get_entidad(self) -> Entidad:
        """Entidad del nodo."""
        return self.__entidad

    def get_relevancia(self) -> float:
        """Relevancia entre 0 y 1."""
        return self.__relevancia

    def get_nivel(self) -> int:
        """Saltos desde la central."""
        return self.__nivel

    def get_centralidad(self) -> float:
        """Centralidad entre 0 y 1."""
        return self.__centralidad

    def set_centralidad(self, valor: float) -> None:
        """Centralidad calculada por CalculadorCentralidad."""
        self.__centralidad = valor
