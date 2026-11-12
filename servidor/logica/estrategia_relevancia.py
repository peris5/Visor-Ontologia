"""«interface» EstrategiaRelevancia (en el servidor desde el incremento 3b)."""
from abc import ABC, abstractmethod


class EstrategiaRelevancia(ABC):
    """Cómo se calcula la relevancia de una relación de la base de datos que
    todavía no la tiene. Separarlo en una interfaz (patrón Estrategia)
    permite cambiar la fórmula (por ejemplo, tener en cuenta la duración del
    periodo o el número de participantes) sin tocar el resto.

    Vuelve al servidor porque es donde se GUARDA el valor (ver
    AsignadorRelevancia). El navegador solo lee el valor ya asignado
    (RelevanciaDesdeBD de src/logica/).

    Requisitos: RF-09, RNF-30.
    """

    @abstractmethod
    def calcular_relevancia(self, tipo: str) -> float:
        """Relevancia, entre 0 y 1, de una relación de ese tipo
        (tipo = etiqueta más específica del intermediario, o tipo de la
        relación directa).
        """
