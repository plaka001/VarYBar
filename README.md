# La Polla · VAR y BAR

Página de la polla del programa: los muchachos dan sus pronósticos del fútbol colombiano, el máster los anota y en el stream sale la tabla con los puntos.

Está hecha con Vite, React y TypeScript. Los datos se guardan en Supabase, en el proyecto **VarYBar**, y se actualizan en vivo.

## Las dos páginas

| Ruta | Para qué |
|---|---|
| `/` | Lo que sale en el stream. Se pone en OBS como fuente de Navegador a 1920 × 1080. Muestra lo que el máster elija: los partidos de una fecha, la tabla o la trivia con la ruleta. |
| `/master` | El panel del máster. Pide PIN. Ahí se anotan pronósticos y resultados, se lleva la trivia y se escoge qué sale al aire. Sirve desde el celular. |

La vista al aire acepta estos parámetros:

| Parámetro | Qué hace |
|---|---|
| `?vista=tabla` | Deja fija la tabla general, sin importar lo que elija el máster. |
| `?fecha=2` | Deja fija la fecha 2. |
| `?guia` | Muestra las zonas que tapa el lienzo de Reacción: la cámara abajo a la derecha, la barra y el chat. |

El diseño deja libre la esquina de abajo a la derecha, que es donde va la cámara. Nada pasa de y = 610 a la derecha de x = 1180.

## Trivia y ruleta (sorteos en vivo)

Sale en la misma fuente de OBS que la polla: en **Al aire** del máster se toca **Trivia y ruleta** y la pantalla cambia sola. No hay que tocar OBS. Para que se oigan los sonidos (punto, tic-tac y pitazo), la fuente debe tener marcado **Controlar audio a través de OBS**.

1. En el máster, pestaña **Trivia y ruleta**: en *Premio, preguntas y reiniciar* se escriben el premio, el partido y cuántas preguntas (de 1 a 20).
2. En pantalla salen las reglas y los QR de Instagram, TikTok, YouTube y Kick.
3. Hacen cada pregunta en vivo. El primero que responde bien en el chat se anota: se escribe su nick y **+1 punto** (o se toca su nombre si ya tiene puntos). La pregunta avanza sola. Si nadie acierta: **Nadie acertó · siguiente**. Si se equivocan: **Deshacer** o **−1**.
4. Al terminar las preguntas: **Ir a la ruleta** (salen las oportunidades de cada uno) y **¡Girar!** Cada punto es una oportunidad: el que tiene 3 puntos tiene el triple de chance que el que tiene 1.
5. El máster no ve el ganador hasta que la ruleta frena en el stream. Se revisa que siga las redes; si no, **No sigue las redes** lo saca y la ruleta vuelve a girar.
6. Para un sorteo nuevo: **Reiniciar trivia**.

El ganador lo escoge el navegador del máster con azar criptográfico, ponderado por puntos, y la ruleta del stream frena dentro de su tajada. Si dos máster anotan al mismo tiempo, el segundo recibe un aviso y ve el cambio del otro; nada se pisa. Con `?vista=trivia` se fija la trivia en la vista al aire.

## Reglas

- **Pleno:** marcador exacto, vale **3 puntos**.
- **Acierto:** ganador o empate, vale **1 punto**.
- Un partido con `multiplicador = 2` vale doble. Está pensado para la final.
- La tabla ordena por puntos, después por plenos y después por aciertos.

## Primer uso

1. Abran `https://SU-DOMINIO.vercel.app/master`.
2. La primera vez, la página pide **crear el PIN del máster**, de mínimo 4 caracteres. El PIN queda guardado en la base de datos y nadie más lo ve.
3. Con ese PIN se entra desde cualquier equipo. Si fallan 10 veces seguidas, el PIN se bloquea 5 minutos.

Para cambiarlo, en el panel abajo está **Cambiar PIN**. Si se les olvida, en Supabase → SQL Editor corren:

```sql
update privado.ajustes set pin_hash = null, fallos = 0, bloqueado_hasta = null where id = 1;
```

Después de eso, la página vuelve a pedir crear un PIN.

## Desplegar en Vercel

1. En vercel.com vayan a **Add New → Project** y escojan el repo `plaka001/VarYBar`.
2. Vercel detecta Vite solo. No hace falta poner variables de entorno, porque la URL de Supabase y la clave publicable ya están en `src/lib/config.ts`. Esa clave está hecha para ir en el navegador.
3. Denle **Deploy**. Cada push a `main` vuelve a desplegar.

`vercel.json` hace dos cosas:

- Manda `/master` a la app.
- Programa dos llamadas diarias a `/api/despertar` (cron). Así Supabase, que en el plan gratis pausa los proyectos con poca actividad en una semana, no se duerme antes del stream.

## OBS

En la escena **Reacción**, agreguen una fuente de **Navegador** encima de "Partido o resumen":

- **URL:** `https://SU-DOMINIO.vercel.app/`
- **Tamaño:** ancho 1920, alto 1080.
- **Casillas:** desmarcar "Apagar la fuente cuando no esté visible" y "Actualizar el navegador cuando la escena se active".

Durante el segmento, la muestran con el ojito. El texto de la barra se cambia como siempre, con clic derecho en el lienzo → Interactuar; por ejemplo, "La polla · Cuadrangulares".

## Base de datos (Supabase)

El SQL completo está en `supabase/migrations/`.

| Tabla | Contenido |
|---|---|
| `participantes` | Santiago, Sebastián, Dani y Camilo. Con `activo = false` alguien deja de salir. |
| `partidos` | Fixture de los cuadrangulares, del `c1-a1` al `c6-b2`: fecha, grupo, local, visitante, `inicio` en hora UTC, estadio, goles y multiplicador. |
| `pronosticos` | Un marcador por participante y partido. |
| `al_aire` | Una sola fila con lo que está en pantalla: `fecha`, `tabla` o `trivia`. |
| `trivia` | Una sola fila con toda la trivia en `estado` (preguntas, puntos, ganador) y `version` para que dos másteres no se pisen. Se escribe con `guardar_trivia`. |

- Todo el mundo puede **leer**, pero nadie puede escribir directo.
- Todo cambio pasa por funciones que piden el PIN: `guardar_pronostico`, `guardar_resultado`, `editar_partido`, `poner_al_aire`, `guardar_trivia`, `crear_pin`, `verificar_pin` y `cambiar_pin`.

### Agregar la final o más partidos

Desde Supabase → Table Editor → `partidos`, o con SQL:

```sql
insert into public.partidos (id, fase, fecha, local, visitante, inicio, multiplicador, orden) values
  ('final-ida',    'Final · ida',    7, 'Ganador A', 'Ganador B', null, 2, 1),
  ('final-vuelta', 'Final · vuelta', 8, 'Ganador B', 'Ganador A', null, 2, 1);
```

Cuando se sepan los equipos y los horarios, se corrigen desde el panel con **Editar partido**.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173  y  /master
npm test         # pruebas de los puntos y de la trivia
npm run build
```
