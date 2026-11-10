"""ConversorJson: convierte los objetos del modelo en diccionarios para la API."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.relacion import Relacion
from servidor.modelo.subgrafo import Subgrafo
from servidor.modelo.tipo_relacion import TipoRelacion


class ConversorJson:
    """Convierte entidades, relaciones y subgrafos en diccionarios que FastAPI
    envía como JSON. Así la forma del JSON está en un solo sitio: si cambia,
    solo hay que tocar esta clase (y ClienteServicio.convertirSubgrafo en el
    navegador, que hace el camino contrario).

    Requisitos: RNF-17 (el navegador no sabe de dónde salen los datos).
    """

    @staticmethod
    def entidad_resumida_a_diccionario(entidad: Entidad) -> dict[str, Any]:
        """Lo justo para una lista de resultados: id, nombre y tipo."""
        return {
            "id": entidad.get_id(),
            "nombre": entidad.get_nombre(),
            "tipo": entidad.get_tipo().value,
        }

    @staticmethod
    def entidad_a_diccionario(entidad: Entidad) -> dict[str, Any]:
        """La entidad completa, con sus atributos."""
        return {
            "id": entidad.get_id(),
            "nombre": entidad.get_nombre(),
            "tipo": entidad.get_tipo().value,
            "descripcion": entidad.get_descripcion(),
            "atributos": entidad.get_atributos(),
        }

    @staticmethod
    def tipo_relacion_a_diccionario(tipo: TipoRelacion) -> dict[str, Any]:
        """id, nombre y color del tipo."""
        return {
            "id": tipo.get_id(),
            "nombre": tipo.get_nombre(),
            "color": tipo.get_color(),
        }

    @staticmethod
    def relacion_a_diccionario(relacion: Relacion) -> dict[str, Any]:
        """La relación con los ids de sus extremos (las entidades ya van en
        la lista de nodos, así no se repiten).
        """
        return {
            "id": relacion.get_id(),
            "origen": relacion.get_origen().get_id(),
            "destino": relacion.get_destino().get_id(),
            "valor": relacion.get_valor(),
            "relevancia": relacion.get_relevancia(),
            "tipo": ConversorJson.tipo_relacion_a_diccionario(relacion.get_tipo()),
        }

    @staticmethod
    def nodo_a_diccionario(nodo: NodoRelevante) -> dict[str, Any]:
        """La entidad del nodo y sus datos dentro del subgrafo."""
        return {
            "entidad": ConversorJson.entidad_a_diccionario(nodo.get_entidad()),
            "relevancia": nodo.get_relevancia(),
            "nivel": nodo.get_nivel(),
            "centralidad": nodo.get_centralidad(),
        }

    @staticmethod
    def subgrafo_a_diccionario(subgrafo: Subgrafo) -> dict[str, Any]:
        """El subgrafo completo: central, umbral, nodos y relaciones."""
        nodos = []
        for nodo in subgrafo.get_nodos():
            nodos.append(ConversorJson.nodo_a_diccionario(nodo))
        relaciones = []
        for relacion in subgrafo.get_relaciones():
            relaciones.append(ConversorJson.relacion_a_diccionario(relacion))
        return {
            "idCentral": subgrafo.get_entidad_central().get_id(),
            "umbral": subgrafo.get_umbral(),
            "nodos": nodos,
            "relaciones": relaciones,
        }
