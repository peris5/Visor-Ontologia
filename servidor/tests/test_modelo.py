"""Pruebas del modelo de dominio en Python (las mismas que tests/pruebasModelo.js)."""
import pytest

from servidor.datos.fabrica_entidades import FabricaEntidades
from servidor.modelo.entidad import Entidad
from servidor.modelo.nodo_relevante import NodoRelevante
from servidor.modelo.obra_de_arte import ObraDeArte
from servidor.modelo.organizacion import Organizacion
from servidor.modelo.persona import Persona
from servidor.modelo.relacion import Relacion
from servidor.modelo.subgrafo import Subgrafo
from servidor.modelo.tipo_entidad import TipoEntidad
from servidor.modelo.tipo_relacion import TipoRelacion


def crear_elementos() -> dict:
    """Unas entidades y un tipo de relación pequeños para estas pruebas."""
    return {
        "persona": Persona({"id": "per1", "nombre": "Persona de prueba", "nacionalidad": "Española"}),
        "organizacion": Organizacion({"id": "org1", "nombre": "Organización de prueba", "sede": "Ciudad"}),
        "obra": ObraDeArte({"id": "obr1", "nombre": "Obra de prueba", "tecnica": "Óleo"}),
        "tipo": TipoRelacion("autor_de", "Autor de", "#ff0000"),
    }


def test_entidad_es_abstracta() -> None:
    with pytest.raises(TypeError):
        Entidad({"id": "x", "nombre": "X"})


def test_get_tipo_de_cada_subclase() -> None:
    elementos = crear_elementos()
    assert elementos["persona"].get_tipo() == TipoEntidad.PERSONA
    assert elementos["organizacion"].get_tipo() == TipoEntidad.ORGANIZACION
    assert elementos["obra"].get_tipo() == TipoEntidad.OBRA_DE_ARTE


def test_get_atributos_anade_los_campos_propios() -> None:
    elementos = crear_elementos()
    assert elementos["persona"].get_atributos()["nacionalidad"] == "Española"
    assert elementos["organizacion"].get_atributos()["sede"] == "Ciudad"
    assert elementos["obra"].get_atributos()["tecnica"] == "Óleo"


def test_get_otro_extremo_en_los_dos_sentidos() -> None:
    elementos = crear_elementos()
    relacion = Relacion("rel1", elementos["persona"], elementos["obra"], elementos["tipo"], 0.8)
    assert relacion.get_otro_extremo(elementos["persona"]).get_id() == "obr1"
    assert relacion.get_otro_extremo(elementos["obra"]).get_id() == "per1"


def test_get_otro_extremo_con_una_entidad_ajena_da_error() -> None:
    elementos = crear_elementos()
    relacion = Relacion("rel1", elementos["persona"], elementos["obra"], elementos["tipo"], 0.8)
    with pytest.raises(ValueError):
        relacion.get_otro_extremo(elementos["organizacion"])


def test_get_clave_par_igual_en_los_dos_sentidos() -> None:
    elementos = crear_elementos()
    de_ida = Relacion("rel1", elementos["persona"], elementos["obra"], elementos["tipo"], 0.8)
    de_vuelta = Relacion("rel2", elementos["obra"], elementos["persona"], elementos["tipo"], 0.5)
    assert de_ida.get_clave_par() == de_vuelta.get_clave_par()


def test_nombre_desde_id() -> None:
    assert TipoRelacion.nombre_desde_id("maestro_de") == "Maestro de"
    assert TipoRelacion.nombre_desde_id("pareja") == "Pareja"


def test_subgrafo_nace_con_la_central() -> None:
    elementos = crear_elementos()
    subgrafo = Subgrafo(elementos["persona"], 0.3)
    assert subgrafo.get_numero_nodos() == 1
    assert subgrafo.get_nodo("per1").get_relevancia() == 1
    assert subgrafo.get_nodo("per1").get_nivel() == 0


def test_eliminar_nodo_quita_sus_relaciones() -> None:
    elementos = crear_elementos()
    subgrafo = Subgrafo(elementos["persona"], 0.3)
    subgrafo.agregar_nodo(NodoRelevante(elementos["obra"], 0.8, 1))
    subgrafo.agregar_nodo(NodoRelevante(elementos["organizacion"], 0.6, 1))
    subgrafo.agregar_relacion(Relacion("rel1", elementos["persona"], elementos["obra"], elementos["tipo"], 0.8))
    subgrafo.agregar_relacion(Relacion("rel2", elementos["obra"], elementos["organizacion"], elementos["tipo"], 0.5))
    subgrafo.agregar_relacion(Relacion("rel3", elementos["persona"], elementos["organizacion"], elementos["tipo"], 0.6))

    subgrafo.eliminar_nodo("obr1")

    assert subgrafo.contiene_entidad("obr1") is False
    assert subgrafo.get_numero_nodos() == 2
    relaciones = subgrafo.get_relaciones()
    assert len(relaciones) == 1
    assert relaciones[0].get_id() == "rel3"


def test_subgrafo_no_guarda_dos_veces_la_misma_relacion() -> None:
    elementos = crear_elementos()
    subgrafo = Subgrafo(elementos["persona"], 0.3)
    subgrafo.agregar_nodo(NodoRelevante(elementos["obra"], 0.8, 1))
    relacion = Relacion("rel1", elementos["persona"], elementos["obra"], elementos["tipo"], 0.8)
    subgrafo.agregar_relacion(relacion)
    subgrafo.agregar_relacion(relacion)
    assert len(subgrafo.get_relaciones()) == 1


def test_fabrica_crea_cada_tipo_y_rechaza_uno_desconocido() -> None:
    assert isinstance(FabricaEntidades.crear_entidad("PERSONA", {"id": "x1"}), Persona)
    assert isinstance(FabricaEntidades.crear_entidad(TipoEntidad.ORGANIZACION, {"id": "x2"}), Organizacion)
    assert isinstance(FabricaEntidades.crear_entidad("OBRA_DE_ARTE", {"id": "x3"}), ObraDeArte)
    with pytest.raises(ValueError):
        FabricaEntidades.crear_entidad("DINOSAURIO", {"id": "x4"})
