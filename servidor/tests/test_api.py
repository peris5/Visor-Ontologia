"""Pruebas de la API con el cliente de pruebas de FastAPI.

El cliente hace peticiones al servidor sin arrancarlo de verdad (no hace
falta uvicorn). Al usarlo con "with", se ejecuta el ciclo de vida del
servidor: se crea el repositorio simulado al principio y se cierra al final.
Cada prueba arranca un servidor nuevo.
"""
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from servidor.api.cache_respuestas import CacheRespuestas
from servidor.app import app
from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.tests.utilidades import cargar_configuracion, cargar_datos_ejemplo

CAMPOS_RELACION = {"id", "idIntermedio", "origen", "destino", "tipo", "padres", "roles", "nombre", "periodo",
                   "lugar", "fecha", "participantes", "participantesPorClase", "via", "dibujable"}


@pytest.fixture
def cliente() -> Iterator[TestClient]:
    """Un cliente de pruebas con el servidor ya arrancado."""
    with TestClient(app) as cliente_de_pruebas:
        yield cliente_de_pruebas


def pedir_relaciones(cliente: TestClient, ids: list[str]) -> dict[str, Any]:
    """POST /api/relaciones con esos ids (la respuesta tiene que ser 200)."""
    respuesta = cliente.post("/api/relaciones", json={"ids": ids})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def entre(datos: dict[str, Any], id_uno: str, id_otro: str) -> list[dict[str, Any]]:
    """Las relaciones de la respuesta entre esas dos entidades."""
    resultado = []
    for relacion in datos["relaciones"]:
        extremos = [relacion["origen"], relacion["destino"]]
        if id_uno in extremos and id_otro in extremos:
            resultado.append(relacion)
    return resultado


def test_salud(cliente: TestClient) -> None:
    respuesta = cliente.get("/api/salud")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}


def test_configuracion_no_envia_lo_que_es_solo_del_servidor(cliente: TestClient) -> None:
    datos = cliente.get("/api/configuracion").json()
    assert set(datos.keys()) == {"umbralPorDefecto", "maxNodos", "nodosObjetivo", "entidadInicial", "idioma", "nombresTipos",
                                 "etiquetasEntidad", "origenDatos", "deduplicarEventos"}
    assert datos["origenDatos"] == "simulado"
    assert datos["deduplicarEventos"] is True
    assert datos["maxNodos"] == 150
    assert datos["entidadInicial"] == "n1"
    assert datos["nombresTipos"]["COINCIDENCIAS"] == "Coincidencias en eventos"
    for solo_del_servidor in ["pesosRelevancia", "etiquetasAuxiliares", "relacionesIgnoradas",
                              "maxParticipantesIntermediario", "maxParticipantesEvidencia"]:
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


def test_jerarquia_con_los_padres_de_las_entidades(cliente: TestClient) -> None:
    jerarquia = cliente.get("/api/jerarquia").json()
    assert jerarquia["Painter"] == ["Creator", "Person"]
    assert jerarquia["Creator"] == ["Person"]
    assert jerarquia["Person"] == []
    assert jerarquia["Paint"] == ["Creation", "Event"]


def test_nombres_con_etiquetas_y_propiedades_de_nombre(cliente: TestClient) -> None:
    nombres = cliente.get("/api/nombres").json()
    assert len(nombres) == 255
    assert nombres[0] == {"id": "n1", "etiquetas": ["Person", "Creator", "Painter"],
                          "propiedades": {"name": "Elena", "lastName": "Ferrando Peris"}}
    for entrada in nombres:
        assert set(entrada.keys()) == {"id", "etiquetas", "propiedades"}
        assert "dimensions" not in entrada["propiedades"]


