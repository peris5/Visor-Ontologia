# Visor de patrimonio 3D · Relevancia artística en tres capas

Trabajo de Fin de Grado. Aplicación web para explorar en 3D una base de datos de conocimiento sobre patrimonio cultural (grupo IRTIC, Universitat de València).

El desarrollo se divide en cuatro incrementos:

1. Modelo y subgrafo (O1): datos simulados, cálculo de la relevancia y construcción del subgrafo. ✔
2. Visualización 3D (O2): servidor Python, Three.js y disposición con un grafo dirigido por fuerzas. ✔
3. Exploración (O3): buscador, información de nodos, navegación, historial y filtros. ✔
   - **3b**: adaptación al diseño de la base de datos real (Neo4j, proyecto REFRACTS). ✔
   - **Relevancia artística**: se calcula **solo en el navegador**, en tres capas. **Versión 4**: fuerza, certeza y relevancia (R, C, S), una sola fórmula para todos los nodos, y eventos, grado y obras tratados según lo que salió de medir con muchos datos. Con un **laboratorio** para medirla. ✔
4. Datos reales y validación (O4): conexión con la base de datos y pruebas de rendimiento y usabilidad.

El diseño de la base de datos está en `docs/diseno_bd_refracts.json` (export de arrows.app) y su análisis, en `ANALISIS_BD_NEO4J.md`. La referencia numérica de la relevancia es el prototipo `docs/prototipo_relevancia_v4.mjs` (`node docs/prototipo_relevancia_v4.mjs` debe decir «v3: 11/17», «v4: 17/17» y «Todas cumplen las 17 propiedades»). `docs/prototipo_relevancia_v3.mjs` y `docs/prototipo_relevancia.mjs` (el circuito) se guardan para comparar.

## Arquitectura: el navegador calcula, el servidor solo da los datos

```
┌──────────────────── NAVEGADOR (JavaScript + Three.js) ── TODO EL CÁLCULO ──────────────────────┐
│  Aplicacion ──crea y conecta──▶ ControladorExploracion ◀──avisan── EscenaGrafo (3D)             │
│                                   │    ◆ FiltroVisualizacion        └ SelectorInteraccion       │
│                                   │    ◆ HistorialNavegacion  ◀──── InterfazUsuario (2D)        │
│                  ┌────────────────┴───────┐                                                     │
│                  ▼                        ▼                                                     │
│              Buscador              GestorSubgrafos ──▶ RepositorioVecindario (caché en memoria) │
│     (todos los nombres)                   │           ConstructorSubgrafo, CalculadorCentralidad │
│                                           │           EstrategiaRelevanciaNodos:               │
│                                           │             RelevanciaNodosTresCapas               │
│                                           │               (CalculadorEvidencia, RepartoParticipantes,
│                                           │                PropagacionDesdeDirectos, TablaTransferencia...)
│                                           │             RelevanciaNodosMejorCamino (para comparar)│
│                                           ▼           RelevanciaCompuesta (cada relación)      │
│                                    ClienteServicio                                              │
└───────────────────────────────────────────┼─────────────────────────────────────────────────────┘
   HTTP + JSON: configuración, tipos, jerarquía y nombres (UNA vez) · como mucho 2 tandas de relaciones por
   entidad nueva · un detalle al seleccionar
┌───────────────────────────────────────────▼──────── SERVIDOR (Python + FastAPI) ── SOLO DATOS ──┐
│  app.py (rutas) ─▶ ConversorJson, CacheRespuestas                                               │
│        ▼                                                                                        │
│  RepositorioDatos ◀── RepositorioSimulado (datos_ejemplo.json o GeneradorBDGrande)              │
│        │          ◀── (incremento 4: RepositorioBDConocimiento, Neo4j)                          │
│        └─▶ ClasificadorEtiquetas · ProyectorRelaciones (regla genérica)                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **La base de datos no tiene relevancias** y nadie las da: el navegador las calcula **siempre**.
- **El servidor** solo da acceso a los datos (la conexión, las credenciales y las consultas). **No calcula ni escribe nada** en la base de datos: le basta con permisos de lectura (RNF-11). Ya no existen `AsignadorRelevancia`, `RelevanciaPorTipo` ni `AlmacenRelevancias`.
- **El navegador** hace el resto: la relevancia de cada relación y de cada nodo, el subgrafo, la poda a 150 nodos, la centralidad, los colores, la búsqueda tolerante a errores, la vista 3D y la interfaz.
- El servidor apenas consume recursos y atiende a más usuarios a la vez (RNF-05). Las sugerencias del buscador salen al instante, porque se buscan en memoria (RNF-03).
- Cada entidad se abre con el umbral que da **más o menos `nodosObjetivo` nodos** (`AjustadorUmbral`). Después el deslizador se mueve libremente, **sin ninguna petición**.

## La relevancia artística, en tres capas

La relevancia es **artística**: mide cuánto ayuda una entidad a entender la trayectoria y la obra de la entidad central (formación, autoría, colaboración, circuito de exposiciones, instituciones). Lo personal (pareja, familia, amistad) solo pesa si tiene un lado artístico.

### Tres números por nodo

| | Qué dice | Para qué se usa |
|---|---|---|
| **R, fuerza** | Cuánto importaría la entidad **si la relación fuera segura** | Para calcular S |
| **C, certeza** | Cuánto se sabe **de verdad**: 1 si hay una relación declarada; menos si solo hay coincidencias en eventos o deducciones | Para calcular S, y la **opacidad** del nodo |
| **S = R × C, relevancia** | Lo que importa la entidad, contando las dudas | Quién entra en el subgrafo (umbral, cuotas y máximo de 150), el orden y la **distancia al centro** |

Separar fuerza y certeza sigue la idea de la **lógica subjetiva** de Jøsang: una probabilidad con un grado de incertidumbre. Tiene un operador de **descuento**, que encadena a lo largo de un camino (los productos), y otro de **fusión**, que junta varias fuentes (los «o» de probabilidades, *noisy-OR*).

### Cada relación

`r = peso(tipo, rol del otro) × reparto × f_t` (`RelevanciaCompuesta`):

- **peso**: primero `pesosPorRol` con el rol que tiene **el otro** extremo. Si el otro es mi maestro, la mentoría vale 0,95; si es mi alumno, 0,60. Si no hay peso por rol, el del tipo en `pesosRelevancia`, el de su padre más cercano (`Paint` → `Creation`) o `pesoPorDefecto`. Los roles se normalizan con `rolesEquivalentes` («Maestra», «teacher», «Mestre», «maestro/a» → `maestro`). Un tipo de `tiposEquivalentes` usa los valores del tipo al que equivale.
- **reparto** (`RepartoParticipantes`): `(2/n)^β`, con n = participantes. Una relación entre dos vale entera, y coincidir con 40 personas, mucho menos. La v4 cambia quién cuenta en n, pone un tope a las coincidencias y no reparte lo que une con el lugar (ver «La v4»).
- **f_t**, el factor de tiempo: penaliza lo que pasó lejos de la **época de la central**, que va del primer al último año de sus relaciones con fecha. Vale `mínimo + (1 − mínimo) · e^(−Δ/τ)`, con Δ = años de distancia a esa época (con 0,5 y τ = 25: 1 dentro, 0,84 a 10 años, 0,68 a 25 y 0,57 a 50). Sin fecha, `factorTiempoSinFecha`; los tipos de `tiposSinTiempo` no caducan y, si la central no tiene ninguna fecha, vale 1. Las relaciones de la propia central con fecha están siempre dentro de su época: f_t solo baja las suyas sin fecha y las de los directos. **Está pendiente de decidir si se quita**: los prototipos usan f_t = 1 (ver «Límites de las propiedades»).

### Capa 0: la evidencia de cada pareja, vista desde un lado

Se juntan **todas** las relaciones y eventos que unen a dos entidades, se dibujen o no (`CalculadorEvidencia`). Por el rol, la evidencia es **dirigida**: la de mi maestro vista desde mí no es la mía vista desde él.

```
por tipo:   fuerza_tipo = 1 − Π_k (1 − r_k · ρ^(k−1))      pruebas del mismo tipo, de mayor a menor
total:      F = 1 − Π_tipos (1 − fuerza_tipo)

