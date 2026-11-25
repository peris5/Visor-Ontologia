# Informe del laboratorio de relevancia

- Fecha: 25/11/2026, 21:14:36
- Datos: simuladaGrande
- Muestra: 325 entidades (325 creadores) de las 25643 que hay, semilla 7, umbral 0.3
- Los valores de la configuración son una propuesta pendiente de validar.

## Propiedades

|  |  | Propiedad | Detalle |
|---|---|---|---|
| ✔ | P0 | El cálculo rápido da lo mismo que la fórmula | diferencia máxima 0.0e+0 |
| ✔ | P1 | Añadir una relación no baja a nadie |  |
| ✔ | P2 | Ningún directo baja de su propia evidencia |  |
| ✔ | P3 | Un deducido sin evidencia propia no supera a su mejor padre |  |
| ✔ | P4 | Cuatro tipos de vínculo pesan más que diez exposiciones | 10 exposiciones 0.627 · 4 tipos 0.943 |
| ✔ | P5 | El compañero de un taller pequeño pesa más que el de una academia de 300 | taller 0.118 · academia 0.051 |
| ✔ | P6 | El maestro pesa más para la alumna que la alumna para el maestro | Joaquín desde Ana 0.950 · Ana desde Joaquín 0.600 |
| ✔ | P7 | La obra de la época de la mentoría pesa más que una 35 años posterior | Paseo 0.532 · Tardía 0.160 |
| ✔ | P8 | Entra «Paseo» y no Pedro | Paseo 0.532 · Pedro 0.093 |
| ✔ | P9 | Dos nodos en la misma situación reciben lo mismo | círculo de 25: de 0.031 a 0.031 |
| ✔ | P10 | Más evidencia nunca baja, tampoco al pasar a directo | Pedro: 0.093 → 0.117 → 0.127 → 0.127 → 0.127 → 0.145 |
| ✔ | P11 | Los coexpositores del maestro no rebajan su obra | Paseo con 400 coexpositores 0.32 · sin ellos 0.32 |
| ✔ | P12 | Las obras propias no tapan a las personas | 200 obras propias: maestro sí, alumnas 12/12 |
| ✔ | P13 | Coexponer no es una relación declarada | certeza Huerta–Marina 0.08 · Huerta–Galería 1.00 |
| ✔ | P14 | Las obras y el lugar no diluyen a las personas | exponer juntas 0.14 y 0.14 · mentoría 0.95 y 0.95 |
| ✔ | P15 | El mismo evento registrado dos veces cuenta una | una vez 0.140 · duplicado 0.140 · otro día 0.200 |
| ✔ | P16 | Pocos registrados no hacen íntimo un evento | 2 registrados: fuerza 0.140, certeza 0.080 · 100 registrados: fuerza 0.014 |

## Robustez

Combinaciones de ρ y δ: 12. Fallos: 0.


## Medición

| Medida | Hay | Entran | % | S mediana | S máxima | Esperado |  |
|---|---|---|---|---|---|---|---|
| Maestros dentro | 185 | 185 | 100,0 % | 0,957 | 0,982 | ≥ 95 % | ✔ |
| Alumnos dentro | 289 | 283 | 97,9 % | 0,659 | 1,000 | ≥ 90 % | ✔ |
| Obras propias dentro | 7444 | 3917 | 52,6 % | 1,000 | 1,000 |  |  |
| Obras del maestro de su época | 4348 | 1387 | 31,9 % | 0,257 | 0,707 | S mediana mayor que la de las muy posteriores | ✔ |
| Obras del maestro muy posteriores | 2240 | 1 | 0,0 % | 0,077 | 0,423 |  |  |
| Obras del maestro sin fecha | 1839 | 425 | 23,1 % | 0,194 | 0,714 |  |  |
| Obras de amigos | 19504 | 19 | 0,1 % | 0,040 | 0,405 | ≤ 1 % | ✔ |
| Cónyuges no artistas de amigos | 343 | 0 | 0,0 % | 0,032 | 0,115 | ≤ 0 % | ✔ |
| Compañeros solo por una organización grande | 116483 | 0 | 0,0 % | 0,024 | 0,280 | ≤ 1 % | ✔ |
| Obras coexpuestas de otros autores | 12362 | 55 | 0,4 % | 0,061 | 0,643 |  |  |
| Personas solo por coincidencias | 29762 | 1503 | 5,1 % | 0,069 | 0,792 |  |  |

| Tamaño |  |
|---|---|
| Centrales medidas | 325 |
| Directos (mediana / p95 / máximo) | 17 / 123 / 956 |
| Candidatos (mediana / p95 / máximo) | 1539 / 3508 / 7032 |
| Nodos dibujados, sin la central (mediana / p95 / máximo) | 31 / 119 / 149 |
| Tiempo de cálculo en ms (mediana / p95 / máximo) | 3,5 / 14,0 / 80,5 |
| Centrales que llenan el máximo | 11 de 325 |
| Centrales con el corte en un empate | 0 de 325 |
| Centrales sin ningún nodo | 0 de 325 |
| Centrales con menos de 3 nodos | 0 de 325 |

| Clase | % de lo dibujado |
|---|---|
| OBRA_DE_ARTE | 49,7 % |
| PERSONA | 35,4 % |
| ORGANIZACION | 14,9 % |

| Origen | % de lo dibujado |
|---|---|
| DECLARADA | 58,1 % |
| DEDUCIDA | 41,3 % |
| COINCIDENCIAS | 0,6 % |

### Por qué entran