def test_relaciones_con_el_formato_y_sin_relevancia(cliente: TestClient) -> None:
    datos = pedir_relaciones(cliente, ["n1"])
    assert set(datos.keys()) == {"ids", "entidades", "relaciones"}
    assert datos["ids"] == ["n1"]
    assert len(datos["relaciones"]) > 0
    for relacion in datos["relaciones"]:
        assert set(relacion.keys()) == CAMPOS_RELACION
        assert "n1" in [relacion["origen"], relacion["destino"]]
    ids_entidades = set()
    for entidad in datos["entidades"]:
        assert set(entidad.keys()) == {"id", "etiquetas", "propiedades"}
        ids_entidades.add(entidad["id"])
    for relacion in datos["relaciones"]:
        assert relacion["origen"] in ids_entidades
        assert relacion["destino"] in ids_entidades


def test_las_entidades_llegan_con_todas_sus_etiquetas(cliente: TestClient) -> None:
    datos = pedir_relaciones(cliente, ["ana_ferrer"])
    for entidad in datos["entidades"]:
        if entidad["id"] == "ana_ferrer":
            assert entidad["etiquetas"] == ["Person", "Creator", "Painter"]


def test_varias_entidades_en_una_peticion_sin_repetir_relaciones(cliente: TestClient) -> None:
    juntas = pedir_relaciones(cliente, ["ana_ferrer", "luis_peris", "ana_ferrer"])
    assert juntas["ids"] == ["ana_ferrer", "luis_peris"]
    ids = []
    for relacion in juntas["relaciones"]:
        assert relacion["id"] not in ids
        ids.append(relacion["id"])
    de_ana = pedir_relaciones(cliente, ["ana_ferrer"])["relaciones"]
    de_luis = pedir_relaciones(cliente, ["luis_peris"])["relaciones"]
    compartidas = len(entre(juntas, "ana_ferrer", "luis_peris"))
    assert len(ids) == len(de_ana) + len(de_luis) - compartidas


def test_mas_del_limite_para_dibujar_llega_como_evidencia(cliente: TestClient) -> None:
    # La exposición de 40 participantes de Ana y Marta: más de
    # maxParticipantesIntermediario (10) y no más de maxParticipantesEvidencia (200).
    datos = pedir_relaciones(cliente, ["ana_ferrer"])
    grandes = []
    for relacion in entre(datos, "ana_ferrer", "marta_soler"):
        if relacion["participantes"] == 40:
            grandes.append(relacion)
    assert len(grandes) == 1
    assert grandes[0]["dibujable"] is False
    assert grandes[0]["nombre"] == "Exposición colectiva de 1911 (40 artistas)"
    # Solo llegan las parejas de Ana, no las 40 × 39 / 2 de la exposición.
    de_la_exposicion = 0
    for relacion in datos["relaciones"]:
        if relacion["idIntermedio"] == grandes[0]["idIntermedio"]:
            de_la_exposicion = de_la_exposicion + 1
            assert "ana_ferrer" in [relacion["origen"], relacion["destino"]]
    assert de_la_exposicion == 39


def test_el_resto_lleva_dibujable_true(cliente: TestClient) -> None:
    for relacion in pedir_relaciones(cliente, ["ana_ferrer", "n1"])["relaciones"]:
        assert relacion["dibujable"] == (relacion["participantes"] <= 10)


def test_los_tipos_sin_relacion_no_generan_relaciones(cliente: TestClient) -> None:
    for relacion in pedir_relaciones(cliente, ["n1", "n2", "n3"])["relaciones"]:
        assert relacion["tipo"] not in ["Birth", "Death", "Live"]


