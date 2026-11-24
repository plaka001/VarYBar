import { describe, expect, it } from 'vitest';
import {
  aRuleta,
  azarCripto,
  bajoPuntero,
  darPunto,
  deshacer,
  eligePonderado,
  girar,
  menos,
  normalizar,
  nuevaTrivia,
  otra,
  pct,
  ponFase,
  ponTotal,
  porciones,
  ranking,
  reincluir,
  reiniciar,
  rotacionFinal,
  siguiente,
  TAU,
  tickets,
  type EstadoTrivia,
  type Resultado,
} from './trivia';

/** Saca el estado de un resultado, o falla la prueba si vino con error */
const ok = (r: Resultado): EstadoTrivia => {
  if (r.error !== undefined) throw new Error(r.error);
  return r.e;
};
const puntos = (e: EstadoTrivia, k: string) => e.jug.find((j) => j.k === k)?.p ?? 0;

function conPuntos(lista: [string, number][], total = 10): EstadoTrivia {
  let e = nuevaTrivia({ total });
  let t = 1;
  for (const [u, n] of lista) for (let i = 0; i < n; i++) e = ok(darPunto(e, u, t++));
  return e;
}

describe('preguntas y puntos', () => {
  it('el punto va al nick y pasa a la siguiente pregunta', () => {
    const e = ok(darPunto(nuevaTrivia(), '@Juanito_10'));
    expect(e.fase).toBe('trivia');
    expect(e.pregunta).toBe(2);
    expect(e.jug).toMatchObject([{ u: 'Juanito_10', k: 'juanito_10', p: 1 }]);
    expect(e.hist).toEqual([{ q: 1, k: 'juanito_10', u: 'Juanito_10' }]);
  });

  it('el mismo nick con otras mayúsculas suma en la misma persona', () => {
    const e = conPuntos([['PipeGol', 1], ['pipegol', 1], ['PIPEGOL', 1]]);
    expect(e.jug).toHaveLength(1);
    expect(e.jug[0]).toMatchObject({ u: 'PipeGol', p: 3 });
  });

  it('sin nick no anota', () => {
    expect(darPunto(nuevaTrivia(), '  @ ').error).toBeTruthy();
  });

  it('nadie acertó: pasa sin punto; deshacer vuelve atrás', () => {
    let e = ok(siguiente(conPuntos([['A', 1]])));
    expect(e.pregunta).toBe(3);
    expect(e.hist[1]).toEqual({ q: 2, k: null });
    e = ok(deshacer(e));
    expect(e.pregunta).toBe(2);
    e = ok(deshacer(e));
    expect(e.pregunta).toBe(1);
    expect(puntos(e, 'a')).toBe(0);
    expect(deshacer(e).error).toBeTruthy();
  });

  it('al llegar a la última se acaba y no deja anotar más', () => {
    const e = conPuntos([['A', 2], ['B', 1]], 3);
    expect(e.terminada).toBe(true);
    expect(e.pregunta).toBe(3);
    expect(darPunto(e, 'C').error).toBeTruthy();
    expect(siguiente(e).error).toBeTruthy();
  });

  it('subir el total abre otra pregunta; bajarlo de lo jugado no deja', () => {
    let e = conPuntos([['A', 3]], 3);
    e = ok(ponTotal(e, 4));
    expect(e).toMatchObject({ total: 4, terminada: false, pregunta: 4 });
    e = ok(darPunto(e, 'B'));
    expect(e.terminada).toBe(true);
    e = ok(ponTotal(e, 2));
    expect(e.total).toBe(4);
    const f = ok(ponTotal(conPuntos([['A', 2]], 10), 3));
    expect(f).toMatchObject({ total: 3, pregunta: 3, terminada: false });
    expect(ok(ponTotal(conPuntos([['A', 2]], 10), 2))).toMatchObject({ total: 2, terminada: true });
  });

  it('menos le quita un punto y esa pregunta queda sin ganador', () => {
    let e = conPuntos([['A', 1], ['B', 1], ['A', 1]]);
    e = ok(menos(e, 'a'));
    expect(puntos(e, 'a')).toBe(1);
    expect(e.hist.map((h) => h.k)).toEqual(['a', 'b', null]);
    expect(menos(ok(menos(e, 'a')), 'a').error).toBeTruthy();
  });

  it('el que vuelve a sumar después de quedar en cero entra de último a la ruleta', () => {
    let e = conPuntos([['A', 1], ['B', 1]]);
    e = ok(menos(e, 'a'));
    e = ok(darPunto(e, 'A', 99));
    expect(e.jug.map((j) => j.k)).toEqual(['b', 'a']);
  });
});

