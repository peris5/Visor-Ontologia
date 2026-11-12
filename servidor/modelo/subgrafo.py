"""Subgrafo (traducción de src/modelo/Subgrafo.js)."""
from servidor.modelo.entidad import Entidad
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.relacion import Relacion


class Subgrafo:
    """El entorno relevante de una entidad central: sus nodos y las
    relaciones entre ellos.

     - Composición con NodoRelevante [1..*]: los nodos pertenecen al subgrafo.
       El propio subgrafo crea el nodo de la entidad central al nacer, y así
       nunca está vacío.
     - Agregación con Relacion [*]: las relaciones existen fuera (en el
       repositorio); el subgrafo solo apunta a ellas.

    Requisitos: RF-08 a RF-12.
    """

    def __init__(self, entidad_central: Entidad, umbral: float) -> None:
        """umbral: umbral con el que se construyó."""
        if not isinstance(entidad_central, Entidad):
            raise ValueError("El subgrafo necesita una entidad central.")
        self.__entidad_central = entidad_central
        self.__umbral = umbral
        # Diccionario idEntidad → NodoRelevante. Permite encontrar un nodo
        # por su id al momento y recuerda el orden en que se añadieron.
        self.__nodos: dict[str, NodoRelevante] = {}
        self.__relaciones: list[Relacion] = []
        # Ids de las relaciones ya añadidas: comprobar si un id está en un
        # conjunto (set) es inmediato, mientras que en una lista hay que
        # recorrerla entera. agregar_relacion lo comprueba cientos de veces.
        self.__ids_de_relaciones: set[str] = set()

        # La entidad central siempre está: relevancia 1 y nivel 0.
        nodo_central = NodoRelevante(entidad_central, 1.0, 0)
        self.__nodos[entidad_central.get_id()] = nodo_central

    def get_entidad_central(self) -> Entidad:
        """Entidad central."""
        return self.__entidad_central

    def get_umbral(self) -> float:
        """Umbral con el que se construyó."""
        return self.__umbral

    def get_nodos(self) -> list[NodoRelevante]:
        """Copia de la lista de nodos, en orden de entrada."""
        lista_de_nodos = []
        for nodo in self.__nodos.values():
            lista_de_nodos.append(nodo)
        return lista_de_nodos

    def get_relaciones(self) -> list[Relacion]:
        """Copia de la lista de relaciones."""
        lista_de_relaciones = []
        for relacion in self.__relaciones:
            lista_de_relaciones.append(relacion)
        return lista_de_relaciones

    def get_nodo(self, identificador: str) -> NodoRelevante | None:
        """El nodo, o None si no está en el subgrafo."""
        if identificador in self.__nodos:
            return self.__nodos[identificador]
        return None

    def get_numero_nodos(self) -> int:
        """Número de nodos (contando la central)."""
        return len(self.__nodos)

    def agregar_nodo(self, nodo: NodoRelevante) -> None:
        """Añade un nodo nuevo (su entidad no puede estar ya)."""
        if not isinstance(nodo, NodoRelevante):
            raise ValueError("Solo se pueden añadir objetos NodoRelevante al subgrafo.")
        id_entidad = nodo.get_entidad().get_id()
        if id_entidad in self.__nodos:
            raise ValueError("La entidad " + id_entidad + " ya está en el subgrafo.")
        self.__nodos[id_entidad] = nodo

    def agregar_relacion(self, relacion: Relacion) -> None:
        """Añade una relación. Si ya estaba (mismo id) no hace nada, para no
        tener duplicados. Sus dos extremos tienen que estar en el subgrafo.
        """
        if self.__contiene_relacion(relacion.get_id()):
            return
        id_origen = relacion.get_origen().get_id()
        id_destino = relacion.get_destino().get_id()
        if not self.contiene_entidad(id_origen) or not self.contiene_entidad(id_destino):
            raise ValueError("La relación " + relacion.get_id() + " une entidades que no están en el subgrafo.")
        self.__relaciones.append(relacion)
        self.__ids_de_relaciones.add(relacion.get_id())

    def eliminar_nodo(self, identificador: str) -> None:
        """Quita un nodo y todas las relaciones en las que participa (una
        relación con un extremo fuera del subgrafo no tendría sentido).
        La entidad central no se puede quitar: el subgrafo tiene como mínimo un nodo.
        """
        if identificador == self.__entidad_central.get_id():
            raise ValueError("No se puede eliminar la entidad central del subgrafo.")
        if identificador not in self.__nodos:
            return
        del self.__nodos[identificador]
        self.__eliminar_relaciones_de(identificador)
        self.__ids_de_relaciones = set()
        for relacion in self.__relaciones:
            self.__ids_de_relaciones.add(relacion.get_id())

    def contiene_entidad(self, identificador: str) -> bool:
        """True si la entidad tiene un nodo en el subgrafo."""
        return identificador in self.__nodos

    def __contiene_relacion(self, id_relacion: str) -> bool:
        """(Privado) ¿Hay ya una relación con este id?"""
        return id_relacion in self.__ids_de_relaciones

    def __eliminar_relaciones_de(self, id_entidad: str) -> None:
        """(Privado) Se queda solo con las relaciones que no tocan a la entidad indicada."""
        relaciones_que_se_quedan = []
        for relacion in self.__relaciones:
            toca_al_origen = relacion.get_origen().get_id() == id_entidad
            toca_al_destino = relacion.get_destino().get_id() == id_entidad
            if not toca_al_origen and not toca_al_destino:
                relaciones_que_se_quedan.append(relacion)
        self.__relaciones = relaciones_que_se_quedan
