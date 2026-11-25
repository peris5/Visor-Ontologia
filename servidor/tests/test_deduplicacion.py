"""Pruebas de lo que cada relación dice de su intermediario (participantes por
clase y vía) y de la deduplicación de eventos (E7), en ProyectorRelaciones.
"""
import asyncio
import json
from typing import Any

from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.logica.configuracion import Configuracion
from servidor.tests.utilidades import ARCHIVO_CONFIGURACION, cargar_configuracion


def configuracion_con(deduplicar: bool) -> Configuracion:
    """La configuración de verdad, con la deduplicación encendida o apagada."""
    with open(ARCHIVO_CONFIGURACION, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    datos["deduplicarEventos"] = deduplicar
    configuracion = Configuracion()
    configuracion.cargar(datos)
    configuracion.comprobar()
    return configuracion


def evento(grafo: dict[str, Any], id_evento: str, etiquetas: list[str], personas: list[str], lugar: str | None,
           fecha: str) -> None:
    """Añade al grafo un evento con esas personas, en un lugar y una fecha."""
    grafo["nodos"].append({"id": id_evento, "etiquetas": etiquetas, "propiedades": {"name_es": id_evento}})
    for persona in personas:
        grafo["relaciones"].append({"id": id_evento + persona, "tipo": "PARTICIPATES_IN", "desde": persona,
                                    "hasta": id_evento, "propiedades": {"role": "expositora"}})
    if lugar is not None:
        grafo["relaciones"].append({"id": id_evento + lugar, "tipo": "OCURRED_AT", "desde": id_evento, "hasta": lugar,
                                    "propiedades": {"date": fecha}})


def crear_grafo() -> dict[str, Any]:
    """Cuatro personas, una obra, una galería y un museo, sin eventos."""
    nodos = []
    for persona in ["ana", "bea", "carla", "dora"]:
        nodos.append({"id": persona, "etiquetas": ["Person", "Creator"], "propiedades": {"name": persona}})
    nodos.append({"id": "obra", "etiquetas": ["HeritageItem"], "propiedades": {"name_es": "obra"}})
    nodos.append({"id": "galeria", "etiquetas": ["Organization"], "propiedades": {"name_es": "galeria"}})
    nodos.append({"id": "museo", "etiquetas": ["Organization"], "propiedades": {"name_es": "museo"}})
    return {"jerarquia": {"Exposition": "Event", "Wedding": "Event", "Creation": "Event", "Creator": "Person"},
            "nodos": nodos, "relaciones": []}


def relaciones(grafo: dict[str, Any], id_entidad: str, deduplicar: bool = True) -> list[dict[str, Any]]:
    """Las relaciones derivadas de una entidad."""
    repositorio = RepositorioSimulado(grafo, 0, configuracion_con(deduplicar))
    return asyncio.run(repositorio.obtener_relaciones([id_entidad]))["relaciones"]


def con(lista: list[dict[str, Any]], id_otra: str) -> list[dict[str, Any]]:
    """Las de la lista que unen con esa otra entidad."""
    resultado = []
    for relacion in lista:
        if id_otra in [relacion["origen"], relacion["destino"]]:
            resultado.append(relacion)
    return resultado


def test_participantes_por_clase_via_y_fecha() -> None:
    grafo = crear_grafo()
    evento(grafo, "expo", ["Event", "Exposition"], ["ana", "bea"], "galeria", "1920-05-14")
    grafo["relaciones"].append({"id": "x", "tipo": "IS_EXPOSED", "desde": "expo", "hasta": "obra", "propiedades": {}})
    lista = relaciones(grafo, "ana")
    assert len(lista) == 3
    for relacion in lista:
        assert relacion["participantes"] == 4
        assert relacion["participantesPorClase"] == {"PERSONA": 2, "OBRA_DE_ARTE": 1, "ORGANIZACION": 1}
        assert relacion["fecha"] == "1920-05-14"
        assert relacion["via"]["ana"] == "PARTICIPATES_IN"
        assert "idsIntermediarios" not in relacion
    assert con(lista, "galeria")[0]["via"] == {"ana": "PARTICIPATES_IN", "galeria": "OCURRED_AT"}
    assert con(lista, "obra")[0]["via"] == {"ana": "PARTICIPATES_IN", "obra": "IS_EXPOSED"}


def test_una_relacion_directa_no_tiene_vias() -> None:
    grafo = crear_grafo()
    grafo["relaciones"].append({"id": "d", "tipo": "STUDENT_OF", "desde": "ana", "hasta": "bea", "propiedades": {}})
    directa = relaciones(grafo, "ana")[0]
    assert directa["via"] == {}
    assert directa["participantes"] == 2
    assert directa["participantesPorClase"] == {"PERSONA": 2}


def test_dos_registros_del_mismo_tipo_lugar_y_dia_son_un_evento() -> None:
    grafo = crear_grafo()
    evento(grafo, "e1", ["Event", "Exposition"], ["ana", "bea", "carla"], "galeria", "1920-05-14")
    evento(grafo, "e2", ["Event", "Exposition"], ["ana", "bea", "dora"], "galeria", "1920-05-14")
    lista = relaciones(grafo, "ana")
    # Con Bea solo una, y también con Carla (solo en e1) y con Dora (solo en e2).
    for otra in ["bea", "carla", "dora", "galeria"]:
        encontradas = con(lista, otra)
        assert len(encontradas) == 1, otra
        assert encontradas[0]["idIntermedio"] == "e1"
        assert encontradas[0]["idsIntermediarios"] == ["e1", "e2"]
        assert encontradas[0]["participantes"] == 5
        assert encontradas[0]["participantesPorClase"] == {"PERSONA": 4, "ORGANIZACION": 1}
    # Desde quien solo está en el segundo registro sale la misma relación.
    assert con(relaciones(grafo, "dora"), "ana")[0]["id"] == con(lista, "dora")[0]["id"]


def test_con_la_deduplicacion_apagada_son_dos() -> None:
    grafo = crear_grafo()
    evento(grafo, "e1", ["Event", "Exposition"], ["ana", "bea"], "galeria", "1920-05-14")
    evento(grafo, "e2", ["Event", "Exposition"], ["ana", "bea"], "galeria", "1920-05-14")
    assert len(con(relaciones(grafo, "ana", False), "bea")) == 2
    assert len(con(relaciones(grafo, "ana", True), "bea")) == 1


def test_no_se_juntan_sin_dia_sin_lugar_o_si_algo_es_distinto() -> None:
    casos = [
        # (tipo, lugar y fecha del primero, tipo, lugar y fecha del segundo)
        (["Event", "Exposition"], "galeria", "1920", ["Event", "Exposition"], "galeria", "1920"),
        (["Event", "Exposition"], "galeria", "1920-05", ["Event", "Exposition"], "galeria", "1920-05"),
        (["Event", "Exposition"], None, "", ["Event", "Exposition"], None, ""),
        (["Event", "Exposition"], "galeria", "1920-05-14", ["Event", "Exposition"], "museo", "1920-05-14"),
        (["Event", "Exposition"], "galeria", "1920-05-14", ["Event", "Exposition"], "galeria", "1920-06-02"),
        (["Event", "Exposition"], "galeria", "1920-05-14", ["Event", "Wedding"], "galeria", "1920-05-14"),
        # Creation hereda de Event, pero no está en tiposCoincidencia (se compara el tipo exacto).
        (["Event", "Creation"], "galeria", "1920-05-14", ["Event", "Creation"], "galeria", "1920-05-14"),
    ]
    for caso in casos:
        grafo = crear_grafo()
        evento(grafo, "e1", caso[0], ["ana", "bea"], caso[1], caso[2])
        evento(grafo, "e2", caso[3], ["ana", "bea"], caso[4], caso[5])
        assert len(con(relaciones(grafo, "ana"), "bea")) == 2, str(caso)


def test_deduplicar_no_cambia_el_grafo() -> None:
    grafo = crear_grafo()
    evento(grafo, "e1", ["Event", "Exposition"], ["ana", "bea"], "galeria", "1920-05-14")
    evento(grafo, "e2", ["Event", "Exposition"], ["ana", "carla"], "galeria", "1920-05-14")
    repositorio = RepositorioSimulado(grafo, 0, cargar_configuracion())
    antes = repositorio.get_grafo()
    asyncio.run(repositorio.obtener_relaciones(["ana", "bea", "carla"]))
    assert repositorio.get_grafo() == antes
