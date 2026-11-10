"""Pruebas de CalculadorCentralidad (las mismas que tests/pruebasCentralidad.js).

Subgrafo hecho a mano:
  A ──0.5── B ──0.5── C        D (sin relaciones)

Sumas: A = 0.5, B = 1.0, C = 0.5, D = 0.  Máximo = 1.0
Centralidad: A = 0.5, B = 1, C = 0.5, D = 0
"""
from servidor.logica.calculador_centralidad import CalculadorCentralidad
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.persona import Persona
from servidor.modelo.relacion import Relacion
from servidor.modelo.subgrafo import Subgrafo
from servidor.modelo.tipo_relacion import TipoRelacion


def test_valores_exactos_en_un_subgrafo_hecho_a_mano() -> None:
    entidad_a = Persona({"id": "A"})
    entidad_b = Persona({"id": "B"})
    entidad_c = Persona({"id": "C"})
    entidad_d = Persona({"id": "D"})
    tipo = TipoRelacion("pareja", "Pareja", "#000000")

    subgrafo = Subgrafo(entidad_a, 0.3)
    subgrafo.agregar_nodo(NodoRelevante(entidad_b, 0.5, 1))
    subgrafo.agregar_nodo(NodoRelevante(entidad_c, 0.25, 2))
    subgrafo.agregar_nodo(NodoRelevante(entidad_d, 0.4, 1))
    subgrafo.agregar_relacion(Relacion("r1", entidad_a, entidad_b, tipo, 0.5))
    subgrafo.agregar_relacion(Relacion("r2", entidad_b, entidad_c, tipo, 0.5))

    centralidad = CalculadorCentralidad().calcular(subgrafo)

    assert centralidad["A"] == 0.5
    assert centralidad["B"] == 1
    assert centralidad["C"] == 0.5
    assert centralidad["D"] == 0


def test_sin_relaciones_todos_valen_cero() -> None:
    entidad_a = Persona({"id": "A"})
    entidad_b = Persona({"id": "B"})
    subgrafo = Subgrafo(entidad_a, 0.3)
    subgrafo.agregar_nodo(NodoRelevante(entidad_b, 0.5, 1))

    centralidad = CalculadorCentralidad().calcular(subgrafo)

    assert centralidad["A"] == 0
    assert centralidad["B"] == 0
