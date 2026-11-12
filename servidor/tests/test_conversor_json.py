"""Pruebas de ConversorJson: la forma del JSON que recibe el navegador."""
from servidor.api.conversor_json import ConversorJson
from servidor.modelo.vecindario import Vecindario
from servidor.tests.utilidades import cargar_configuracion


def test_configuracion_solo_lo_que_necesita_el_cliente() -> None:
    datos = ConversorJson.configuracion_a_diccionario(cargar_configuracion())
    assert set(datos.keys()) == {"umbralPorDefecto", "maxNodos", "entidadInicial", "idioma", "nombresTipos",
                                 "etiquetasEntidad"}
    assert datos["idioma"] == "es"
    assert datos["nombresTipos"]["Marriage"] == "Matrimonio"
    assert datos["etiquetasEntidad"]["Person"] == "PERSONA"


def test_vecindario() -> None:
    entidades = [{"id": "a", "etiquetas": ["Person"], "propiedades": {"name": "Ana"}}]
    relaciones = [{"id": "i|a|b", "idIntermedio": "i", "origen": "a", "destino": "b", "tipo": "Marriage",
                   "padres": ["Related", "Relationship"], "roles": {}, "periodo": None, "lugar": None,
                   "fecha": None, "valor": 0.95}]
    datos = ConversorJson.vecindario_a_diccionario("a", 0.3, Vecindario(entidades, relaciones, False, 4, 2))
    assert datos == {"idCentral": "a", "umbral": 0.3, "recortado": False, "entidades": entidades,
                     "relaciones": relaciones, "relevanciasAsignadas": 4, "relevanciasReutilizadas": 2}
