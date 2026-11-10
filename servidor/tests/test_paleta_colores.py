"""Pruebas de PaletaColores (las mismas que tests/pruebasPaletaColores.js)."""
import re

import pytest

from servidor.logica.paleta_colores import PaletaColores

FORMATO_DE_COLOR = re.compile(r"^#[0-9a-f]{6}$")


def test_los_colores_tienen_el_formato_rrggbb() -> None:
    for indice in range(50):
        color = PaletaColores.color_para(indice)
        assert FORMATO_DE_COLOR.match(color), "color del índice " + str(indice) + ": " + color


def test_indices_distintos_dan_colores_distintos() -> None:
    colores_vistos = []
    for indice in range(50):
        color = PaletaColores.color_para(indice)
        assert color not in colores_vistos, "el color " + color + " del índice " + str(indice) + " está repetido"
        colores_vistos.append(color)


def test_la_asignacion_es_determinista() -> None:
    ids = ["maestro_de", "pareja", "autor_de"]
    primera_vez = PaletaColores.asignar(ids)
    segunda_vez = PaletaColores.asignar(ids)
    for id_tipo in ids:
        assert primera_vez[id_tipo] == segunda_vez[id_tipo]
    assert primera_vez["maestro_de"] == PaletaColores.color_para(0)


def test_un_indice_no_valido_da_error() -> None:
    with pytest.raises(ValueError):
        PaletaColores.color_para(-1)


def test_mismos_colores_que_en_javascript() -> None:
    # Valores calculados con PaletaColores.js del incremento 1: así sabemos
    # que la traducción a Python da exactamente los mismos colores.
    colores_de_javascript = ["#b62020", "#2fda61", "#a95ae2", "#b6a320",
                             "#2fbeda", "#e25aa4", "#45b620", "#362fda"]
    for indice in range(len(colores_de_javascript)):
        assert PaletaColores.color_para(indice) == colores_de_javascript[indice]
