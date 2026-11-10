"""«interface» EstrategiaRelevancia (traducción de src/logica/EstrategiaRelevancia.js)."""
from abc import ABC, abstractmethod

from servidor.modelo.relacion import Relacion


class EstrategiaRelevancia(ABC):
    """Define cómo se calcula la relevancia. Separarlo en una interfaz permite
    cambiar la fórmula en el futuro sin tocar ConstructorSubgrafo
    (patrón Estrategia).

    Requisitos: RNF-30.
    """

    @abstractmethod
    def calcular_relevancia_relacion(self, relacion: Relacion) -> float:
        """Relevancia de una relación, entre 0 y 1."""

    @abstractmethod
    def calcular_relevancia_nodo(self, relevancia_padre: float, relevancia_relacion: float) -> float:
        """Relevancia de un nodo a partir de la de su padre y la de la
        relación que los une.
        """