certeza:    C = 1                                          si hay alguna relación declarada
            C = 1 − Π_k (1 − pCoincidencia · reparto_k)    si solo hay coincidencias
```

- **Multiplexidad**: las pruebas repetidas del mismo tipo rinden cada vez menos (ρ; el prototipo v4 lo llama λ). Los tipos **distintos** se combinan sin descuento.
- **Coincidencia o declarada**: ver E4 en «La v4».

Un nodo es **directo** si `F(c,X) × C(c,X) × fE(X) ≥ umbralDirecto`.

### Capas 1 a 3: una sola fórmula, propagación desde los directos

Para **cada** nodo X que sea vecino de la central o de algún directo (`PropagacionDesdeDirectos`):

```
R(X) = 1 − (1 − R₀(X)) × Π_{Y directo ≠ X} (1 − fE(Y) · Tr(c,Y → Y,X) · F(Y,X) · fE(X) · h(Y,t))
C(X) = 1 − (1 − C₀(X)) × Π_{Y directo ≠ X} (1 − C(c,Y) · C(Y,X) · δ)

R₀(X) = F(c,X) · fE(X)        C₀(X) = C(c,X)        (0 si X no tiene evidencia con la central)
```

- **Ser directo solo decide quién transmite.** La fórmula del que recibe es la misma para todos, así que cruzar el umbral de directo no hace bajar a nadie (P10).
- Cada nodo recibe de los directos usando su **evidencia propia**, no su valor ya reforzado. Es **un solo paso**, sin iterar y sin orden. Nunca se llega a tres saltos.
- **Tr, transmisión** (`TablaTransferencia`): `1 − Π_tipos t de c–Y (1 − fuerza_t · T(t, rol, tipo(Y,X)) · τ)`. La obra de tu maestro (`Mentorship:maestro>Creation` = 0,8) dice mucho de ti; la de un amigo (`Friendship>Creation` = 0,2), poco. Con *noisy-OR*, añadir un tipo o una prueba nunca baja la transmisión.
- **τ, compatibilidad temporal** (`CompatibilidadTemporal`): la obra que pintó tu maestro mientras te enseñaba cuenta entera; una 35 años posterior, solo `factorFueraDeTiempo`. Es el mejor valor entre las pruebas de cada tipo.
- **h, penalización por grado** (`PenalizacionGrado`, idea de Adamic-Adar): `min(1, log(2 + gradoReferencia) / log(2 + grado_t(Y)))`.
- **fE, factor de entidad**: `Creator` 1,0; `Organization` 0,8; una `Person` sin subtipo creador, 0,6.
- **δ, descuento por transitividad**: la certeza de que algo vale para la central por venir de un directo seguro. Vale lo mismo para «amigo de tu amigo» (cierre triádico, Kossinets y Watts, 2006) y para «obra de tu maestro».

El cálculo recorre, para cada directo, **sus vecinos**. `calcularReferencia` es la fórmula escrita tal cual (cada candidato contra todos los directos): solo la usan las pruebas y el laboratorio para comprobar que da lo mismo (P0).

### La v4: qué cambia y por qué

La v3 se probó con una base de datos simulada de unas 25.000 entidades y salieron problemas que los escenarios pequeños no mostraban. Además, los eventos de REFRACTS vienen de fuentes muy distintas (anécdotas, vídeos, prensa…).

| | Problema | Cambio | Interruptor |
|---|---|---|---|
| **E1** | Un maestro famoso está unido a cientos de personas con las que expuso; `h` lo hundía y sus obras casi nunca entraban | El grado de `h` cuenta solo las entidades unidas por el **mismo tipo que el segundo tramo**. Para repartir hacia sus obras cuenta cuántas obras tiene, no con cuánta gente expuso (normalización por meta-camino de PathSim; Sun y otros, 2011) | `penalizacionPorTipo` |
| **E2** | Las obras y el lugar diluían lo que une a dos personas: una mentoría en un taller bajaba de 0,95 a 0,63 | Entre dos personas, n = número de **personas** | `contarSoloPersonas` |
| **E3** | Una obra propia vale 1, más que el maestro: en los prolíficos las 150 plazas se llenaban de obras | Como mucho 50 obras, y desempate por C y por id | `cuotasPorClase` |
| **E4** | Dos obras de la misma exposición contaban como relación declarada | En un evento, todo es **coincidencia** salvo lo que une con el lugar | `coincidenciaSalvoLugar`, `relacionesLugar` |
| **E5** | Un evento con 3 registrados parecía íntimo | Una coincidencia vale como mucho `topeCoincidencia` (0,2) | `topeCoincidencia` (`null` = sin tope) |
| **E6** | Que una obra se expusiera en un museo se repartía entre los participantes | Lo que une con el **lugar** no se reparte | `lugarSinReparto` |
| **E7** | El mismo acto registrado desde dos fuentes contaba doble | El **servidor** junta los eventos del mismo tipo, lugar y fecha **con día** | `deduplicarEventos` (`servidor/configuracion.json`) |

**Por qué no se usa el número de participantes registrados.** Dice cuánta gente *apuntó* quien lo registró, no cuánta hubo. Por eso se usa solo como **mínimo**: con 100 registrados hubo al menos 100 y el evento fue grande (2/100); con 3 no se sabe y se queda en el tope. Se apoya en Crandall y otros (2010) y Pham y otros (2013): un evento concurrido dice poco de cada pareja, y lo que más informa es coincidir en **varios eventos distintos**. En lo declarado se sigue usando `(2/n)^β`, porque esa lista sí está completa.

**Por qué la fecha con día (E7).** Con solo el año, dos exposiciones distintas de la misma galería se confundirían.

Con los interruptores en `false`, `topeCoincidencia` a `null`, `cuotasPorClase` vacío y `deduplicarEventos` a `false`, el resultado es **idéntico a la v3** (lo comprueban las pruebas).

### Las propiedades

Son las pruebas de `tests/pruebasPropiedadesRelevancia.js` y la primera pestaña del laboratorio. Se cumplen las 17, también moviendo ρ y δ (12 combinaciones). La v3 cumple 11.

| | Propiedad |
|---|---|
| P0 | El cálculo rápido da lo mismo que la fórmula escrita tal cual |
| P1 | Añadir una relación no baja la relevancia de nadie |
| P2 | Ningún nodo directo baja de su propia evidencia |
| P3 | Un nodo deducido sin evidencia propia no supera a su mejor padre |
| P4 | Cuatro tipos distintos de vínculo pesan más que diez exposiciones repetidas |
| P5 | El compañero de un taller pequeño pesa más que el de una academia enorme |
| P6 | El maestro es más relevante para la alumna que la alumna para el maestro |
| P7 | La obra del maestro de la época de la mentoría pesa más que una muy posterior |
| P8 | En el ejemplo de Ana entra la obra de su maestro y no el marido (no artista) de su amigo |
| P9 | Dos nodos en la misma situación reciben la misma relevancia (el orden de cálculo no influye) |
| P10 | Más evidencia nunca baja la relevancia, tampoco cuando un nodo pasa a ser directo |
| P11 | Los coexpositores del maestro no rebajan su obra |
| P12 | Las obras propias no tapan al maestro ni a las alumnas |
| P13 | Coexponer no es una relación declarada |
| P14 | Las obras y el lugar no diluyen a las personas |
| P15 | El mismo evento registrado dos veces cuenta una |
| P16 | Pocos registrados no hacen íntimo un evento |

**Límites de las propiedades** (son de las fórmulas, y los comparten los prototipos):

- **P1** se cumple al unir dos nodos que no tenían relación. Al añadir un tipo **más fuerte** a una pareja que ya la tenía puede cambiar su tipo principal, y con él la T del segundo tramo. Si Juan trabaja en el taller y además lo fundó, pasa de 0,118 a 0,104, porque `Employement>Fund` no está en la tabla y usa el valor por defecto.
- **f_t no está en las propiedades**: se comprueban con f_t = 1, como en los prototipos. Con f_t activado se siguen cumpliendo las 17 (sus comparaciones son relativas), pero cambian los valores: en el ejemplo sin fechas, Luis pasa de 0,624 a 0,574 y el Museo, de 0,314 a 0,282 (deja de entrar). Y hay un caso de **P1** que sí incumple: la primera relación **con fecha** de una central crea su época, y sus relaciones sin fecha bajan un 10 % (una amistad, de 0,50 a 0,45).
- **P3** se garantiza con **un solo** padre. Con varios, la suma de vías puede superar al mejor de ellos (la v2 lo recortaba con un tope; el prototipo v3 no).

### Por qué se descartaron otras variantes

- **El circuito eléctrico** incumple **P1 y P2**: la tensión de cada nodo es una media de la de sus vecinos, así que conectar un nodo a otro con menos tensión le quita corriente. Añadir una relación podía bajar a alguien.
- **Un modelo solo de muelles** (que la relevancia salga de la posición en el dibujo) incumple **P1, P3, P5, P7 y P8**, y depende del azar de la simulación.
- **La v2**, con una fórmula para los directos y otra para los deducidos, incumple **P10**: un nodo que ganaba evidencia y pasaba a ser directo podía bajar.

El dibujo **nunca** modifica la relevancia: los muelles salen del cálculo y no al revés.

### Para comparar: el mejor camino

Con `"estrategiaNodos": "mejorCamino"` en `public/relevancia.json` vuelve el cálculo más antiguo (`RelevanciaNodosMejorCamino`): el producto del mejor camino. No distingue la certeza (C = 1), cada relación vale `r` (con los cambios de la v4 que estén encendidos) y solo llega a dos saltos. Recarga la página después de cambiarlo.

## Carga en dos tandas

Para una entidad nueva, `GestorSubgrafos`:

1. Pide **todas** las relaciones de la central (`POST /api/relaciones`), si no están en la caché.
2. Calcula la evidencia con cada vecino y elige los **directos**. Si hay más de `maxDirectos`, avisa en la consola y se queda con los de más evidencia.
3. Pide **en una sola tanda** las relaciones de los directos que faltan. `ClienteServicio` la parte en trozos de 200 ids.
4. Calcula las relevancias y construye el subgrafo.

**Por qué es exacto.** Solo transmiten los directos, y a sus vecinos. Tras la tanda 2 se tienen **todas** las relaciones de cada directo, así que su grado (el de h, total o de un tipo) también es exacto. Tener más datos no cambiaría ningún número.

**Consecuencias:**

- cambiar el umbral (subirlo o bajarlo) no hace ninguna petición;
- volver a una entidad visitada, tampoco;
- desmarcar «Mostrar deducidos», tampoco;
- cada entidad nueva cuesta como mucho 2 tandas.

La barra de abajo muestra «Tandas: X · Directos: Y · Deducidos: Z».

## Qué se ve

- **Distancia al centro**: `6 + (1 − S) × 40`.
- **Muelles** (`SimulacionFuerzas`): **uno por pareja**, aunque se dibujen varias curvas. Si cada curva tuviera el suyo, una pareja con cinco exposiciones tiraría cinco veces. Su peso es lo que esa pareja transmite en el cálculo:
  - si un directo Y transmite a X, `fE(Y) · Tr · F(Y,X) · fE(X) · h(Y)`; si se transmiten los dos, el mayor de los dos sentidos;
  - en cualquier otra pareja, `F × C`;
  - con la central no hay muelle.

  `k = 4·peso²` y `longitud = 2 + (1 − peso) × 20`. Así «Paseo» queda junto a Joaquín (peso 0,76).
- **Opacidad** = `opacidadMinima + (1 − opacidadMinima) × C`, continua. Los declarados quedan opacos y los deducidos, con el nombre en cursiva.
- **Línea discontinua**: las parejas sin relación declarada (solo coincidencias) y las aristas sintéticas `COINCIDENCIAS`. Una arista sintética se añade cuando un nodo no tiene ninguna relación que se pueda dibujar. Va hacia la central (o hacia su mejor padre, si es deducido) con el texto «Coinciden en N eventos».
- **Leyenda**: sección «Origen» con las tres muestras (continua, discontinua, semitransparente) y la casilla «Mostrar deducidos». No depende solo del color (RNF-26).
- **Etiqueta y panel**: explican de dónde sale la relevancia («Mentoría (su maestro)», «Amistad · 5 exposiciones juntos», «Pintura de Joaquín Mestre (su maestro)»). El panel muestra además:
  - S, R y C, con la certeza en palabras: «segura» si C ≥ 0,9, «probable» si C ≥ 0,5 y «supuesta» si es menor;
  - el origen, la evidencia propia y el camino;
  - los eventos compartidos que **no** se dibujan;
  - si una relación sale de un evento juntado, cuántos registros tiene.

  **Nunca** se escribe que dos personas «se conocen» si no hay relación declarada (RNF-23).

## Parámetros (`public/relevancia.json`)

> **Todos los valores son una propuesta pendiente de validar con el grupo de investigación.** JSON no admite comentarios, por eso se explican aquí. Vite copia el archivo tal cual al publicar: se puede cambiar sin recompilar (recargando la página).

| Parámetro | Qué es |
|---|---|
| `perfil` | `"artistico"` (de momento el único; deja sitio para otros perfiles) |
| `estrategiaNodos` | `"tresCapas"` (por defecto) o `"mejorCamino"` (para comparar) |
| `pesosRelevancia`, `pesoPorDefecto` | Peso de cada tipo (heredado por los padres) y el de un tipo sin peso |
| `pesosPorRol` | Peso según el rol del otro extremo: `"Mentorship.maestro"` (el otro es mi maestro), `"Mentorship.aprendiz"` |
| `rolesEquivalentes` | Cómo se normalizan los roles de la BD («maestra», «teacher», «mestre» → `maestro`) |
| `tiposEquivalentes` | Tipos que se comportan como otro aunque no hereden de él: `"Apprenticeship": "Mentorship"`. Usan su peso, sus pesos por rol, su tabla T, sus pares temporales y su `tiposSinTiempo`, salvo que tengan un valor propio (`EquivalenciasTipos`) |
| `rolesPorDireccion` | Los roles de una relación **directa** (sin intermediario), según el sentido de la flecha: en `STUDENT_OF`, el origen es el aprendiz y el destino, el maestro |
| `betaParticipantes` | β de `(2/n)^β`: cuánto penaliza el tamaño |
| `factorTiempoMinimo`, `tauTiempoAnios` | Mínimo de f_t y años en que la penalización por época cae a ~1/3 de su recorrido |
| `factorTiempoSinFecha` | f_t de una relación sin fecha (si la central tiene época) |
| `tiposSinTiempo` | Tipos (y sus hijos) que no caducan |
| `tablaTransferencia`, `transferenciaPorDefecto` | Tabla T `"tipo1[:rol1]>tipo2"` (heredada por los padres) y su valor si no hay ninguna |
| `factorEntidad` | Peso de cada tipo de entidad (la etiqueta más específica que tenga, subiendo por los padres; si ninguna, 1) |
| `tiposCoincidencia` | Tipos de evento (exactos, sin herencia) cuyas parejas son coincidencias |
| `probabilidadCoincidencia` | Certeza que da una coincidencia, por su reparto |
| `rho` (ρ, λ en el prototipo v4) | Rendimiento decreciente de las pruebas repetidas del mismo tipo |
| `delta` (δ) | Descuento por transitividad |
| `gradoReferencia` | A partir de cuántas entidades se penaliza a un intermediario (h) |
| `paresTemporales`, `margenAnios` | Pares de tipos en los que importa el orden en el tiempo (`antesODurante` o `solapa`) y el margen |
| `factorFueraDeTiempo`, `transferenciaSinFecha` | τ cuando el camino no respeta el tiempo, y cuando falta alguna fecha |
| `umbralDirecto`, `maxDirectos` | `F × C × fE` mínimo para ser directo, y máximo de directos |
| `penalizacionPorTipo` | E1: el grado de h cuenta solo el tipo del segundo tramo |
| `contarSoloPersonas` | E2: entre dos personas, n son las personas |
| `coincidenciaSalvoLugar`, `relacionesLugar` | E4: en un evento todo es coincidencia salvo lo que une con el lugar, que se reconoce por estas relaciones de la BD |
| `cuotasPorClase` | E3: máximo de nodos de una clase, `{ "OBRA_DE_ARTE": 50 }` |
| `topeCoincidencia` | E5: lo máximo que vale una coincidencia (`null`, sin tope) |
| `lugarSinReparto` | E6: lo que une con el lugar no se reparte |
| `mostrarDeducidosPorDefecto`, `opacidadMinima` | Casilla «Mostrar deducidos» al empezar, y opacidad de un nodo con certeza 0 |

`tiposCoincidencia` y `relacionesLugar` están también en `servidor/configuracion.json` (para juntar eventos): tienen que ser iguales, y lo comprueba `test_configuracion.py`. Ya no existe `cierreTriadico`.

### Valores de referencia (ejemplo de Ana)

`escenarioAna()` con los parámetros de arriba, β = 1 y f_t = 1. Lo comprueba `tests/pruebasRelevanciaNodosTresCapas.js` (± 0,005), y en los datos simulados pequeños sale lo mismo, más «Tardía» con 0,160.

| Nodo | S | R | C | Origen | S en la v3 |
|---|---|---|---|---|---|
| Huerta | 1,000 | 1,000 | 1,000 | DECLARADA | 1,000 |
| Joaquín Mestre | 0,950 | 0,950 | 1,000 | DECLARADA | 0,950 |
| Luis Peris | 0,624 | 0,624 | 1,000 | DECLARADA | 0,789 |
| Paseo | 0,532 | 0,760 | 0,700 | DEDUCIDA | 0,532 |
| Taller Valencia | 0,520 | 0,520 | 1,000 | DECLARADA | 0,520 |
| Museo de la Ciudad | 0,314 | 0,448 | 0,700 | DEDUCIDA | 0,314 |
| Marta Soler | 0,233 | 0,310 | 0,751 | DEDUCIDA | 0,496 |
| Retrato | 0,133 | 0,189 | 0,700 | DEDUCIDA | 0,207 |
| Juan Ribes | 0,118 | 0,169 | 0,700 | DEDUCIDA | 0,118 |
| Pedro Navarro | 0,093 | 0,130 | 0,720 | DEDUCIDA | 0,108 |

Con umbral 0,3 entran los seis primeros (en la v3, también Marta).

### Diferencias con el prototipo

- **Herencia en `paresTemporales`**, como en la tabla T. Así `Mentorship>Paint` usa `Mentorship>Creation`, y «Tardía», que en los datos es `Paint`, se penaliza.
- **Empates**: si dos tipos de una pareja tienen la misma fuerza, o dos pruebas el mismo r, se elige por id. En el prototipo depende del orden de llegada, que en la aplicación depende de por dónde se haya navegado.
- **Umbral**: en la aplicación entra lo que es **mayor** que el umbral; en el prototipo v4, lo mayor **o igual**. El máximo de 150 incluye a la central; en el prototipo, no.
- Los textos usan el rol normalizado: «(su maestro)» también para una maestra.

## El laboratorio (`laboratorio.html`)

Página de desarrollo, que no se enlaza desde el visor. Con los dos servidores en marcha: `http://localhost:5173/laboratorio.html`. Usa **las mismas clases** que la aplicación, así que lo que mide es lo que hace la aplicación.

