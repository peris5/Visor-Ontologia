"""RelevanciaPorTipo implements EstrategiaRelevancia."""
from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.configuracion import Configuracion
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia


class RelevanciaPorTipo(EstrategiaRelevancia):
    """La relevancia de una relación depende solo de su tipo
    (ANALISIS_BD_NEO4J.md §4.3):
      1. el peso del tipo en pesosRelevancia;
      2. si no tiene, el del PADRE MÁS CERCANO que tenga peso (un tipo nuevo,
         como Apprenticeship, hijo de Professional, recibe el de Professional);
      3. si ninguno tiene, pesoPorDefecto.

    Los pesos de configuracion.json son una PROPUESTA pendiente de validar
    con el tutor.

    Requisitos: RF-09, RNF-16 (pesos en la configuración), RNF-30.
    """

    def __init__(self, configuracion: Configuracion, clasificador: ClasificadorEtiquetas) -> None:
        """configuracion: ya comprobada. clasificador: para saber los padres."""
        self.__pesos = configuracion.get_pesos_relevancia()
        self.__peso_por_defecto = configuracion.get_peso_por_defecto()
        self.__clasificador = clasificador

    def calcular_relevancia(self, tipo: str) -> float:
        """Peso del tipo, de su padre más cercano o el de por defecto."""
        if tipo in self.__pesos:
            return self.__pesos[tipo]
        for padre in self.__clasificador.padres(tipo):
            if padre in self.__pesos:
                return self.__pesos[padre]
        return self.__peso_por_defecto
