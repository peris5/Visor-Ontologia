"""Pruebas de RepositorioSimulado.obtener_vecindario (servidor/datos/).

Mini grafo de prueba (valor de cada relación entre paréntesis):

    C ──(0.9)──▶ A ──(0.7)──▶ D ──(0.6)──▶ E        (cadena de 3 saltos)
    B ──(0.8)──▶ C                                  (C es el DESTINO)
    C ──(0.2)──▶ L                                  (por debajo del umbral)
    A ──(0.3)──▶ M                                  (igual al umbral: no lo supera)
    L ──(0.9)──▶ X                                  (solo se llega por L)
    N                                               (sin relaciones)

Con umbral 0.3 desde C se llega a A, B, D y E; no a L, M, X ni N.
"""
import asyncio

import pytest

from servidor.datos.repositorio_simulado import RepositorioSimulado
from servidor.modelo.vecindario import Vecindario
from servidor.tests.utilidades import cargar_datos_ejemplo

# Entidades que tenía el subgrafo del incremento 2 (calculado en el servidor
# con ConstructorSubgrafo, máximo 150 nodos) para cada entidad y umbral.
# Se calcularon antes de borrar ConstructorSubgrafo de Python.
SUBGRAFOS_DEL_INCREMENTO_2: dict[str, list[str]] = {
    "p01|0.3": [  # 150 entidades
        "a01", "a02", "a03", "a04", "a06", "a07", "a08", "a09", "a10", "a107", "a109", "a11",
        "a110", "a112", "a114", "a116", "a12", "a13", "a139", "a14", "a148", "a15", "a156",
        "a158", "a16", "a17", "a177", "a18", "a182", "a19", "a20", "a209", "a21", "a210",
        "a211", "a212", "a213", "a214", "a215", "a216", "a218", "a219", "a22", "a220", "a221",
        "a223", "a224", "a225", "a23", "a24", "a25", "a26", "a27", "a28", "a29", "a30", "a31",
        "a32", "a34", "a37", "a38", "a39", "a40", "a41", "a42", "a43", "a44", "a45", "a65",
        "a70", "a77", "a78", "a79", "a88", "a89", "o01", "o02", "o03", "o04", "o05", "o06",
        "o08", "o10", "o13", "o14", "o16", "o17", "o19", "o20", "o21", "o22", "p01", "p02",
        "p03", "p04", "p07", "p08", "p09", "p10", "p100", "p107", "p108", "p109", "p11", "p110",
        "p111", "p112", "p113", "p114", "p115", "p116", "p118", "p119", "p12", "p120", "p122",
        "p123", "p13", "p14", "p15", "p16", "p17", "p18", "p19", "p20", "p21", "p22", "p23",
        "p24", "p25", "p36", "p38", "p40", "p41", "p42", "p45", "p55", "p56", "p57", "p58",
        "p59", "p60", "p61", "p63", "p81", "p87", "p90", "p91", "p92", "p96"
    ],
    "p01|0.5": [  # 86 entidades
        "a01", "a02", "a03", "a06", "a07", "a08", "a09", "a10", "a107", "a11", "a12", "a13",
        "a14", "a15", "a16", "a17", "a18", "a182", "a19", "a20", "a209", "a21", "a210", "a211",
        "a212", "a213", "a215", "a22", "a225", "a23", "a24", "a25", "a26", "a27", "a28", "a29",
        "a30", "a40", "a41", "a89", "o02", "o03", "o04", "o05", "o06", "o08", "o16", "o22",
        "p01", "p02", "p03", "p04", "p07", "p08", "p09", "p10", "p107", "p108", "p109", "p11",
        "p110", "p112", "p113", "p114", "p115", "p119", "p12", "p123", "p13", "p14", "p15",
        "p16", "p17", "p18", "p20", "p21", "p22", "p23", "p24", "p25", "p36", "p41", "p55",
        "p56", "p58", "p59"
    ],
    "o01|0.3": [  # 150 entidades
        "a01", "a02", "a04", "a06", "a100", "a101", "a102", "a113", "a13", "a137", "a138",
        "a141", "a15", "a156", "a157", "a158", "a16", "a161", "a162", "a176", "a181", "a184",
        "a186", "a187", "a194", "a195", "a196", "a198", "a199", "a20", "a200", "a201", "a202",
        "a204", "a205", "a206", "a207", "a208", "a209", "a217", "a220", "a221", "a222", "a23",
        "a24", "a26", "a31", "a32", "a39", "a40", "a45", "a56", "a59", "a60", "a61", "a64",
        "a65", "a67", "a69", "a70", "a74", "a75", "a76", "a77", "a78", "a79", "a80", "a83",
        "a87", "a88", "a91", "o01", "o02", "o03", "o05", "o06", "o08", "o13", "o14", "o15",
        "o17", "o22", "p01", "p02", "p03", "p04", "p05", "p08", "p09", "p10", "p100", "p101",
        "p102", "p103", "p104", "p105", "p106", "p107", "p108", "p11", "p111", "p112", "p115",
        "p119", "p12", "p120", "p123", "p126", "p13", "p14", "p15", "p16", "p17", "p18", "p19",
        "p22", "p23", "p26", "p33", "p34", "p36", "p38", "p39", "p40", "p41", "p42", "p43",
        "p44", "p45", "p46", "p49", "p51", "p52", "p55", "p58", "p71", "p80", "p81", "p82",
        "p83", "p84", "p90", "p91", "p92", "p93", "p94", "p95", "p96", "p97", "p98"
    ],
    "a01|0.4": [  # 105 entidades
        "a01", "a02", "a03", "a06", "a07", "a08", "a09", "a10", "a105", "a107", "a11", "a116",
        "a12", "a13", "a14", "a15", "a156", "a16", "a17", "a18", "a182", "a19", "a20", "a209",
        "a21", "a210", "a211", "a212", "a213", "a214", "a215", "a22", "a225", "a23", "a24",
        "a25", "a26", "a27", "a28", "a29", "a30", "a32", "a34", "a37", "a38", "a39", "a40",
        "a41", "a42", "a43", "a44", "a45", "a89", "o01", "o02", "o03", "o04", "o05", "o06",
        "o08", "o16", "o17", "o19", "o20", "o22", "p01", "p02", "p03", "p04", "p07", "p08",
        "p09", "p10", "p107", "p108", "p109", "p11", "p110", "p112", "p113", "p114", "p115",
        "p119", "p12", "p120", "p123", "p13", "p14", "p15", "p16", "p17", "p18", "p19", "p20",
        "p21", "p22", "p23", "p24", "p25", "p36", "p41", "p55", "p56", "p58", "p59"
    ],
}


