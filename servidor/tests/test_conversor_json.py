"""Pruebas de ConversorJson: la forma del JSON que recibe el navegador."""
from servidor.api.conversor_json import ConversorJson
from servidor.tests.utilidades import cargar_configuracion


def test_configuracion_solo_lo_que_necesita_el_cliente() -> None:
    datos = ConversorJson.configuracion_a_diccionario(cargar_configuracion())
    assert set(datos.keys()) == {"umbralPorDefecto", "maxNodos", "nodosObjetivo", "entidadInicial", "idioma", "nombresTipos",
                                 "etiquetasEntidad"}
    assert datos["idioma"] == "es"
    assert datos["nombresTipos"]["Marriage"] == "Matrimonio"
    assert datos["etiquetasEntidad"]["Person"] == "PERSONA"


def test_relaciones_sin_ninguna_relevancia() -> None:
    entidades = [{"id": "a", "etiquetas": ["Person"], "propiedades": {"name": "Ana"}}]
    relaciones = [{"id": "i|a|b", "idIntermedio": "i", "origen": "a", "destino": "b", "tipo": "Marriage",
                   "padres": ["Related", "Relationship"], "roles": {}, "nombre": "", "periodo": None, "lugar": None,
                   "fecha": None, "participantes": 2, "dibujable": True}]
    datos = ConversorJson.relaciones_a_diccionario(["a"], {"entidades": entidades, "relaciones": relaciones})
    assert datos == {"ids": ["a"], "entidades": entidades, "relaciones": relaciones}
