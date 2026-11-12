"""Funciones de ayuda compartidas por las pruebas."""
import json
from pathlib import Path
from typing import Any

from servidor.logica.configuracion import Configuracion

CARPETA_SERVIDOR = Path(__file__).resolve().parent.parent
ARCHIVO_DATOS_EJEMPLO = CARPETA_SERVIDOR / "datos" / "datos_ejemplo.json"
ARCHIVO_CONFIGURACION = CARPETA_SERVIDOR / "configuracion.json"
ARCHIVO_DISENO = CARPETA_SERVIDOR.parent / "docs" / "diseno_bd_refracts.json"


def cargar_datos_ejemplo() -> dict[str, Any]:
    """Lee servidor/datos/datos_ejemplo.json (los mismos datos que usa el servidor)."""
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        return json.load(archivo)


def cargar_configuracion() -> Configuracion:
    """La configuración de verdad (servidor/configuracion.json), ya comprobada."""
    configuracion = Configuracion()
    configuracion.cargar_archivo(ARCHIVO_CONFIGURACION)
    configuracion.comprobar()
    return configuracion


def crear_grafo_pequeno() -> dict[str, Any]:
    """Un grafo pequeño con la forma de Neo4j, escrito a mano:

        Ana ─HAS_ROLE_IN(maestra)─▶ [Relationship:Mentorship] ◀─HAS_ROLE_IN(aprendiz)─ Luis
                                      ├─OCURRED_DURING─▶ (Period 1902–1908)
                                      └─TOOK_PLACE_AT─▶ (Ubication València)
        Ana ─PARTICIPATES_IN(autora)─▶ [Event:Creation:Paint] ─PRODUCED─▶ Cuadro
                                                              └─CREATE───▶ Cuadro  (misma obra dos veces)
        [Event:Exposition] ─IS_EXPOSED─▶ Cuadro, ─OCURRED_AT─▶ Museo
        Ana ─STUDENT_OF─▶ Luis                                       (relación directa)
        Ana, Luis ─HAS_ROLE_IN─▶ [Relationship:Commission]           (etiqueta que NO está en el diseño)
        Ana, Luis ─HAS_ROLE_IN─▶ [Relationship:Friendship]           (segundo intermediario del mismo par)
        Ana ─PARTICIPATES_IN─▶ [Event:Birth] ─TOOK_PLACE_AT─▶ València (tipo sin relación)
        Ana, Luis, Eva, Pep ─PARTICIPATES_IN─▶ [Event] (4 participantes, más del límite de 3 de las pruebas)
        Ana ─HAS_IMAGE─▶ (Image)    Museo ─LOCATED_IN─▶ València ─IS_IN─▶ España
        Zoe ─HAS_ROLE_IN─▶ [Relationship:Marriage] ◀─ Teo           (zona no conectada)
    """
    def nodo(id_nodo: str, etiquetas: list[str], propiedades: dict[str, Any]) -> dict[str, Any]:
        return {"id": id_nodo, "etiquetas": etiquetas, "propiedades": propiedades}

    def relacion(id_relacion: str, tipo: str, desde: str, hasta: str, propiedades: dict[str, Any]) -> dict[str, Any]:
        return {"id": id_relacion, "tipo": tipo, "desde": desde, "hasta": hasta, "propiedades": propiedades}

    return {
        "jerarquia": {"Mentorship": "Relationship", "Friendship": "Relationship", "Marriage": "Related",
                      "Related": "Relationship", "Creation": "Event", "Paint": "Creation",
                      "Exposition": "Event", "Birth": "Event", "Painter": "Creator", "Creator": "Person",
                      "_comentario": "las claves con _ se ignoran"},
        "nodos": [
            nodo("ana", ["Person", "Creator", "Painter"], {"name": "Ana", "lastName": "Roig"}),
            nodo("luis", ["Person"], {"name": "Luis", "lastName": "Peris"}),
            nodo("eva", ["Person"], {"name": "Eva"}),
            nodo("pep", ["Person"], {"name": "Pep"}),
            nodo("cuadro", ["HeritageItem"], {"name_es": "Cuadro", "dimensions": "10 × 20 cm"}),
            nodo("museo", ["Organization"], {"name_es": "Museo", "name_ca": "Museu", "name_en": "Museum"}),
            nodo("mentoria", ["Relationship", "Mentorship"], {}),
            nodo("periodo", ["Period"], {"from": "1902", "to": "1908", "description": ""}),
            nodo("valencia", ["Ubication"], {"name_es": "Valencia", "name_ca": "València"}),
            nodo("espana", ["Ubication"], {"name_es": "España"}),
            nodo("pintura", ["Event", "Creation", "Paint"], {"name_es": "Pintura del cuadro"}),
            nodo("expo", ["Event", "Exposition"], {}),
            nodo("encargo", ["Relationship", "Commission"], {}),
            nodo("amistad", ["Relationship", "Friendship"], {}),
            nodo("nacimiento", ["Event", "Birth"], {}),
            nodo("congreso", ["Event"], {}),
            nodo("imagen", ["Image"], {"url": "https://example.org/imagenes/ana.jpg", "caption": "Ana"}),
            nodo("zoe", ["Person"], {"name": "Zoe"}),
            nodo("teo", ["Person"], {"name": "Teo"}),
            nodo("boda", ["Relationship", "Related", "Marriage"], {}),
        ],
        "relaciones": [
            relacion("r1", "HAS_ROLE_IN", "ana", "mentoria", {"role": "maestra"}),
            relacion("r2", "HAS_ROLE_IN", "luis", "mentoria", {"role": "aprendiz"}),
            relacion("r3", "OCURRED_DURING", "mentoria", "periodo", {}),
            relacion("r4", "TOOK_PLACE_AT", "mentoria", "valencia", {}),
            relacion("r5", "PARTICIPATES_IN", "ana", "pintura", {"role": "autora"}),
            relacion("r6", "PRODUCED", "pintura", "cuadro", {}),
            relacion("r7", "CREATE", "pintura", "cuadro", {}),
            relacion("r8", "IS_EXPOSED", "expo", "cuadro", {}),
            relacion("r9", "OCURRED_AT", "expo", "museo", {"date": "1910"}),
            relacion("r10", "STUDENT_OF", "ana", "luis", {}),
            relacion("r11", "HAS_ROLE_IN", "ana", "encargo", {}),
            relacion("r12", "HAS_ROLE_IN", "luis", "encargo", {}),
            relacion("r13", "HAS_ROLE_IN", "ana", "amistad", {}),
            relacion("r14", "HAS_ROLE_IN", "luis", "amistad", {}),
            relacion("r15", "PARTICIPATES_IN", "ana", "nacimiento", {}),
            relacion("r16", "TOOK_PLACE_AT", "nacimiento", "valencia", {"date": "1880"}),
            relacion("r17", "PARTICIPATES_IN", "ana", "congreso", {}),
            relacion("r18", "PARTICIPATES_IN", "luis", "congreso", {}),
            relacion("r19", "PARTICIPATES_IN", "eva", "congreso", {}),
            relacion("r20", "PARTICIPATES_IN", "pep", "congreso", {}),
            relacion("r21", "HAS_IMAGE", "ana", "imagen", {"order": 1}),
            relacion("r22", "LOCATED_IN", "museo", "valencia", {}),
            relacion("r23", "IS_IN", "valencia", "espana", {}),
            relacion("r24", "HAS_ROLE_IN", "zoe", "boda", {"role": "esposa"}),
            relacion("r25", "HAS_ROLE_IN", "teo", "boda", {"role": "esposo"}),
        ],
    }


def crear_configuracion_pruebas() -> Configuracion:
    """La configuración de verdad, pero con un límite de 3 participantes
    (para probarlo con el grafo pequeño).
    """
    with open(ARCHIVO_CONFIGURACION, encoding="utf-8") as archivo:
        datos = json.load(archivo)
    datos["maxParticipantesIntermediario"] = 3
    configuracion = Configuracion()
    configuracion.cargar(datos)
    configuracion.comprobar()
    return configuracion