**Mide lo que sirva el servidor**, que por defecto son los datos pequeños (`"origenDatos": "simulado"`): solo tienen 55 creadores, así que una muestra de 325 se completa con obras y organizaciones como centrales y **no se puede comparar** (la página avisa). Para medir con los datos grandes, arranca el servidor así, sin tocar la configuración:

```
$env:VISOR_ORIGEN_DATOS = "simuladaGrande"            (PowerShell; en cmd: set VISOR_ORIGEN_DATOS=simuladaGrande)
python -m uvicorn servidor.app:app --port 8000
```

Genera al arrancar unas 25.000 entidades inventadas (en un segundo). La entidad inicial es entonces `C0001`, la creadora o creador con más obras. Para volver a los pequeños: `Remove-Item Env:VISOR_ORIGEN_DATOS` y reiniciar.

| Pestaña | Qué hace | Cómo leerla |
|---|---|---|
| **Propiedades** | Pasa P0–P16 con la configuración. «Robustez» las repite moviendo ρ y δ | Si algo sale en rojo después de cambiar un valor, ese valor rompe una propiedad |
| **Medir sobre los datos** | Toma una muestra (`/api/muestra`), la carga y la calcula como la aplicación, y dice quién entra: maestros, alumnos, obras de amigos… Todo sale de las propias relaciones, así que sirve igual con Neo4j. «Monotonía» añade relaciones al azar y cuenta cuántos valores bajan | Verde o rojo: las que tienen un valor esperado. Las demás son para comparar. En «Por qué entran», un desplegable por medida con cada entidad, sus números, sus padres y su explicación |
| **Comparar configuraciones** | Dos JSON editables sobre la **misma muestra**, con las diferencias resaltadas. «Descargar» guarda la segunda como `relevancia.json` | Cambia un valor cada vez para ver qué hace |
| **Tipos y datos** | Qué tipos, roles (por tipo de relación), pares de tipos, vías, eventos y etiquetas hay de verdad en lo medido | Lo resaltado no está previsto en la configuración. De los roles solo se resaltan los de tipos en los que el rol cambia algo (hoy, la mentoría) |

