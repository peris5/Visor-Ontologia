"""Pruebas de RepositorioSimulado: tipos, nombres y detalle (el vecindario
está en test_vecindario.py). Usan el grafo pequeño de utilidades.py.
"""
import asyncio
import inspect

import pytest

from servidor.datos.repositorio_datos import EntidadNoEncontrada, RepositorioDatos
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.tests.utilidades import (cargar_configuracion, cargar_datos_ejemplo, crear_configuracion_pruebas,
                                       crear_grafo_pequeno)


def crear_repositorio() -> RepositorioSimulado:
    """Repositorio sin retardo con el grafo pequeño."""
    return RepositorioSimulado(crear_grafo_pequeno(), 0, crear_configuracion_pruebas())


def test_obtener_tipos_sale_de_los_datos() -> None:
    tipos = asyncio.run(crear_repositorio().obtener_tipos())
    ids = []
    padres = {}
    for tipo in tipos:
        ids.append(tipo["id"])
        padres[tipo["id"]] = tipo["padres"]
    # Etiquetas de los intermediarios (salvo Birth) y la relación directa,
    # incluida la etiqueta inventada Commission.
    assert ids == ["Commission", "Creation", "Event", "Exposition", "Friendship", "Marriage", "Mentorship",
                   "Paint", "Related", "Relationship", "STUDENT_OF"]
    assert padres["Marriage"] == ["Related", "Relationship"]
    assert "Birth" not in ids


def test_obtener_nombres_solo_con_las_propiedades_de_nombre() -> None:
    nombres = asyncio.run(crear_repositorio().obtener_nombres())
    ids = []
    for entrada in nombres:
        ids.append(entrada["id"])
    assert ids == ["ana", "luis", "eva", "pep", "cuadro", "museo", "zoe", "teo"]
    assert nombres[4] == {"id": "cuadro", "etiquetas": ["HeritageItem"], "propiedades": {"name_es": "Cuadro"}}


def test_detalle_con_eventos_imagenes_y_ubicacion() -> None:
    detalle = asyncio.run(crear_repositorio().obtener_detalle("ana"))
    tipos_de_eventos = []
    for evento in detalle["eventos"]:
        tipos_de_eventos.append(evento["tipo"])
    assert "Birth" in tipos_de_eventos
    assert "Mentorship" in tipos_de_eventos
    # El congreso no crea relaciones (demasiados participantes), pero sí sale en el detalle.
    assert "Event" in tipos_de_eventos
    nacimiento = None
    for evento in detalle["eventos"]:
        if evento["tipo"] == "Birth":
            nacimiento = evento
    assert nacimiento["sinRelacion"] is True
    assert nacimiento["lugar"]["name_es"] == "Valencia"
    assert nacimiento["fecha"] == "1880"
    assert detalle["imagenes"] == [{"id": "imagen", "propiedades": {"url": "https://example.org/imagenes/ana.jpg",
                                                                   "caption": "Ana"}, "orden": 1}]


def test_detalle_de_una_organizacion_con_la_cadena_de_lugares() -> None:
    detalle = asyncio.run(crear_repositorio().obtener_detalle("museo"))
    nombres = []
    for lugar in detalle["ubicacion"]:
        nombres.append(lugar["name_es"])
    assert nombres == ["Valencia", "España"]


def test_detalle_con_fuentes_en_los_datos_de_ejemplo() -> None:
    repositorio = RepositorioSimulado(cargar_datos_ejemplo(), 0, cargar_configuracion())
    detalle = asyncio.run(repositorio.obtener_detalle("n1"))
    tipos = []
    for fuente in detalle["fuentes"]:
        tipos.append(fuente["tipo"])
        assert fuente["externalId"] is not None
    tipos.sort()
    assert tipos == ["API", "Book", "Web"]
    assert len(detalle["imagenes"]) == 2
    assert detalle["imagenes"][0]["orden"] == 1


def test_detalle_de_una_entidad_inexistente() -> None:
    with pytest.raises(EntidadNoEncontrada):
        asyncio.run(crear_repositorio().obtener_detalle("no_existe"))


def test_todos_los_metodos_son_asincronos() -> None:
    repositorio = crear_repositorio()
    assert inspect.iscoroutinefunction(repositorio.obtener_tipos)
    assert inspect.iscoroutinefunction(repositorio.obtener_nombres)
    assert inspect.iscoroutinefunction(repositorio.obtener_vecindario)
    assert inspect.iscoroutinefunction(repositorio.obtener_detalle)


def test_una_relacion_con_un_nodo_que_no_existe_da_error() -> None:
    datos = crear_grafo_pequeno()
    datos["relaciones"].append({"id": "r99", "tipo": "HAS_ROLE_IN", "desde": "ana", "hasta": "nadie",
                                "propiedades": {}})
    with pytest.raises(ValueError):
        RepositorioSimulado(datos, 0, crear_configuracion_pruebas())


def test_la_interfaz_no_se_puede_instanciar() -> None:
    with pytest.raises(TypeError):
        RepositorioDatos()
