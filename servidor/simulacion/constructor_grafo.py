"""ConstructorGrafo: un grafo con la forma de Neo4j, nodo a nodo."""
from typing import Any


class ConstructorGrafo:
    """Va añadiendo nodos y relaciones con la misma forma que los datos de
    ejemplo (y que Neo4j): las entidades se unen a través de nodos
    Relationship y Event, con sus Period y su OCURRED_AT.

    Los nodos Period se comparten: uno por cada par de años.
    """

    def __init__(self) -> None:
        self.__nodos: list[dict[str, Any]] = []
        self.__relaciones: list[dict[str, Any]] = []
        self.__periodos: dict[str, str] = {}

    def get_nodos(self) -> list[dict[str, Any]]:
        """Los nodos añadidos."""
        return self.__nodos

    def get_relaciones(self) -> list[dict[str, Any]]:
        """Las relaciones añadidas."""
        return self.__relaciones

    def nodo(self, id_nodo: str, etiquetas: list[str], propiedades: dict[str, Any]) -> str:
        """Añade un nodo y devuelve su id."""
        self.__nodos.append({"id": id_nodo, "etiquetas": etiquetas, "propiedades": propiedades})
        return id_nodo

    def relacion(self, tipo: str, desde: str, hasta: str, propiedades: dict[str, Any]) -> None:
        """Añade una relación entre dos nodos."""
        self.__relaciones.append({"id": "r" + str(len(self.__relaciones) + 1), "tipo": tipo, "desde": desde,
                                  "hasta": hasta, "propiedades": propiedades})

    def intermediario(self, etiquetas: list[str], participantes: list[tuple[str, str]],
                      anios: tuple[int, int] | None, organizacion: str | None, fecha: str | None) -> str:
        """Un nodo Relationship o Event con sus personas (id, rol), sus años
        (OCURRED_DURING) y la organización donde ocurrió (OCURRED_AT, con la
        fecha). Devuelve su id. Los nombres son códigos: los eventos llevan
        su propio id.
        """
        id_nodo = "I" + str(len(self.__nodos) + 1).rjust(6, "0")
        tipo_de_union = "HAS_ROLE_IN"
        propiedades: dict[str, Any] = {}
        if etiquetas[0] == "Event":
            tipo_de_union = "PARTICIPATES_IN"
            propiedades = {"name_es": id_nodo}
        self.nodo(id_nodo, etiquetas, propiedades)
        for participante in participantes:
            self.relacion(tipo_de_union, participante[0], id_nodo, {"role": participante[1]})
        if anios is not None:
            self.relacion("OCURRED_DURING", id_nodo, self.__periodo(anios), {})
        if organizacion is not None:
            datos_fecha: dict[str, Any] = {}
            if fecha is not None:
                datos_fecha = {"date": fecha}
            self.relacion("OCURRED_AT", id_nodo, organizacion, datos_fecha)
        return id_nodo

    def __periodo(self, anios: tuple[int, int]) -> str:
        """(Privado) El nodo Period de esos años (se crea la primera vez)."""
        clave = str(anios[0]) + "-" + str(anios[1])
        if clave not in self.__periodos:
            self.__periodos[clave] = self.nodo("T" + clave, ["Period"], {"from": str(anios[0]), "to": str(anios[1]),
                                                                        "description": ""})
        return self.__periodos[clave]
