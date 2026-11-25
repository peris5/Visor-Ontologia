"""ConversorJson: la forma del JSON que envía la API."""
from typing import Any

from servidor.logica.configuracion import Configuracion


class ConversorJson:
    """Prepara los diccionarios que FastAPI envía como JSON. Así la forma del
    JSON está en un solo sitio: si cambia, solo hay que tocar esta clase (y,
    en el navegador, RepositorioVecindario y ClienteServicio, que hacen el
    camino contrario).
    """

    @staticmethod
    def configuracion_a_diccionario(configuracion: Configuracion) -> dict[str, Any]:
        """Solo lo que necesita el navegador. Lo demás (clasificación de las
        etiquetas, límites...) se queda en el servidor.
        """
        return {
            "umbralPorDefecto": configuracion.get_umbral_por_defecto(),
            "maxNodos": configuracion.get_max_nodos(),
            "nodosObjetivo": configuracion.get_nodos_objetivo(),
            "entidadInicial": configuracion.get_entidad_inicial(),
            "idioma": configuracion.get_idioma(),
            "nombresTipos": configuracion.get_nombres_tipos(),
            "etiquetasEntidad": configuracion.get_etiquetas_entidad(),
        }

    @staticmethod
    def relaciones_a_diccionario(ids: list[str], datos: dict[str, Any]) -> dict[str, Any]:
        """Las relaciones de las entidades pedidas:
          - ids: las entidades pedidas. De ellas el navegador ya tiene TODAS
            las relaciones (de las demás entidades que aparecen, solo algunas).
          - entidades: en bruto, las pedidas y las de los extremos.
          - relaciones: derivadas, sin relevancia, con "participantes" y
            "dibujable".
        """
        return {
            "ids": list(ids),
            "entidades": datos["entidades"],
            "relaciones": datos["relaciones"],
        }
