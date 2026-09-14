/**
 * Checa o pipeline de parsing da extensao com as mesmas libs e a mesma ordem
 * de plugins que o navegador usa (VladeMD.createParser).
 *
 *   node test/parse.test.js
 */
'use strict';

const assert = require('assert');
const path = require('path');

const V = (f) => path.join(__dirname, '..', 'vendor', f);

// As libs sao UMD: no browser elas se registram em globalThis, aqui fazemos o mesmo.
globalThis.markdownit = require(V('markdown-it.min.js'));
globalThis.markdownitSub = require(V('markdown-it-sub.min.js'));
globalThis.markdownitSup = require(V('markdown-it-sup.min.js'));
globalThis.markdownitEmoji = require(V('markdown-it-emoji.min.js'));
globalThis.markdownitFootnote = require(V('markdown-it-footnote.min.js'));
globalThis.hljs = require(V('highlight.min.js'));
require(path.join(__dirname, '..', 'md-plugins.js'));

const VladeMD = globalThis.VladeMD;
const SETTINGS = { math: true, emoji: true, wikilinks: true, tags: true };
const md = VladeMD.createParser(SETTINGS);

let pass = 0;
const cases = [];
function t(name, fn) {
  cases.push([name, fn]);
}
const has = (html, needle, name) =>
  assert.ok(html.includes(needle), `${name}\n  esperado conter: ${needle}\n  html: ${html}`);
const hasNot = (html, needle, name) =>
  assert.ok(!html.includes(needle), `${name}\n  NAO devia conter: ${needle}\n  html: ${html}`);

// ------------------------------------------------------------------- GFM
t('tabela GFM', () => {
  const h = md.render('| a | b |\n|---|---|\n| 1 | 2 |');
  has(h, '<table>', 'tabela');
  has(h, '<th>a</th>', 'cabecalho');
});

t('emoji :smile:', () => {
  has(md.render('oi :smile:'), '\u{1F604}', 'emoji');
});

t('task list', () => {
  const h = md.render('- [x] feito\n- [ ] pendente');
  has(h, 'type="checkbox"', 'checkbox');
  has(h, 'checked', 'marcado');
  hasNot(h, '[x]', 'marcador cru removido');
});

t('nota de rodape', () => {
  const h = md.render('texto[^1]\n\n[^1]: nota');
  has(h, 'footnote', 'footnote');
});

t('realce de sintaxe', () => {
  has(md.render('```js\nconst a = 1;\n```'), 'hljs-keyword', 'hljs');
});

// ------------------------------------------------------------ cientifico
t('subscrito e sobrescrito', () => {
  const h = md.render('H~2~O e X^2^');
  has(h, '<sub>2</sub>', 'sub');
  has(h, '<sup>2</sup>', 'sup');
});

t('math inline vira \\( \\)', () => {
  has(md.render('seja $a+b$ igual'), '\\(a+b\\)', 'math inline');
});

t('math em bloco vira \\[ \\]', () => {
  const h = md.render('$$\n\\int_0^1 x dx\n$$');
  has(h, 'math-display', 'bloco');
  has(h, '\\[', 'delimitador');
});

t('math ganha de sup: $x^2$ nao vira <sup>', () => {
  const h = md.render('$x^2 + y^2$');
  hasNot(h, '<sup>', 'sup nao deve aparecer dentro de formula');
  has(h, '\\(x^2 + y^2\\)', 'formula intacta');
});

t('cifrao de dinheiro nao vira formula', () => {
  const h = md.render('custa $5 e depois $10 reais');
  hasNot(h, '\\(', 'nao e formula');
});

t('math escapa HTML', () => {
  has(md.render('$a < b$'), '\\(a &lt; b\\)', 'escape');
});

// --------------------------------------------------------------- Obsidian
t('frontmatter separado do corpo', () => {
  const { yaml, body } = VladeMD.splitFrontmatter('---\ntitle: Teste\ntags:\n  - a\n  - b\n---\n\n# Ola');
  assert.ok(yaml, 'yaml extraido');
  assert.strictEqual(body.trim(), '# Ola');
  const rows = VladeMD.parseFrontmatter(yaml);
  assert.strictEqual(rows[0].key, 'title');
  assert.strictEqual(rows[0].value, 'Teste');
  assert.deepStrictEqual(rows[1].list, ['a', 'b']);
});

t('documento sem frontmatter fica intacto', () => {
  const { yaml, body } = VladeMD.splitFrontmatter('# Ola\n\n---\n\nfim');
  assert.strictEqual(yaml, null);
  has(body, '# Ola', 'corpo preservado');
});

t('callout simples', () => {
  const h = md.render('> [!WARNING] Cuidado\n> corpo aqui');
  has(h, 'callout callout-warning', 'classe');
  has(h, 'Cuidado', 'titulo');
  has(h, 'corpo aqui', 'corpo');
  hasNot(h, '[!WARNING]', 'marcador cru removido');
});

