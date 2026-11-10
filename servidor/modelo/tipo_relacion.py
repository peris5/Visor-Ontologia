"""TipoRelacion (traducción de src/modelo/TipoRelacion.js)."""
from typing import Any


class TipoRelacion:
    """Un tipo de relación (por ejemplo "Maestro de").

    Los tipos no se conocen de antemano: el repositorio los descubre a partir
    de las relaciones que lee y le da a cada uno un nombre legible y un color.

    Requisitos: RF-20 y RF-39 (cada tipo tiene su color).
    """

    def __init__(self, identificador: str, nombre: str, color: str) -> None:
        """identificador: tal como viene en los datos ("maestro_de").
        nombre: para mostrar ("Maestro de"). color: formato "#rrggbb".
        """
        if not isinstance(identificador, str) or identificador == "":
            raise ValueError("El tipo de relación necesita un id (un texto no vacío).")
        self.__id = identificador
        self.__nombre = nombre
        self.__color = color

    def get_id(self) -> str:
        """Identificador del tipo."""
        return self.__id

    def get_nombre(self) -> str:
        """Nombre para mostrar."""
        return self.__nombre

    def get_color(self) -> str:
        """Color "#rrggbb"."""
        return self.__color

    @staticmethod
    def nombre_desde_id(identificador: Any) -> str:
        """Convierte un id en un nombre legible: cambia los guiones bajos por
        espacios y pone la primera letra en mayúscula.
        Ejemplo: "maestro_de" → "Maestro de".
        """
        if not isinstance(identificador, str):
            return ""
        nombre = ""
        for caracter in identificador:
            if caracter == "_":
                nombre = nombre + " "
            elif nombre == "":
                # Es la primera letra: va en mayúscula.
                nombre = nombre + caracter.upper()
            else:
                nombre = nombre + caracter.lower()
        return nombre
