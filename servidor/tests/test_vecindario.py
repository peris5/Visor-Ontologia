"""Pruebas de RepositorioSimulado.obtener_vecindario (servidor/datos/).

Con el grafo pequeño de utilidades.py y los pesos de configuracion.json:
  Mentorship 0,85 · Friendship 0,75 · Paint 0,90 (de Creation) ·
  Exposition 0,50 · Commission 0,50 (de Relationship) · STUDENT_OF 0,5 (por defecto)
"""
import asyncio

import pytest

from servidor.datos.repositorio_datos import EntidadNoEncontrada
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.modelo.vecindario import Vecindario
from servidor.tests.utilidades import (cargar_configuracion, cargar_datos_ejemplo, crear_configuracion_pruebas,
                                       crear_grafo_pequeno)


def crear_repositorio() -> RepositorioSimulado:
    """Repositorio con el grafo pequeño."""
    return RepositorioSimulado(crear_grafo_pequeno(), 0, crear_configuracion_pruebas())


def pedir(repositorio: RepositorioSimulado, id_entidad: str, umbral: float, maximo: int = 2000) -> Vecindario:
    """Vecindario (ejecuta el método asíncrono)."""
    return asyncio.run(repositorio.obtener_vecindario(id_entidad, umbral, maximo))


def ids_de(lista: list[dict]) -> list[str]:
    """Ids de una lista de entidades o relaciones, ordenados."""
    ids = []
    for elemento in lista:
        ids.append(elemento["id"])
    ids.sort()
    return ids


def test_contiene_la_central_y_las_entidades_en_bruto() -> None:
    vecindario = pedir(crear_repositorio(), "ana", 0.3)
    assert "ana" in ids_de(vecindario.entidades)
    ana = vecindario.entidades[0]
    assert ana == {"id": "ana", "etiquetas": ["Person", "Creator", "Painter"],
                   "propiedades": {"name": "Ana", "lastName": "Roig"}}


def test_las_relaciones_llevan_la_relevancia_asignada() -> None:
    vecindario = pedir(crear_repositorio(), "ana", 0.3)
    valores = {}
    for relacion in vecindario.relaciones:
        valores[relacion["tipo"]] = relacion["valor"]
    assert valores == {"Mentorship": 0.85, "Friendship": 0.75, "Paint": 0.90, "Exposition": 0.5,
                       "Commission": 0.5, "STUDENT_OF": 0.5}


def test_solo_sigue_las_relaciones_por_encima_del_umbral() -> None:
    vecindario = pedir(crear_repositorio(), "ana", 0.6)
    for relacion in vecindario.relaciones:
        assert relacion["valor"] > 0.6
    # Al museo solo se llega por la exposición (0,5).
    assert ids_de(vecindario.entidades) == ["ana", "cuadro", "luis"]


def test_llega_a_varios_saltos() -> None:
    # Desde Luis: Luis → Ana → cuadro → museo.
    vecindario = pedir(crear_repositorio(), "luis", 0.3)
    assert ids_de(vecindario.entidades) == ["ana", "cuadro", "luis", "museo"]
    assert vecindario.recortado is False


def test_se_para_en_max_entidades_y_marca_recortado() -> None:
    vecindario = pedir(crear_repositorio(), "luis", 0.3, 2)
    assert ids_de(vecindario.entidades) == ["ana", "luis"]
    assert vecindario.recortado is True
    for relacion in vecindario.relaciones:
        assert relacion["origen"] in ["ana", "luis"]
        assert relacion["destino"] in ["ana", "luis"]


def test_solo_se_asignan_relevancias_a_lo_que_se_recorre() -> None:
    repositorio = crear_repositorio()
    pedir(repositorio, "ana", 0.3)
    almacen = repositorio.get_almacen()
    assert almacen.leer("mentoria") is not None
    assert almacen.leer("r10") is not None
    # La boda de Zoe y Teo está en una zona no conectada: sigue sin relevancia.
    assert almacen.leer("boda") is None
    # El nacimiento y el congreso no crean relaciones: tampoco tienen relevancia.
    assert almacen.leer("nacimiento") is None
    assert almacen.leer("congreso") is None


def test_una_segunda_peticion_igual_no_asigna_ninguna() -> None:
    repositorio = crear_repositorio()
    primera = pedir(repositorio, "ana", 0.3)
    segunda = pedir(repositorio, "ana", 0.3)
    assert primera.relevancias_asignadas == 6
    assert primera.relevancias_reutilizadas == 0
    assert segunda.relevancias_asignadas == 0
    assert segunda.relevancias_reutilizadas == 6


def test_entidad_inexistente_da_error() -> None:
    with pytest.raises(EntidadNoEncontrada):
        pedir(crear_repositorio(), "no_existe", 0.3)
    # Un nodo que no es una entidad tampoco.
    with pytest.raises(EntidadNoEncontrada):
        pedir(crear_repositorio(), "mentoria", 0.3)


def test_no_cambia_los_datos_que_recibe() -> None:
    datos = crear_grafo_pequeno()
    repositorio = RepositorioSimulado(datos, 0, crear_configuracion_pruebas())
    pedir(repositorio, "ana", 0.3)
    for nodo in datos["nodos"]:
        assert "relevance" not in nodo["propiedades"]


def test_con_los_datos_de_ejemplo() -> None:
    repositorio = RepositorioSimulado(cargar_datos_ejemplo(), 0, cargar_configuracion())
    vecindario = pedir(repositorio, "n1", 0.3)
    assert len(vecindario.entidades) > 150
    assert vecindario.recortado is False
    tipos = set()
    for relacion in vecindario.relaciones:
        tipos.add(relacion["tipo"])
    # Están los tipos de prueba, que no están escritos en el código.
    assert "Apprenticeship" in tipos
    assert "STUDENT_OF" in tipos
