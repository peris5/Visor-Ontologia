"""Pruebas de ClasificadorEtiquetas (servidor/logica/)."""
from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.tests.utilidades import cargar_configuracion, cargar_datos_ejemplo


def crear_clasificador() -> ClasificadorEtiquetas:
    """Con la configuración y la jerarquía de los datos de ejemplo."""
    jerarquia = {}
    datos = cargar_datos_ejemplo()
    for etiqueta in datos["jerarquia"]:
        if not etiqueta.startswith("_"):
            jerarquia[etiqueta] = datos["jerarquia"][etiqueta]
    return ClasificadorEtiquetas(cargar_configuracion(), jerarquia)


def test_entidades() -> None:
    clasificador = crear_clasificador()
    assert clasificador.es_entidad(["Person", "Creator", "Painter"])
    assert clasificador.es_entidad(["HeritageItem"])
    assert clasificador.tipo_entidad(["Person", "Creator", "Painter"]) == "PERSONA"
    assert clasificador.tipo_entidad(["Organization"]) == "ORGANIZACION"
    assert clasificador.tipo_entidad(["HeritageItem"]) == "OBRA_DE_ARTE"
    # Solo con el subtipo, se reconoce por sus padres.
    assert clasificador.tipo_entidad(["Painter"]) == "PERSONA"


def test_auxiliares() -> None:
    clasificador = crear_clasificador()
    assert clasificador.es_auxiliar(["Period"])
    assert clasificador.es_auxiliar(["ExternalSource", "Book"])
    assert clasificador.es_auxiliar(["Book"])
    assert not clasificador.es_auxiliar(["Person"])
    assert not clasificador.es_intermediario(["Image"])


def test_intermediarios_incluida_una_etiqueta_inventada() -> None:
    clasificador = crear_clasificador()
    assert clasificador.es_intermediario(["Relationship", "Related", "Marriage"])
    assert clasificador.es_intermediario(["Event", "Birth"])
    # Una etiqueta que no está en ningún sitio es un intermediario.
    assert clasificador.es_intermediario(["Commission"])
    assert not clasificador.es_entidad(["Commission"])


def test_etiqueta_mas_especifica() -> None:
    clasificador = crear_clasificador()
    assert clasificador.mas_especifica(["Event", "Creation", "Paint"]) == "Paint"
    assert clasificador.mas_especifica(["Paint", "Event", "Creation"]) == "Paint"
    assert clasificador.mas_especifica(["Relationship", "Professional", "Apprenticeship"]) == "Apprenticeship"
    assert clasificador.mas_especifica(["Event"]) == "Event"
    assert clasificador.mas_especifica([]) == ""
    # Un tipo nuevo que aún no está en la jerarquía gana a Relationship.
    assert clasificador.mas_especifica(["Relationship", "Commission"]) == "Commission"


def test_padres_en_orden() -> None:
    clasificador = crear_clasificador()
    assert clasificador.padres("Marriage") == ["Related", "Relationship"]
    assert clasificador.padres("Paint") == ["Creation", "Event"]
    assert clasificador.padres("Apprenticeship") == ["Professional", "Relationship"]
    assert clasificador.padres("STUDENT_OF") == []


def test_un_ciclo_en_la_jerarquia_no_cuelga() -> None:
    # El diseño tiene Creation IS_A Event y Event IS_A Creation.
    clasificador = ClasificadorEtiquetas(cargar_configuracion(), {"Creation": "Event", "Event": "Creation"})
    assert clasificador.padres("Creation") == ["Event"]
    assert clasificador.padres("Event") == ["Creation"]
