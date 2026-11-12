"""ConversorJson: convierte los objetos del modelo en diccionarios para la API."""
from typing import Any

from servidor.modelo.entidad import Entidad
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_relacion import TipoRelacion
from servidor.modelo.vecindario import Vecindario


class ConversorJson:
    """Convierte entidades, relaciones y vecindarios en diccionarios que
    FastAPI envía como JSON. Así la forma del JSON está en un solo sitio: si
    cambia, solo hay que tocar esta clase (y RepositorioVecindario en el
    navegador, que hace el camino contrario).

    Desde el incremento 3 los datos van EN BRUTO: sin relevancias, sin
    centralidades, sin nombres legibles de los tipos y sin colores. Todo eso
    lo calcula el navegador.

    Requisitos: RNF-17 (el navegador no sabe de dónde salen los datos).
    """

    @staticmethod
    def entidad_resumida_a_diccionario(entidad: Entidad) -> dict[str, Any]:
        """Lo justo para el índice del buscador: id, nombre y tipo."""
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
    def relacion_a_diccionario(relacion: Relacion) -> dict[str, Any]:
        """La relación en bruto: ids de sus extremos (las entidades ya van en
        su propia lista, así no se repiten), id de su tipo y valor de la BD.
        """
        return {
            "id": relacion.get_id(),
            "origen": relacion.get_origen().get_id(),
            "destino": relacion.get_destino().get_id(),
            "tipo": relacion.get_tipo().get_id(),
            "valor": relacion.get_valor(),
        }

    @staticmethod
    def vecindario_a_diccionario(id_central: str, umbral: float, vecindario: Vecindario,
                                 tipos: list[TipoRelacion]) -> dict[str, Any]:
        """El vecindario completo.

        tiposRelacion lleva los ids de TODOS los tipos de relación de los
        datos (no solo los de este vecindario): el navegador los ordena y les
        da color, y así un mismo tipo tiene el mismo color en todos los
        vecindarios.
        """
        entidades = []
        for entidad in vecindario.entidades:
            entidades.append(ConversorJson.entidad_a_diccionario(entidad))
        relaciones = []
        for relacion in vecindario.relaciones:
            relaciones.append(ConversorJson.relacion_a_diccionario(relacion))
        ids_de_tipos = []
        for tipo in tipos:
            ids_de_tipos.append(tipo.get_id())
        return {
            "idCentral": id_central,
            "umbral": umbral,
            "recortado": vecindario.recortado,
            "entidades": entidades,
            "relaciones": relaciones,
            "tiposRelacion": ids_de_tipos,
        }
