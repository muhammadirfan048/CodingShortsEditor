// A small, dependency-free syntax highlighter for drawing code on canvas.
// Returns lines of tokens: [{ t: 'text', c: 'kw' | 'str' | 'num' | 'com' | 'fn' | 'type' | 'p' | 'id' | 'tag' | 'attr' }]

const JS = 'const let var function return if else for while do break continue new class extends import from export default async await try catch finally throw typeof instanceof in of this null undefined true false switch case static get set yield delete void super';
const KEYWORDS = {
  javascript: JS,
  jsx: JS,
  typescript: JS + ' interface type enum implements public private protected readonly as keyof declare namespace abstract string number boolean any unknown never',
  python: 'def return if elif else for while in not and or import from as class try except finally raise with lambda None True False pass break continue yield async await is global nonlocal self print len range',
  java: 'public private protected class interface extends implements static final void int long double float boolean char new return if else for while do break continue switch case try catch finally throw throws import package this super null true false String var',
  csharp: 'public private protected internal class interface static readonly void int long double float bool char string new return if else for foreach while do break continue switch case try catch finally throw using namespace this base null true false var async await var get set',
  go: 'package import func return if else for range break continue switch case default go defer chan map struct interface type var const nil true false make len append string int error',
  bash: 'cd ls echo export sudo npm npx yarn pnpm git node python pip cat mkdir rm cp mv if then fi for do done in',
  sql: 'select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order asc desc limit having as distinct count sum avg min max null is primary key',
  css: '',
  html: '',
  plain: '',
};

const kwCache = {};
function kwSet(lang) {
  if (!kwCache[lang]) kwCache[lang] = new Set((KEYWORDS[lang] || '').split(/\s+/).filter(Boolean));
  return kwCache[lang];
}

function commentRe(lang) {
  if (lang === 'python' || lang === 'bash') return '#.*$';
  if (lang === 'sql') return '--.*$';
  if (lang === 'html') return '<!--.*?(?:-->|$)';
  if (lang === 'css') return '\\/\\*.*?(?:\\*\\/|$)';
  if (lang === 'plain') return '(?!x)x';
  return '\\/\\/.*$|\\/\\*.*?(?:\\*\\/|$)';
}

export function highlight(code, lang = 'javascript') {
  const kws = kwSet(lang);
  const ci = lang === 'sql';
  const re = new RegExp(
    `(${commentRe(lang)})|("(?:\\\\.|[^"\\\\])*"?|'(?:\\\\.|[^'\\\\])*'?|\`(?:\\\\.|[^\`\\\\])*\`?)|(\\b\\d+(?:\\.\\d+)?\\b)|(<\\/?[A-Za-z][\\w.-]*|\\/?>)|([A-Za-z_$][\\w$-]*)|(\\s+)|(.)`,
    'g'
  );
  return code.replace(/\t/g, '  ').split('\n').map((line) => {
    if (lang === 'plain') return line ? [{ t: line, c: 'id' }] : [];
    const out = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line))) {
      const [all, com, str, num, tag, id, ws] = m;
      if (!all) { re.lastIndex++; continue; }
      if (com) out.push({ t: com, c: 'com' });
      else if (str) out.push({ t: str, c: 'str' });
      else if (num) out.push({ t: num, c: 'num' });
      else if (tag && (lang === 'html' || lang === 'jsx')) out.push({ t: tag, c: 'tag' });
      else if (id) {
        const after = line.slice(re.lastIndex);
        let c = 'id';
        if (kws.has(ci ? id.toLowerCase() : id)) c = 'kw';
        else if (lang === 'css' && /^\s*:/.test(after)) c = 'attr';
        else if ((lang === 'html' || lang === 'jsx') && /^=/.test(after)) c = 'attr';
        else if (/^\s*\(/.test(after)) c = 'fn';
        else if (/^[A-Z]/.test(id)) c = 'type';
        out.push({ t: id, c });
      } else if (ws) out.push({ t: ws, c: 'id' });
      else if (tag) out.push({ t: tag, c: 'p' });
      else out.push({ t: all, c: 'p' });
    }
    return out;
  });
}

// Editor theme (dark), used by the renderer.
export const EDITOR_THEME = {
  bg: '#141821',
  bar: '#0e1118',
  border: 'rgba(255,255,255,.08)',
  gutter: '#4a5468',
  gutterActive: '#c8d3e6',
  activeLine: 'rgba(130,170,255,.08)',
  cursor: '#ffcc66',
  tabBg: '#141821',
  tabText: '#d6deeb',
  colors: {
    id: '#d6deeb',
    kw: '#c792ea',
    str: '#c3e88d',
    num: '#f78c6c',
    com: '#637083',
    fn: '#82aaff',
    type: '#ffcb6b',
    p: '#89ddff',
    tag: '#ff5370',
    attr: '#ffcb6b',
  },
};
