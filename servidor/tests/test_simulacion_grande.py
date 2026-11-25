"""Pruebas de los datos simulados grandes (servidor/simulacion/) y de
/api/muestra. Para que tarden poco se generan con tamaños pequeños.
"""
import asyncio
import re
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from servidor.api.cache_respuestas import CacheRespuestas
from servidor.app import app, crear_configuracion
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.simulacion.generador_bd_grande import GeneradorBDGrande
from servidor.tests.utilidades import cargar_configuracion

# Los códigos de los nombres: C0001, P0001, H00001, AC01, I000123...
CODIGO = re.compile(r"[A-Z]{1,2}\d+")


def parametros_pequenos() -> dict[str, Any]:
    """Los de la configuración, con muchas menos entidades."""
    parametros = dict(cargar_configuracion().get_simulacion_grande())
    parametros.update({"creadores": 150, "personas": 100, "obras": 600, "exposicionesPequenas": 120,
                       "exposicionesMedianas": 20, "salones": 3, "tertulias": 30, "porcentajeDuplicados": 20})
    return parametros


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    """El servidor con los datos grandes (en pequeño)."""
    with TestClient(app) as cliente_de_pruebas:
        datos = GeneradorBDGrande(parametros_pequenos()).generar()
        app.state.repositorio = RepositorioSimulado(datos, 0, cargar_configuracion())
        app.state.cache = CacheRespuestas(1000, 60)
        yield cliente_de_pruebas


def test_con_la_misma_semilla_sale_el_mismo_grafo() -> None:
    primero = GeneradorBDGrande(parametros_pequenos()).generar()
    segundo = GeneradorBDGrande(parametros_pequenos()).generar()
    assert primero == segundo
    otra_semilla = parametros_pequenos()
    otra_semilla["semilla"] = 1
    assert GeneradorBDGrande(otra_semilla).generar() != primero


def test_los_nombres_son_codigos() -> None:
    for nodo in GeneradorBDGrande(parametros_pequenos()).generar()["nodos"]:
        for clave in ["name", "lastName", "name_es", "name_ca", "name_en"]:
            if clave in nodo["propiedades"]:
                assert CODIGO.fullmatch(nodo["propiedades"][clave]) is not None, nodo["propiedades"][clave]


def test_tamano_de_los_datos_completos() -> None:
    contador = {"Creator": 0, "Person": 0, "Organization": 0, "HeritageItem": 0}
    for nodo in GeneradorBDGrande(cargar_configuracion().get_simulacion_grande()).generar()["nodos"]:
        for etiqueta in contador:
            if etiqueta in nodo["etiquetas"]:
                contador[etiqueta] = contador[etiqueta] + 1
    assert contador == {"Creator": 2000, "Person": 3500, "Organization": 143, "HeritageItem": 22000}


def test_el_tres_por_ciento_de_los_eventos_con_lugar_esta_repetido_y_se_junta() -> None:
    # Con los datos completos: se cuentan en el grafo los eventos con lugar y
    # los que tienen fecha con día (dos por cada repetido), y el servidor junta
    # exactamente esos.
    configuracion = cargar_configuracion()
    datos = GeneradorBDGrande(configuracion.get_simulacion_grande()).generar()
    con_lugar = 0
    con_dia = 0
    for relacion in datos["relaciones"]:
        if relacion["tipo"] == "OCURRED_AT" and "date" in relacion["propiedades"]:
            con_lugar = con_lugar + 1
            if len(relacion["propiedades"]["date"]) == 10:
                con_dia = con_dia + 1
    repetidos = con_dia // 2
    distintos = con_lugar - repetidos
    assert con_dia % 2 == 0
    assert 0.02 < repetidos / distintos < 0.04
    muestra = asyncio.run(RepositorioSimulado(datos, 0, configuracion).obtener_muestra(5, 7))
    assert sum(muestra["eventosJuntados"].values()) == repetidos
    assert set(muestra["eventosJuntados"]) == {"Exposition", "Event", "Work"}