«Descargar informe» guarda todo en Markdown, con la fecha, la fuente de datos, la configuración y las 20 entidades de más S de cada medida. El último con los datos grandes está en `docs/informe_laboratorio_simuladaGrande.md`.

«Compañeros solo por una organización grande» cuenta personas sin evidencia propia con la central a las que **solo** les transmite esa organización (su único padre). Si además les llega algo por otro lado, no se sabe por qué entran y no cuentan.

### Resultados con los datos simulados grandes (n = 325, semilla 7)

| Medida | v4 | v3 | v4 sin E1 | v4 sin E6 |
|---|---|---|---|---|
| Maestros dentro (≥ 95 %) | 100,0 % | 97,8 % | 100,0 % | 100,0 % |
| Alumnos dentro (≥ 90 %) | 97,9 % | 76,1 % | 99,0 % | 100,0 % |
| Obras del maestro de su época | 31,9 % | 1,5 % | 2,8 % | 31,9 % |
| Obras del maestro muy posteriores | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| Obras de amigos (≤ 1 %) | 0,1 % | 0,0 % | 0,0 % | 0,1 % |
| Cónyuges no artistas de amigos (0 %) | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| Compañeros solo por una organización grande (≤ 1 %) | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| Obras coexpuestas de otros autores | 0,4 % | 4,4 % | 0,3 % | 0,2 % |
| Personas solo por coincidencias | 5,1 % | 4,0 % | 4,4 % | 2,2 % |