#### Maestros dentro (185): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0458 | C0004 | PERSONA | 0,982 | 0,982 | 1,000 | DECLARADA | TA37, H07994, H14400, C0052, GA33, y 3 más | Mentoría (su maestro) · 1 exposición juntos |
| C0292 | C0011 | PERSONA | 0,980 | 0,980 | 1,000 | DECLARADA | TA10, MU21, H15948, MU13, MU22, y 2 más | Mentoría (su maestro) · 2 exposiciones juntos |
| C0014 | C0149 | PERSONA | 0,975 | 0,975 | 1,000 | DECLARADA | TA16, C1619, C0470, C0020 | Mentoría (su maestro) |
| C1341 | C0531 | PERSONA | 0,974 | 0,974 | 1,000 | DECLARADA | TA26, MU18 | Mentoría (su maestro) |
| C0391 | C1095 | PERSONA | 0,973 | 0,973 | 1,000 | DECLARADA | TA18, C1628, MU10, C1728 | Mentoría (su maestro) |
| C1468 | C1068 | PERSONA | 0,972 | 0,972 | 1,000 | DECLARADA | TA26, CI13 | Mentoría (su maestro) |
| C0012 | C0812 | PERSONA | 0,971 | 0,971 | 1,000 | DECLARADA | TA23, MU23 | Mentoría (su maestro) |
| C0162 | C0030 | PERSONA | 0,970 | 0,970 | 1,000 | DECLARADA | TA35, C0002, CI13, P0618 | Mentoría (su maestro) · 1 evento juntos |
| C0589 | C0297 | PERSONA | 0,970 | 0,970 | 1,000 | DECLARADA | TA19, GA40, CI10 | Mentoría (su maestro) |
| C1431 | C0334 | PERSONA | 0,970 | 0,970 | 1,000 | DECLARADA | TA31, C0347 | Mentoría (su maestro) |
| C0992 | C0938 | PERSONA | 0,970 | 0,970 | 1,000 | DECLARADA | TA35, CI18 | Mentoría (su maestro) |
| C0537 | C0001 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA36, C1658, MU12 | Mentoría (su maestro) |
| C0172 | C0055 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA22, MU10 | Mentoría (su maestro) |
| C1122 | C0154 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA18, AC01 | Mentoría (su maestro) |
| C0478 | C0930 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA21, AC03 | Mentoría (su maestro) |
| C1843 | C0191 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA08, C1554 | Mentoría (su maestro) |
| C0728 | C1682 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA30 | Mentoría (su maestro) |
| C1935 | C0655 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA17, MU18, H02669 | Mentoría (su maestro) · 1 exposición juntos |
| C0683 | C0469 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA12, GA12 | Mentoría (su maestro) |
| C0356 | C0710 | PERSONA | 0,969 | 0,969 | 1,000 | DECLARADA | TA07 | Mentoría (su maestro) |

#### Alumnos dentro (283): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0005 | C0562 | PERSONA | 1,000 | 1,000 | 1,000 | DECLARADA | C0039, H14497, C0935, MU08, C0105, y 3 más | Pintura, Mentoría (su aprendiz) |
| C0001 | C0748 | PERSONA | 0,847 | 0,847 | 1,000 | DECLARADA | TA36, H16054, H20864, C0798, C1966, y 9 más | Mentoría (su aprendiz) · 1 exposición juntos |
| C0467 | C1540 | PERSONA | 0,842 | 0,842 | 1,000 | DECLARADA | TA15 | Mentoría (su aprendiz), Amistad |
| C0004 | C0458 | PERSONA | 0,830 | 0,830 | 1,000 | DECLARADA | TA37, H02186, GA33, C0052, GA17, y 3 más | Mentoría (su aprendiz) · 1 exposición juntos |
| C0011 | C0292 | PERSONA | 0,795 | 0,795 | 1,000 | DECLARADA | TA10, MU21, MU22, MU13, C1023, y 5 más | Mentoría (su aprendiz) · 2 exposiciones juntos |
| C0012 | C0818 | PERSONA | 0,769 | 0,769 | 1,000 | DECLARADA | TA23, MU22, C0334, C0136 | Mentoría (su aprendiz) · 1 exposición juntos |
| C0004 | C1999 | PERSONA | 0,764 | 0,764 | 1,000 | DECLARADA | C0194, C0052, H19932, C0306, MU22, y 1 más | Mentoría (su aprendiz) · 1 exposición juntos |
| C0001 | C0293 | PERSONA | 0,747 | 0,747 | 1,000 | DECLARADA | TA36, C1482, C0653, MU02, C0652, y 5 más | Mentoría (su aprendiz) |
| C0001 | C0545 | PERSONA | 0,747 | 0,747 | 1,000 | DECLARADA | TA36, C1966, C0461, C0748, C0798, y 5 más | Mentoría (su aprendiz) |
| C0001 | C0537 | PERSONA | 0,745 | 0,745 | 1,000 | DECLARADA | TA36, C1658, MU12, C1966, C0545, y 6 más | Mentoría (su aprendiz) |
| C0001 | C0310 | PERSONA | 0,744 | 0,744 | 1,000 | DECLARADA | TA36, C1993, C0010, MU03, C0537, y 2 más | Mentoría (su aprendiz) |
| C0005 | C0101 | PERSONA | 0,737 | 0,737 | 1,000 | DECLARADA | C1159, MU01, C0001, C0781, C0088, y 4 más | Mentoría (su aprendiz) · 1 exposición juntos |
| C0531 | C1341 | PERSONA | 0,729 | 0,729 | 1,000 | DECLARADA | TA26, MU18, C0555 | Mentoría (su aprendiz) |
| C0005 | C1168 | PERSONA | 0,727 | 0,727 | 1,000 | DECLARADA | TA13, C0781, H13477, CI10 | Mentoría (su aprendiz) |
| C0089 | C1123 | PERSONA | 0,726 | 0,726 | 1,000 | DECLARADA | TA02, TA15 | Mentoría (su aprendiz) |
| C0014 | C1692 | PERSONA | 0,723 | 0,723 | 1,000 | DECLARADA | TA10, GA04, MU13, C0020, C1340 | Mentoría (su aprendiz) |
| C0005 | C0220 | PERSONA | 0,723 | 0,723 | 1,000 | DECLARADA | TA13, AC02, MU22, H17542, C0703 | Mentoría (su aprendiz) · 1 exposición juntos |
| C0001 | C0798 | PERSONA | 0,723 | 0,723 | 1,000 | DECLARADA | C0748, C0267, C1966, C0545, C0358, y 4 más | Mentoría (su aprendiz) |
| C0066 | C1062 | PERSONA | 0,722 | 0,722 | 1,000 | DECLARADA | MU24, H00921, C0476, C0468 | Mentoría (su aprendiz) · 2 exposiciones juntos |
| C0314 | C1086 | PERSONA | 0,717 | 0,717 | 1,000 | DECLARADA | TA19, MU13, H08055, C0234 | Mentoría (su aprendiz) · 1 exposición juntos |

#### Obras propias dentro (3917): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0001 | H00042 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00047 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00078 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00083 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00122 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00150 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA | H18352, GA11, C0082 | Pintura · 1 exposición juntos |
| C0001 | H00223 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00257 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00271 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00287 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00288 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00298 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00319 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00367 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00385 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00395 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00401 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00417 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00437 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |
| C0001 | H00505 | OBRA_DE_ARTE | 1,000 | 1,000 | 1,000 | DECLARADA |  | Pintura |

