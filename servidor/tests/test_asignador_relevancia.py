"""Pruebas de AsignadorRelevancia y AlmacenRelevanciasEnGrafo."""
from typing import Any

import pytest

from servidor.datos.almacen_relevancias import AlmacenRelevancias
from servidor.datos.almacen_relevancias_en_grafo import AlmacenRelevanciasEnGrafo
from servidor.logica.asignador_relevancia import AsignadorRelevancia
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia


class EstrategiaQueCuenta(EstrategiaRelevancia):
    """Doble de prueba: siempre 0,7, y cuenta cuántas veces calcula."""

    def __init__(self) -> None:
        self.veces = 0

    def calcular_relevancia(self, tipo: str) -> float:
        self.veces = self.veces + 1
        return 0.7


def crear_grafo() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Dos intermediarios (uno con relevancia manual) y una relación directa."""
    nodos = {
        "i1": {"id": "i1", "etiquetas": ["Relationship"], "propiedades": {}},
        "i2": {"id": "i2", "etiquetas": ["Relationship"],
               "propiedades": {"relevance": 0.2, "relevanceSource": "manual", "relevanceVersion": 1}},
    }
    relaciones = {"r1": {"id": "r1", "tipo": "STUDENT_OF", "desde": "a", "hasta": "b", "propiedades": {}}}
    return nodos, relaciones


def crear_asignador(version: int) -> tuple[AsignadorRelevancia, EstrategiaQueCuenta, dict, dict]:
    """Asignador con la estrategia que cuenta, sobre el grafo de prueba."""
    nodos, relaciones = crear_grafo()
    estrategia = EstrategiaQueCuenta()
    asignador = AsignadorRelevancia(estrategia, AlmacenRelevanciasEnGrafo(nodos, relaciones), version)
    return asignador, estrategia, nodos, relaciones


def test_asigna_y_guarda_si_falta() -> None:
    asignador, estrategia, nodos, relaciones = crear_asignador(1)
    assert asignador.obtener("i1", "Relationship") == 0.7
    assert estrategia.veces == 1
    assert nodos["i1"]["propiedades"] == {"relevance": 0.7, "relevanceSource": "auto", "relevanceVersion": 1}
    # En una relación directa se guarda en la propia relación.
    asignador.obtener("r1", "STUDENT_OF")
    assert relaciones["r1"]["propiedades"]["relevance"] == 0.7


def test_la_segunda_vez_reutiliza_sin_calcular() -> None:
    asignador, estrategia, _, _ = crear_asignador(1)
    asignador.obtener("i1", "Relationship")
    asignador.obtener("i1", "Relationship")
    assert estrategia.veces == 1


def test_no_sobrescribe_un_valor_manual() -> None:
    asignador, estrategia, nodos, _ = crear_asignador(5)
    # Aunque la versión de los pesos sea otra, el valor manual se respeta.
    assert asignador.obtener("i2", "Relationship") == 0.2
    assert estrategia.veces == 0
    # Y el almacén tampoco lo sobrescribe aunque se lo pidan.
    AlmacenRelevanciasEnGrafo(nodos, {}).guardar("i2", 0.9, 5)
    assert nodos["i2"]["propiedades"]["relevance"] == 0.2


def test_recalcula_si_cambia_la_version_de_los_pesos() -> None:
    nodos, relaciones = crear_grafo()
    almacen = AlmacenRelevanciasEnGrafo(nodos, relaciones)
    AsignadorRelevancia(EstrategiaQueCuenta(), almacen, 1).obtener("i1", "Relationship")
    estrategia_nueva = EstrategiaQueCuenta()
    asignador_nuevo = AsignadorRelevancia(estrategia_nueva, almacen, 2)
    asignador_nuevo.obtener("i1", "Relationship")
    assert estrategia_nueva.veces == 1
    assert nodos["i1"]["propiedades"]["relevanceVersion"] == 2


def test_estadisticas() -> None:
    asignador, _, _, _ = crear_asignador(1)
    asignador.obtener("i1", "Relationship")
    asignador.obtener("i1", "Relationship")
    asignador.obtener("i2", "Relationship")
    asignador.obtener("r1", "STUDENT_OF")
    assert asignador.get_estadisticas() == {"asignadas": 2, "reutilizadas": 2}


def test_el_almacen_lee_none_si_no_hay_relevancia() -> None:
    nodos, relaciones = crear_grafo()
    almacen = AlmacenRelevanciasEnGrafo(nodos, relaciones)
    assert almacen.leer("i1") is None
    assert almacen.leer("no_existe") is None
    assert almacen.leer("i2") == {"valor": 0.2, "origen": "manual", "version": 1}


def test_la_interfaz_del_almacen_no_se_puede_instanciar() -> None:
    with pytest.raises(TypeError):
        AlmacenRelevancias()