- **E1** es lo que hace entrar las obras del maestro (2,8 % → 31,9 %).
- **E6 tiene un efecto secundario que hay que decidir.** Como lo que une con el lugar es declarado (E4), compartir una galería ya da a dos artistas una certeza de δ = 0,7 (0,08 la coincidencia en sí), aunque no expusieran a la vez. Con E6, además, la galería transmite con toda su fuerza. Quienes comparten salas entran más: del 2,2 % al 5,1 %.
- Por qué entran esas 1.503 personas (el padre que más les aporta): por una **obra propia** expuesta con ellas (499; `Creation>Exposition` = 0,8 se pensó para la obra y el museo, pero vale también para la obra y quien coincide con ella), por el **lugar** (310) o por **coautoría** con alguien cercano (201; `Mentorship:maestro>Creation` = 0,8 vale también para los coautores del maestro).
- **Eventos repetidos**: 80 de los 2.421 con lugar (3,3 %) están registrados dos veces, y los 80 salen juntados.
- **f_t apenas se nota** en estos datos, donde casi todo tiene fecha: con f_t = 1 ninguna medida cambia más de 0,1 puntos.
- La v3 de esta tabla lleva la deduplicación del servidor encendida.
- Los datos no son los del prototipo (`docs/simulacion/`): el generador es otro y el azar también.