#### Obras del maestro de su época (1387): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0683 | H08761 | OBRA_DE_ARTE | 0,705 | 0,775 | 0,910 | DEDUCIDA | C0469, GA12 | Pintura de C0469 (su maestro) · Exposición de GA12 (Exposición) |
| C0391 | H03191 | OBRA_DE_ARTE | 0,702 | 0,772 | 0,910 | DEDUCIDA | C1095, MU10 | Pintura de C1095 (su maestro) · Exposición de MU10 (Exposición) |
| C0094 | H01801 | OBRA_DE_ARTE | 0,701 | 0,770 | 0,910 | DEDUCIDA | C0653, GA26 | Diseño de C0653 (su maestro) · Exposición de GA26 (Fundación) |
| C0094 | H10279 | OBRA_DE_ARTE | 0,701 | 0,770 | 0,910 | DEDUCIDA | C0653, GA26 | Diseño de C0653 (su maestro) · Exposición de GA26 (Fundación) |
| C0094 | H16153 | OBRA_DE_ARTE | 0,697 | 0,766 | 0,910 | DEDUCIDA | C0653, GA26 | Diseño de C0653 (su maestro) · Exposición de GA26 (Fundación) |
| C0284 | H14625 | OBRA_DE_ARTE | 0,610 | 0,671 | 0,910 | DEDUCIDA | C0403, MU22 | Diseño de C0403 (su maestro) · Exposición de MU22 (Exposición) |
| C0371 | H06568 | OBRA_DE_ARTE | 0,580 | 0,638 | 0,910 | DEDUCIDA | C0248, GA26 | Pintura de C0248 (su maestro) · Exposición de GA26 (Exposición) |
| C1267 | H09991 | OBRA_DE_ARTE | 0,545 | 0,596 | 0,915 | DEDUCIDA | C0070, MU23, H17240 | Pintura de C0070 (su maestro) · Exposición de MU23 (Exposición) · Exposición de H17240 (Creación) · Coinciden en 1 exposición |
| C0172 | H13693 | OBRA_DE_ARTE | 0,537 | 0,590 | 0,910 | DEDUCIDA | C0055, MU10 | Pintura de C0055 (su maestro) · Exposición de MU10 (Exposición) |
| C0172 | H07870 | OBRA_DE_ARTE | 0,535 | 0,588 | 0,910 | DEDUCIDA | C0055, MU10 | Pintura de C0055 (su maestro) · Exposición de MU10 (Exposición) |
| C1352 | H21995 | OBRA_DE_ARTE | 0,535 | 0,761 | 0,702 | DEDUCIDA | C1027, C0219 | Pintura de C1027 (su maestro) · Exposición de C0219 (Diseño) |
| C1610 | H16485 | OBRA_DE_ARTE | 0,534 | 0,760 | 0,703 | DEDUCIDA | C1417, C0616 | Diseño de C1417 (su maestro) · Exposición de C0616 (Amistad) |
| C0386 | H20081 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C0386 | H21025 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C0386 | H21961 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C1935 | H21427 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0655 | Pintura de C0655 (su maestro) |
| C0469 | H05583 | OBRA_DE_ARTE | 0,534 | 0,760 | 0,702 | DEDUCIDA | C0586, C0797 | Creación de C0586 (su maestro) · Exposición de C0797 (su aprendiz) |
| C1994 | H09813 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0503 | Pintura de C0503 (su maestro) |
| C1994 | H13007 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0503 | Pintura de C0503 (su maestro) |
| C0788 | H20081 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |

#### Obras del maestro muy posteriores (1)

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0458 | H02186 | OBRA_DE_ARTE | 0,423 | 0,456 | 0,926 | DEDUCIDA | C0004, H07994, H14400, GA33 | Creación de C0004 (su maestro) · Exposición de H07994 (Pintura) · Exposición de H14400 (Pintura) · Exposición de GA33 (Exposición) · Coinciden en 1 exposición |

#### Obras del maestro sin fecha (425): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0386 | H03818 | OBRA_DE_ARTE | 0,714 | 0,783 | 0,912 | DEDUCIDA | C0285, MU01, H16170 | Pintura de C0285 (su maestro) · Exposición de MU01 (Exposición) · Exposición de H16170 (Pintura) · Coinciden en 1 exposición |
| C1731 | H19082 | OBRA_DE_ARTE | 0,624 | 0,685 | 0,912 | DEDUCIDA | C0081, MU01, H06621 | Pintura de C0081 (su maestro) · Exposición de MU01 (Exposición) · Exposición de H06621 (Creación) · Coinciden en 1 exposición |
| C0847 | H14625 | OBRA_DE_ARTE | 0,610 | 0,671 | 0,910 | DEDUCIDA | C0403, MU22 | Diseño de C0403 (su maestro) · Exposición de MU22 (Exposición) |
| C0386 | H21881 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C1935 | H16873 | OBRA_DE_ARTE | 0,534 | 0,763 | 0,700 | DEDUCIDA | C0655 | Pintura de C0655 (su maestro) |
| C0788 | H03818 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C0788 | H21881 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C0513 | H14744 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0336 | Pintura de C0336 (su maestro) |
| C0723 | H18379 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1660 | Creación de C1660 (su maestro) |
| C0723 | H20869 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1660 | Creación de C1660 (su maestro) |
| C1352 | H13460 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1027 | Pintura de C1027 (su maestro) |
| C0345 | H15776 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1242 | Pintura de C1242 (su maestro) |
| C0345 | H16044 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1242 | Pintura de C1242 (su maestro) |
| C0253 | H21645 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1965 | Pintura de C1965 (su maestro) |
| C0938 | H03818 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C0938 | H21881 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C0285 | Pintura de C0285 (su maestro) |
| C1366 | H00439 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1180 | Pintura de C1180 (su maestro) |
| C1366 | H03559 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1180 | Pintura de C1180 (su maestro) |
| C1366 | H04123 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1180 | Pintura de C1180 (su maestro) |
| C1366 | H04232 | OBRA_DE_ARTE | 0,532 | 0,760 | 0,700 | DEDUCIDA | C1180 | Pintura de C1180 (su maestro) |

#### Obras de amigos (19)

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0598 | H09982 | OBRA_DE_ARTE | 0,405 | 0,569 | 0,712 | DEDUCIDA | C0467, C1396 | Pintura de C0467 (Colaboración, Amistad) · Exposición de C1396 (Amistad) |
| C0467 | H01728 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0598 | Pintura de C0598 (Colaboración, Amistad) |
| C0467 | H09378 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0598 | Pintura de C0598 (Colaboración, Amistad) |
| C0467 | H12059 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0598 | Pintura de C0598 (Colaboración, Amistad) |
| C0598 | H03022 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H04055 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H04070 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H09596 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H19203 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H20115 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H20229 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C0598 | H21428 | OBRA_DE_ARTE | 0,396 | 0,565 | 0,700 | DEDUCIDA | C0467 | Pintura de C0467 (Colaboración, Amistad) |
| C1861 | H12359 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1109 | Pintura de C1109 (Colaboración, Amistad) |
| C0158 | H01136 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |
| C0158 | H02040 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |
| C0158 | H08850 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |
| C0158 | H13811 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |
| C0158 | H15170 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |
| C0158 | H15911 | OBRA_DE_ARTE | 0,391 | 0,559 | 0,700 | DEDUCIDA | C1190 | Pintura de C1190 (Colaboración, Amistad) |

