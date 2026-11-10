"""«abstract» Entidad (traducción de src/modelo/Entidad.js)."""
from abc import ABC, abstractmethod
from typing import Any

from servidor.modelo.tipo_entidad import TipoEntidad


class Entidad(ABC):
    """Cualquier elemento del grafo de patrimonio: una persona, una
    organización o una obra de arte.

    Guarda lo que tienen en común (id, nombre, descripción y atributos libres)
    y deja que cada subclase diga de qué tipo es.

    Es abstracta: no se puede hacer Entidad(...). Solo se crean Persona,
    Organizacion u ObraDeArte (normalmente con FabricaEntidades).

    Requisitos: modelo de dominio usado en RF-08 a RF-12.
    """

    def __init__(self, datos: dict[str, Any]) -> None:
        """Crea la entidad.

        datos: diccionario con id (obligatorio), nombre, descripcion y
        atributos (opcional: diccionario con datos extra).
        """
        if datos is None:
            raise ValueError("Faltan los datos para crear la entidad.")
        identificador = datos.get("id")
        if not isinstance(identificador, str) or identificador == "":
            raise ValueError("La entidad necesita un id (un texto no vacío).")

        self.__id = identificador
        self.__nombre = Entidad._texto_o_vacio(datos.get("nombre"))
        self.__descripcion = Entidad._texto_o_vacio(datos.get("descripcion"))
        self.__atributos = self.__convertir_atributos(datos.get("atributos"))

        # Si no viene nombre, usamos el id para que siempre se pueda mostrar algo.
        if self.__nombre == "":
            self.__nombre = identificador

    def get_id(self) -> str:
        """Identificador único de la entidad."""
        return self.__id

    def get_nombre(self) -> str:
        """Nombre para mostrar."""
        return self.__nombre

    def get_descripcion(self) -> str:
        """Descripción (puede estar vacía)."""
        return self.__descripcion

    def get_atributos(self) -> dict[str, Any]:
        """Devuelve una COPIA de los atributos, para que quien la reciba no
        pueda cambiar los datos internos de la entidad sin querer.
        Las subclases la amplían con sus propios campos.
        """
        copia_de_atributos = dict(self.__atributos)
        return copia_de_atributos

    @abstractmethod
    def get_tipo(self) -> TipoEntidad:
        """Método abstracto: cada subclase devuelve su tipo."""

    def _anadir_si_no_vacio(self, atributos: dict[str, Any], clave: str, valor: str) -> None:
        """(Protegido) Añade un atributo al diccionario solo si tiene
        contenido, para no llenar la ficha de campos vacíos.
        """
        if valor != "":
            atributos[clave] = valor

    @staticmethod
    def _texto_o_vacio(valor: Any) -> str:
        """(Protegido) Devuelve el valor si es un texto; si no, un texto vacío.
        Así los campos que no vienen en los datos quedan como "" y no como None.
        """
        if isinstance(valor, str):
            return valor
        return ""

    def __convertir_atributos(self, atributos_de_entrada: Any) -> dict[str, Any]:
        """(Privado) Copia los atributos de entrada en un diccionario nuevo.
        Si no hay atributos, el diccionario queda vacío.
        """
        atributos: dict[str, Any] = {}
        if not isinstance(atributos_de_entrada, dict):
            return atributos
        for clave in atributos_de_entrada:
            atributos[clave] = atributos_de_entrada[clave]
        return atributos