## Los datos con la forma de Neo4j

### Forma de los datos simulados

`servidor/datos/datos_ejemplo.json` es un grafo **inventado** con la misma estructura que el diseño de Neo4j:

```json
{
  "jerarquia": { "Painter": "Creator", "Creator": "Person", "Marriage": "Related", "Related": "Relationship", "...": "..." },
  "nodos":      [ { "id": "n1", "etiquetas": ["Person", "Creator", "Painter"], "propiedades": { "name": "Elena", "lastName": "Ferrando Peris" } } ],
  "relaciones": [ { "id": "r1", "tipo": "HAS_ROLE_IN", "desde": "n1", "hasta": "n227", "propiedades": { "role": "maestra" } } ]
}
```

- Las entidades **no** se relacionan directamente: lo hacen a través de nodos intermediarios (`Relationship`, `Event` y sus subtipos), con sus periodos (`Period`), lugares (`Ubication`), imágenes (`Image`) y fuentes (`ExternalSource`).
- Etiquetas, tipos de relación y propiedades son **exactamente** los del diseño, erratas incluidas (`Ubication`, `Employement`, `OCURRED_AT`, `coworking`).
- **Ninguna relación tiene `relevance`**, igual que la BD real.
- Dos elementos de prueba que **no están en el diseño** (marcados con `"_comentario"`): el subtipo `Apprenticeship` y la relación directa `STUDENT_OF`.
- **Escenario fijo de Ana Ferrer** (ids fijos, nombres inventados, al final del archivo): el ejemplo del prototipo, con Luis Peris, Marta Soler, Pedro Navarro, Joaquín Mestre, Juan Ribes, el Taller Valencia, el Museo de la Ciudad y las obras «Huerta», «Retrato» y «Paseo».
  - Para que las exposiciones tengan 4, 6, 12 y 40 participantes hay **38 personas de relleno**. Con la v4 sus coincidencias no llegan a `umbralDirecto`, así que no transmiten y los valores de Ana son los del prototipo.

Tiene 164 personas, 27 organizaciones, 64 obras y 15 lugares (1552 nodos y 2623 relaciones). Lo genera, con semilla fija, `servidor/datos/generar_datos_ejemplo.py`:

```
.venv\Scripts\python.exe -m servidor.datos.generar_datos_ejemplo
```

Escribe también `tests/relacionesEjemplo.json`, con todas las entidades y relaciones derivadas tal como las envía el servidor, que usan las pruebas del navegador.

### Datos simulados grandes

Con el origen `simuladaGrande`, `servidor/simulacion/generador_bd_grande.py` genera al arrancar un grafo con la misma forma (la regla genérica que deriva las relaciones es la misma que con la BD real): 2.000 creadores, 1.500 personas, 143 organizaciones, 22.000 obras, mentorías, empleos, amistades, matrimonios, tertulias, exposiciones y salones. Un 3 % de los eventos con lugar está registrado dos veces a propósito, con la misma fecha con día (los demás solo tienen el año). La semilla y los tamaños están en `simulacionGrande` (`servidor/configuracion.json`); con la misma semilla sale el mismo grafo. Los nombres son códigos (C0001, P0001, H00001…): **ninguna persona real**.

### Clasificación de las etiquetas y regla genérica

La clasificación está en `servidor/configuracion.json`, no en el código (`ClasificadorEtiquetas`):

- **Entidades** (`etiquetasEntidad`): `Person` → persona, `Organization` → organización, `HeritageItem` → obra.
- **Auxiliares** (`etiquetasAuxiliares`, con su papel en `papelesAuxiliares`): `Period`, `Ubication`, `Image`, `ExternalSource`.
- **Intermediarios**: todo lo demás, también cualquier etiqueta nueva.

`ProyectorRelaciones` deriva las relaciones entre entidades con una **regla genérica**:

1. **Por intermediario:** una relación por cada **pareja** de entidades unidas al mismo intermediario. Su tipo es la etiqueta más específica.
2. **Directa:** una relación entre dos entidades se toma tal cual (por ejemplo `STUDENT_OF`), con el sentido de la flecha en `origen` y `destino`.
3. **Límites:** `tiposSinRelacion` (`Birth`, `Death`, `Live`) no crean relaciones.
   - Con más de `maxParticipantesIntermediario` (10) entidades, las relaciones llegan con **`dibujable: false`**: no se dibujan, pero cuentan como evidencia.
   - Con más de `maxParticipantesEvidencia` (200), el intermediario se ignora.
   - Solo se devuelven las parejas de las entidades pedidas, nunca todas las de un evento.
4. **Datos:** roles, nombre del intermediario, periodo, lugar, fecha, `participantes`, `participantesPorClase` (`{"PERSONA": 3, "OBRA_DE_ARTE": 8}`) y `via` (qué relación de la BD une cada extremo al intermediario: `PARTICIPATES_IN`, `OCURRED_AT`, `IS_EXPOSED`…).
5. **Eventos repetidos** (`deduplicarEventos`): dos eventos de `tiposCoincidencia` con el mismo tipo, el mismo lugar y la misma fecha **con día** se juntan en uno, con los participantes de los dos e `idsIntermediarios`. No se modifica la BD.

En `servidor/datos/proyector_relaciones.py` hay una consulta Cypher de referencia para el incremento 4.

### Cómo se añade un tipo nuevo

Normalmente, **nada**: sale solo en `/api/tipos`, en la leyenda y en el grafo, hereda el peso y la T de su padre más cercano y se nombra a partir de su id (`STUDENT_OF` → «Student of»). Como mucho, se añade un peso o una T en `public/relevancia.json` y un nombre en `nombresTipos` (`servidor/configuracion.json`).

Para saber si hace falta:

1. En el laboratorio, pulsa «Medir» y mira **«Tipos y datos»**: los tipos con peso por defecto, los roles resaltados (los de tipos en los que el rol importa) y los pares de tipos que caen en `transferenciaPorDefecto` (los primeros son los que más relevancia mueven).
   - Si el tipo nuevo **es en el fondo otro** (un aprendizaje es una mentoría), no hace falta repetir valores: se añade a `tiposEquivalentes` y, si es una relación directa, a `rolesPorDireccion`. `STUDENT_OF` y `Apprenticeship` son el ejemplo.
2. Escribe los valores nuevos en la segunda configuración de **«Comparar configuraciones»** y compara.
3. Comprueba que **P0–P16 siguen en verde** (salen también en la comparación).
4. Descarga la segunda configuración, cópiala a `public/relevancia.json` y pasa las pruebas.