#### Obras coexpuestas de otros autores (55): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0055 | H16053 | OBRA_DE_ARTE | 0,608 | 0,660 | 0,922 | DEDUCIDA | C1173, H13693, GA29 | Creación de C1173 (Colaboración) · Exposición de H13693 (Pintura) · Exposición de GA29 (Exposición) · Coinciden en 1 exposición |
| C0055 | H03466 | OBRA_DE_ARTE | 0,605 | 0,657 | 0,922 | DEDUCIDA | C1173, H13693, GA29 | Creación de C1173 (Colaboración) · Exposición de H13693 (Pintura) · Exposición de GA29 (Exposición) · Coinciden en 1 exposición |
| C0675 | H12554 | OBRA_DE_ARTE | 0,573 | 0,625 | 0,917 | DEDUCIDA | C0689, MU18 | Pintura de C0689 (Colaboración) · Exposición de MU18 (Exposición) · Coinciden en 1 exposición |
| C1309 | H03730 | OBRA_DE_ARTE | 0,547 | 0,598 | 0,914 | DEDUCIDA | C0977, MU09 | Creación de C0977 (Colaboración) · Exposición de MU09 (Exposición) · Coinciden en 1 exposición |
| C0905 | H00825 | OBRA_DE_ARTE | 0,498 | 0,547 | 0,912 | DEDUCIDA | C1875, MU10, H04134, C0481 | Creación de C1875 (Colaboración) · Exposición de MU10 (Exposición) · Exposición de H04134 (Pintura) · Exposición de C0481 (Amistad) · Coinciden en 1 exposición |
| C1875 | H04134 | OBRA_DE_ARTE | 0,484 | 0,531 | 0,912 | DEDUCIDA | C0905, MU10, H00825, C1240 | Pintura de C0905 (Colaboración) · Exposición de MU10 (Exposición) · Exposición de H00825 (Creación) · Exposición de C1240 (Amistad) · Coinciden en 1 exposición |
| C1520 | H11241 | OBRA_DE_ARTE | 0,482 | 0,521 | 0,924 | DEDUCIDA | C0013, H11487, H20762, GA30 | Pintura de C0013 (Colaboración) · Exposición de H11487 (Creación) · Exposición de H20762 (Creación) · Exposición de GA30 (Exposición) · Coinciden en 1 exposición |
| C1520 | H03921 | OBRA_DE_ARTE | 0,482 | 0,521 | 0,924 | DEDUCIDA | C0013, H11487, H20762, GA30 | Pintura de C0013 (Colaboración) · Exposición de H11487 (Creación) · Exposición de H20762 (Creación) · Exposición de GA30 (Exposición) · Coinciden en 1 exposición |
| C0729 | H08885 | OBRA_DE_ARTE | 0,428 | 0,462 | 0,926 | DEDUCIDA | C0005, H19377, H20829, GA01 | Pintura de C0005 (Pintura) · Exposición de H19377 (Pintura) · Exposición de H20829 (Pintura) · Exposición de GA01 (Exposición) · Coinciden en 1 exposición |
| C1914 | H04172 | OBRA_DE_ARTE | 0,416 | 0,451 | 0,923 | DEDUCIDA | C0024, H21126, GA25, H06518 | Pintura de C0024 (Pintura) · Exposición de H21126 (Pintura) · Exposición de GA25 (Exposición) · Exposición de H06518 (Pintura) · Coinciden en 1 exposición |
| C0386 | H11231 | OBRA_DE_ARTE | 0,381 | 0,469 | 0,813 | DEDUCIDA | C0892, H17471, GA38, H08708, H04927 | Pintura de C0892 (coinciden en 3 exposiciones) · Exposición de H17471 (Pintura) · Exposición de GA38 (Exposición) · Exposición de H08708 (Pintura) · Exposición de H04927 (Pintura) · … · Coinciden en 2 exposiciones |
| C0386 | H08227 | OBRA_DE_ARTE | 0,381 | 0,468 | 0,813 | DEDUCIDA | C0892, H17471, GA38, H08708, H16170 | Pintura de C0892 (coinciden en 3 exposiciones) · Exposición de H17471 (Pintura) · Exposición de GA38 (Exposición) · Exposición de H08708 (Pintura) · Exposición de H16170 (Pintura) · … · Coinciden en 2 exposiciones |
| C0212 | H00299 | OBRA_DE_ARTE | 0,381 | 0,410 | 0,927 | DEDUCIDA | H07132, H17457, GA11, MU21, C0421 | Exposición de H07132 (Diseño) · Exposición de H17457 (Diseño) · Exposición de GA11 (Exposición) · Exposición de MU21 (Exposición) · Exposición de C0421 (Creación) · … · Coinciden en 2 exposiciones |
| C0121 | H11724 | OBRA_DE_ARTE | 0,380 | 0,410 | 0,926 | DEDUCIDA | H01649, H02929, GA20, GA05 | Exposición de H01649 (Diseño) · Exposición de H02929 (Diseño) · Exposición de GA20 (Exposición) · Exposición de GA05 (Exposición) · Coinciden en 1 exposición |
| C0926 | H16987 | OBRA_DE_ARTE | 0,379 | 0,481 | 0,786 | DEDUCIDA | H18000, H19189, H13132, GA06 | Exposición de H18000 (Pintura) · Exposición de H19189 (Pintura) · Exposición de H13132 (Pintura) · Exposición de GA06 (Exposición) · Coinciden en 2 exposiciones |
| C0086 | H20121 | OBRA_DE_ARTE | 0,373 | 0,403 | 0,926 | DEDUCIDA | H09628, H18669, GA14, MU18 | Exposición de H09628 (Pintura) · Exposición de H18669 (Pintura) · Exposición de GA14 (Exposición) · Exposición de MU18 (Exposición) · Coinciden en 1 exposición |
| C0049 | H07957 | OBRA_DE_ARTE | 0,372 | 0,408 | 0,911 | DEDUCIDA | C0009, MU10, C0082 | Pintura de C0009 (Colaboración) · Exposición de MU10 (Exposición) · Exposición de C0082 (Diseño) · Coinciden en 1 exposición |
| C0729 | H03743 | OBRA_DE_ARTE | 0,371 | 0,402 | 0,923 | DEDUCIDA | C0005, H05366, H18306, GA01 | Pintura de C0005 (Pintura) · Exposición de H05366 (Pintura) · Exposición de H18306 (Pintura) · Exposición de GA01 (Exposición) · Coinciden en 1 exposición |
| C0421 | H09960 | OBRA_DE_ARTE | 0,367 | 0,396 | 0,929 | DEDUCIDA | H00393, H17793, GA25, MU13, C0196 | Exposición de H00393 (Creación) · Exposición de H17793 (Creación) · Exposición de GA25 (Exposición) · Exposición de MU13 (Exposición) · Exposición de C0196 (Amistad) · … · Coinciden en 1 exposición |
| C0093 | H10661 | OBRA_DE_ARTE | 0,364 | 0,393 | 0,927 | DEDUCIDA | H11699, H10594, GA27, MU22, H02210 | Exposición de H11699 (Pintura) · Exposición de H10594 (Pintura) · Exposición de GA27 (Exposición) · Exposición de MU22 (Exposición) · Exposición de H02210 (Creación) · … · Coinciden en 2 exposiciones |

