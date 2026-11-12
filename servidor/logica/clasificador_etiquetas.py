"""ClasificadorEtiquetas: qué es cada nodo de Neo4j según sus etiquetas."""
from servidor.logica.configuracion import Configuracion


class ClasificadorEtiquetas:
    """Decide, a partir de la configuración y de la jerarquía de etiquetas
    leída de la base de datos, qué papel tiene un nodo:

     - ENTIDAD: alguna de sus etiquetas (o de sus padres) está en
       etiquetasEntidad (Person, Organization, HeritageItem).
     - AUXILIAR: no es entidad y alguna etiqueta (o padre) está en
       etiquetasAuxiliares (Period, Ubication, Image, ExternalSource).
     - INTERMEDIARIO: todo lo demás (Relationship, Event... y cualquier
       etiqueta nueva que se añada a la BD, sin tocar el código).

    Ninguna etiqueta está escrita aquí: todas salen de la configuración o de
    la jerarquía. Se miran también los padres para que un nodo que solo
    tuviera la etiqueta "Painter" siguiera siendo una persona.

    La jerarquía es un diccionario etiqueta → su padre (los IS_A del diseño).
    Se supone que en la BD real los subtipos son varias etiquetas en el mismo
    nodo (:Person:Creator:Painter); si fueran una taxonomía aparte, solo
    cambiaría cómo se lee la jerarquía, no esta clase.

    Requisitos: nuevo RNF de mantenibilidad (añadir tipos sin cambiar el
    código), RNF-16 (clasificación en la configuración).
    """

    def __init__(self, configuracion: Configuracion, jerarquia: dict[str, str]) -> None:
        """configuracion: ya comprobada. jerarquia: etiqueta → etiqueta padre."""
        self.__etiquetas_entidad = configuracion.get_etiquetas_entidad()
        self.__etiquetas_auxiliares = configuracion.get_etiquetas_auxiliares()
        self.__jerarquia = jerarquia

    def es_entidad(self, etiquetas: list[str]) -> bool:
        """¿Alguna etiqueta (o alguno de sus padres) es de entidad?"""
        for etiqueta in self.__con_padres(etiquetas):
            if etiqueta in self.__etiquetas_entidad:
                return True
        return False

    def tipo_entidad(self, etiquetas: list[str]) -> str:
        """"PERSONA", "ORGANIZACION" u "OBRA_DE_ARTE". ValueError si no es una entidad."""
        for etiqueta in self.__con_padres(etiquetas):
            if etiqueta in self.__etiquetas_entidad:
                return self.__etiquetas_entidad[etiqueta]
        raise ValueError("Ninguna de las etiquetas " + str(etiquetas) + " es de entidad (revisa etiquetasEntidad).")

    def es_auxiliar(self, etiquetas: list[str]) -> bool:
        """¿Es un nodo auxiliar (y no una entidad)?"""
        if self.es_entidad(etiquetas):
            return False
        for etiqueta in self.__con_padres(etiquetas):
            if etiqueta in self.__etiquetas_auxiliares:
                return True
        return False

    def es_intermediario(self, etiquetas: list[str]) -> bool:
        """Ni entidad ni auxiliar: une entidades (Relationship, Event o uno nuevo)."""
        if self.es_entidad(etiquetas):
            return False
        return not self.es_auxiliar(etiquetas)

    def mas_especifica(self, etiquetas: list[str]) -> str:
        """La etiqueta que no es padre (ni abuelo...) de ninguna otra del nodo.
        Ejemplo: ["Event", "Creation", "Paint"] → "Paint".
        Si hubiera varias, se elige:
          1. la más profunda en la jerarquía;
          2. a igual profundidad, la que no es padre de NADA en la jerarquía
             (así, en un nodo :Relationship:Commission, si Commission es un
             tipo nuevo que aún no está en la jerarquía, gana Commission y no
             Relationship, que es padre de muchos tipos);
          3. si sigue el empate, la primera.
        "" si no hay etiquetas.
        """
        mejor = ""
        puntuacion_mejor = -1
        for etiqueta in etiquetas:
            if not self.__es_padre_de_alguna(etiqueta, etiquetas):
                # Profundidad × 2, más 1 si es una hoja: la profundidad manda
                # y la hoja solo desempata.
                puntuacion = len(self.padres(etiqueta)) * 2
                if not self.__es_padre_en_la_jerarquia(etiqueta):
                    puntuacion = puntuacion + 1
                if puntuacion > puntuacion_mejor:
                    mejor = etiqueta
                    puntuacion_mejor = puntuacion
        return mejor

    def padres(self, etiqueta: str) -> list[str]:
        """Los padres de la etiqueta, del más cercano al más lejano.
        Ejemplo: "Marriage" → ["Related", "Relationship"].
        Si la jerarquía tuviera un ciclo (el diseño tiene uno: Creation IS_A
        Event y Event IS_A Creation), se para al repetir una etiqueta.
        """
        resultado: list[str] = []
        vistas = {etiqueta}
        actual = etiqueta
        while actual in self.__jerarquia:
            padre = self.__jerarquia[actual]
            if padre in vistas:
                break
            resultado.append(padre)
            vistas.add(padre)
            actual = padre
        return resultado

    def __con_padres(self, etiquetas: list[str]) -> list[str]:
        """(Privado) Las etiquetas del nodo y, detrás, todos sus padres."""
        resultado: list[str] = []
        for etiqueta in etiquetas:
            if etiqueta not in resultado:
                resultado.append(etiqueta)
        for etiqueta in etiquetas:
            for padre in self.padres(etiqueta):
                if padre not in resultado:
                    resultado.append(padre)
        return resultado

    def __es_padre_en_la_jerarquia(self, etiqueta: str) -> bool:
        """(Privado) ¿Es padre de alguna etiqueta en toda la jerarquía?"""
        for hija in self.__jerarquia:
            if self.__jerarquia[hija] == etiqueta:
                return True
        return False

    def __es_padre_de_alguna(self, etiqueta: str, etiquetas: list[str]) -> bool:
        """(Privado) ¿Es la etiqueta padre (o abuelo...) de otra del nodo?"""
        for otra in etiquetas:
            if otra != etiqueta and etiqueta in self.padres(otra):
                return True
        return False