def test_por_encima_del_limite_de_evidencia_no_llega() -> None:
    # Un evento con 201 personas (más de maxParticipantesEvidencia) y otro con 12.
    nodos = [{"id": "gran", "etiquetas": ["Event"], "propiedades": {}},
             {"id": "medio", "etiquetas": ["Event"], "propiedades": {}}]
    relaciones = []
    for indice in range(201):
        nodos.append({"id": "p" + str(indice), "etiquetas": ["Person"], "propiedades": {"name": "P" + str(indice)}})
        relaciones.append({"id": "r" + str(indice), "tipo": "PARTICIPATES_IN", "desde": "p" + str(indice),
                           "hasta": "gran", "propiedades": {}})
        if indice < 12:
            relaciones.append({"id": "m" + str(indice), "tipo": "PARTICIPATES_IN", "desde": "p" + str(indice),
                               "hasta": "medio", "propiedades": {}})
    grafo = {"jerarquia": {}, "nodos": nodos, "relaciones": relaciones}
    with TestClient(app) as cliente:
        app.state.repositorio = RepositorioSimulado(grafo, 0, cargar_configuracion())
        app.state.cache = CacheRespuestas(10, 60)
        datos = pedir_relaciones(cliente, ["p0"])
    intermediarios = set()
    for relacion in datos["relaciones"]:
        intermediarios.add(relacion["idIntermedio"])
        assert relacion["dibujable"] is False
        assert relacion["participantes"] == 12
    assert intermediarios == {"medio"}


def test_el_servidor_no_escribe_ninguna_relevancia(cliente: TestClient) -> None:
    repositorio = cliente.app.state.repositorio
    antes = repositorio.get_grafo()
    pedir_relaciones(cliente, ["n1", "ana_ferrer", "luis_peris"])
    cliente.get("/api/detalle/n1")
    despues = repositorio.get_grafo()
    assert despues == antes
    for elemento in despues["nodos"] + despues["relaciones"]:
        for clave in elemento["propiedades"]:
            assert not clave.startswith("relevance"), elemento["id"]


def test_escenario_de_ana_ferrer(cliente: TestClient) -> None:
    datos = pedir_relaciones(cliente, ["ana_ferrer", "luis_peris", "joaquin_mestre", "taller_valencia",
                                       "obra_huerta"])

    def tipos(id_uno: str, id_otro: str) -> list[Any]:
        lista = []
        for relacion in entre(datos, id_uno, id_otro):
            lista.append([relacion["tipo"], relacion["participantes"]])
        lista.sort()
        return lista

    assert tipos("ana_ferrer", "luis_peris") == [["Exposition", 4]] * 5 + [["Friendship", 2]]
    assert tipos("ana_ferrer", "marta_soler") == [["Exposition", 3], ["Exposition", 6], ["Exposition", 40]]
    assert tipos("ana_ferrer", "pedro_navarro") == [["Exposition", 12]]
    assert tipos("ana_ferrer", "joaquin_mestre") == [["Mentorship", 2]]
    assert tipos("ana_ferrer", "taller_valencia") == [["Employement", 2]]
    assert tipos("ana_ferrer", "obra_huerta") == [["Paint", 2]]
    assert tipos("luis_peris", "marta_soler") == [["Friendship", 2]]
    assert tipos("luis_peris", "pedro_navarro") == [["Marriage", 2]]
    assert tipos("luis_peris", "obra_retrato") == [["Paint", 2]]
    assert tipos("joaquin_mestre", "obra_paseo") == [["Paint", 2]]
    assert tipos("joaquin_mestre", "obra_tardia") == [["Paint", 2]]
    assert tipos("taller_valencia", "juan_ribes") == [["Employement", 2]]
    assert tipos("obra_huerta", "museo_ciudad") == [["Exposition", 2]]
    etiquetas = {}
    for entidad in datos["entidades"]:
        etiquetas[entidad["id"]] = entidad["etiquetas"]
    assert etiquetas["pedro_navarro"] == ["Person"]
    assert etiquetas["marta_soler"] == ["Person", "Creator", "Painter"]


