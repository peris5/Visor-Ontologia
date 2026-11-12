"""Pruebas de los datos de ejemplo y de su generador (servidor/datos/)."""
import json
from typing import Any

from servidor.datos.generar_datos_ejemplo import (ARCHIVO_VECINDARIO_PRUEBAS, GeneradorDatosEjemplo,
                                                  convertir_a_texto, vecindario_de_pruebas)
from servidor.tests.utilidades import ARCHIVO_DATOS_EJEMPLO, ARCHIVO_DISENO


def leer_diseno() -> dict[str, Any]:
    """Etiquetas, tipos de relación y propiedades del diseño de arrows.app.

    Del diseño se quitan los espacios del final ('Death ') y el tipo que
    arrows.app añade a algunas propiedades ('coordinates:point' →
    'coordinates'). En Event, los nombres aparecen como etiquetas (seguramente
    por error, ver ANALISIS_BD_NEO4J.md §7): se cuentan como propiedades.
    """
    with open(ARCHIVO_DISENO, encoding="utf-8") as archivo:
        grafo = json.load(archivo)["graph"]
    etiquetas: set[str] = set()
    propiedades_de_nodos: set[str] = set()
    tipos: set[str] = set()
    propiedades_de_relaciones: set[str] = set()
    for nodo in grafo["nodes"]:
        etiquetas.add(nodo["caption"].strip())
        for clave in nodo["properties"]:
            propiedades_de_nodos.add(clave.split(":")[0].strip())
        for etiqueta_como_propiedad in nodo["labels"]:
            propiedades_de_nodos.add(etiqueta_como_propiedad.strip())
    for relacion in grafo["relationships"]:
        tipos.add(relacion["type"].strip())
        for clave in relacion["properties"]:
            propiedades_de_relaciones.add(clave.strip())
    return {"etiquetas": etiquetas, "propiedades_nodos": propiedades_de_nodos, "tipos": tipos,
            "propiedades_relaciones": propiedades_de_relaciones}


def leer_datos() -> dict[str, Any]:
    """Los datos de ejemplo tal como están en el archivo."""
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        return json.load(archivo)


def test_el_generador_da_siempre_lo_mismo_y_coincide_con_el_archivo() -> None:
    primera = convertir_a_texto(GeneradorDatosEjemplo().generar())
    segunda = convertir_a_texto(GeneradorDatosEjemplo().generar())
    assert primera == segunda
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        assert archivo.read() == primera


def test_no_hay_ninguna_relevancia() -> None:
    datos = leer_datos()
    for elemento in datos["nodos"] + datos["relaciones"]:
        for clave in elemento["propiedades"]:
            assert not clave.startswith("relevance"), elemento["id"]


def test_todo_existe_en_el_diseno_salvo_lo_marcado_como_de_prueba() -> None:
    diseno = leer_diseno()
    datos = leer_datos()
    for nodo in datos["nodos"]:
        for etiqueta in nodo["etiquetas"]:
            if etiqueta not in diseno["etiquetas"]:
                assert "_comentario" in nodo, "etiqueta que no está en el diseño: " + etiqueta
        for clave in nodo["propiedades"]:
            assert clave in diseno["propiedades_nodos"], "propiedad que no está en el diseño: " + clave
    for relacion in datos["relaciones"]:
        if relacion["tipo"] not in diseno["tipos"]:
            assert "_comentario" in relacion, "relación que no está en el diseño: " + relacion["tipo"]
        for clave in relacion["propiedades"]:
            assert clave in diseno["propiedades_relaciones"], "propiedad que no está en el diseño: " + clave
    for etiqueta in datos["jerarquia"]:
        if not etiqueta.startswith("_"):
            assert datos["jerarquia"][etiqueta] in diseno["etiquetas"]


def test_los_elementos_de_prueba_estan_marcados() -> None:
    datos = leer_datos()
    marcados_nodos = 0
    for nodo in datos["nodos"]:
        if "Apprenticeship" in nodo["etiquetas"]:
            assert "_comentario" in nodo
            marcados_nodos = marcados_nodos + 1
    marcados_relaciones = 0
    for relacion in datos["relaciones"]:
        if relacion["tipo"] == "STUDENT_OF":
            assert "_comentario" in relacion
            marcados_relaciones = marcados_relaciones + 1
    assert marcados_nodos > 0
    assert marcados_relaciones > 0


def test_todas_las_relaciones_apuntan_a_nodos_que_existen() -> None:
    datos = leer_datos()
    ids = set()
    for nodo in datos["nodos"]:
        assert nodo["id"] not in ids
        ids.add(nodo["id"])
    for relacion in datos["relaciones"]:
        assert relacion["desde"] in ids
        assert relacion["hasta"] in ids


def test_tamano_de_los_datos() -> None:
    contador = {"Person": 0, "Organization": 0, "HeritageItem": 0, "Ubication": 0}
    for nodo in leer_datos()["nodos"]:
        for etiqueta in contador:
            if etiqueta in nodo["etiquetas"]:
                contador[etiqueta] = contador[etiqueta] + 1
    assert contador == {"Person": 120, "Organization": 25, "HeritageItem": 60, "Ubication": 15}


def test_el_vecindario_de_las_pruebas_del_navegador_esta_al_dia() -> None:
    # Si falla: .venv\Scripts\python.exe -m servidor.datos.generar_datos_ejemplo
    esperado = vecindario_de_pruebas(GeneradorDatosEjemplo().generar())
    with open(ARCHIVO_VECINDARIO_PRUEBAS, encoding="utf-8") as archivo:
        assert archivo.read() == esperado
