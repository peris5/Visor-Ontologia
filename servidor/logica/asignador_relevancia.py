"""AsignadorRelevancia: da relevancia, bajo demanda, a lo que se recorre."""
from servidor.datos.almacen_relevancias import AlmacenRelevancias
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia


class AsignadorRelevancia:
    """Obtiene la relevancia de una relación de la base de datos mientras se
    recorre el vecindario (ANALISIS_BD_NEO4J.md §4.2):

     - si el almacén ya tiene un valor MANUAL, o uno AUTOMÁTICO calculado con
       la versión actual de los pesos, lo reutiliza;
     - si no tiene ninguno (o es automático y de una versión antigua), lo
       calcula con la estrategia, lo GUARDA y lo devuelve.

    Así solo se calcula la relevancia de lo que de verdad se recorre, y una
    sola vez: la primera persona que explora una zona del grafo completa sus
    relevancias y las siguientes ya no calculan nada. Las relaciones que
    nadie recorre nunca se calculan.

    Se crea UNA vez al arrancar el servidor (lo crea el repositorio).

    Requisitos: RF-09, RNF-05 (trabajo mínimo).
    """

    def __init__(self, estrategia: EstrategiaRelevancia, almacen: AlmacenRelevancias, version: int) -> None:
        """version: versión actual de la tabla de pesos (versionPesos)."""
        self.__estrategia = estrategia
        self.__almacen = almacen
        self.__version = version
        self.__asignadas = 0
        self.__reutilizadas = 0

    def obtener(self, id_elemento: str, tipo: str) -> float:
        """Relevancia del elemento (nodo intermediario o relación directa)."""
        guardada = self.__almacen.leer(id_elemento)
        if guardada is not None:
            es_manual = guardada["origen"] == "manual"
            es_de_esta_version = guardada["version"] == self.__version
            if es_manual or es_de_esta_version:
                self.__reutilizadas = self.__reutilizadas + 1
                return guardada["valor"]
        valor = self.__estrategia.calcular_relevancia(tipo)
        self.__almacen.guardar(id_elemento, valor, self.__version)
        self.__asignadas = self.__asignadas + 1
        return valor

    def get_estadisticas(self) -> dict[str, int]:
        """Cuántas relevancias se han asignado y cuántas reutilizado desde que
        arrancó el servidor: {"asignadas": n, "reutilizadas": n}.
        """
        return {"asignadas": self.__asignadas, "reutilizadas": self.__reutilizadas}