## Instalación (una vez)

```
npm install
py -m venv .venv
.venv\Scripts\activate
pip install -r servidor/requirements.txt
```

## Desarrollo: dos servidores

- **Terminal 1, servidor Python** (puerto 8000):
  ```
  .venv\Scripts\activate
  python -m uvicorn servidor.app:app --reload --port 8000
  ```
  `http://localhost:8000/api/salud` debe responder `{"estado": "ok"}`. La documentación de la API está en `http://localhost:8000/docs`.
- **Terminal 2, la página** (puerto 5173): `npm run dev` y abre `http://localhost:5173/`.

En Windows, la recarga automática (`--reload`) a veces se queda a medias. Si algo no cambia, para el servidor y arráncalo de nuevo.

## Pruebas

- **Python**: `python -m pytest`. Cubren el clasificador, el proyector (`dibujable`, `participantes`, vías, deduplicación, límites), los datos simulados grandes, el repositorio, los datos de ejemplo (y el escenario de Ana Ferrer), la configuración, la caché y la API. También comprueban que el servidor no escribe ninguna propiedad `relevance*`.
- **Navegador**: con `npm run dev` en marcha, abre `http://localhost:5173/pruebas.html`.
  - Incluyen cada pieza de la relevancia (`RelevanciaCompuesta`, `RepartoParticipantes`, `NormalizadorRoles`, `CalculadorEvidencia`, `TablaTransferencia`, `PenalizacionGrado`, `CompatibilidadTemporal`, `PropagacionDesdeDirectos`, `SeleccionadorNodos`), las tablas de los prototipos v3 y v4 (`pruebasRelevanciaNodosTresCapas.js`) y las **17 propiedades** (`pruebasPropiedadesRelevancia.js`).
  - También el gestor (tandas y peticiones), el constructor (orden por S, cuotas, arista sintética, deducidos, máximo, un muelle por pareja), la leyenda, los paneles y el laboratorio.
  - No necesitan el servidor: usan un cliente falso y `tests/relacionesEjemplo.json`.

## Publicar

```
npm run build
python -m uvicorn servidor.app:app --port 8000
```

`npm run build` deja la página en `dist/` y el servidor Python la sirve en `/` además de la API.

## API

| Petición | Respuesta |
|---|---|
| `GET /api/salud` | `{"estado": "ok"}` |
| `GET /api/configuracion` | `umbralPorDefecto`, `maxNodos`, `nodosObjetivo`, `entidadInicial`, `idioma`, `nombresTipos`, `etiquetasEntidad`, `origenDatos`, `deduplicarEventos` |
| `GET /api/tipos` | Los tipos de relación con sus padres |
| `GET /api/jerarquia` | Cada etiqueta con sus padres: `{"Painter": ["Creator", "Person"]}` (para `factorEntidad`) |
| `GET /api/nombres` | Todas las entidades con sus etiquetas y nombres (el índice del buscador) |
| `POST /api/relaciones` `{"ids": [...]}` | `ids`, `entidades` (en bruto, con todas sus etiquetas) y `relaciones` (derivadas, **sin relevancia**, con `participantes`, `participantesPorClase`, `via`, `dibujable` y, en los eventos juntados, `idsIntermediarios`) de las entidades pedidas |
| `GET /api/muestra?n=325&semilla=7` | Para el laboratorio: los `ids` de los 25 creadores con más relaciones y otros al azar (si no hay bastantes, se completa con otras entidades), cuántos son `creadores`, cuántas `entidades` hay, `intermediariosIgnorados` por tamaño y `eventosJuntados`. La misma semilla da siempre los mismos |
| `GET /api/detalle/{id}` | Eventos, imágenes, fuentes y ubicación |

- `ids`: de 1 a 200, de 1 a 100 caracteres cada uno; si no, **422**. Una entidad inexistente da **404**.
- Las relaciones se guardan en la caché del servidor entidad a entidad.

## Configuración

- **`public/relevancia.json`**: los parámetros de la relevancia (ver arriba).
- **`servidor/configuracion.json`**: ajustes generales (`origenDatos`, `umbralPorDefecto`, `maxNodos`, `nodosObjetivo`, `entidadInicial`, `idioma`), clasificación de etiquetas, límites (`maxParticipantesIntermediario`, `maxParticipantesEvidencia`), deduplicación de eventos (`deduplicarEventos`, `tiposCoincidencia`, `relacionesLugar`), `simulacionGrande` y `nombresTipos`. **No** tiene pesos. `origenDatos` es `"simulado"` (los datos pequeños) o `"simuladaGrande"`; la variable de entorno `VISOR_ORIGEN_DATOS`, si existe, manda sobre él.
- **`public/config.json`**: solo `urlServicio` (`"/api"`).

## Carpetas y clases

### Servidor (`servidor/`)

| Ruta | Qué es |
|---|---|
| `app.py` | Rutas de la API (`/api/relaciones`, `/api/jerarquia`...), configuración comprobada al arrancar y página publicada. |
| `api/conversor_json.py` | **ConversorJson**: forma del JSON. |
| `api/cache_respuestas.py` | **CacheRespuestas**. |
| `logica/configuracion.py` | **Configuracion**. |
| `logica/clasificador_etiquetas.py` | **ClasificadorEtiquetas**. |
| `datos/repositorio_datos.py` | **«interface» RepositorioDatos** (`obtener_tipos`, `obtener_jerarquia`, `obtener_nombres`, `obtener_relaciones`, `obtener_detalle`). |
| `datos/repositorio_simulado.py` | **RepositorioSimulado**: solo lee. |
| `datos/proyector_relaciones.py` | **ProyectorRelaciones**: la regla genérica, con `participantes`, `via` y `dibujable`, y la deduplicación de eventos. |
| `simulacion/generador_bd_grande.py`, `constructor_grafo.py` | **GeneradorBDGrande** y **ConstructorGrafo**: los datos simulados grandes. |
| `datos/generar_datos_ejemplo.py` | Genera los datos de ejemplo y el escenario de Ana Ferrer. |

### Navegador (`src/`)