#### Personas solo por coincidencias (1503): las 20 de más S

| Central | Entra | Clase | S | R | C | Origen | Padres | Por qué |
|---|---|---|---|---|---|---|---|---|
| C0001 | C0031 | PERSONA | 0,792 | 0,795 | 0,995 | DEDUCIDA | C0652, C0915, C0010, H01731, H02096, y 8 más | Pintura de C0652 (Creación) · Pintura de C0915 (Pintura) · Pintura de C0010 (Pintura) · Exposición de H01731 (Pintura) · Exposición de H02096 (Pintura) · … · Coinciden en 2 exposiciones |
| C0421 | C0005 | PERSONA | 0,786 | 0,792 | 0,992 | DEDUCIDA | C0562, MU02, MU22, CI13, H01898, y 1 más | Pintura de C0562 (su maestro) · Exposición de MU02 (Exposición) · Exposición de MU22 (Exposición) · Evento de CI13 (Evento) · Exposición de H01898 (Creación) · … · Coinciden en 1 exposición |
| C0001 | C0002 | PERSONA | 0,771 | 0,772 | 1,000 | DEDUCIDA | C0079, C0109, GA39, C1331, MU12, y 9 más | Creación de C0079 (Colaboración) · Creación de C0109 (su aprendiz) · Exposición de GA39 (Exposición) · Exposición de C1331 (Pintura) · Exposición de MU12 (Exposición) · … · Coinciden en 1 evento |
| C0826 | C0040 | PERSONA | 0,770 | 0,789 | 0,975 | DEDUCIDA | C1979, MU13, CI12 | Pintura de C1979 (su maestro) · Exposición de MU13 (Exposición) · Evento de CI12 (Evento) · Coinciden en 1 evento |
| C0589 | C0168 | PERSONA | 0,759 | 0,778 | 0,975 | DEDUCIDA | C0297, CI07, CI15 | Pintura de C0297 (su maestro) · Evento de CI07 (Relación profesional) · Evento de CI15 (Evento) · Coinciden en 1 evento |
| C0345 | C0291 | PERSONA | 0,756 | 0,820 | 0,922 | DEDUCIDA | C1242, GA11, C0390 | Pintura de C1242 (su maestro) · Exposición de GA11 (Exposición) · Exposición de C0390 (Pintura) · Coinciden en 1 exposición |
| C0022 | C0010 | PERSONA | 0,744 | 0,745 | 0,999 | DEDUCIDA | C0251, C0180, H00441, GA23, C0323, y 11 más | Pintura de C0251 (Creación) · Pintura de C0180 (Creación) · Exposición de H00441 (Creación) · Exposición de GA23 (Exposición) · Pintura de C0323 (coinciden en 4 exposiciones) · … · Coinciden en 2 eventos |
| C0010 | C0022 | PERSONA | 0,738 | 0,739 | 0,999 | DEDUCIDA | C0180, C0251, C0323, GA23, C0214, y 6 más | Creación de C0180 (Pintura) · Creación de C0251 (Pintura) · Exposición de C0323 (Pintura) · Exposición de GA23 (Exposición) · Exposición de C0214 (Pintura) · … · Coinciden en 2 eventos |
| C0001 | C0157 | PERSONA | 0,717 | 0,717 | 1,000 | DEDUCIDA | C0026, C0915, C1536, H08788, H16856, y 12 más | Pintura de C0026 (Pintura) · Amistad de C0915 (Pintura) · Colaboración de C1536 (Amistad) · Exposición de H08788 (Pintura) · Exposición de H16856 (Pintura) · … · Coinciden en 2 exposiciones |
| C0847 | C0531 | PERSONA | 0,717 | 0,784 | 0,914 | DEDUCIDA | C0403, MU18, H00221, C1129 | Pintura de C0403 (su maestro) · Exposición de MU18 (Exposición) · Exposición de H00221 (Pintura) · Exposición de C1129 (Amistad) · Coinciden en 1 exposición |
| C0284 | C0531 | PERSONA | 0,715 | 0,782 | 0,915 | DEDUCIDA | C0403, MU18, C0791 | Pintura de C0403 (su maestro) · Exposición de MU18 (Exposición) · Boda de C0791 (Amistad) · Coinciden en 1 exposición |
| C0022 | C0260 | PERSONA | 0,710 | 0,716 | 0,993 | DEDUCIDA | C0577, C0013, AC02, CI03, C0899, y 4 más | Diseño de C0577 (Colaboración) · Diseño de C0013 (Creación) · Empleo de AC02 (Empleo) · Evento de CI03 (Evento) · Exposición de C0899 (Creación) · … · Coinciden en 1 evento |
| C0386 | C0263 | PERSONA | 0,710 | 0,779 | 0,912 | DEDUCIDA | C0764, MU18, C0892 | Pintura de C0764 (su maestro) · Exposición de MU18 (Exposición) · Exposición de C0892 (coinciden en 3 exposiciones) · Coinciden en 1 exposición |
| C0003 | C0176 | PERSONA | 0,709 | 0,709 | 1,000 | DEDUCIDA | C0557, C0143, C0372, MU19, MU02, y 17 más | Mentoría de C0557 (su aprendiz) · Exposición de C0143 (Pintura) · Exposición de C0372 (Pintura) · Exposición de MU19 (Exposición) · Exposición de MU02 (Exposición) · … · Coinciden en 4 eventos |
| C0022 | C1260 | PERSONA | 0,707 | 0,712 | 0,993 | DEDUCIDA | C0342, H21514, H11859, GA23, MU19, y 1 más | Pintura de C0342 (Colaboración) · Exposición de H21514 (Creación) · Exposición de H11859 (Diseño) · Exposición de GA23 (Exposición) · Exposición de MU19 (Exposición) · … · Coinciden en 1 exposición |
| C0022 | C0052 | PERSONA | 0,704 | 0,707 | 0,996 | COINCIDENCIAS | C0008, C0342, C1949, H18467, MU03, y 8 más | Coinciden en 5 exposiciones · Pintura con C0008 |
| C0009 | C0005 | PERSONA | 0,699 | 0,703 | 0,994 | DEDUCIDA | C0781, C0935, C1066, C1900, CI10, y 4 más | Pintura de C0781 (Colaboración) · Pintura de C0935 (Pintura) · Amistad de C1066 (Amistad) · Exposición de C1900 (su aprendiz) · Evento de CI10 (Evento) · … · Coinciden en 1 evento |
| C0001 | C0052 | PERSONA | 0,698 | 0,698 | 1,000 | DEDUCIDA | TA36, C0344, C1658, C0933, C1331, y 13 más | Mentoría de TA36 (Mentoría) · Pintura de C0344 (Amistad) · Pintura de C1658 (Amistad) · Exposición de C0933 (Pintura) · Exposición de C1331 (Pintura) · … · Coinciden en 1 exposición |
| C0022 | C0144 | PERSONA | 0,688 | 0,690 | 0,998 | DEDUCIDA | C1622, C0013, H21514, GA23, AC02, y 10 más | Amistad de C1622 (Diseño) · Amistad de C0013 (Creación) · Exposición de H21514 (Creación) · Exposición de GA23 (Exposición) · Empleo de AC02 (Empleo) · … · Coinciden en 3 exposiciones |
| C0006 | C0031 | PERSONA | 0,686 | 0,690 | 0,994 | DEDUCIDA | C0915, MU20, AC03, MU23, C1006, y 7 más | Pintura de C0915 (Colaboración) · Exposición de MU20 (Exposición) · Empleo de AC03 (Empleo) · Exposición de MU23 (Exposición) · Exposición de C1006 (Pintura) · … · Coinciden en 2 exposiciones |


