# VladeMD-View

Extensão do Chrome que renderiza arquivos `.md` no navegador com as sintaxes do
**GitHub (GFM)**, do **Obsidian** e do que o **Claude Code** costuma escrever.

O Chrome mostra `.md` como texto cru. Extensões existentes cobrem bem o GFM, mas
perdem o que é próprio do Obsidian e do Claude Code: frontmatter YAML vira lixo
no topo, callouts viram citação comum, wikilinks viram colchetes. Esta extensão
cobre os três dialetos.

## O que renderiza

| Recurso | Exemplo | Origem |
| --- | --- | --- |
| Tabelas, listas de tarefas, notas de rodapé | `\| a \| b \|`, `- [x]`, `[^1]` | GFM |
| Realce de sintaxe | ` ```python ` | GFM |
| Emoji por atalho | `:smile:` | GFM |
| Diagramas | ` ```mermaid ` | Mermaid 11 |
| Fórmulas | `$e^{i\pi}+1=0$`, `$$...$$` | MathJax 3 (SVG) |
| Subscrito / sobrescrito | `H~2~O`, `X^2^` | extensão de sintaxe |
| Frontmatter YAML | `---\ntitle: ...\n---` | Obsidian |
| Callouts (13 tipos, recolhíveis) | `> [!WARNING] Título` | Obsidian |
| Wikilinks e embeds | `[[Nota\|texto]]`, `![[img.png]]` | Obsidian |
| Destaque | `==importante==` | Obsidian |
| Tags | `#arquitetura` | Obsidian |
| Referência de bloco | `^id` (removida da exibição) | Obsidian |
| HTML inline | `<details>`, `<kbd>`, `<br>` | comum no Claude Code |

Mais: sumário lateral com destaque da seção atual, âncora em cada título, botão
de copiar em cada bloco de código, tema claro/escuro/sistema, barra de progresso
de leitura e folha de estilo de impressão.

`[[Nota]]` vira link para `Nota.md` na mesma pasta — navegar entre notas do
Obsidian funciona direto no navegador.

## Instalação

1. `chrome://extensions`
2. Ligue o **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione esta pasta
4. Abra as opções e confira o status de **Acesso a arquivos locais**

Ler `.md` do disco depende da permissão **Permitir acesso a URLs de arquivo**.
Instalada sem compactação, ela costuma já vir ligada — a página de opções mostra
o status real. Se estiver desligada, o interruptor fica em `chrome://extensions`
→ VladeMD-View (ou ícone da extensão → **Gerenciar extensão**).

## Estrutura

```
manifest.json     Manifest V3
content.js        detecta o .md, monta a página, sumário, tema, Mermaid, MathJax
md-plugins.js     dialetos Obsidian/Claude Code + montagem do parser
style.css         visual do leitor (paleta e escala inspiradas no Theme UI)
background.js     injeta Mermaid e MathJax sob demanda
options.html/js   preferências
welcome.html/js   primeira execução
vendor/           libs empacotadas localmente (exigência da CSP do MV3)
test/             suíte de parsing + sample.md para conferência visual
```

Mermaid (2,5 MB) e MathJax (2 MB) **não** são carregados junto com a página: o
`content.js` só pede a injeção ao `background.js` quando o documento tem
diagrama ou fórmula. Abrir um `.md` comum carrega ~340 KB.

## Testes

```bash
node test/parse.test.js
```

Roda o mesmo `VladeMD.createParser` que o navegador usa, com as mesmas libs —
33 casos cobrindo cada dialeto, incluindo as armadilhas (`$5` não é fórmula,
`$x^2$` não vira sobrescrito, `#fff` não vira tag, `[[javascript:...]]` não vira
link).

Para conferência visual, abra `test/sample.md` no navegador: o arquivo exercita
todos os recursos. Qualquer trecho que apareça como texto cru indica regressão.

## Opções

Ícone da extensão → **Opções** (ou `chrome://extensions` → VladeMD-View → Opções da extensão).

Tema, largura da coluna, sumário ligado/desligado, e chaves por sintaxe
(MathJax, Mermaid, emoji, wikilinks, tags). Desligar tags é útil se você escreve
muito `#hex` em prosa.

## Segurança

Todo HTML gerado passa por DOMPurify antes de ir para a página, inclusive o HTML
inline do próprio documento. Os diagramas Mermaid rodam com `securityLevel:
'strict'`. Nenhuma lib é carregada de CDN — a CSP do Manifest V3 proíbe, e tudo
está em `vendor/`. A extensão não faz requisição de rede alguma.

## Limitações conhecidas

- Sem publicação na Chrome Web Store — instalação é por "carregar sem compactação".
- `![[nota.md]]` (embed de outra nota) vira link, não incorpora o conteúdo.
- O YAML do frontmatter é lido de forma rasa: chave/valor e listas de um nível.
- Âncoras de título não seguem exatamente o algoritmo de slug do GitHub.
