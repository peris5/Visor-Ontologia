"""Pruebas de la API con el cliente de pruebas de FastAPI.

El cliente hace peticiones al servidor sin arrancarlo de verdad (no hace
falta uvicorn). Al usarlo con "with", se ejecuta el ciclo de vida del
servidor: se crea el repositorio simulado al principio y se cierra al final.
"""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from servidor.app import app
from servidor.tests.utilidades import cargar_datos_ejemplo


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    """Un cliente de pruebas con el servidor ya arrancado."""
    with TestClient(app) as cliente_de_pruebas:
        yield cliente_de_pruebas


def test_salud(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_configuracion_incluye_max_nodos(cliente: TestClient) -> None:
    datos = cliente.get("/api/configuracion").json()
    assert datos == {"umbralPorDefecto": 0.3, "maxNodos": 150, "entidadInicial": "p01"}


def test_nombres_devuelve_id_nombre_y_tipo_de_todas(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/nombres")
    assert respuesta.status_code == 200
    nombres = respuesta.json()
    assert len(nombres) == len(cargar_datos_ejemplo()["entidades"])
    for entrada in nombres:
        assert set(entrada.keys()) == {"id", "nombre", "tipo"}
    assert nombres[0] == {"id": "p01", "nombre": "Elena Montsalvat", "tipo": "PERSONA"}


def test_vecindario_con_el_formato_esperado(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/vecindario/p01", params={"umbral": 0.3})
    assert respuesta.status_code == 200
    vecindario = respuesta.json()
    assert set(vecindario.keys()) == {"idCentral", "umbral", "recortado", "entidades",
                                      "relaciones", "tiposRelacion"}
    assert vecindario["idCentral"] == "p01"
    assert vecindario["umbral"] == 0.3
    assert vecindario["recortado"] is False
    assert len(vecindario["entidades"]) > 1
    assert len(vecindario["relaciones"]) > 0
    for entidad in vecindario["entidades"]:
        assert set(entidad.keys()) == {"id", "nombre", "tipo", "descripcion", "atributos"}


def test_vecindario_con_relaciones_en_bruto(cliente: TestClient) -> None:
    vecindario = cliente.get("/api/vecindario/p01", params={"umbral": 0.3}).json()
    for relacion in vecindario["relaciones"]:
        # Sin relevancia ni color: los calcula el navegador.
        assert set(relacion.keys()) == {"id", "origen", "destino", "tipo", "valor"}
        assert isinstance(relacion["tipo"], str)
        assert relacion["valor"] > 0.3


def test_vecindario_sin_umbral_usa_el_de_la_configuracion(cliente: TestClient) -> None:
    vecindario = cliente.get("/api/vecindario/p01").json()
    assert vecindario["umbral"] == 0.3


def test_umbral_fuera_de_rango_da_422(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/p01", params={"umbral": 1.5}).status_code == 422
    assert cliente.get("/api/vecindario/p01", params={"umbral": -0.1}).status_code == 422
    assert cliente.get("/api/vecindario/p01", params={"umbral": "mucho"}).status_code == 422


def test_no_se_puede_pedir_el_maximo_de_entidades(cliente: TestClient) -> None:
    # max_entidades lo fija el servidor: un parámetro así se ignora.
    normal = cliente.get("/api/vecindario/p01", params={"umbral": 0.1}).json()
    con_parametro = cliente.get("/api/vecindario/p01", params={"umbral": 0.1, "max_entidades": 1}).json()
    assert len(con_parametro["entidades"]) == len(normal["entidades"])


def test_entidad_inexistente_da_404(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/vecindario/P99")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No existe la entidad P99"}


def test_un_id_demasiado_largo_da_422(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/vecindario/" + "x" * 101)
    assert respuesta.status_code == 422


def test_el_umbral_se_redondea_hacia_abajo_a_dos_decimales(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/p01", params={"umbral": 0.3000001}).json()["umbral"] == 0.3
    assert cliente.get("/api/vecindario/p01", params={"umbral": 0.349}).json()["umbral"] == 0.34
    assert cliente.get("/api/vecindario/p01", params={"umbral": 0.29}).json()["umbral"] == 0.29


def test_la_misma_peticion_da_la_misma_respuesta(cliente: TestClient) -> None:
    primera = cliente.get("/api/vecindario/p01", params={"umbral": 0.5})
    segunda = cliente.get("/api/vecindario/p01", params={"umbral": 0.5})
    assert primera.content == segunda.content
    assert primera.headers["content-type"] == "application/json"


def test_las_respuestas_permiten_cache_del_navegador(cliente: TestClient) -> None:
    rutas = ["/api/vecindario/p01", "/api/nombres", "/api/configuracion"]
    for ruta in rutas:
        cabecera = cliente.get(ruta).headers["cache-control"]
        assert "max-age=" in cabecera


def test_con_un_umbral_mayor_el_vecindario_no_crece(cliente: TestClient) -> None:
    anterior = None
    for umbral in [0.1, 0.3, 0.5, 0.7, 0.9]:
        vecindario = cliente.get("/api/vecindario/p01", params={"umbral": umbral}).json()
        numero_de_entidades = len(vecindario["entidades"])
        if anterior is not None:
            assert numero_de_entidades <= anterior
        anterior = numero_de_entidades


def test_las_rutas_del_incremento_2_ya_no_existen(cliente: TestClient) -> None:
    assert cliente.get("/api/subgrafo/p01").status_code == 404
    assert cliente.get("/api/entidades").status_code == 404
