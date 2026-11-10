"""Relacion (traducción de src/modelo/Relacion.js)."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.tipo_relacion import TipoRelacion


class Relacion:
    """Una relación entre dos entidades (origen → destino) de un tipo concreto.

    Guarda dos números:
     - valor: el que viene de la base de datos.
     - relevancia: la que calcula la EstrategiaRelevancia a partir del valor.
       Hasta que la estrategia la calcula, vale lo mismo que el valor.

    Requisitos: RF-08 a RF-12 (la relevancia de las relaciones decide el subgrafo).
    """

    def __init__(self, identificador: str, origen: Entidad, destino: Entidad,
                 tipo: TipoRelacion, valor: Any) -> None:
        """valor: relevancia que trae la base de datos."""
        if not isinstance(identificador, str) or identificador == "":
            raise ValueError("La relación necesita un id (un texto no vacío).")
        if not isinstance(origen, Entidad) or not isinstance(destino, Entidad):
            raise ValueError("La relación " + identificador + " necesita una entidad de origen y otra de destino.")
        if not isinstance(tipo, TipoRelacion):
            raise ValueError("La relación " + identificador + " necesita un TipoRelacion.")
        self.__id = identificador
        self.__origen = origen
        self.__destino = destino
        self.__tipo = tipo
        self.__valor = valor
        self.__relevancia = valor

    def get_id(self) -> str:
        """Identificador de la relación."""
        return self.__id

    def get_origen(self) -> Entidad:
        """Entidad de origen."""
        return self.__origen

    def get_destino(self) -> Entidad:
        """Entidad de destino."""
        return self.__destino

    def get_tipo(self) -> TipoRelacion:
        """Tipo de la relación."""
        return self.__tipo

    def get_valor(self) -> Any:
        """Valor original de la base de datos."""
        return self.__valor

    def get_relevancia(self) -> float:
        """Relevancia calculada por la estrategia."""
        return self.__relevancia

    def set_relevancia(self, valor: float) -> None:
        """Nueva relevancia (la pone la estrategia)."""
        self.__relevancia = valor

    def get_otro_extremo(self, entidad: Entidad) -> Entidad:
        """Dada una de las dos entidades de la relación, devuelve la otra.
        Sirve para recorrer el grafo sin importar el sentido de la flecha.
        """
        id_entidad = entidad.get_id()
        if id_entidad == self.__origen.get_id():
            return self.__destino
        if id_entidad == self.__destino.get_id():
            return self.__origen
        raise ValueError("La entidad " + id_entidad + " no forma parte de la relación " + self.__id + ".")

    def get_clave_par(self) -> str:
        """Clave que identifica al par de entidades, sin importar el sentido:
        la relación A→B y la relación B→A dan la misma clave.
        Se consigue poniendo siempre primero el id más pequeño (orden alfabético).
        Ejemplo: "a01|p03".
        """
        id_origen = self.__origen.get_id()
        id_destino = self.__destino.get_id()
        if id_origen < id_destino:
            return id_origen + "|" + id_destino
        return id_destino + "|" + id_origen
