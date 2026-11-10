"""«enumeration» TipoEntidad (traducción de src/modelo/TipoEntidad.js)."""
from enum import Enum


class TipoEntidad(Enum):
    """Los tres tipos de entidad que hay en la base de datos de patrimonio.

    Una enumeración de Python (Enum) no se puede ampliar ni cambiar por error,
    que es lo que esperamos de una enumeración.

    Requisitos: modelo de dominio usado en RF-08 a RF-12.
    """

    PERSONA = "PERSONA"
    ORGANIZACION = "ORGANIZACION"
    OBRA_DE_ARTE = "OBRA_DE_ARTE"
