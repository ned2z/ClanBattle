import { PRIMS } from './primitives';
import { RECIPES } from './recipes';
import type { PrimApi, Step, Tech, TechCtx, Feature, Target } from './types';

export * from './types';
export { RECIPES, IMPACT } from './recipes';
export { PRIMS } from './primitives';
export { FEATURES } from './features';

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** evaluate a tiny expression such as "$T*0.5" with a closed scope */
function calc(expr: string, v: Record<string, number>): number {
  const keys = Object.keys(v);
  const args = keys.map((k) => v[k]);
  try {
    // eslint-disable-next-line no-new-func
    return Number(new Function(`"use strict";const [${keys.join(',')}]=[${args.join(',')}];return (${expr});`)());
  } catch {
    return Number.NaN;
  }
}

/** step `at` -> seconds. number = fraction of impact; string = expression */
function when(at: number | string | undefined, v: Record<string, number>): number {
  if (at === undefined) return 0;
  if (typeof at === 'number') return Math.max(0, v.T * at);
  const r = calc(at, v);
  return Number.isFinite(r) ? Math.max(0, r) : 0;
}

export class FxRunner {
  private vars: Record<string, number>;

  constructor(private base: Omit<PrimApi, 'args' | 'target' | 'index' | 'run' | 'runOne'>) {
    this.vars = { T: base.T, FLY: round(Math.min(0.26, base.T * 0.55)), index: 0, n: 0 };
  }

  play(tech: Tech, feature?: Feature) {
    const recipe = RECIPES[tech];
    if (!recipe) return;
    this.emit(feature ? [...recipe.steps, ...(feature.add ?? [])] : recipe.steps);
  }

  private api(s: Step, target: Target | undefined, index: number): PrimApi {
    const v = { ...this.vars, index };
    return {
      ...this.base,
      args: s.args ?? {},
      target,
      index,
      run: (sub: Step[]) => this.emit(sub),
      runOne: (step: Step, t: Target, i: number) => {
        this.base.h.later(when(step.at, { ...v, index: i }), () => {
          const prim = PRIMS[step.prim];
          if (prim) prim(this.api(step, t, i));
        });
      },
    } as unknown as PrimApi;
  }

  private emit(steps: Step[]) {
    for (const s of steps) {
      this.base.h.later(when(s.at, this.vars), () => {
        const prim = PRIMS[s.prim];
        if (!prim) console.warn('[fx] unknown primitive', s.prim);
        if (prim) prim(this.api(s, undefined, 0));
      });
    }
  }
}

export type { Target, TechCtx };
