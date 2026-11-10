"""Persona extends Entidad (traducción de src/modelo/Persona.js)."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.tipo_entidad import TipoEntidad


class Persona(Entidad):
    """Una persona del grafo (artista, mecenas, restauradora...).

    Requisitos: modelo de dominio usado en RF-08 a RF-12.
    """

    def __init__(self, datos: dict[str, Any]) -> None:
        """datos: los de Entidad más fechaNacimiento, fechaDefuncion y
        nacionalidad (todos opcionales).
        """
        super().__init__(datos)
        self.__fecha_nacimiento = Entidad._texto_o_vacio(datos.get("fechaNacimiento"))
        self.__fecha_defuncion = Entidad._texto_o_vacio(datos.get("fechaDefuncion"))
        self.__nacionalidad = Entidad._texto_o_vacio(datos.get("nacionalidad"))

    def get_tipo(self) -> TipoEntidad:
        """TipoEntidad.PERSONA"""
        return TipoEntidad.PERSONA

    def get_atributos(self) -> dict[str, Any]:
        """Atributos comunes más los propios de una persona."""
        atributos = super().get_atributos()
        self._anadir_si_no_vacio(atributos, "fechaNacimiento", self.__fecha_nacimiento)
        self._anadir_si_no_vacio(atributos, "fechaDefuncion", self.__fecha_defuncion)
        self._anadir_si_no_vacio(atributos, "nacionalidad", self.__nacionalidad)
        return atributos
