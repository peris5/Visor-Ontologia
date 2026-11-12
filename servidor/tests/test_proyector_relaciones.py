"""Pruebas de ProyectorRelaciones (servidor/datos/) con el grafo pequeño de utilidades.py."""
from typing import Any

from servidor.datos.proyector_relaciones import ProyectorRelaciones
from servidor.logica.clasificador_etiquetas import ClasificadorEtiquetas
from servidor.tests.utilidades import crear_configuracion_pruebas, crear_grafo_pequeno


def crear_proyector() -> ProyectorRelaciones:
    """El proyector sobre el grafo pequeño (límite de 3 participantes)."""
    grafo = crear_grafo_pequeno()
    configuracion = crear_configuracion_pruebas()
    nodos: dict[str, dict[str, Any]] = {}
    adyacencia: dict[str, list[dict[str, Any]]] = {}
    for nodo in grafo["nodos"]:
        nodos[nodo["id"]] = nodo
        adyacencia[nodo["id"]] = []
    for relacion in grafo["relaciones"]:
        adyacencia[relacion["desde"]].append({"relacion": relacion, "otro": relacion["hasta"]})
        adyacencia[relacion["hasta"]].append({"relacion": relacion, "otro": relacion["desde"]})
    jerarquia: dict[str, str] = {}
    for etiqueta in grafo["jerarquia"]:
        if not etiqueta.startswith("_"):
            jerarquia[etiqueta] = grafo["jerarquia"][etiqueta]
    clasificador = ClasificadorEtiquetas(configuracion, jerarquia)
    return ProyectorRelaciones(nodos, adyacencia, clasificador, configuracion)


def por_intermediario(relaciones: list[dict[str, Any]], id_intermedio: str) -> list[dict[str, Any]]:
    """Las relaciones derivadas de ese intermediario."""
    resultado = []
    for relacion in relaciones:
        if relacion["idIntermedio"] == id_intermedio:
            resultado.append(relacion)
    return resultado


def test_una_relacion_por_pareja_con_el_tipo_mas_especifico_roles_periodo_y_lugar() -> None:
    relaciones = por_intermediario(crear_proyector().relaciones_de("ana"), "mentoria")
    assert len(relaciones) == 1
    mentoria = relaciones[0]
    assert mentoria["id"] == "mentoria|ana|luis"
    assert mentoria["origen"] == "ana"
    assert mentoria["destino"] == "luis"
    assert mentoria["tipo"] == "Mentorship"
    assert mentoria["padres"] == ["Relationship"]
    assert mentoria["roles"] == {"ana": "maestra", "luis": "aprendiz"}
    assert mentoria["periodo"] == {"from": "1902", "to": "1908", "description": ""}
    assert mentoria["lugar"] == "Valencia"


def test_la_misma_pareja_desde_el_otro_lado_da_el_mismo_id() -> None:
    proyector = crear_proyector()
    desde_luis = por_intermediario(proyector.relaciones_de("luis"), "mentoria")
    assert desde_luis[0]["id"] == "mentoria|ana|luis"


def test_persona_obra_por_creation() -> None:
    relaciones = por_intermediario(crear_proyector().relaciones_de("ana"), "pintura")
    assert len(relaciones) == 1
    assert relaciones[0]["tipo"] == "Paint"
    assert relaciones[0]["padres"] == ["Creation", "Event"]
    assert relaciones[0]["roles"] == {"ana": "autora"}


def test_dos_uniones_a_la_misma_entidad_no_duplican() -> None:
    # La pintura está unida a la obra por PRODUCED y por CREATE.
    relaciones = por_intermediario(crear_proyector().relaciones_de("cuadro"), "pintura")
    assert len(relaciones) == 1


def test_obra_organizacion_por_exposition_con_fecha() -> None:
    relaciones = por_intermediario(crear_proyector().relaciones_de("cuadro"), "expo")
    assert len(relaciones) == 1
    assert relaciones[0]["origen"] == "cuadro"
    assert relaciones[0]["destino"] == "museo"
    assert relaciones[0]["tipo"] == "Exposition"
    assert relaciones[0]["fecha"] == "1910"


def test_relacion_directa() -> None:
    relaciones = por_intermediario(crear_proyector().relaciones_de("ana"), "r10")
    assert len(relaciones) == 1
    assert relaciones[0]["tipo"] == "STUDENT_OF"
    assert relaciones[0]["id"] == "r10|ana|luis"
    assert relaciones[0]["periodo"] is None


def test_un_intermediario_con_una_etiqueta_que_no_esta_en_el_diseno() -> None:
    relaciones = por_intermediario(crear_proyector().relaciones_de("ana"), "encargo")
    assert len(relaciones) == 1
    assert relaciones[0]["tipo"] == "Commission"
    assert relaciones[0]["padres"] == []


def test_no_se_aplica_a_tipos_sin_relacion_ni_por_encima_del_limite() -> None:
    relaciones = crear_proyector().relaciones_de("ana")
    assert por_intermediario(relaciones, "nacimiento") == []
    # El congreso tiene 4 participantes y el límite de la prueba es 3.
    assert por_intermediario(relaciones, "congreso") == []


def test_dos_intermediarios_entre_el_mismo_par_dan_dos_relaciones() -> None:
    relaciones = crear_proyector().relaciones_de("ana")
    entre_ana_y_luis = []
    for relacion in relaciones:
        if relacion["origen"] == "ana" and relacion["destino"] == "luis":
            entre_ana_y_luis.append(relacion["tipo"])
    entre_ana_y_luis.sort()
    assert entre_ana_y_luis == ["Commission", "Friendship", "Mentorship", "STUDENT_OF"]


def test_las_relaciones_ignoradas_no_cuentan() -> None:
    # HAS_IMAGE, LOCATED_IN e IS_IN están en relacionesIgnoradas: el museo no
    # se relaciona con nadie por estar en València.
    relaciones = crear_proyector().relaciones_de("museo")
    assert len(relaciones) == 1
    assert relaciones[0]["idIntermedio"] == "expo"
