"""Pruebas de ConversorJson: la forma del JSON que recibe el navegador."""
from servidor.api.conversor_json import ConversorJson
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.obra_de_arte import ObraDeArte
from servidor.modelo.persona import Persona
from servidor.modelo.relacion import Relacion
from servidor.modelo.subgrafo import Subgrafo
from servidor.modelo.tipo_relacion import TipoRelacion


def crear_subgrafo_de_prueba() -> Subgrafo:
    """Central P01 y una obra A03 unidas por DOS relaciones distintas."""
    persona = Persona({"id": "P01", "nombre": "Pintora", "descripcion": "Retratista", "nacionalidad": "Española"})
    obra = ObraDeArte({"id": "A03", "nombre": "Cuadro", "tecnica": "Óleo"})
    autor_de = TipoRelacion("autor_de", "Autor de", "#4c8bf5")
    restaurador_de = TipoRelacion("restaurador_de", "Restaurador de", "#f5a623")

    subgrafo = Subgrafo(persona, 0.3)
    nodo_obra = NodoRelevante(obra, 0.9, 1)
    nodo_obra.set_centralidad(0.5)
    subgrafo.agregar_nodo(nodo_obra)
    subgrafo.get_nodo("P01").set_centralidad(1.0)

    relacion_autor = Relacion("R07", persona, obra, autor_de, 0.9)
    relacion_restaurador = Relacion("R08", obra, persona, restaurador_de, 0.6)
    relacion_restaurador.set_relevancia(0.55)
    subgrafo.agregar_relacion(relacion_autor)
    subgrafo.agregar_relacion(relacion_restaurador)
    return subgrafo


def test_campos_del_subgrafo() -> None:
    json_subgrafo = ConversorJson.subgrafo_a_diccionario(crear_subgrafo_de_prueba())
    assert json_subgrafo["idCentral"] == "P01"
    assert json_subgrafo["umbral"] == 0.3
    assert len(json_subgrafo["nodos"]) == 2
    assert len(json_subgrafo["relaciones"]) == 2


def test_campos_de_un_nodo_y_su_entidad() -> None:
    json_subgrafo = ConversorJson.subgrafo_a_diccionario(crear_subgrafo_de_prueba())
    nodo_central = json_subgrafo["nodos"][0]
    assert nodo_central["relevancia"] == 1
    assert nodo_central["nivel"] == 0
    assert nodo_central["centralidad"] == 1.0
    entidad = nodo_central["entidad"]
    assert entidad["id"] == "P01"
    assert entidad["nombre"] == "Pintora"
    assert entidad["tipo"] == "PERSONA"
    assert entidad["descripcion"] == "Retratista"
    assert entidad["atributos"] == {"nacionalidad": "Española"}

    nodo_obra = json_subgrafo["nodos"][1]
    assert nodo_obra["entidad"]["tipo"] == "OBRA_DE_ARTE"
    assert nodo_obra["relevancia"] == 0.9
    assert nodo_obra["nivel"] == 1
    assert nodo_obra["centralidad"] == 0.5


def test_campos_de_una_relacion() -> None:
    json_subgrafo = ConversorJson.subgrafo_a_diccionario(crear_subgrafo_de_prueba())
    relacion = json_subgrafo["relaciones"][0]
    assert relacion == {
        "id": "R07",
        "origen": "P01",
        "destino": "A03",
        "valor": 0.9,
        "relevancia": 0.9,
        "tipo": {"id": "autor_de", "nombre": "Autor de", "color": "#4c8bf5"},
    }


def test_varias_relaciones_del_mismo_par_se_mantienen_separadas() -> None:
    json_subgrafo = ConversorJson.subgrafo_a_diccionario(crear_subgrafo_de_prueba())
    primera = json_subgrafo["relaciones"][0]
    segunda = json_subgrafo["relaciones"][1]
    assert primera["id"] != segunda["id"]
    assert segunda["origen"] == "A03"
    assert segunda["destino"] == "P01"
    assert segunda["valor"] == 0.6
    assert segunda["relevancia"] == 0.55
    assert segunda["tipo"]["id"] == "restaurador_de"


def test_entidad_resumida() -> None:
    persona = Persona({"id": "P01", "nombre": "Pintora", "descripcion": "Retratista"})
    assert ConversorJson.entidad_resumida_a_diccionario(persona) == {
        "id": "P01", "nombre": "Pintora", "tipo": "PERSONA",
    }
