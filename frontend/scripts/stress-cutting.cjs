/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/cutting-layout.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleObject = { exports: {} };
new Function('module', 'exports', compiled)(moduleObject, moduleObject.exports);
const { packLayoutByPattern } = moduleObject.exports;
const settings = {
  sheetWidth: 2800, sheetHeight: 2070, marginX: 8, marginY: 8,
  defaultGapX: 4, defaultGapY: 4, algorithm: 'leftEdge',
  allowRotation: true, keepEdgeGap: true, workKind: 'cutting',
};
const count = Number(process.argv[2] || 1000);
const groups = Number(process.argv[3] || 1);
const parts = Array.from({ length: count }, (_, i) => ({
  id: `part-${i}`, partNumber: i + 1, catalogItemCode: null,
  name: `Detail ${i}`, width: 100 + ((i * 43) % 700),
  height: 100 + ((i * 101) % 900), quantity: 1,
  preferredSheet: null, rotate: false, gapX: null, gapY: null,
  pattern: `material-${i % groups}`, thickness: i % 2 ? 16 : 19,
  article: `ART-${i % 5}`,
}));
const before = performance.now();
const result = packLayoutByPattern(parts, settings);
const ms = Math.round(performance.now() - before);
const placed = result.sheets.flatMap(sheet => sheet.placements);
const ids = new Set(placed.map(part => part.unitId));
const errors = [];
if (placed.length + result.unplaced.length !== count) errors.push('lost parts');
if (ids.size !== placed.length) errors.push('duplicate parts');
for (const sheet of result.sheets) {
  for (const part of sheet.placements) {
    if (part.x < sheet.marginX || part.y < sheet.marginY ||
        part.x + part.width > sheet.marginX + sheet.workWidth ||
        part.y + part.height > sheet.marginY + sheet.workHeight) errors.push(`outside sheet ${sheet.globalIndex}`);
  }
  for (let i = 0; i < sheet.placements.length; i++) {
    const a = sheet.placements[i];
    for (let j = i + 1; j < sheet.placements.length; j++) {
      const b = sheet.placements[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x &&
          a.y < b.y + b.height && a.y + a.height > b.y) errors.push(`overlap sheet ${sheet.globalIndex}`);
    }
  }
}
console.log(JSON.stringify({ count, groups: result.groups.length, sheets: result.sheets.length,
  placed: placed.length, unplaced: result.unplaced.length, ms, errors: errors.slice(0, 10),
  memoryMB: Math.round(process.memoryUsage().heapUsed / 1048576) }));
if (errors.length) process.exitCode = 1;
