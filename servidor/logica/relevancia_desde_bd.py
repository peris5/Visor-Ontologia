"""RelevanciaDesdeBD (traducción de src/logica/RelevanciaDesdeBD.js)."""
import math

from servidor.logica.estrategia_relevancia import EstrategiaRelevancia
from servidor.modelo.relacion import Relacion


class RelevanciaDesdeBD(EstrategiaRelevancia):
    """La estrategia de este TFG:
     - Relación: el valor que trae la base de datos, acotado a [0, 1].
     - Nodo: relevancia del padre × relevancia de la relación.

    Requisitos: RNF-30 y RF-08 a RF-12.
    """

    def calcular_relevancia_relacion(self, relacion: Relacion) -> float:
        """El valor de la BD, acotado entre 0 y 1."""
        valor = relacion.get_valor()
        # Un valor que no es un número no aporta relevancia.
        # (bool es un tipo de int en Python; lo excluimos a propósito.)
        if not isinstance(valor, (int, float)) or isinstance(valor, bool):
            return 0.0
        if math.isnan(valor):
            return 0.0
        # Acotamos para que un dato erróneo de la BD (por ejemplo 1.4 o -0.2)
        # no rompa la regla de que la relevancia está entre 0 y 1.
        if valor < 0:
            return 0.0
        if valor > 1:
            return 1.0
        return valor

    def calcular_relevancia_nodo(self, relevancia_padre: float, relevancia_relacion: float) -> float:
        """Producto de las dos relevancias. Como las dos están entre 0 y 1,
        el resultado nunca es mayor que la relevancia del padre: alejarse de
        la central nunca hace a un nodo más relevante.
        """
        relevancia_del_nodo = relevancia_padre * relevancia_relacion
        return relevancia_del_nodo
