"""CalculadorCentralidad (traducción de src/logica/CalculadorCentralidad.js)."""
from servidor.modelo.subgrafo import Subgrafo


class CalculadorCentralidad:
    """Mide lo "conectado" que está cada nodo dentro del subgrafo con la
    centralidad de grado ponderada:
      1. Para cada nodo, sumamos las relevancias de sus relaciones.
      2. Dividimos cada suma por la mayor, para que queden entre 0 y 1
         (el nodo más conectado vale 1). Si la mayor es 0, todos valen 0.

    Requisitos: RF-37.
    """

    def calcular(self, subgrafo: Subgrafo) -> dict[str, float]:
        """Devuelve idEntidad → centralidad entre 0 y 1."""
        sumas_por_nodo = self.__sumar_relevancias_por_nodo(subgrafo)
        suma_maxima = self.__buscar_maximo(sumas_por_nodo)
        centralidad_por_nodo = self.__normalizar(sumas_por_nodo, suma_maxima)
        return centralidad_por_nodo

    def __sumar_relevancias_por_nodo(self, subgrafo: Subgrafo) -> dict[str, float]:
        """(Privado) Paso 1: suma de relevancias de las relaciones de cada
        nodo. Cada relación suma a sus DOS extremos.
        """
        sumas_por_nodo: dict[str, float] = {}

        # Empezamos todos en 0, así un nodo sin relaciones también aparece.
        for nodo in subgrafo.get_nodos():
            id_entidad = nodo.get_entidad().get_id()
            sumas_por_nodo[id_entidad] = 0.0

        for relacion in subgrafo.get_relaciones():
            relevancia = relacion.get_relevancia()
            id_origen = relacion.get_origen().get_id()
            id_destino = relacion.get_destino().get_id()
            sumas_por_nodo[id_origen] = sumas_por_nodo[id_origen] + relevancia
            sumas_por_nodo[id_destino] = sumas_por_nodo[id_destino] + relevancia
        return sumas_por_nodo

    def __buscar_maximo(self, sumas_por_nodo: dict[str, float]) -> float:
        """(Privado) La suma más grande de todas."""
        maximo = 0.0
        for suma in sumas_por_nodo.values():
            if suma > maximo:
                maximo = suma
        return maximo

    def __normalizar(self, sumas_por_nodo: dict[str, float], suma_maxima: float) -> dict[str, float]:
        """(Privado) Paso 2: divide cada suma por el máximo."""
        centralidad_por_nodo: dict[str, float] = {}
        for id_entidad in sumas_por_nodo:
            centralidad = 0.0
            # Si el máximo es 0 no se puede dividir: nadie tiene relaciones,
            # así que todos valen 0.
            if suma_maxima > 0:
                centralidad = sumas_por_nodo[id_entidad] / suma_maxima
            centralidad_por_nodo[id_entidad] = centralidad
        return centralidad_por_nodo