def crear_datos_prueba() -> dict:
    """El mini grafo de arriba."""
    return {
        "entidades": [
            {"id": "C", "tipo": "PERSONA", "nombre": "Central"},
            {"id": "A", "tipo": "PERSONA", "nombre": "Alumna"},
            {"id": "B", "tipo": "ORGANIZACION", "nombre": "Banda"},
            {"id": "D", "tipo": "OBRA_DE_ARTE", "nombre": "Dibujo"},
            {"id": "E", "tipo": "OBRA_DE_ARTE", "nombre": "Escultura"},
            {"id": "L", "tipo": "ORGANIZACION", "nombre": "Liga"},
            {"id": "M", "tipo": "PERSONA", "nombre": "Mario"},
            {"id": "X", "tipo": "PERSONA", "nombre": "Xavier"},
            {"id": "N", "tipo": "PERSONA", "nombre": "Nadie"},
        ],
        "relaciones": [
            ["r1", "C", "A", "maestro_de", 0.9],
            ["r2", "B", "C", "miembro_de", 0.8],
            ["r3", "A", "D", "autor_de", 0.7],
            ["r4", "D", "E", "inspira", 0.6],
            ["r5", "C", "L", "miembro_de", 0.2],
            ["r6", "A", "M", "pareja_de", 0.3],
            ["r7", "L", "X", "miembro_de", 0.9],
        ],
    }


def pedir_vecindario(id_entidad: str, umbral: float, max_entidades: int) -> Vecindario:
    """Vecindario del mini grafo."""
    repositorio = RepositorioSimulado(crear_datos_prueba(), 0)
    return asyncio.run(repositorio.obtener_vecindario(id_entidad, umbral, max_entidades))