| Ruta | Qué es |
|---|---|
| `aplicacion/Aplicacion.js` | Crea y conecta todo, lee `public/relevancia.json` y elige la estrategia de nodos. |
| `modelo/EvidenciaPareja.js`, `ResultadoRelevanciaNodo.js`, `OrigenRelevancia.js` | Evidencia (dirigida) de una pareja con todos sus tipos; R, C y S de un nodo, sus padres y lo que transmite; su origen. |
| `modelo/Relacion.js`, `NodoRelevante.js`, `Subgrafo.js`, `Entidad.js` | Relación con participantes, `dibujable`, roles y nombre; nodo con su resultado; subgrafo con la evidencia de cada pareja y sus muelles; entidad con sus etiquetas. |
| `datos/RepositorioVecindario.js` | La **caché** de relaciones: va acumulando tandas y sabe qué entidades tiene completas. |
| `datos/ClienteServicio.js` | `obtenerRelaciones` (POST en trozos de 200), `obtenerJerarquia` y el resto. |
| `logica/FabricaRelevancia.js` | Crea y conecta las piezas del cálculo: la usan la aplicación, el laboratorio y las pruebas. |
| `logica/RelevanciaCompuesta.js`, `RepartoParticipantes.js` | Cada relación: `peso × reparto × f_t`. El reparto (E2, E5, E6) y qué es coincidencia (E4). |
| `logica/EquivalenciasTipos.js` | Con qué tipos se busca cada uno en la configuración: él, sus padres o aquel al que equivale. |
| `logica/NormalizadorRoles.js`, `CalculadorEvidencia.js` | Capa 0: roles normalizados (también por el sentido de la flecha) y evidencia de cada pareja. |
| `logica/TablaTransferencia.js`, `PenalizacionGrado.js`, `CompatibilidadTemporal.js` | T, Tr y factorEntidad; h por tipo (E1); τ. |
| `logica/PropagacionDesdeDirectos.js` | Capas 1 a 3: una sola fórmula. Sustituye a `RefuerzoEntreDirectos` y `DeduccionPorTipos`. |
| `logica/SeleccionadorNodos.js` | Orden (S, C, id) y cuotas por clase (E3). |
| `logica/EstrategiaRelevanciaNodos.js`, `RelevanciaNodosTresCapas.js`, `RelevanciaNodosMejorCamino.js` | La interfaz y sus dos implementaciones. |
| `logica/GestorSubgrafos.js`, `ConstructorSubgrafo.js` | Carga en dos tandas; corte por S, aristas, arista sintética y un muelle por pareja. |
| `laboratorio/` | **EscenariosPrueba** y **PropiedadesRelevancia** (P0–P16), **MedidorMuestra**, **MedidasRelevancia**, **AnalizadorTipos**, **PruebaMonotonia**, **InformeLaboratorio**, **Estadistica** y **Laboratorio** (la página). |
| `vista3d/`, `interfaz/` | Opacidad según C, líneas discontinuas, muelles del cálculo, sección «Origen» de la leyenda y panel con S, R, C y la explicación. |

## Uso

- **Buscar**: escribe en el buscador (2 letras; cualquier idioma o apellido; se toleran erratas).
- **Ver información**: clic en un nodo o en una línea. Al pasar el puntero se ve el nombre y por qué es relevante.
- **Navegar**: doble clic o «Explorar su red»; «← Volver» (o `Alt + ←`).
- **Filtrar**: pulsa un tipo en la leyenda. «Mostrar deducidos» muestra u oculta los nodos deducidos.
- **Cámara** y **Disposición**: como antes.

## Lista de comprobación (a mano)

Con los datos pequeños (`"origenDatos": "simulado"`), abre `http://localhost:5173/`, busca **Ana Ferrer** y pon el umbral en **0,3**:

- [ ] Entran seis nodos: «Huerta», Joaquín Mestre, Luis Peris, «Paseo», el Taller Valencia y el Museo de la Ciudad. Marta Soler, «Retrato», Juan Ribes, Pedro Navarro y «Tardía», no.
- [ ] Joaquín y «Huerta» quedan pegados al centro, y el Taller más lejos que Luis. «Paseo» queda junto a Joaquín por el muelle fuerte, y su etiqueta dice «Pintura de Joaquín Mestre (su maestro)».
- [ ] Con el umbral en 0,2 aparece Marta, algo transparente. Su panel dice «probable» y sigue diciendo que coinciden en 3 exposiciones, y lista la de 40 artistas, que no se dibuja.
- [ ] Mover el umbral en los dos sentidos no hace ninguna petición en la pestaña *Red* (F12). Desmarcar «Mostrar deducidos», tampoco.
- [ ] Con `"estrategiaNodos": "mejorCamino"` (y recargando) vuelve el comportamiento antiguo: «Paseo» y «Tardía» valen 0,95 y todo se ve opaco.
- [ ] La barra muestra «Tandas: 2 · Directos: … · Deducidos: …» al abrir una entidad nueva, y «Tandas: 0» al volver a ella.

Con los datos grandes (`VISOR_ORIGEN_DATOS=simuladaGrande`, ver «El laboratorio»):

- [ ] C0001, quien más obras tiene, se abre con como mucho 50 obras en la leyenda. Con el umbral en 0,3 están su maestro, si tiene, y sus alumnos.
- [ ] En `laboratorio.html`, «Propiedades» dice 17 de 17 y «Medir» (325, semilla 7) sale en verde.
- [ ] En «Comparar», poner `penalizacionPorTipo` a `false` hace caer las obras del maestro de su época.
- [ ] En «Tipos y datos», la tabla «Eventos» tiene juntados (61, 13 y 6). Con los datos pequeños, `STUDENT_OF` y `Apprenticeship` salen como «equivalente a Mentorship» y la página avisa de que la muestra no es comparable.

## Pendiente de validar con el grupo de investigación

- Todos los valores de `public/relevancia.json` (pesos, pesos por rol, tabla T, ρ, δ, `topeCoincidencia`, `cuotasPorClase`, `gradoReferencia`, pares temporales, factores…).
- El efecto de E6 en quienes comparten salas (ver «Resultados con los datos simulados grandes»).
- Si se quita el factor de tiempo f_t de cada relación (todo a 1, como en los prototipos) o se mantiene y se explica (época de la central, `factorTiempoMinimo` 0,5, τ = 25 años, sin fecha 0,9, `tiposSinTiempo`).
- Los pares de tipos que más mueven con la T por defecto: `Creation>Creation` (coautores y obras de los coautores) y los de talleres compartidos.
- La herencia en `paresTemporales` (no está en el prototipo).
- Qué roles hay en la BD real, para completar `rolesEquivalentes`, y con qué relación se une el lugar a un evento (`relacionesLugar`).
- Con qué precisión están las fechas de los eventos: sin día no se pueden juntar los repetidos.
- Si en la BD real los subtipos son varias etiquetas en el mismo nodo (`:Event:Creation:Paint`).
