// p23 — «متحف الباب» (starts at door 1): a glass dome with one gem per live page; four chips switch the door.
import museums from '../lib/museums.js?v=37';
export const meta = { free: true, center: [0.5, 0.55], typeLabel: 'متحف الباب' };
export default function build(ctx) { return museums(ctx, 1, meta); }