def test_roles_y_periodos_llegan_en_bruto(cliente: TestClient) -> None:
    # La mentoría de Ana con Joaquín: los roles tal y como están en la base de
    # datos (el navegador los normaliza) y el periodo con sus textos.
    datos = pedir_relaciones(cliente, ["ana_ferrer", "joaquin_mestre"])
    mentorias = []
    for relacion in entre(datos, "ana_ferrer", "joaquin_mestre"):
        if relacion["tipo"] == "Mentorship":
            mentorias.append(relacion)
    assert len(mentorias) == 1
    assert mentorias[0]["roles"] == {"ana_ferrer": "aprendiz", "joaquin_mestre": "maestro"}
    assert mentorias[0]["periodo"]["from"] == "1900"
    assert mentorias[0]["periodo"]["to"] == "1910"
    anios = {}
    for relacion in datos["relaciones"]:
        extremos = [relacion["origen"], relacion["destino"]]
        if relacion["tipo"] == "Paint" and "joaquin_mestre" in extremos:
            extremos.remove("joaquin_mestre")
            anios[extremos[0]] = relacion["periodo"]["from"]
    assert anios == {"obra_paseo": "1905", "obra_tardia": "1945"}


def test_participantes_por_clase_y_vias_en_el_escenario_de_ana(cliente: TestClient) -> None:
    datos = pedir_relaciones(cliente, ["ana_ferrer", "obra_huerta"])
    taller = entre(datos, "ana_ferrer", "taller_valencia")[0]
    assert taller["via"] == {"ana_ferrer": "HAS_ROLE_IN", "taller_valencia": "OCURRED_AT"}
    assert taller["participantesPorClase"] == {"PERSONA": 1, "ORGANIZACION": 1}
    museo = entre(datos, "obra_huerta", "museo_ciudad")[0]
    assert museo["via"] == {"obra_huerta": "IS_EXPOSED", "museo_ciudad": "OCURRED_AT"}
    autoria = entre(datos, "ana_ferrer", "obra_huerta")[0]
    assert autoria["via"] == {"ana_ferrer": "PARTICIPATES_IN", "obra_huerta": "PRODUCED"}
    for relacion in entre(datos, "ana_ferrer", "luis_peris"):
        assert relacion["participantesPorClase"] == {"PERSONA": relacion["participantes"]}


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


def test_entidad_inexistente_da_404(cliente: TestClient) -> None:
    respuesta = cliente.post("/api/relaciones", json={"ids": ["n1", "P99"]})
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No existe la entidad P99"}
    # Un nodo que existe pero no es una entidad (una relación coworking) tampoco.
    assert cliente.post("/api/relaciones", json={"ids": ["n300"]}).status_code == 404


def test_peticiones_no_validas_dan_422(cliente: TestClient) -> None:
    assert cliente.post("/api/relaciones", json={"ids": []}).status_code == 422
    assert cliente.post("/api/relaciones", json={"ids": ["x" * 101]}).status_code == 422
    assert cliente.post("/api/relaciones", json={"ids": [""]}).status_code == 422
    assert cliente.post("/api/relaciones", json={"otro": ["n1"]}).status_code == 422
    demasiados = []
    for indice in range(201):
        demasiados.append("n" + str(indice + 1))
    assert cliente.post("/api/relaciones", json={"ids": demasiados}).status_code == 422


def test_las_respuestas_cacheables_lo_dicen(cliente: TestClient) -> None:
    for ruta in ["/api/nombres", "/api/tipos", "/api/jerarquia", "/api/configuracion", "/api/detalle/n1"]:
        assert "max-age=" in cliente.get(ruta).headers["cache-control"]


def test_las_rutas_antiguas_ya_no_existen(cliente: TestClient) -> None:
    assert cliente.get("/api/subgrafo/n1").status_code == 404
    assert cliente.get("/api/entidades").status_code == 404
    assert cliente.get("/api/vecindario/n1").status_code == 404


def test_los_datos_de_ejemplo_tienen_255_entidades() -> None:
    entidades = 0
    for nodo in cargar_datos_ejemplo()["nodos"]:
        for etiqueta in ["Person", "Organization", "HeritageItem"]:
            if etiqueta in nodo["etiquetas"]:
                entidades = entidades + 1
    assert entidades == 255