def test_hay_eventos_registrados_dos_veces_y_llegan_juntados(cliente: TestClient) -> None:
    ids = cliente.get("/api/muestra?n=150").json()["ids"]
    juntados = 0
    for relacion in cliente.post("/api/relaciones", json={"ids": ids}).json()["relaciones"]:
        if "idsIntermediarios" in relacion:
            juntados = juntados + 1
            assert len(relacion["idsIntermediarios"]) == 2
    assert juntados > 0


def test_el_servidor_no_escribe_ninguna_relevancia() -> None:
    datos = GeneradorBDGrande(parametros_pequenos()).generar()
    for elemento in datos["nodos"] + datos["relaciones"]:
        for clave in elemento["propiedades"]:
            assert not clave.startswith("relevance")


def test_muestra_con_la_misma_semilla_da_los_mismos(cliente: TestClient) -> None:
    primera = cliente.get("/api/muestra?n=60&semilla=7").json()
    assert len(primera["ids"]) == 60
    assert len(set(primera["ids"])) == 60
    assert primera["creadores"] == 60
    # 150 creadores, 100 personas, 600 obras y 143 organizaciones.
    assert primera["entidades"] == 993
    assert cliente.get("/api/muestra?n=60&semilla=7").json() == primera
    otra = cliente.get("/api/muestra?n=60&semilla=8").json()
    # Los 25 con más relaciones son siempre los mismos; el resto, no.
    assert otra["ids"][0:25] == primera["ids"][0:25]
    assert otra["ids"] != primera["ids"]
    for id_entidad in primera["ids"]:
        assert id_entidad.startswith("C")


def test_muestra_completa_con_otras_entidades_si_no_hay_bastantes_creadores(cliente: TestClient) -> None:
    muestra = cliente.get("/api/muestra?n=200").json()
    ids = muestra["ids"]
    assert len(ids) == 200
    assert muestra["creadores"] == 150
    creadores = 0
    for id_entidad in ids:
        if id_entidad.startswith("C"):
            creadores = creadores + 1
    assert creadores >= 150


def test_muestra_dice_los_intermediarios_ignorados() -> None:
    # Un salón con más de maxParticipantesEvidencia personas.
    nodos = [{"id": "salon", "etiquetas": ["Event", "Exposition"], "propiedades": {}}]
    relaciones = []
    for indice in range(205):
        nodos.append({"id": "c" + str(indice), "etiquetas": ["Person", "Creator"], "propiedades": {"name": "C1"}})
        relaciones.append({"id": "r" + str(indice), "tipo": "PARTICIPATES_IN", "desde": "c" + str(indice),
                           "hasta": "salon", "propiedades": {}})
    grafo = {"jerarquia": {"Exposition": "Event"}, "nodos": nodos, "relaciones": relaciones}
    repositorio = RepositorioSimulado(grafo, 0, cargar_configuracion())
    muestra = asyncio.run(repositorio.obtener_muestra(10, 7))
    assert muestra["intermediariosIgnorados"] == {"Exposition": 1}
    assert len(muestra["ids"]) == 10


def test_muestra_no_valida_da_422(cliente: TestClient) -> None:
    assert cliente.get("/api/muestra?n=0").status_code == 422
    assert cliente.get("/api/muestra?n=1001").status_code == 422
    assert cliente.get("/api/muestra?n=hola").status_code == 422


def test_la_variable_de_entorno_cambia_el_origen_de_los_datos(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VISOR_ORIGEN_DATOS", raising=False)
    assert crear_configuracion().get_origen_datos() == "simulado"
    monkeypatch.setenv("VISOR_ORIGEN_DATOS", "simuladaGrande")
    configuracion = crear_configuracion()
    assert configuracion.get_origen_datos() == "simuladaGrande"
    assert configuracion.get_entidad_inicial() == "C0001"


def test_entidad_inicial_de_los_datos_grandes() -> None:
    configuracion = cargar_configuracion()
    assert configuracion.get_entidad_inicial() == "n1"
    datos = {"origenDatos": "simuladaGrande", "entidadInicial": "n1", "simulacionGrande": {"entidadInicial": "C0001"}}
    configuracion.cargar(datos)
    assert configuracion.get_entidad_inicial() == "C0001"
