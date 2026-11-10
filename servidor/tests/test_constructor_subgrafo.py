"""Pruebas de ConstructorSubgrafo (las mismas que tests/pruebasConstructorSubgrafo.js).

Mini grafo de prueba (valores de cada relación entre paréntesis):

  C ──maestro_de (0.9)──── A ──miembro_de (0.3)── B
  C ──colaborador_de (0.5)─ A            (dos relaciones entre C y A)
  C ──pareja_de (0.9)───── Y ──maestro_de (0.9)── V ──autor_de (0.5)── W ──autor_de (0.6)── Z
  C ──autor_de (0.4)────── V             (camino directo, peor que C→Y→V)
  C ──miembro_de (0.2)──── L             (por debajo del umbral)

Con umbral 0.3 el resultado esperado es:
  C = 1 (nivel 0), A = 0.9 (nivel 1), Y = 0.9 (nivel 1),
  V = 0.9 × 0.9 = 0.81 (nivel 2), W = 0.81 × 0.5 = 0.405 (nivel 3).
  Quedan fuera: B (0.27), Z (0.243) y L (0.2).
"""
import asyncio
import math
from typing import Any

import pytest

from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.logica.constructor_subgrafo import ConstructorSubgrafo
from servidor.logica.relevancia_desde_bd import RelevanciaDesdeBD
from servidor.modelo.subgrafo import Subgrafo
from servidor.tests.utilidades import cargar_datos_ejemplo


def crear_datos_prueba() -> dict[str, Any]:
    """Datos del mini grafo."""
    return {
        "entidades": [
            {"id": "C", "tipo": "PERSONA", "nombre": "Central"},
            {"id": "A", "tipo": "PERSONA", "nombre": "Alumna"},
            {"id": "B", "tipo": "ORGANIZACION", "nombre": "Banda"},
            {"id": "Y", "tipo": "PERSONA", "nombre": "Yolanda"},
            {"id": "V", "tipo": "PERSONA", "nombre": "Vicente"},
            {"id": "W", "tipo": "OBRA_DE_ARTE", "nombre": "Obra W"},
            {"id": "Z", "tipo": "OBRA_DE_ARTE", "nombre": "Obra Z"},
            {"id": "L", "tipo": "ORGANIZACION", "nombre": "Liga"},
        ],
        "relaciones": [
            ["r1", "C", "A", "maestro_de", 0.9],
            ["r2", "C", "A", "colaborador_de", 0.5],
            ["r3", "C", "Y", "pareja_de", 0.9],
            ["r4", "Y", "V", "maestro_de", 0.9],
            ["r5", "C", "V", "autor_de", 0.4],
            ["r6", "V", "W", "autor_de", 0.5],
            ["r7", "C", "L", "miembro_de", 0.2],
            ["r8", "A", "B", "miembro_de", 0.3],
            ["r9", "W", "Z", "autor_de", 0.6],
        ],
    }


def construir(datos: dict[str, Any], umbral: float, max_nodos: int, id_central: str) -> Subgrafo:
    """Crea un constructor con un repositorio sin retardo y construye el subgrafo."""
    repositorio = RepositorioSimulado(datos, 0)
    constructor = ConstructorSubgrafo(repositorio, RelevanciaDesdeBD(), umbral, max_nodos)
    return asyncio.run(constructor.construir(id_central))


def ids_de_relaciones(subgrafo: Subgrafo) -> list[str]:
    """Ids de las relaciones del subgrafo."""
    ids = []
    for relacion in subgrafo.get_relaciones():
        ids.append(relacion.get_id())
    return ids


def test_la_central_tiene_relevancia_1_y_nivel_0() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 150, "C")
    nodo_central = subgrafo.get_nodo("C")
    assert subgrafo.get_entidad_central().get_id() == "C"
    assert nodo_central.get_relevancia() == 1
    assert nodo_central.get_nivel() == 0


def test_nodos_relevancias_y_niveles_esperados() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 150, "C")
    assert subgrafo.get_numero_nodos() == 5
    assert subgrafo.get_nodo("A").get_relevancia() == pytest.approx(0.9)
    assert subgrafo.get_nodo("Y").get_relevancia() == pytest.approx(0.9)
    assert subgrafo.get_nodo("W").get_relevancia() == pytest.approx(0.405)
    assert subgrafo.get_nodo("W").get_nivel() == 3
    assert subgrafo.contiene_entidad("B") is False
    assert subgrafo.contiene_entidad("Z") is False
    assert subgrafo.contiene_entidad("L") is False


def test_un_nodo_entra_con_su_mejor_relevancia() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 150, "C")
    nodo_v = subgrafo.get_nodo("V")
    # Directo C→V daría 0.4; por C→Y→V da 0.81, que es mejor.
    assert nodo_v.get_relevancia() == pytest.approx(0.81)
    assert nodo_v.get_nivel() == 2


def test_hay_nodos_de_nivel_2_o_mas() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 150, "C")
    hay_nivel_dos_o_mas = False
    for nodo in subgrafo.get_nodos():
        if nodo.get_nivel() >= 2:
            hay_nivel_dos_o_mas = True
    assert hay_nivel_dos_o_mas


