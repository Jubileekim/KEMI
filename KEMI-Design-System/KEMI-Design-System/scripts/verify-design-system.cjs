// Structural/token checks plus reproducibility. Browser behavior is checked separately.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const fail = message => { throw new Error(message); };
const html = read('reference/KEMI_Design_System_1.1.html');
const css = read('tokens/tokens.css');
const json = JSON.parse(read('tokens/tokens.json'));
const roles = JSON.parse(read('source/typography.json'));
const original = read('source/design-system-1.1.base.html');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) fail('Duplicate HTML ids');
for (const match of html.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(match[1])) fail(`Broken anchor: ${match[1]}`);
for (const id of ['revision','primary-system','typography-system','component-rules','responsive-rules','current-patterns','content-accessibility','change-log']) {
  if (!ids.includes(id)) fail(`Missing required section: ${id}`);
}
const definitions = new Map([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
for (const [name, value] of Object.entries(json['01-primitives'].color)) {
  if (definitions.get(`kemi-${name}`) !== value) fail(`Primitive mismatch: ${name}`);
}
for (const role of roles) {
  if (!css.includes(`.type-${role.token}`)) fail(`Missing typography class: ${role.token}`);
  if (definitions.get(`font-${role.token}`) !== `${json['01-primitives'].font.size[role.token]}px`) fail(`Font mismatch: ${role.token}`);
  if (definitions.get(`leading-${role.token}`) !== `${json['01-primitives'].font.lineHeight[role.token]}px`) fail(`Leading mismatch: ${role.token}`);
}
if (roles.length !== 11 || json.$meta.primaryColor !== '#539863') fail('Primary color / type-role count mismatch');
const cssOnly = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const inlineStyles = [...html.matchAll(/\bstyle="([^"]*)"/g)].map(match => match[1]).join('\n');
const declared = new Set([...(cssOnly + inlineStyles).matchAll(/--([\w-]+)\s*:/g)].map(match => match[1]));
for (const match of cssOnly.matchAll(/var\(--([\w-]+)/g)) if (!declared.has(match[1])) fail(`Undefined CSS variable: ${match[1]}`);
const assetData = text => [...text.matchAll(/data:image\/[^"'\s)]+/g)].map(match => match[0]).sort();
if (JSON.stringify(assetData(html)) !== JSON.stringify(assetData(original))) fail('Embedded artwork changed');
let scripts = 0;
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) { new vm.Script(match[1]); scripts++; }
const lum = hex => {
  const c = hex.slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
};
const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const resolve = value => value.startsWith('{') ? json['01-primitives'].color[value.slice(1,-1)] : value;
let pairs = 0;
for (const [theme, values] of Object.entries(json['02-semantic'])) {
  const checks = [['action/primary-text','action/primary',4.5],['action/primary-text','action/primary-hover',4.5],['action/primary-text','action/primary-press',4.5],['text/primary','surface/base',4.5],['text/secondary','surface/raised',4.5],['focus/ring','surface/base',3],['border/strong','surface/raised',3],['action/primary','action/primary-subtle',4.5]];
  for (const [fg,bg,min] of checks) {
    const value = ratio(resolve(values[fg]),resolve(values[bg]));
    if (value < min) fail(`${theme} ${fg} / ${bg}: ${value.toFixed(2)} < ${min}`);
    pairs++;
  }
}
const outputs = ['src/tokens/tokens.css','src/tokens/tokens.json','KEMI_Design_System.html','public/KEMI_Design_System.html','tokens/tokens.css','reference/KEMI_Design_System_1.1.html'];
const digest = name => createHash('sha256').update(read(name)).digest('hex');
const before = outputs.map(digest);
execFileSync(process.execPath,[path.join(__dirname,'build-design-system.cjs')],{stdio:'pipe'});
if (JSON.stringify(before) !== JSON.stringify(outputs.map(digest))) fail('Generated outputs were stale or non-deterministic');
console.log(`PASS: ${ids.length} unique ids; links and required sections; ${roles.length} type roles; CSS variables; ${scripts} scripts; embedded assets unchanged; ${pairs} contrast pairs; ${outputs.length} reproducible outputs.`);
