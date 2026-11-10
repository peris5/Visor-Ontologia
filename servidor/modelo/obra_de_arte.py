"""ObraDeArte extends Entidad (traducción de src/modelo/ObraDeArte.js)."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.tipo_entidad import TipoEntidad


class ObraDeArte(Entidad):
    """Una obra de arte del grafo (pintura, escultura, edificio...).

    Requisitos: modelo de dominio usado en RF-08 a RF-12.
    """

    def __init__(self, datos: dict[str, Any]) -> None:
        """datos: los de Entidad más fechaCreacion y tecnica (opcionales)."""
        super().__init__(datos)
        self.__fecha_creacion = Entidad._texto_o_vacio(datos.get("fechaCreacion"))
        self.__tecnica = Entidad._texto_o_vacio(datos.get("tecnica"))

    def get_tipo(self) -> TipoEntidad:
        """TipoEntidad.OBRA_DE_ARTE"""
        return TipoEntidad.OBRA_DE_ARTE

    def get_atributos(self) -> dict[str, Any]:
        """Atributos comunes más los propios de una obra de arte."""
        atributos = super().get_atributos()
        self._anadir_si_no_vacio(atributos, "fechaCreacion", self.__fecha_creacion)
        self._anadir_si_no_vacio(atributos, "tecnica", self.__tecnica)
        return atributos
