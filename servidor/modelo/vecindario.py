"""Vecindario: los datos en bruto alrededor de una entidad."""
from servidor.modelo.entidad import Entidad
from servidor.modelo.relacion import Relacion


class Vecindario:
    """Las entidades y relaciones que rodean a una entidad, sin ningún cálculo.

    Es lo que el servidor envía al navegador para que este construya el
    subgrafo (ver RepositorioDatos.obtener_vecindario). Contiene todo lo que
    el navegador puede llegar a necesitar con ese umbral, y normalmente algo
    más: el navegador descarta lo que sobre.

    recortado es True si el recorrido se paró porque se llegó al máximo de
    entidades que permite el servidor (entonces podría faltar algo).

    Requisitos: RNF-17 (acceso a datos separado), RNF-05 (el servidor solo
    entrega datos y hace el mínimo trabajo).
    """

    def __init__(self, entidades: list[Entidad], relaciones: list[Relacion], recortado: bool) -> None:
        """entidades: las encontradas, la central incluida.
        relaciones: las encontradas (todas superan el umbral).
        recortado: True si se llegó al máximo de entidades.
        """
        self.entidades = entidades
        self.relaciones = relaciones
        self.recortado = recortado