t('callout sem titulo usa o padrao', () => {
  has(md.render('> [!TIP]\n> dica'), 'Tip', 'titulo padrao');
});

t('callout recolhivel vira details', () => {
  const open = md.render('> [!NOTE]+ Aberto\n> x');
  has(open, '<details', 'details');
  has(open, 'open', 'aberto');
  has(open, '<summary', 'summary');
  has(md.render('> [!NOTE]- Fechado\n> x'), '<details', 'fechado tambem e details');
  hasNot(md.render('> [!NOTE]- Fechado\n> x'), 'open=', 'fechado nao tem open');
});

t('callout com alias mapeia para a cor certa', () => {
  has(md.render('> [!caution] x'), 'callout-warning', 'caution -> warning');
  has(md.render('> [!error] x'), 'callout-danger', 'error -> danger');
});

t('blockquote comum continua blockquote', () => {
  const h = md.render('> citacao normal');
  has(h, '<blockquote>', 'blockquote');
  hasNot(h, 'callout', 'sem callout');
});

t('wikilink simples aponta para .md vizinho', () => {
  has(md.render('veja [[Minha Nota]]'), 'href="Minha%20Nota.md"', 'href');
});

t('wikilink com alias e ancora', () => {
  const h = md.render('[[Nota#Secao Dois|clique]]');
  has(h, 'href="Nota.md#secao-dois"', 'href');
  has(h, '>clique<', 'label');
});

t('wikilink so com ancora', () => {
  has(md.render('[[#Secao Um]]'), 'href="#secao-um"', 'ancora local');
});

t('embed de imagem', () => {
  has(md.render('![[foto.png]]'), '<img src="foto.png"', 'img');
});

t('wikilink com protocolo nao vira href', () => {
  const h = md.render('[[javascript:alert(1)]]');
  hasNot(h, 'href="javascript', 'protocolo bloqueado');
});

t('destaque ==texto==', () => {
  has(md.render('isso e ==importante=='), '<mark>importante</mark>', 'mark');
  has(md.render('==**forte**=='), '<mark><strong>forte</strong></mark>', 'markdown aninhado');
});

t('tag do obsidian', () => {
  has(md.render('sobre #arquitetura hoje'), 'md-tag', 'tag');
  hasNot(md.render('a cor e #fff no fim'), 'md-tag">#fff no', 'nao engole o resto da linha');
});

t('tag nao dispara no meio de palavra nem em ancora de url', () => {
  hasNot(md.render('veja http://x.com/p#secao aqui'), 'md-tag', 'ancora de url intacta');
  hasNot(md.render('issue n#5'), 'md-tag', 'sem letra apos #');
});

t('heading nao vira tag', () => {
  const h = md.render('# Titulo');
  has(h, '<h1>Titulo</h1>', 'heading');
  hasNot(h, 'md-tag', 'sem tag');
});

t('block ref ^id e removido', () => {
  const h = md.render('paragrafo com ref ^abc123');
  hasNot(h, '^abc123', 'ref removida');
  has(h, 'paragrafo com ref', 'texto mantido');
});

// ----------------------------------------------------------------- fences
t('bloco mermaid vira placeholder com a fonte como texto', () => {
  // Atributos data-* nao sobrevivem ao DOMPurify; por isso a fonte vai no texto.
  const h = md.render('```mermaid\ngraph TD;\nA-->B;\n```');
  has(h, '<div class="mermaid-block">graph TD;', 'placeholder com a fonte');
  hasNot(h, 'data-src', 'nao depende de atributo');
});

t('mermaid escapa o HTML da fonte', () => {
  const h = md.render('```mermaid\nA["<b>x</b>"]\n```');
  has(h, '&quot;', 'aspas escapadas');
  hasNot(h, '<b>', 'html neutralizado');
});

t('bloco de codigo comum nao vira mermaid', () => {
  has(md.render('```\ntexto\n```'), '<pre>', 'pre normal');
});

// ------------------------------------------------------------ desligaveis
t('opcoes desligadas removem os plugins', () => {
  const off = VladeMD.createParser({ math: false, emoji: false, wikilinks: false, tags: false });
  hasNot(off.render('$a+b$'), '\\(', 'math off');
  hasNot(off.render('oi :smile:'), '\u{1F604}', 'emoji off');
  hasNot(off.render('[[Nota]]'), 'wikilink', 'wikilinks off');
  hasNot(off.render('sobre #tag'), 'md-tag', 'tags off');
});

// ------------------------------------------------------------------ slug
t('slug remove acento e pontuacao', () => {
  assert.strictEqual(VladeMD.slugify('Instalacao & Configuracao'), 'instalacao-configuracao');
  assert.strictEqual(VladeMD.slugify('Ola, Mundo!'), 'ola-mundo');
});

// -------------------------------------------------------------------- run
let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    pass++;
  } catch (e) {
    failed++;
    console.error(`FALHOU  ${name}\n        ${e.message}\n`);
  }
}
console.log(`${pass}/${cases.length} testes passaram`);
process.exit(failed ? 1 : 0);
