"""Pruebas de la API con el cliente de pruebas de FastAPI.

El cliente hace peticiones al servidor sin arrancarlo de verdad (no hace
falta uvicorn). Al usarlo con "with", se ejecuta el ciclo de vida del
servidor: se crea el repositorio simulado al principio y se cierra al final.
"""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from servidor.app import app


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    """Un cliente de pruebas con el servidor ya arrancado."""
    with TestClient(app) as cliente_de_pruebas:
        yield cliente_de_pruebas


def test_salud(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_configuracion(cliente: TestClient) -> None:
    datos = cliente.get("/api/configuracion").json()
    assert datos["umbralPorDefecto"] == 0.3
    assert datos["entidadInicial"] == "p01"
    assert "maxNodos" not in datos


def test_entidades_devuelve_entidades(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/entidades")
    assert respuesta.status_code == 200
    entidades = respuesta.json()
    assert len(entidades) > 0
    for entidad in entidades:
        assert set(entidad.keys()) == {"id", "nombre", "tipo"}


def test_entidades_filtra_por_texto(cliente: TestClient) -> None:
    entidades = cliente.get("/api/entidades", params={"texto": "montsalvat"}).json()
    assert len(entidades) == 1
    assert entidades[0]["id"] == "p01"


def test_entidades_filtra_por_tipo_y_limite(cliente: TestClient) -> None:
    obras = cliente.get("/api/entidades", params={"tipo": "OBRA_DE_ARTE"}).json()
    assert len(obras) > 0
    for obra in obras:
        assert obra["tipo"] == "OBRA_DE_ARTE"
    dos = cliente.get("/api/entidades", params={"limite": 2}).json()
    assert len(dos) == 2


def test_subgrafo_con_el_formato_esperado(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/subgrafo/p01", params={"umbral": 0.3})
    assert respuesta.status_code == 200
    subgrafo = respuesta.json()
    assert subgrafo["idCentral"] == "p01"
    assert subgrafo["umbral"] == 0.3
    assert len(subgrafo["nodos"]) > 1
    assert len(subgrafo["relaciones"]) > 0

    nodo = subgrafo["nodos"][0]
    assert set(nodo.keys()) == {"entidad", "relevancia", "nivel", "centralidad"}
    assert set(nodo["entidad"].keys()) == {"id", "nombre", "tipo", "descripcion", "atributos"}
    relacion = subgrafo["relaciones"][0]
    assert set(relacion.keys()) == {"id", "origen", "destino", "valor", "relevancia", "tipo"}
    assert set(relacion["tipo"].keys()) == {"id", "nombre", "color"}


def test_subgrafo_central_con_relevancia_1_y_ninguno_bajo_el_umbral(cliente: TestClient) -> None:
    umbral = 0.4
    subgrafo = cliente.get("/api/subgrafo/p01", params={"umbral": umbral}).json()
    for nodo in subgrafo["nodos"]:
        if nodo["entidad"]["id"] == "p01":
            assert nodo["relevancia"] == 1
            assert nodo["nivel"] == 0
        else:
            assert nodo["relevancia"] > umbral


def test_subgrafo_sin_umbral_usa_el_de_la_configuracion(cliente: TestClient) -> None:
    subgrafo = cliente.get("/api/subgrafo/p01").json()
    assert subgrafo["umbral"] == 0.3


def test_umbral_fuera_de_rango_da_422(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/subgrafo/p01", params={"umbral": 1.5})
    assert respuesta.status_code == 422


def test_entidad_inexistente_da_404(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/subgrafo/P99")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No existe la entidad P99"}


def test_con_un_umbral_mayor_no_hay_mas_nodos(cliente: TestClient) -> None:
    anterior = None
    for umbral in [0.1, 0.3, 0.5, 0.7, 0.9]:
        subgrafo = cliente.get("/api/subgrafo/p01", params={"umbral": umbral}).json()
        numero_de_nodos = len(subgrafo["nodos"])
        if anterior is not None:
            assert numero_de_nodos <= anterior
        anterior = numero_de_nodos
