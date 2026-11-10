"""Funciones de ayuda compartidas por las pruebas."""
import json
from pathlib import Path
from typing import Any

ARCHIVO_DATOS_EJEMPLO = Path(__file__).resolve().parent.parent / "datos" / "datos_ejemplo.json"


def cargar_datos_ejemplo() -> dict[str, Any]:
    """Lee servidor/datos/datos_ejemplo.json (los mismos datos que usa el servidor)."""
    with open(ARCHIVO_DATOS_EJEMPLO, encoding="utf-8") as archivo:
        return json.load(archivo)
