"""TipoEntidad: los tres tipos de entidad."""
from enum import Enum


class TipoEntidad(Enum):
    """Los tres tipos de entidad que hay en la base de datos de patrimonio.

    Una enumeración de Python (Enum) no se puede ampliar ni cambiar por error,
    que es lo que esperamos de una enumeración.
    """

    PERSONA = "PERSONA"
    ORGANIZACION = "ORGANIZACION"
    OBRA_DE_ARTE = "OBRA_DE_ARTE"