## Monotonía

| Penalización por grado | Centrales | Valores de S comparados | Bajan | Mayor bajada |
|---|---|---|---|---|
| activada | 60 | 155375 | 0 | 0,0000 |
| desactivada | 60 | 155375 | 0 | 0,0000 |

## Tipos y datos

### Tipos de relación

Los resaltados reciben pesoPorDefecto: habría que darles un peso en pesosRelevancia.

| Tipo | Relaciones | Peso | De dónde sale |  |
|---|---|---|---|---|
| Exposition | 133117 | 0,70 | exacto |  |
| Wedding | 28471 | 0,20 | exacto |  |
| Paint | 12833 | 1,00 | heredado de Creation |  |
| Event | 12384 | 0,30 | exacto |  |
| Design | 3582 | 1,00 | heredado de Creation |  |
| Creation | 3525 | 1,00 | exacto |  |
| Friendship | 2748 | 0,50 | exacto |  |
| Mentorship | 2211 | 0,95 | exacto |  |
| Employement | 1517 | 0,65 | exacto |  |
| Marriage | 707 | 0,50 | exacto |  |
| coworking | 568 | 0,85 | exacto |  |
| Professional | 384 | 0,60 | exacto |  |
| Filiation | 364 | 0,45 | exacto |  |
| Fund | 313 | 0,85 | exacto |  |
| Work | 141 | 0,60 | exacto |  |

### Roles sin equivalencia

Por tipo de relación, sin distinguir mayúsculas ni «/a». Solo importan en los tipos con pesos por rol o con claves con rol en la tabla T (Mentorship) y en los que heredan de ellos o les equivalen: los resaltados se añaden a rolesEquivalentes. Los demás no cambian nada.

| Tipo de relación | Roles (veces) | Importa |  |
|---|---|---|---|
| Exposition | expositor (174166) | no |  |
| Wedding | invitado (47975), contrayente (8967) | no |  |
| Event | asistente (22243) | no |  |
| Paint | autor (12365), coautor (992) | no |  |
| Friendship | amigo (5496) | no |  |
| Design | autor (3469), coautor (244) | no |  |
| Creation | autor (3391), coautor (282) | no |  |
| Employement | profesor (941), oficial (484), empleado (92) | no |  |
| Marriage | cónyuge (1414) | no |  |
| coworking | colaborador (1136) | no |  |
| Filiation | hijo (364), progenitor (364) | no |  |
| Fund | fundador (427) | no |  |
| Professional | miembro (384) | no |  |
| Work | conservador (141) | no |  |

### Pares de tipos con transferenciaPorDefecto

Primer tramo > segundo tramo, de más a menos relevancia movida en total (suma de sus aportaciones). Los primeros son los que habría que añadir a tablaTransferencia.

