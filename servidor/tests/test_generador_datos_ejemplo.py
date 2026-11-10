"""Pruebas del generador de datos de ejemplo (servidor/herramientas/)."""
from servidor.herramientas.generador_datos_ejemplo import ARCHIVO_DATOS, GeneradorDatosEjemplo
from servidor.tests.utilidades import cargar_datos_ejemplo


def test_reproduce_exactamente_el_archivo_actual() -> None:
    # Si alguien cambia datos_ejemplo.json a mano o cambia el generador sin
    # volver a ejecutarlo, esta prueba avisa: el archivo debe poder
    # regenerarse siempre igual.
    datos = GeneradorDatosEjemplo(cargar_datos_ejemplo()).generar()
    texto_generado = GeneradorDatosEjemplo.convertir_a_texto(datos)
    with open(ARCHIVO_DATOS, encoding="utf-8") as archivo:
        texto_del_archivo = archivo.read()
    assert texto_generado == texto_del_archivo


def test_conserva_los_datos_originales_al_principio() -> None:
    datos = GeneradorDatosEjemplo(cargar_datos_ejemplo()).generar()
    assert datos["entidades"][0]["id"] == "p01"
    assert datos["entidades"][15]["id"] == "a05"
    assert datos["relaciones"][26][0] == "r27"


def test_ids_y_nombres_sin_repetir_y_relaciones_validas() -> None:
    datos = GeneradorDatosEjemplo(cargar_datos_ejemplo()).generar()
    ids = set()
    nombres = set()
    for entidad in datos["entidades"]:
        assert entidad["id"] not in ids
        assert entidad["nombre"] not in nombres
        ids.add(entidad["id"])
        nombres.add(entidad["nombre"])
    ids_de_relaciones = set()
    for fila in datos["relaciones"]:
        assert fila[0] not in ids_de_relaciones
        ids_de_relaciones.add(fila[0])
        assert fila[1] in ids
        assert fila[2] in ids
        assert fila[1] != fila[2]
        assert 0 <= fila[4] <= 1
