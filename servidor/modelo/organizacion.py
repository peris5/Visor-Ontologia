"""Organizacion extends Entidad (traducción de src/modelo/Organizacion.js)."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.tipo_entidad import TipoEntidad


class Organizacion(Entidad):
    """Una organización del grafo (academia, taller, fundación, museo...).

    Requisitos: modelo de dominio usado en RF-08 a RF-12.
    """

    def __init__(self, datos: dict[str, Any]) -> None:
        """datos: los de Entidad más fechaFundacion y sede (opcionales)."""
        super().__init__(datos)
        self.__fecha_fundacion = Entidad._texto_o_vacio(datos.get("fechaFundacion"))
        self.__sede = Entidad._texto_o_vacio(datos.get("sede"))

    def get_tipo(self) -> TipoEntidad:
        """TipoEntidad.ORGANIZACION"""
        return TipoEntidad.ORGANIZACION

    def get_atributos(self) -> dict[str, Any]:
        """Atributos comunes más los propios de una organización."""
        atributos = super().get_atributos()
        self._anadir_si_no_vacio(atributos, "fechaFundacion", self.__fecha_fundacion)
        self._anadir_si_no_vacio(atributos, "sede", self.__sede)
        return atributos
