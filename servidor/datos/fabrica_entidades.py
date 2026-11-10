"""FabricaEntidades (traducción de src/datos/FabricaEntidades.js)."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.obra_de_arte import ObraDeArte
from servidor.modelo.organizacion import Organizacion
from servidor.modelo.persona import Persona
from servidor.modelo.tipo_entidad import TipoEntidad


class FabricaEntidades:
    """Crea la subclase de Entidad que corresponde a cada tipo. Así, quien lee
    los datos no tiene que saber qué clase concreta usar (patrón Fábrica).
    """

    @staticmethod
    def crear_entidad(tipo: Any, datos: dict[str, Any]) -> Entidad:
        """tipo: un TipoEntidad o su texto ("PERSONA", "ORGANIZACION" u
        "OBRA_DE_ARTE"), que es como viene en los archivos de datos.
        """
        texto_del_tipo = tipo
        if isinstance(tipo, TipoEntidad):
            texto_del_tipo = tipo.value

        if texto_del_tipo == TipoEntidad.PERSONA.value:
            return Persona(datos)
        if texto_del_tipo == TipoEntidad.ORGANIZACION.value:
            return Organizacion(datos)
        if texto_del_tipo == TipoEntidad.OBRA_DE_ARTE.value:
            return ObraDeArte(datos)
        raise ValueError("Tipo de entidad desconocido: \"" + str(tipo) + "\".")