| Par | Caminos | Fuerza que mueven |  |
|---|---|---|---|
| Paint>Paint | 12143 | 1835,1 |  |
| Creation>Creation | 5117 | 688,1 |  |
| Friendship>Exposition | 98749 | 544,0 |  |
| Event>Event | 54175 | 482,4 |  |
| Design>Design | 1970 | 324,7 |  |
| coworking>Exposition | 24864 | 267,8 |  |
| Event>Professional | 7797 | 260,0 |  |
| Mentorship:maestro>Exposition | 20451 | 251,6 |  |
| Mentorship>Employement | 1970 | 246,7 |  |
| Paint>Creation | 1562 | 243,3 |  |
| Exposition>Work | 3462 | 198,6 |  |
| Creation>Paint | 931 | 194,2 |  |
| Friendship>Mentorship | 1849 | 194,0 |  |
| Employement>Mentorship | 1930 | 170,5 |  |
| Mentorship:aprendiz>Exposition | 24925 | 165,7 |  |
| Paint>Mentorship | 772 | 162,6 |  |
| Paint>Friendship | 1198 | 160,6 |  |
| Design>Paint | 701 | 145,3 |  |
| Professional>Event | 8083 | 142,2 |  |
| Paint>Design | 673 | 133,0 |  |
| Fund>Exposition | 5739 | 100,7 |  |
| coworking>Mentorship | 544 | 100,0 |  |
| Mentorship:maestro>Friendship | 770 | 96,8 |  |
| coworking>Friendship | 826 | 95,4 |  |
| Friendship>Event | 11769 | 85,7 |  |
| Friendship>coworking | 683 | 82,6 |  |
| Professional>Professional | 1198 | 76,2 |  |
| Exposition>Fund | 784 | 71,6 |  |
| Paint>coworking | 268 | 68,2 |  |
| Paint>Event | 4274 | 63,0 |  |
| Creation>Friendship | 443 | 61,1 |  |
| Mentorship:aprendiz>Friendship | 743 | 60,8 |  |
| Creation>Design | 249 | 57,9 |  |
| Friendship>Employement | 678 | 48,9 |  |
| Mentorship:maestro>Event | 3828 | 48,7 |  |
| Design>Creation | 253 | 47,1 |  |
| Fund>Paint | 313 | 46,9 |  |
| coworking>Event | 3513 | 44,3 |  |
| Creation>Mentorship | 204 | 42,4 |  |
| Mentorship:maestro>coworking | 184 | 41,4 |  |
| Design>Friendship | 293 | 40,2 |  |
| Mentorship>Fund | 353 | 38,1 |  |
| Marriage>Exposition | 5485 | 34,9 |  |
| coworking>coworking | 157 | 34,0 |  |
| Design>Mentorship | 142 | 32,2 |  |
| Paint>Employement | 203 | 31,6 |  |
| Event>Fund | 868 | 30,8 |  |
| Friendship>Wedding | 19341 | 30,2 |  |
| Creation>Event | 1816 | 26,2 |  |
| Mentorship:aprendiz>coworking | 167 | 25,3 |  |
| Event>Paint | 2533 | 24,5 |  |
| coworking>Employement | 179 | 23,7 |  |
| Filiation>Paint | 208 | 22,8 |  |
| Exposition>Friendship | 1239 | 21,7 |  |
| Paint>Marriage | 189 | 21,6 |  |
| Fund>Design | 157 | 21,0 |  |
| Exposition>Mentorship | 704 | 20,0 |  |
| Creation>coworking | 78 | 20,0 |  |
| Mentorship:aprendiz>Event | 1963 | 19,8 |  |
| Design>coworking | 77 | 19,7 |  |
| Fund>Event | 1237 | 18,7 |  |
| Mentorship:maestro>Employement | 129 | 18,3 |  |
| Design>Event | 1129 | 17,5 |  |
| Fund>Mentorship | 183 | 17,2 |  |
| Paint>Wedding | 4521 | 16,9 |  |
| Mentorship:aprendiz>Employement | 183 | 16,8 |  |
| Friendship>Fund | 210 | 15,6 |  |
| Marriage>Friendship | 227 | 14,0 |  |
| coworking>Marriage | 148 | 13,9 |  |
| Friendship>Professional | 197 | 13,6 |  |
| Friendship>Filiation | 291 | 13,0 |  |
| Marriage>Mentorship | 120 | 12,9 |  |
| coworking>Wedding | 4044 | 12,8 |  |
| Event>Creation | 1805 | 12,4 |  |
| Mentorship:maestro>Marriage | 111 | 12,1 |  |
| Employement>Fund | 154 | 11,7 |  |
| Creation>Employement | 71 | 11,1 |  |
| Mentorship:maestro>Wedding | 3357 | 10,9 |  |
| Paint>Professional | 71 | 10,4 |  |
| Fund>Friendship | 119 | 10,0 |  |
| Fund>Professional | 163 | 9,9 |  |
| Mentorship:aprendiz>Wedding | 4331 | 9,7 |  |
| Paint>Filiation | 94 | 9,6 |  |
| Exposition>Event | 4733 | 9,4 |  |
| Professional>Fund | 137 | 9,4 |  |
| Design>Employement | 60 | 9,4 |  |
| Filiation>Exposition | 1787 | 9,2 |  |
| Mentorship:aprendiz>Marriage | 131 | 8,5 |  |
| Exposition>coworking | 263 | 8,4 |  |
| Paint>Fund | 56 | 8,3 |  |
| Fund>Employement | 107 | 7,9 |  |
| Marriage>Event | 1255 | 7,8 |  |
| Marriage>Wedding | 7081 | 7,7 |  |
| Fund>Fund | 104 | 7,6 |  |
| Filiation>Design | 71 | 7,4 |  |
| Fund>Creation | 40 | 7,1 |  |
| coworking>Fund | 54 | 6,9 |  |
| Event>Exposition | 10581 | 6,8 |  |
| Event>Design | 651 | 6,5 |  |
| Mentorship:aprendiz>Fund | 63 | 6,4 |  |
| Creation>Marriage | 53 | 6,3 |  |
| coworking>Professional | 47 | 5,8 |  |
| Marriage>coworking | 45 | 5,8 |  |
| Mentorship:maestro>Filiation | 65 | 5,7 |  |
| coworking>Filiation | 69 | 5,7 |  |
| Design>Wedding | 1456 | 5,4 |  |
| Filiation>Friendship | 90 | 4,9 |  |
| Mentorship:maestro>Professional | 35 | 4,7 |  |
| Creation>Wedding | 1194 | 4,6 |  |
| Mentorship:maestro>Fund | 30 | 4,4 |  |
| Mentorship:aprendiz>Filiation | 77 | 4,3 |  |
| Mentorship:aprendiz>Professional | 51 | 4,3 |  |
| Filiation>Mentorship | 38 | 3,9 |  |
| Design>Marriage | 36 | 3,9 |  |
| Marriage>Marriage | 82 | 3,9 |  |
| Creation>Filiation | 40 | 3,8 |  |
| Exposition>Employement | 197 | 3,7 |  |
| Wedding>Paint | 1192 | 3,6 |  |
| Marriage>Employement | 61 | 3,4 |  |
| Fund>coworking | 23 | 3,3 |  |
| Filiation>Event | 575 | 3,2 |  |
| Filiation>Wedding | 3244 | 3,0 |  |
| Creation>Fund | 16 | 2,9 |  |
| Event>Mentorship | 231 | 2,7 |  |
| Creation>Professional | 18 | 2,7 |  |
| Event>Friendship | 350 | 2,6 |  |
| Filiation>Marriage | 53 | 2,2 |  |
| Exposition>Wedding | 4455 | 2,1 |  |
| Marriage>Fund | 26 | 2,1 |  |
| Marriage>Filiation | 49 | 2,1 |  |
| Design>Filiation | 23 | 2,1 |  |
| Design>Professional | 14 | 2,0 |  |
| Filiation>Employement | 39 | 2,0 |  |
| Exposition>Marriage | 156 | 2,0 |  |
| Wedding>Creation | 565 | 1,7 |  |
| Design>Fund | 10 | 1,5 |  |
| Wedding>Exposition | 3794 | 1,4 |  |
| Fund>Wedding | 539 | 1,2 |  |
| Fund>Marriage | 16 | 1,1 |  |
| Exposition>Professional | 65 | 1,1 |  |
| Filiation>coworking | 10 | 1,1 |  |
| Event>coworking | 76 | 1,1 |  |
| Filiation>Filiation | 27 | 1,0 |  |
| Exposition>Filiation | 75 | 1,0 |  |
| Marriage>Professional | 11 | 0,8 |  |
| Fund>Filiation | 11 | 0,7 |  |
| Wedding>Design | 80 | 0,7 |  |
| Wedding>Mentorship | 108 | 0,6 |  |
| Wedding>Friendship | 167 | 0,6 |  |
| Marriage>Work | 14 | 0,5 |  |
| Event>Employement | 45 | 0,4 |  |
| Friendship>Work | 10 | 0,4 |  |
| Wedding>Wedding | 5113 | 0,3 |  |
| Wedding>Event | 901 | 0,3 |  |
| Event>Marriage | 46 | 0,3 |  |
| Filiation>Professional | 4 | 0,3 |  |
| Event>Wedding | 1198 | 0,2 |  |
| Filiation>Creation | 2 | 0,2 |  |
| Wedding>coworking | 31 | 0,2 |  |
| Filiation>Work | 6 | 0,2 |  |
| Filiation>Fund | 2 | 0,2 |  |
| Wedding>Marriage | 58 | 0,2 |  |
| Event>Filiation | 27 | 0,2 |  |
| Wedding>Employement | 33 | 0,1 |  |
| Wedding>Filiation | 35 | 0,1 |  |
| Wedding>Fund | 18 | 0,1 |  |
| Wedding>Professional | 10 | 0,0 |  |
| Wedding>Work | 10 | 0,0 |  |

