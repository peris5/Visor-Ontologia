"""Pruebas del RepositorioSimulado (las de tests/pruebasRepositorio.js del incremento 1).

Las de obtener_vecindario están en test_vecindario.py.

Los métodos del repositorio son asíncronos; asyncio.run() los ejecuta y
espera su resultado, así no hace falta ningún complemento de pytest.
"""
import asyncio
import inspect

import pytest

from servidor.datos.repositorio_datos import RepositorioDatos
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.modelo.obra_de_arte import ObraDeArte
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_entidad import TipoEntidad
from servidor.tests.utilidades import cargar_datos_ejemplo


def crear_datos_prueba() -> dict:
    """Mini conjunto de datos para estas pruebas."""
    return {
        "entidades": [
            {"id": "A", "tipo": "PERSONA", "nombre": "Ana"},
            {"id": "B", "tipo": "PERSONA", "nombre": "Bruno"},
            {"id": "C", "tipo": "OBRA_DE_ARTE", "nombre": "Cuadro azul"},
            {"id": "D", "tipo": "ORGANIZACION", "nombre": "Academia"},
        ],
        "relaciones": [
            ["r1", "A", "B", "maestro_de", 0.9],
            ["r2", "B", "C", "autor_de", 0.7],
            ["r3", "C", "A", "autor_de", 0.4],
            ["r4", "A", "D", "miembro_de", 0.5],
        ],
    }


def crear_repositorio() -> RepositorioSimulado:
    """Repositorio sin retardo con los datos de prueba."""
    return RepositorioSimulado(crear_datos_prueba(), 0)


def contiene_relacion_con_id(relaciones: list[Relacion], id_relacion: str) -> bool:
    """¿Hay en la lista una relación con ese id?"""
    for relacion in relaciones:
        if relacion.get_id() == id_relacion:
            return True
    return False


def test_obtener_relaciones_en_los_dos_sentidos() -> None:
    relaciones = asyncio.run(crear_repositorio().obtener_relaciones("A"))
    assert len(relaciones) == 3
    assert contiene_relacion_con_id(relaciones, "r1")
    assert contiene_relacion_con_id(relaciones, "r3")
    assert contiene_relacion_con_id(relaciones, "r4")


def test_los_tipos_se_descubren_de_los_datos() -> None:
    tipos = asyncio.run(crear_repositorio().obtener_tipos_relacion())
    ids = []
    for tipo in tipos:
        ids.append(tipo.get_id())
    # Sin repetir y en orden de aparición. (Nombre y color: en el navegador.)
    assert ids == ["maestro_de", "autor_de", "miembro_de"]


def test_las_relaciones_apuntan_a_su_tipo() -> None:
    relaciones = asyncio.run(crear_repositorio().obtener_relaciones("C"))
    for relacion in relaciones:
        assert relacion.get_tipo().get_id() == "autor_de"


def test_obtener_entidad_inexistente_devuelve_none() -> None:
    assert asyncio.run(crear_repositorio().obtener_entidad("no_existe")) is None


def test_obtener_entidad_devuelve_la_subclase_correcta() -> None:
    entidad = asyncio.run(crear_repositorio().obtener_entidad("C"))
    assert isinstance(entidad, ObraDeArte)
    assert entidad.get_nombre() == "Cuadro azul"


def test_todos_los_metodos_son_asincronos() -> None:
    repositorio = crear_repositorio()
    assert inspect.iscoroutinefunction(repositorio.buscar_entidades)
    assert inspect.iscoroutinefunction(repositorio.obtener_entidad)
    assert inspect.iscoroutinefunction(repositorio.obtener_relaciones)
    assert inspect.iscoroutinefunction(repositorio.obtener_tipos_relacion)
    assert inspect.iscoroutinefunction(repositorio.obtener_vecindario)


def test_buscar_entidades_filtra_por_texto_tipo_y_limite() -> None:
    repositorio = crear_repositorio()
    con_la_letra_u = asyncio.run(repositorio.buscar_entidades("U", None, None))
    assert len(con_la_letra_u) == 2
    solo_personas = asyncio.run(repositorio.buscar_entidades("", TipoEntidad.PERSONA, None))
    assert len(solo_personas) == 2
    con_limite = asyncio.run(repositorio.buscar_entidades("", None, 1))
    assert len(con_limite) == 1


def test_relacion_con_entidad_inexistente_da_error() -> None:
    datos = crear_datos_prueba()
    datos["relaciones"].append(["r9", "A", "Z", "maestro_de", 0.5])
    with pytest.raises(ValueError):
        RepositorioSimulado(datos, 0)


def test_la_interfaz_no_se_puede_instanciar() -> None:
    with pytest.raises(TypeError):
        RepositorioDatos()


def test_los_datos_de_ejemplo_se_cargan() -> None:
    datos = cargar_datos_ejemplo()
    repositorio = RepositorioSimulado(datos, 0)
    todas = asyncio.run(repositorio.buscar_entidades("", None, None))
    tipos = asyncio.run(repositorio.obtener_tipos_relacion())
    assert len(todas) == len(datos["entidades"])
    assert len(tipos) >= 5