def ids_de(lista: list) -> list[str]:
    """Ids de una lista de entidades o de relaciones."""
    ids = []
    for elemento in lista:
        ids.append(elemento.get_id())
    return ids


def test_contiene_la_entidad_central() -> None:
    vecindario = pedir_vecindario("C", 0.3, 2000)
    assert "C" in ids_de(vecindario.entidades)


def test_solo_relaciones_con_valor_mayor_que_el_umbral() -> None:
    vecindario = pedir_vecindario("C", 0.3, 2000)
    for relacion in vecindario.relaciones:
        assert relacion.get_valor() > 0.3
    ids_relaciones = ids_de(vecindario.relaciones)
    assert "r5" not in ids_relaciones  # 0.2
    assert "r6" not in ids_relaciones  # 0.3 no supera 0.3
    ids_entidades = ids_de(vecindario.entidades)
    assert "L" not in ids_entidades
    assert "M" not in ids_entidades
    assert "X" not in ids_entidades  # solo se llega por una relación que no supera el umbral
    assert "N" not in ids_entidades


def test_sigue_las_relaciones_en_los_dos_sentidos() -> None:
    vecindario = pedir_vecindario("C", 0.3, 2000)
    # En r2 la central es el DESTINO (B → C), y aun así se llega a B.
    assert "B" in ids_de(vecindario.entidades)
    assert "r2" in ids_de(vecindario.relaciones)
    # Y desde E (final de la cadena) se llega hasta C yendo "hacia atrás".
    desde_e = pedir_vecindario("E", 0.3, 2000)
    assert "C" in ids_de(desde_e.entidades)


def test_llega_a_varios_saltos() -> None:
    vecindario = pedir_vecindario("C", 0.3, 2000)
    assert sorted(ids_de(vecindario.entidades)) == ["A", "B", "C", "D", "E"]
    assert sorted(ids_de(vecindario.relaciones)) == ["r1", "r2", "r3", "r4"]
    assert vecindario.recortado is False


def test_se_para_en_max_entidades_y_marca_recortado() -> None:
    vecindario = pedir_vecindario("C", 0.3, 3)
    assert len(vecindario.entidades) == 3
    assert vecindario.recortado is True
    # En anchura: primero los vecinos directos de C (A y B).
    assert sorted(ids_de(vecindario.entidades)) == ["A", "B", "C"]
    # Ninguna relación apunta a una entidad que se ha quedado fuera.
    ids_entidades = ids_de(vecindario.entidades)
    for relacion in vecindario.relaciones:
        assert relacion.get_origen().get_id() in ids_entidades
        assert relacion.get_destino().get_id() in ids_entidades


def test_si_cabe_todo_no_esta_recortado() -> None:
    vecindario = pedir_vecindario("C", 0.3, 5)
    assert len(vecindario.entidades) == 5
    assert vecindario.recortado is False


def test_entidad_inexistente_da_error() -> None:
    with pytest.raises(ValueError):
        pedir_vecindario("no_existe", 0.3, 2000)


def test_respeta_el_orden_de_los_datos() -> None:
    vecindario = pedir_vecindario("C", 0.3, 2000)
    assert ids_de(vecindario.entidades) == ["C", "A", "B", "D", "E"]
    assert ids_de(vecindario.relaciones) == ["r1", "r2", "r3", "r4"]


@pytest.mark.parametrize("clave", list(SUBGRAFOS_DEL_INCREMENTO_2.keys()))
def test_contiene_todas_las_entidades_del_subgrafo_del_incremento_2(clave: str) -> None:
    partes = clave.split("|")
    id_entidad = partes[0]
    umbral = float(partes[1])
    repositorio = RepositorioSimulado(cargar_datos_ejemplo(), 0)
    vecindario = asyncio.run(repositorio.obtener_vecindario(id_entidad, umbral, 2000))
    ids_del_vecindario = set(ids_de(vecindario.entidades))
    for id_esperado in SUBGRAFOS_DEL_INCREMENTO_2[clave]:
        assert id_esperado in ids_del_vecindario, "falta " + id_esperado + " en el vecindario de " + clave
    assert vecindario.recortado is False
