"""Vecindario: los datos en bruto alrededor de una entidad."""
from typing import Any


class Vecindario:
    """Las entidades y relaciones que rodean a una entidad, en bruto.

    Es lo que el servidor envía al navegador para que este construya el
    subgrafo (ver RepositorioDatos.obtener_vecindario). Contiene todo lo que
    el navegador puede llegar a necesitar con ese umbral, y normalmente algo
    más: el navegador descarta lo que sobre.

     - entidades: [{"id", "etiquetas", "propiedades"}] tal cual están en la BD.
     - relaciones: relaciones DERIVADAS (ver ProyectorRelaciones), cada una
       con su "valor": la relevancia asignada (ver AsignadorRelevancia).
     - recortado: True si el recorrido se paró al llegar al máximo de
       entidades que permite el servidor (entonces podría faltar algo).
     - relevancias_asignadas / relevancias_reutilizadas: en esta petición,
       cuántas relevancias se han calculado y guardado y cuántas ya estaban.

    Requisitos: RNF-17 (acceso a datos separado), RNF-05 (el servidor solo
    entrega datos y hace el mínimo trabajo), RF-09.
    """

    def __init__(self, entidades: list[dict[str, Any]], relaciones: list[dict[str, Any]], recortado: bool,
                 relevancias_asignadas: int, relevancias_reutilizadas: int) -> None:
        """Ver la descripción de la clase."""
        self.entidades = entidades
        self.relaciones = relaciones
        self.recortado = recortado
        self.relevancias_asignadas = relevancias_asignadas
        self.relevancias_reutilizadas = relevancias_reutilizadas
