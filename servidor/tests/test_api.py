"""Pruebas de la API con el cliente de pruebas de FastAPI.

El cliente hace peticiones al servidor sin arrancarlo de verdad (no hace
falta uvicorn). Al usarlo con "with", se ejecuta el ciclo de vida del
servidor: se crea el repositorio simulado al principio y se cierra al final.
Cada prueba arranca un servidor nuevo, así que empieza sin ninguna
relevancia asignada.
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


def test_configuracion_no_envia_lo_que_es_solo_del_servidor(cliente: TestClient) -> None:
    datos = cliente.get("/api/configuracion").json()
    assert set(datos.keys()) == {"umbralPorDefecto", "maxNodos", "entidadInicial", "idioma", "nombresTipos",
                                 "etiquetasEntidad"}
    assert datos["maxNodos"] == 150
    assert datos["entidadInicial"] == "n1"
    for solo_del_servidor in ["pesosRelevancia", "etiquetasAuxiliares", "relacionesIgnoradas",
                              "maxParticipantesIntermediario", "maxEntidadesVecindario"]:
        assert solo_del_servidor not in datos


def test_tipos_incluye_los_de_prueba_sin_haberlos_escrito_en_el_codigo(cliente: TestClient) -> None:
    tipos = cliente.get("/api/tipos").json()
    padres = {}
    for tipo in tipos:
        padres[tipo["id"]] = tipo["padres"]
    assert padres["Apprenticeship"] == ["Professional", "Relationship"]
    assert padres["STUDENT_OF"] == []
    assert padres["Marriage"] == ["Related", "Relationship"]
    assert "Birth" not in padres


def test_nombres_con_etiquetas_y_propiedades_de_nombre(cliente: TestClient) -> None:
    nombres = cliente.get("/api/nombres").json()
    assert len(nombres) == 205
    assert nombres[0] == {"id": "n1", "etiquetas": ["Person", "Creator", "Painter"],
                          "propiedades": {"name": "Elena", "lastName": "Ferrando Peris"}}
    for entrada in nombres:
        assert set(entrada.keys()) == {"id", "etiquetas", "propiedades"}
        assert "dimensions" not in entrada["propiedades"]


def test_vecindario_con_el_formato_y_las_estadisticas(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/vecindario/n1", params={"umbral": 0.3})
    assert respuesta.status_code == 200
    assert respuesta.headers["cache-control"] == "no-store"
    vecindario = respuesta.json()
    assert set(vecindario.keys()) == {"idCentral", "umbral", "recortado", "entidades", "relaciones",
                                      "relevanciasAsignadas", "relevanciasReutilizadas"}
    assert vecindario["relevanciasAsignadas"] > 0
    assert vecindario["relevanciasReutilizadas"] == 0
    for relacion in vecindario["relaciones"]:
        assert set(relacion.keys()) == {"id", "idIntermedio", "origen", "destino", "tipo", "padres", "roles",
                                        "periodo", "lugar", "fecha", "valor"}
        assert relacion["valor"] > 0.3
    for entidad in vecindario["entidades"]:
        assert set(entidad.keys()) == {"id", "etiquetas", "propiedades"}


def test_la_segunda_vez_todas_las_relevancias_se_reutilizan(cliente: TestClient) -> None:
    primera = cliente.get("/api/vecindario/n1", params={"umbral": 0.3}).json()
    segunda = cliente.get("/api/vecindario/n1", params={"umbral": 0.3}).json()
    assert segunda["relevanciasAsignadas"] == 0
    total = primera["relevanciasAsignadas"] + primera["relevanciasReutilizadas"]
    assert segunda["relevanciasReutilizadas"] == total
    # Con otro umbral (que no está en la caché) se recorre de nuevo: todo estaba ya asignado.
    tercera = cliente.get("/api/vecindario/n1", params={"umbral": 0.5}).json()
    assert tercera["relevanciasAsignadas"] == 0
    assert tercera["relevanciasReutilizadas"] > 0


def test_detalle_con_eventos_imagenes_y_fuentes(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/detalle/n1")
    assert respuesta.status_code == 200
    detalle = respuesta.json()
    assert set(detalle.keys()) == {"id", "etiquetas", "propiedades", "eventos", "imagenes", "fuentes", "ubicacion"}
    tipos = []
    for evento in detalle["eventos"]:
        tipos.append(evento["tipo"])
    assert "Birth" in tipos
    assert len(detalle["imagenes"]) == 2
    assert len(detalle["fuentes"]) == 3


def test_detalle_de_una_entidad_inexistente_da_404(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/detalle/n99999")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No existe la entidad n99999"}


def test_umbral_fuera_de_rango_da_422(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/n1", params={"umbral": 1.5}).status_code == 422
    assert cliente.get("/api/vecindario/n1", params={"umbral": -0.1}).status_code == 422
    assert cliente.get("/api/vecindario/n1", params={"umbral": "mucho"}).status_code == 422


def test_entidad_inexistente_da_404(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/vecindario/P99")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No existe la entidad P99"}
    # Un nodo que existe pero no es una entidad (una relación coworking) tampoco.
    assert cliente.get("/api/vecindario/n300").status_code == 404


def test_un_id_demasiado_largo_da_422(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/" + "x" * 101).status_code == 422


def test_el_umbral_se_redondea_hacia_abajo_a_dos_decimales(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/n1", params={"umbral": 0.3000001}).json()["umbral"] == 0.3
    assert cliente.get("/api/vecindario/n1", params={"umbral": 0.349}).json()["umbral"] == 0.34
    assert cliente.get("/api/vecindario/n1", params={"umbral": 0.29}).json()["umbral"] == 0.29


def test_vecindario_sin_umbral_usa_el_de_la_configuracion(cliente: TestClient) -> None:
    assert cliente.get("/api/vecindario/n1").json()["umbral"] == 0.3


def test_con_un_umbral_mayor_el_vecindario_no_crece(cliente: TestClient) -> None:
    anterior = None
    for umbral in [0.1, 0.3, 0.5, 0.7, 0.9]:
        numero = len(cliente.get("/api/vecindario/n1", params={"umbral": umbral}).json()["entidades"])
        if anterior is not None:
            assert numero <= anterior
        anterior = numero


def test_las_respuestas_cacheables_lo_dicen(cliente: TestClient) -> None:
    for ruta in ["/api/nombres", "/api/tipos", "/api/configuracion", "/api/detalle/n1"]:
        assert "max-age=" in cliente.get(ruta).headers["cache-control"]


def test_las_rutas_antiguas_ya_no_existen(cliente: TestClient) -> None:
    assert cliente.get("/api/subgrafo/n1").status_code == 404
    assert cliente.get("/api/entidades").status_code == 404


def test_los_datos_de_ejemplo_tienen_205_entidades() -> None:
    entidades = 0
    for nodo in cargar_datos_ejemplo()["nodos"]:
        for etiqueta in ["Person", "Organization", "HeritageItem"]:
            if etiqueta in nodo["etiquetas"]:
                entidades = entidades + 1
    assert entidades == 205
