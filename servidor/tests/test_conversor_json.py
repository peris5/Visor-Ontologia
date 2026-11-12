"""Pruebas de ConversorJson: la forma del JSON que recibe el navegador."""
from servidor.api.conversor_json import ConversorJson
from servidor.modelo.obra_de_arte import ObraDeArte
from servidor.modelo.persona import Persona
from servidor.modelo.relacion import Relacion
from servidor.modelo.tipo_relacion import TipoRelacion
from servidor.modelo.vecindario import Vecindario


def crear_vecindario_de_prueba() -> dict:
    """Central P01 y una obra A03 unidas por DOS relaciones distintas."""
    persona = Persona({"id": "P01", "nombre": "Pintora", "descripcion": "Retratista", "nacionalidad": "Española"})
    obra = ObraDeArte({"id": "A03", "nombre": "Cuadro", "tecnica": "Óleo"})
    autor_de = TipoRelacion("autor_de")
    restaurador_de = TipoRelacion("restaurador_de")
    relaciones = [
        Relacion("R07", persona, obra, autor_de, 0.9),
        Relacion("R08", obra, persona, restaurador_de, 0.6),
    ]
    vecindario = Vecindario([persona, obra], relaciones, False)
    todos_los_tipos = [autor_de, TipoRelacion("miembro_de"), restaurador_de]
    return ConversorJson.vecindario_a_diccionario("P01", 0.3, vecindario, todos_los_tipos)


def test_campos_del_vecindario() -> None:
    json_vecindario = crear_vecindario_de_prueba()
    assert set(json_vecindario.keys()) == {"idCentral", "umbral", "recortado", "entidades",
                                           "relaciones", "tiposRelacion"}
    assert json_vecindario["idCentral"] == "P01"
    assert json_vecindario["umbral"] == 0.3
    assert json_vecindario["recortado"] is False
    assert len(json_vecindario["entidades"]) == 2
    assert len(json_vecindario["relaciones"]) == 2


def test_las_entidades_van_completas() -> None:
    entidad = crear_vecindario_de_prueba()["entidades"][0]
    assert entidad == {
        "id": "P01",
        "nombre": "Pintora",
        "tipo": "PERSONA",
        "descripcion": "Retratista",
        "atributos": {"nacionalidad": "Española"},
    }


def test_las_relaciones_van_en_bruto() -> None:
    relacion = crear_vecindario_de_prueba()["relaciones"][0]
    # Sin relevancia, sin nombre del tipo y sin color: eso lo calcula el navegador.
    assert relacion == {"id": "R07", "origen": "P01", "destino": "A03", "tipo": "autor_de", "valor": 0.9}


def test_varias_relaciones_del_mismo_par_se_mantienen_separadas() -> None:
    relaciones = crear_vecindario_de_prueba()["relaciones"]
    assert relaciones[0]["id"] != relaciones[1]["id"]
    assert relaciones[1]["origen"] == "A03"
    assert relaciones[1]["destino"] == "P01"
    assert relaciones[1]["tipo"] == "restaurador_de"


def test_lleva_los_ids_de_todos_los_tipos() -> None:
    # También miembro_de, aunque ninguna relación de este vecindario lo use.
    assert crear_vecindario_de_prueba()["tiposRelacion"] == ["autor_de", "miembro_de", "restaurador_de"]


def test_entidad_resumida() -> None:
    persona = Persona({"id": "P01", "nombre": "Pintora", "descripcion": "Retratista"})
    assert ConversorJson.entidad_resumida_a_diccionario(persona) == {
        "id": "P01", "nombre": "Pintora", "tipo": "PERSONA",
    }
