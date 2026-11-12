"""Pruebas de CacheSubgrafos (servidor/api/)."""
import asyncio

import pytest

from servidor.api.cache_subgrafos import CacheSubgrafos


class ContadorDeCalculos:
    """Función de cálculo falsa que cuenta cuántas veces se ejecuta."""

    def __init__(self, espera: float) -> None:
        self.veces = 0
        self.__espera = espera

    async def calcular(self) -> bytes:
        """Tarda un poco (como un subgrafo de verdad) y devuelve un JSON."""
        self.veces = self.veces + 1
        await asyncio.sleep(self.__espera)
        return b"{}"


async def pedir_varias_veces_a_la_vez(cache: CacheSubgrafos, contador: ContadorDeCalculos, veces: int) -> None:
    """Lanza varias peticiones iguales a la vez y espera a todas."""
    tareas = []
    for _ in range(veces):
        tareas.append(asyncio.ensure_future(cache.obtener("p01|0.3", contador.calcular)))
    for tarea in tareas:
        await tarea


def test_la_segunda_peticion_no_vuelve_a_calcular() -> None:
    cache = CacheSubgrafos(10, 600)
    contador = ContadorDeCalculos(0)
    asyncio.run(cache.obtener("p01|0.3", contador.calcular))
    asyncio.run(cache.obtener("p01|0.3", contador.calcular))
    assert contador.veces == 1


def test_peticiones_iguales_a_la_vez_calculan_una_sola_vez() -> None:
    cache = CacheSubgrafos(10, 600)
    contador = ContadorDeCalculos(0.05)
    asyncio.run(pedir_varias_veces_a_la_vez(cache, contador, 50))
    assert contador.veces == 1


def test_claves_distintas_se_calculan_por_separado() -> None:
    cache = CacheSubgrafos(10, 600)
    contador = ContadorDeCalculos(0)
    asyncio.run(cache.obtener("p01|0.3", contador.calcular))
    asyncio.run(cache.obtener("p01|0.5", contador.calcular))
    assert contador.veces == 2


def test_no_guarda_mas_del_maximo_y_olvida_el_menos_usado() -> None:
    cache = CacheSubgrafos(2, 600)
    contador = ContadorDeCalculos(0)
    asyncio.run(cache.obtener("A", contador.calcular))
    asyncio.run(cache.obtener("B", contador.calcular))
    asyncio.run(cache.obtener("A", contador.calcular))  # A se usa: ahora el menos usado es B
    asyncio.run(cache.obtener("C", contador.calcular))  # entra C y se olvida B
    assert cache.get_numero_entradas() == 2
    assert contador.veces == 3
    asyncio.run(cache.obtener("A", contador.calcular))  # A sigue guardada
    assert contador.veces == 3
    asyncio.run(cache.obtener("B", contador.calcular))  # B se olvidó: se recalcula
    assert contador.veces == 4


def test_las_entradas_caducan() -> None:
    cache = CacheSubgrafos(10, 0)
    contador = ContadorDeCalculos(0)
    asyncio.run(cache.obtener("p01|0.3", contador.calcular))
    asyncio.run(asyncio.sleep(0.01))
    asyncio.run(cache.obtener("p01|0.3", contador.calcular))
    assert contador.veces == 2


def test_los_errores_no_se_guardan() -> None:
    cache = CacheSubgrafos(10, 600)

    async def fallar() -> bytes:
        raise ValueError("fallo de prueba")

    with pytest.raises(ValueError):
        asyncio.run(cache.obtener("p99|0.3", fallar))
    assert cache.get_numero_entradas() == 0
    contador = ContadorDeCalculos(0)
    asyncio.run(cache.obtener("p99|0.3", contador.calcular))
    assert contador.veces == 1
