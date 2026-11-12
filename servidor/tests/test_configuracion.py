"""Pruebas de Configuracion (las de tests/pruebasConfiguracion.js del incremento 1)."""
import json
from pathlib import Path

import pytest

from servidor.logica.configuracion import Configuracion

ARCHIVO_CONFIGURACION = Path(__file__).resolve().parent.parent / "configuracion.json"


def test_lee_los_valores_indicados() -> None:
    configuracion = Configuracion()
    configuracion.cargar({
        "origenDatos": "real",
        "urlServicio": "https://ejemplo.invalid/api",
        "umbralPorDefecto": 0.5,
        "maxNodos": 40,
        "maxEntidadesVecindario": 500,
        "entidadInicial": "p02",
    })
    assert configuracion.get_origen_datos() == "real"
    assert configuracion.get_url_servicio() == "https://ejemplo.invalid/api"
    assert configuracion.get_umbral_por_defecto() == 0.5
    assert configuracion.get_max_nodos() == 40
    assert configuracion.get_max_entidades_vecindario() == 500
    assert configuracion.get_entidad_inicial() == "p02"


def test_valores_por_defecto_si_faltan() -> None:
    configuracion = Configuracion()
    configuracion.cargar({})
    assert configuracion.get_origen_datos() == "simulado"
    assert configuracion.get_url_servicio() == ""
    assert configuracion.get_umbral_por_defecto() == 0.3
    assert configuracion.get_max_nodos() == 150
    assert configuracion.get_max_entidades_vecindario() == 2000
    assert configuracion.get_entidad_inicial() == ""


def test_valores_por_defecto_si_no_son_validos() -> None:
    configuracion = Configuracion()
    configuracion.cargar({"umbralPorDefecto": 7, "maxNodos": -3, "maxEntidadesVecindario": "mucho"})
    assert configuracion.get_umbral_por_defecto() == 0.3
    assert configuracion.get_max_nodos() == 150
    assert configuracion.get_max_entidades_vecindario() == 2000


def test_el_archivo_configuracion_json_se_lee_bien() -> None:
    configuracion = Configuracion()
    configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
    assert configuracion.get_origen_datos() == "simulado"
    assert configuracion.get_entidad_inicial() != ""


def test_cargar_sin_un_objeto_da_error() -> None:
    configuracion = Configuracion()
    with pytest.raises(ValueError):
        configuracion.cargar(None)


def test_comprobar_acepta_el_archivo_de_verdad() -> None:
    configuracion = Configuracion()
    configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
    configuracion.comprobar()
    assert configuracion.get_idioma() == "es"
    assert configuracion.get_etiquetas_entidad()["HeritageItem"] == "OBRA_DE_ARTE"
    assert configuracion.get_max_participantes_intermediario() == 10
    assert configuracion.get_version_pesos() == 1
    assert configuracion.get_papeles_auxiliares()["Period"] == "periodo"


def test_comprobar_dice_que_falta() -> None:
    configuracion = Configuracion()
    configuracion.cargar({"umbralPorDefecto": 0.3})
    with pytest.raises(ValueError) as error:
        configuracion.comprobar()
    assert "etiquetasEntidad" in str(error.value)
    assert "pesosRelevancia" in str(error.value)


def test_comprobar_rechaza_un_peso_fuera_de_rango() -> None:
    configuracion = Configuracion()
    configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
    datos = {}
    with open(ARCHIVO_CONFIGURACION, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    datos["pesosRelevancia"]["Marriage"] = 1.5
    configuracion.cargar(datos)
    with pytest.raises(ValueError) as error:
        configuracion.comprobar()
    assert "Marriage" in str(error.value)
