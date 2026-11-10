"""PaletaColores (traducción de src/logica/PaletaColores.js)."""
import math
from typing import Any


class PaletaColores:
    """Da un color distinto a cada tipo de relación. Como los tipos no se
    conocen de antemano, no podemos tener una lista fija: generamos los
    colores con una fórmula a partir de un número (el índice del tipo).

    Requisitos: RF-20 y RF-39.
    """

    # Ángulo áureo en grados. Si avanzamos el tono del color en este ángulo
    # cada vez, los colores quedan bien repartidos por el círculo cromático
    # y nunca se repite exactamente el mismo tono.
    ANGULO_AUREO = 137.508

    @staticmethod
    def color_para(indice: Any) -> str:
        """Color "#rrggbb" para un índice (entero ≥ 0). Índices distintos dan
        colores distintos.
        """
        # bool es un tipo de int en Python; lo excluimos a propósito.
        if not isinstance(indice, int) or isinstance(indice, bool) or indice < 0:
            raise ValueError("El índice del color debe ser un número entero mayor o igual que 0.")
        # Tono: avanzamos el ángulo áureo por cada índice y nos quedamos con
        # el resto de dividir entre 360 (una vuelta completa).
        tono = (indice * PaletaColores.ANGULO_AUREO) % 360
        # Luminosidad: la variamos en tres niveles para que dos tonos
        # parecidos se distingan también por lo claros u oscuros que son.
        nivel_de_luminosidad = indice % 3
        luminosidad = 0.42 + nivel_de_luminosidad * 0.1
        saturacion = 0.7
        return PaletaColores.__convertir_hsl_a_hexadecimal(tono, saturacion, luminosidad)

    @staticmethod
    def asignar(ids_tipos: list[str]) -> dict[str, str]:
        """Asigna un color a cada id, en el orden en que llegan.
        Es determinista: la misma lista en el mismo orden da siempre los mismos
        colores. Si un id aparece repetido, conserva el color de la primera vez.
        """
        colores_por_id: dict[str, str] = {}
        siguiente_indice = 0
        for id_tipo in ids_tipos:
            if id_tipo not in colores_por_id:
                colores_por_id[id_tipo] = PaletaColores.color_para(siguiente_indice)
                siguiente_indice = siguiente_indice + 1
        return colores_por_id

    @staticmethod
    def __convertir_hsl_a_hexadecimal(tono: float, saturacion: float, luminosidad: float) -> str:
        """(Privado) Convierte un color HSL (tono 0-360, saturación y
        luminosidad 0-1) en el formato "#rrggbb". Es la fórmula estándar.
        """
        # "croma": cuánto color puro hay.
        croma = (1 - abs(2 * luminosidad - 1)) * saturacion
        sector = tono / 60
        intermedio = croma * (1 - abs((sector % 2) - 1))
        ajuste = luminosidad - croma / 2

        rojo = 0.0
        verde = 0.0
        azul = 0.0
        if sector < 1:
            rojo = croma
            verde = intermedio
        elif sector < 2:
            rojo = intermedio
            verde = croma
        elif sector < 3:
            verde = croma
            azul = intermedio
        elif sector < 4:
            verde = intermedio
            azul = croma
        elif sector < 5:
            rojo = intermedio
            azul = croma
        else:
            rojo = croma
            azul = intermedio

        texto_rojo = PaletaColores.__componente_a_hexadecimal(rojo + ajuste)
        texto_verde = PaletaColores.__componente_a_hexadecimal(verde + ajuste)
        texto_azul = PaletaColores.__componente_a_hexadecimal(azul + ajuste)
        return "#" + texto_rojo + texto_verde + texto_azul

    @staticmethod
    def __componente_a_hexadecimal(componente: float) -> str:
        """(Privado) Convierte un componente entre 0 y 1 en dos cifras
        hexadecimales ("00" a "ff").
        """
        # Usamos floor(x + 0,5) y no round(x): round de Python redondea los
        # ",5" al número par (round(2.5) da 2), mientras que Math.round de
        # JavaScript los redondea hacia arriba. Así salen los mismos colores
        # que en el incremento 1.
        valor_de_0_a_255 = math.floor(componente * 255 + 0.5)
        texto = format(valor_de_0_a_255, "x")
        if len(texto) < 2:
            texto = "0" + texto
        return texto
