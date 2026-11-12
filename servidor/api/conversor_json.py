"""ConversorJson: la forma del JSON que envía la API."""
from typing import Any

from servidor.logica.configuracion import Configuracion
from servidor.modelo.vecindario import Vecindario


class ConversorJson:
    """Prepara los diccionarios que FastAPI envía como JSON. Así la forma del
    JSON está en un solo sitio: si cambia, solo hay que tocar esta clase (y,
    en el navegador, RepositorioVecindario y ClienteServicio, que hacen el
    camino contrario).

    Desde el incremento 3b el repositorio ya devuelve los datos en bruto
    (etiquetas y propiedades de Neo4j), así que aquí casi solo se eligen los
    campos que se envían.

    Requisitos: RNF-17 (el navegador no sabe de dónde salen los datos).
    """

    @staticmethod
    def configuracion_a_diccionario(configuracion: Configuracion) -> dict[str, Any]:
        """Solo lo que necesita el navegador. Lo demás (clasificación de las
        etiquetas, pesos, límites...) se queda en el servidor.
        """
        return {
            "umbralPorDefecto": configuracion.get_umbral_por_defecto(),
            "maxNodos": configuracion.get_max_nodos(),
            "entidadInicial": configuracion.get_entidad_inicial(),
            "idioma": configuracion.get_idioma(),
            "nombresTipos": configuracion.get_nombres_tipos(),
            "etiquetasEntidad": configuracion.get_etiquetas_entidad(),
        }

    @staticmethod
    def vecindario_a_diccionario(id_central: str, umbral: float, vecindario: Vecindario) -> dict[str, Any]:
        """El vecindario: entidades en bruto, relaciones derivadas con su
        relevancia asignada ("valor") y las estadísticas de la asignación.
        """
        return {
            "idCentral": id_central,
            "umbral": umbral,
            "recortado": vecindario.recortado,
            "entidades": vecindario.entidades,
            "relaciones": vecindario.relaciones,
            "relevanciasAsignadas": vecindario.relevancias_asignadas,
            "relevanciasReutilizadas": vecindario.relevancias_reutilizadas,
        }