describe('la ruleta', () => {
  it('sin puntos no hay ruleta', () => {
    expect(aRuleta(nuevaTrivia()).error).toBeTruthy();
  });

  it('cada tajada mide lo que valen sus puntos', () => {
    const e = conPuntos([['A', 3], ['B', 2], ['C', 1], ['D', 2]]);
    const pz = porciones(e);
    expect(tickets(e)).toBe(8);
    pz.forEach((z) => expect((z.a1 - z.a0) / TAU).toBeCloseTo(z.p / 8, 12));
    expect(pz[pz.length - 1].a1).toBeCloseTo(TAU, 12);
    expect(ranking(e).map((j) => j.u)).toEqual(['A', 'B', 'D', 'C']);
  });

  it('sorteo ponderado: 5-3-1-1 sale 50/30/10/10 %', () => {
    const c = [0, 0, 0, 0];
    const N = 200_000;
    for (let i = 0; i < N; i++) c[eligePonderado([5, 3, 1, 1], azarCripto)]++;
    [0.5, 0.3, 0.1, 0.1].forEach((p, i) => expect(Math.abs(c[i] / N - p)).toBeLessThan(0.006));
  });

  it('cada boleto sale exactamente una vez si se recorre todo el azar', () => {
    const pesos = [3, 2, 1, 2];
    const veces = [0, 0, 0, 0];
    for (let r = 0; r < 8; r++) veces[eligePonderado(pesos, () => r)]++;
    expect(veces).toEqual(pesos);
  });

  it('la ruleta frena en el ganador, venga de donde venga', () => {
    let e = ok(aRuleta(conPuntos([['A', 3], ['B', 2], ['C', 1], ['D', 2]])));
    for (let i = 0; i < 3000; i++) {
      const g = ok(girar(e));
      const rot0 = Math.random() * 40 - 20;
      const fin = rotacionFinal(rot0, g.giro!.phi, g.giro!.vueltas);
      expect(fin).toBeGreaterThanOrEqual(rot0 + g.giro!.vueltas * TAU - 1e-9);
      expect(bajoPuntero(porciones(g), fin)!.k).toBe(g.ganador!.k);
      e = ok(aRuleta(g));
    }
  });

  it('girar muchas veces reparte según los puntos', () => {
    const e = ok(aRuleta(conPuntos([['A', 3], ['B', 2], ['C', 1], ['D', 2]])));
    const cuenta: Record<string, number> = {};
    const N = 20_000;
    for (let i = 0; i < N; i++) {
      const k = ok(girar(e)).ganador!.k;
      cuenta[k] = (cuenta[k] ?? 0) + 1;
    }
    const esperado: Record<string, number> = { a: 3 / 8, b: 2 / 8, c: 1 / 8, d: 2 / 8 };
    let chi = 0;
    for (const k in esperado) chi += ((cuenta[k] ?? 0) - esperado[k] * N) ** 2 / (esperado[k] * N);
    expect(chi).toBeLessThan(16.3);   // 3 grados de libertad, p = 0,001
  });

  it('el ganador trae sus puntos y su porcentaje', () => {
    const g = ok(girar(ok(aRuleta(conPuntos([['A', 3], ['B', 1]])))));
    expect(g.fase).toBe('ganador');
    expect(g.ganador!.pct).toBe(pct(g.ganador!.p, 4));
  });

  it('otra: saca al ganador y vuelve a girar sin él', () => {
    const g = ok(girar(ok(aRuleta(conPuntos([['A', 3], ['B', 2], ['C', 1]])))));
    const g2 = ok(otra(g));
    expect(g2.excluidos).toEqual([g.ganador!.k]);
    expect(g2.ganador!.k).not.toBe(g.ganador!.k);
    expect(g2.giro!.id).not.toBe(g.giro!.id);
    expect(porciones(g2).map((z) => z.k)).not.toContain(g.ganador!.k);
    const g3 = ok(otra(g2));
    expect(otra(g3).error).toBeTruthy();   // no queda nadie más
    const de = ok(reincluir(ok(aRuleta(g3)), g.ganador!.k));
    expect(de.excluidos).not.toContain(g.ganador!.k);
  });

  it('no gira si no están en la ruleta; volver a las preguntas desde la ruleta', () => {
    const e = conPuntos([['A', 1]]);
    expect(girar(e).error).toBeTruthy();
    const r = ok(aRuleta(e));
    expect(ok(ponFase(r, 'trivia')).fase).toBe('trivia');
    expect(ok(deshacer(r))).toMatchObject({ fase: 'trivia', pregunta: 1 });
  });

  it('reiniciar deja todo en cero pero guarda premio, partido y total', () => {
    let e = conPuntos([['A', 2]], 8);
    e = { ...e, premio: 'Camiseta', partido: 'Nacional vs Medellín' };
    expect(ok(reiniciar(e))).toEqual(nuevaTrivia({ premio: 'Camiseta', partido: 'Nacional vs Medellín', total: 8 }));
  });
});

describe('lo que llega de la base', () => {
  it('fila vacía = trivia nueva', () => {
    expect(normalizar({})).toEqual(nuevaTrivia());
    expect(normalizar(null)).toEqual(nuevaTrivia());
  });

  it('ida y vuelta por JSON queda igual', () => {
    const g = ok(girar(ok(aRuleta(conPuntos([['A', 3], ['B', 2]])))));
    expect(normalizar(JSON.parse(JSON.stringify(g)))).toEqual(g);
  });

  it('datos raros no rompen nada', () => {
    const e = normalizar({ fase: 'ganador', pregunta: 99, total: -3, jug: [{ u: 'A', k: 'a', p: 2 }, 5, null], hist: 'x' });
    expect(e.fase).toBe('ruleta');
    expect(e.pregunta).toBe(20);
    expect(e.total).toBe(1);
    expect(e.jug).toEqual([{ u: 'A', k: 'a', p: 2, t1: 0 }]);
    expect(e.hist).toEqual([]);
  });
});