### Pares temporales

En qué parte de sus caminos falta alguna fecha (y se usa transferenciaSinFecha).

| Par | Caminos | Sin alguna fecha |  |
|---|---|---|---|
| Employement>Employement | 47316 | 0,0 % |  |
| Mentorship>Creation | 11929 | 20,7 % |  |
| Mentorship>Mentorship | 5346 | 16,3 % |  |
| Friendship>Marriage | 533 | 52,9 % |  |

### Relaciones «via»

Qué relación de la base de datos une cada extremo con su intermediario. Las de relacionesLugar (OCURRED_AT) marcan el lugar del evento.

| Relación | Veces |  |
|---|---|---|
| PARTICIPATES_IN | 274662 |  |
| IS_EXPOSED | 76472 |  |
| OCURRED_AT | 21271 |  |
| PRODUCED | 19137 |  |
| HAS_ROLE_IN | 13989 |  |
| CREATE | 199 |  |

### Intermediarios grandes



| Tipo | Qué pasa con ellos | Cuántos |  |
|---|---|---|---|
| Exposition | no dibujables (más de maxParticipantesIntermediario, en lo cargado) | 446 |  |
| Wedding | no dibujables (más de maxParticipantesIntermediario, en lo cargado) | 322 |  |
| Event | no dibujables (más de maxParticipantesIntermediario, en lo cargado) | 129 |  |
| Exposition | ignorados (más de maxParticipantesEvidencia, en toda la base de datos) | 3 | ⚠ |

### Eventos

Por cada tipo de tiposCoincidencia, en lo cargado. «En el tope»: sus coincidencias entre personas valen topeCoincidencia; «bajan»: tienen tantas personas registradas que valen menos. «Juntados»: los que el servidor ha unido por estar registrados varias veces.

| Tipo | Eventos | Personas registradas (mín / mediana / máx) | En el tope | Bajan | Sin lugar | Sin día | Juntados | Juntados en toda la BD |  |
|---|---|---|---|---|---|---|---|---|---|
| Exposition | 1977 | 1 / 3 / 78 | 1834 | 143 | 0 | 1916 | 61 | 61 |  |
| Wedding | 524 | 4 / 12 / 22 | 202 | 322 | 524 | 524 | 0 | 0 |  |
| Event | 300 | 3 / 9 / 14 | 193 | 107 | 0 | 287 | 13 | 13 |  |
| Work | 141 | 1 / 1 / 1 | 141 | 0 | 0 | 135 | 6 | 6 |  |

### Etiquetas de entidad

Con clase: la etiqueta o un padre suyo está en etiquetasEntidad. Con factor: está en factorEntidad.

| Etiqueta | Entidades | Con clase | Con factor |  |
|---|---|---|---|---|
| HeritageItem | 19648 | sí | sí |  |
| Person | 3473 | sí | sí |  |
| Creator | 2000 | sí | sí |  |
| Painter | 1394 | sí | sí |  |
| Designer | 314 | sí | sí |  |
| Organization | 143 | sí | sí |  |

## Configuración

```json
{
  "perfil": "artistico",
  "estrategiaNodos": "tresCapas",
  "pesosRelevancia": {
    "Creation": 1,
    "Mentorship": 0.95,
    "coworking": 0.85,
    "Fund": 0.85,
    "Exposition": 0.7,
    "Employement": 0.65,
    "Professional": 0.6,
    "Work": 0.6,
    "Friendship": 0.5,
    "Marriage": 0.5,
    "Related": 0.45,
    "Filiation": 0.45,
    "Wedding": 0.2,
    "Event": 0.3
  },
  "pesoPorDefecto": 0.4,
  "pesosPorRol": {
    "Mentorship.maestro": 0.95,
    "Mentorship.aprendiz": 0.6
  },
  "rolesEquivalentes": {
    "maestro": [
      "maestro",
      "maestra",
      "mestre",
      "mestra",
      "teacher",
      "master"
    ],
    "aprendiz": [
      "aprendiz",
      "alumno",
      "alumna",
      "discípulo",
      "discípula",
      "deixeble",
      "student",
      "apprentice"
    ]
  },
  "tiposEquivalentes": {
    "STUDENT_OF": "Mentorship",
    "Apprenticeship": "Mentorship"
  },
  "rolesPorDireccion": {
    "STUDENT_OF": {
      "origen": "aprendiz",
      "destino": "maestro"
    }
  },
  "betaParticipantes": 1,
  "factorTiempoMinimo": 0.5,
  "tauTiempoAnios": 25,
  "factorTiempoSinFecha": 0.9,
  "tiposSinTiempo": [
    "Creation",
    "Mentorship",
    "Related"
  ],
  "tablaTransferencia": {
    "Mentorship:maestro>Creation": 0.8,
    "Mentorship:aprendiz>Creation": 0.5,
    "Mentorship:maestro>Mentorship": 0.6,
    "Mentorship:aprendiz>Mentorship": 0.3,
    "Mentorship>Creation": 0.8,
    "Mentorship>Mentorship": 0.6,
    "Creation>Exposition": 0.8,
    "coworking>Creation": 0.6,
    "Marriage>Creation": 0.5,
    "Employement>Employement": 0.5,
    "Exposition>Creation": 0.4,
    "Friendship>Friendship": 0.4,
    "Exposition>Exposition": 0.3,
    "Friendship>Marriage": 0.3,
    "Friendship>Creation": 0.2
  },
  "transferenciaPorDefecto": 0.3,
  "factorEntidad": {
    "Creator": 1,
    "HeritageItem": 1,
    "Organization": 0.8,
    "Person": 0.6
  },
  "tiposCoincidencia": [
    "Exposition",
    "Work",
    "Wedding",
    "Event"
  ],
  "probabilidadCoincidencia": 0.4,
  "rho": 0.5,
  "delta": 0.7,
  "gradoReferencia": 10,
  "paresTemporales": {
    "Mentorship>Creation": "antesODurante",
    "Mentorship>Mentorship": "solapa",
    "Employement>Employement": "solapa",
    "Friendship>Marriage": "solapa"
  },
  "margenAnios": 5,
  "factorFueraDeTiempo": 0.3,
  "transferenciaSinFecha": 1,
  "umbralDirecto": 0.05,
  "maxDirectos": 1000,
  "penalizacionPorTipo": true,
  "contarSoloPersonas": true,
  "coincidenciaSalvoLugar": true,
  "relacionesLugar": [
    "OCURRED_AT"
  ],
  "cuotasPorClase": {
    "OBRA_DE_ARTE": 50
  },
  "topeCoincidencia": 0.2,
  "lugarSinReparto": true,
  "mostrarDeducidosPorDefecto": true,
  "opacidadMinima": 0.25
}
```
