"""Pruebas de RelevanciaDesdeBD (las mismas que tests/pruebasRelevancia.js)."""
from typing import Any

import pytest

from servidor.logica.estrategia_relevancia import EstrategiaRelevancia
from servidor.logica.relevancia_desde_bd import RelevanciaDesdeBD
from servidor.modelo.persona import Persona
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_relacion import TipoRelacion


def crear_relacion_con_valor(valor: Any) -> Relacion:
    """Una relación cualquiera con el valor indicado."""
    origen = Persona({"id": "o"})
    destino = Persona({"id": "d"})
    tipo = TipoRelacion("pareja", "Pareja", "#000000")
    return Relacion("r", origen, destino, tipo, valor)


def test_la_de_una_relacion_es_el_valor_de_la_bd() -> None:
    estrategia = RelevanciaDesdeBD()
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor(0.7)) == 0.7
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor(0)) == 0
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor(1)) == 1


def test_la_de_un_nodo_es_el_producto() -> None:
    estrategia = RelevanciaDesdeBD()
    assert estrategia.calcular_relevancia_nodo(0.9, 0.5) == pytest.approx(0.45)
    assert estrategia.calcular_relevancia_nodo(1, 0.8) == pytest.approx(0.8)


def test_los_valores_fuera_de_rango_se_acotan() -> None:
    estrategia = RelevanciaDesdeBD()
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor(1.4)) == 1
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor(-0.2)) == 0
    assert estrategia.calcular_relevancia_relacion(crear_relacion_con_valor("hola")) == 0


def test_la_interfaz_no_se_puede_instanciar() -> None:
    with pytest.raises(TypeError):
        EstrategiaRelevancia()
