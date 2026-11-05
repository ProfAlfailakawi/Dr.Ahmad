// The game library of «الموسوعة الحيّة»: buildGame(spec, ctx) -> { update(t, dt, e) } for the ten game types.
import { createGame } from './games/toolkit.js';
import { speedSort } from './games/speed-sort.js';
import { spotError } from './games/spot-error.js';
import { escapeGame } from './games/escape.js';
import { allocate } from './games/allocate.js';
import { assemble } from './games/assemble.js';
import { bet } from './games/bet.js';
import { match } from './games/match.js';
import { caseGame } from './games/case.js';
import { timelineRace } from './games/timeline-race.js';
import { design } from './games/design.js';

const TYPES = {
  'speed-sort': speedSort,
  'spot-error': spotError,
  escape: escapeGame,
  allocate,
  assemble,
  bet,
  match,
  case: caseGame,
  'timeline-race': timelineRace,
  design,
};

export const GAME_TYPES = Object.keys(TYPES);

export function buildGame(spec, ctx) {
  const make = TYPES[spec.game];
  if (!make) throw new Error('unknown game type: ' + spec.game);
  const G = createGame(spec, ctx);
  const extra = make(G) || {};
  return {
    update(t, dt, e) { G.update(t, dt, e); extra.update?.(t, dt, e); },
    G,
  };
}
