"""TipoRelacion (en el servidor, solo su id)."""


class TipoRelacion:
    """Un tipo de relación, tal como viene en los datos (por ejemplo "maestro_de").

    Los tipos no se conocen de antemano: el repositorio los descubre a partir
    de las relaciones que lee.

    En el servidor solo se guarda el id. El nombre legible ("Maestro de") y
    el color los pone el navegador (TipoRelacion.nombreDesdeId y
    PaletaColores en src/), porque el servidor solo entrega datos en bruto.

    Requisitos: RF-39 (tipos de relación no conocidos de antemano).
    """

    def __init__(self, identificador: str) -> None:
        """identificador: tal como viene en los datos ("maestro_de")."""
        if not isinstance(identificador, str) or identificador == "":
            raise ValueError("El tipo de relación necesita un id (un texto no vacío).")
        self.__id = identificador

    def get_id(self) -> str:
        """Identificador del tipo."""
        return self.__id
