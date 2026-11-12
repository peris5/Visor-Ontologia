"""Pruebas de RelevanciaPorTipo (servidor/logica/)."""
import pytest

from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.logica.estrategia_relevancia import EstrategiaRelevancia
from servidor.logica.relevancia_por_tipo import RelevanciaPorTipo
from servidor.tests.utilidades import cargar_configuracion


def crear_estrategia() -> RelevanciaPorTipo:
    """Con los pesos de configuracion.json y una jerarquía pequeña."""
    jerarquia = {"Marriage": "Related", "Related": "Relationship", "Apprenticeship": "Professional",
                 "Professional": "Relationship", "Paint": "Creation", "Creation": "Event",
                 "Nuevo": "SinPeso"}
    configuracion = cargar_configuracion()
    return RelevanciaPorTipo(configuracion, ClasificadorEtiquetas(configuracion, jerarquia))


def test_peso_del_tipo() -> None:
    estrategia = crear_estrategia()
    assert estrategia.calcular_relevancia("Marriage") == 0.95
    assert estrategia.calcular_relevancia("Employement") == 0.60
    assert estrategia.calcular_relevancia("Event") == 0.40


def test_peso_del_padre_mas_cercano() -> None:
    estrategia = crear_estrategia()
    # Apprenticeship no tiene peso: recibe el de Professional (no el de Relationship).
    assert estrategia.calcular_relevancia("Apprenticeship") == 0.55
    assert estrategia.calcular_relevancia("Paint") == 0.90


def test_peso_por_defecto() -> None:
    estrategia = crear_estrategia()
    assert estrategia.calcular_relevancia("STUDENT_OF") == 0.5
    assert estrategia.calcular_relevancia("Nuevo") == 0.5


def test_la_interfaz_no_se_puede_instanciar() -> None:
    with pytest.raises(TypeError):
        EstrategiaRelevancia()