def test_ningun_nodo_ni_relacion_por_debajo_del_umbral() -> None:
    for umbral in [0.1, 0.3, 0.5, 0.7]:
        subgrafo = construir(cargar_datos_ejemplo(), umbral, 150, "p01")
        for nodo in subgrafo.get_nodos():
            if nodo.get_entidad().get_id() != "p01":
                assert nodo.get_relevancia() > umbral
        for relacion in subgrafo.get_relaciones():
            assert relacion.get_relevancia() > umbral


def test_las_relaciones_solo_unen_nodos_del_subgrafo() -> None:
    subgrafo = construir(cargar_datos_ejemplo(), 0.3, 150, "p01")
    for relacion in subgrafo.get_relaciones():
        assert subgrafo.contiene_entidad(relacion.get_origen().get_id())
        assert subgrafo.contiene_entidad(relacion.get_destino().get_id())


def test_se_guardan_todas_las_relaciones_que_superan_el_umbral() -> None:
    ids = ids_de_relaciones(construir(crear_datos_prueba(), 0.3, 150, "C"))
    assert len(ids) == 6
    assert "r5" in ids, "debe incluir r5 (C–V, 0.4), aunque V entrara por otro camino"
    assert "r8" not in ids, "no debe incluir r8 (0.3 no supera 0.3)"


def test_se_conservan_las_relaciones_multiples_entre_un_par() -> None:
    ids = ids_de_relaciones(construir(crear_datos_prueba(), 0.3, 150, "C"))
    assert "r1" in ids
    assert "r2" in ids


def test_nunca_mas_de_max_nodos_y_se_conservan_los_mas_relevantes() -> None:
    completo = construir(cargar_datos_ejemplo(), 0.1, 150, "p01")
    for max_nodos in [1, 2, 3, 5, 8]:
        limitado = construir(cargar_datos_ejemplo(), 0.1, max_nodos, "p01")
        assert limitado.get_numero_nodos() <= max_nodos

        # La relevancia más baja que se ha quedado dentro...
        menor_dentro = 1.0
        for nodo in limitado.get_nodos():
            if nodo.get_relevancia() < menor_dentro:
                menor_dentro = nodo.get_relevancia()
        # ...tiene que ser mayor o igual que la de cualquier nodo que se ha quedado fuera.
        for nodo in completo.get_nodos():
            if not limitado.contiene_entidad(nodo.get_entidad().get_id()):
                assert nodo.get_relevancia() <= menor_dentro


def test_con_max_nodos_3_quedan_c_a_e_y() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 3, "C")
    assert subgrafo.get_numero_nodos() == 3
    assert subgrafo.contiene_entidad("A")
    assert subgrafo.contiene_entidad("Y")


def test_al_subir_el_umbral_el_subgrafo_no_crece() -> None:
    nodos_anteriores = math.inf
    relaciones_anteriores = math.inf
    for paso in range(21):
        umbral = paso * 0.05
        subgrafo = construir(cargar_datos_ejemplo(), umbral, 150, "p01")
        numero_de_nodos = subgrafo.get_numero_nodos()
        numero_de_relaciones = len(subgrafo.get_relaciones())
        assert numero_de_nodos <= nodos_anteriores
        assert numero_de_relaciones <= relaciones_anteriores
        nodos_anteriores = numero_de_nodos
        relaciones_anteriores = numero_de_relaciones


def test_los_datos_de_ejemplo_tienen_caminos_de_3_o_mas_saltos() -> None:
    subgrafo = construir(cargar_datos_ejemplo(), 0.3, 150, "p01")
    nivel_maximo = 0
    for nodo in subgrafo.get_nodos():
        if nodo.get_nivel() > nivel_maximo:
            nivel_maximo = nodo.get_nivel()
    assert nivel_maximo >= 3


def test_la_centralidad_se_guarda_en_los_nodos() -> None:
    subgrafo = construir(crear_datos_prueba(), 0.3, 150, "C")
    maximo = 0.0
    for nodo in subgrafo.get_nodos():
        if nodo.get_centralidad() > maximo:
            maximo = nodo.get_centralidad()
    assert maximo == 1


def test_error_con_una_entidad_inexistente() -> None:
    with pytest.raises(ValueError) as informacion:
        construir(crear_datos_prueba(), 0.3, 150, "no_existe")
    assert "no_existe" in str(informacion.value)


def test_set_umbral_rechaza_valores_no_validos() -> None:
    repositorio = RepositorioSimulado(crear_datos_prueba(), 0)
    constructor = ConstructorSubgrafo(repositorio, RelevanciaDesdeBD(), 0.3, 150)
    for valor_no_valido in [-0.1, 1.1, math.nan, "0.5", None]:
        with pytest.raises(ValueError):
            constructor.set_umbral(valor_no_valido)
    assert constructor.get_umbral() == 0.3
    constructor.set_umbral(0.5)
    assert constructor.get_umbral() == 0.5
