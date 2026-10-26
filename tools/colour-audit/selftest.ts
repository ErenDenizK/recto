import * as c from './color.ts';
const ink = c.parseHex('#08090c'),
  lime = c.parseHex('#c8fb3d');
console.log(
  'ink/lime',
  c.contrast(ink, lime).toFixed(2),
  'want 16.42; Lc',
  c.apcaLc(ink, lime).toFixed(1),
  'want 93',
);
console.log(
  'black/white Lc',
  c.apcaLc([0, 0, 0], [255, 255, 255]).toFixed(1),
  'want 106.0; white/black',
  c.apcaLc([255, 255, 255], [0, 0, 0]).toFixed(1),
  'want -107.9',
);
console.log(
  '#888 on #fff Lc',
  c.apcaLc(c.parseHex('#888888'), [255, 255, 255]).toFixed(1),
  'want 63.1',
);
console.log('lime oklch', c.oklch(lime), 'want 0.921 0.210 124');
// Sharma test pair 1: (50,2.6772,-79.7751) vs (50,0,-82.7485) = 2.0425 -- test via lab path not available; check symmetric & zero
console.log(
  'dE same',
  c.deltaE2000(lime, lime),
  'dE white/black',
  c.deltaE2000([255, 255, 255], [0, 0, 0]).toFixed(1),
  'want 100',
);
console.log('dE red/green', c.deltaE2000([255, 0, 0], [0, 255, 0]).toFixed(1), 'want ~86.6');
console.log(
  'lime lum',
  c.relLum(lime).toFixed(4),
  'lime/white',
  c.contrast(lime, [255, 255, 255]).toFixed(2),
  'want 1.21',
);
console.log('protan red', c.simulate([255, 0, 0], 'protanopia').map(Math.round));
console.log(
  'req 13/400',
  c.apcaRequired(13, 400),
  '16/400',
  c.apcaRequired(16, 400),
  '24/400',
  c.apcaRequired(24, 400),
  '13/600',
  c.apcaRequired(13, 600),
);
