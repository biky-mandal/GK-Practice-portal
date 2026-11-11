const SYMBOLS: Record<string, string> = {
  '×': '\\times ', '÷': '\\div ', '≤': '\\le ', '≥': '\\ge ', '≠': '\\ne ', '≈': '\\approx ', '±': '\\pm ',
  '∞': '\\infty ', '∫': '\\int ', '∑': '\\sum ', '∏': '\\prod ', '∂': '\\partial ', '∈': '\\in ', '∉': '\\notin ',
  '⊂': '\\subset ', '∪': '\\cup ', '∩': '\\cap ', '→': '\\to ', '⇒': '\\Rightarrow ', '∴': '\\therefore ', '°': '^\\circ ',
  'π': '\\pi ', 'θ': '\\theta ', 'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'λ': '\\lambda ',
  'μ': '\\mu ', 'σ': '\\sigma ', 'ω': '\\omega ', 'φ': '\\phi ', 'Δ': '\\Delta ', 'Σ': '\\Sigma ', 'Ω': '\\Omega ',
  '²': '^{2}', '³': '^{3}', '⁴': '^{4}', '¹': '^{1}', '⁰': '^{0}', '⁻': '^{-}',
  '₀': '_{0}', '₁': '_{1}', '₂': '_{2}', '₃': '_{3}', '₄': '_{4}', '½': '\\frac{1}{2}', '¼': '\\frac{1}{4}', '¾': '\\frac{3}{4}'
};

const SYMBOL_CLASS = new RegExp(`[${Object.keys(SYMBOLS).join('')}√]`);
const FUNCTIONS = ['sin', 'cos', 'tan', 'cot', 'sec', 'cosec', 'csc', 'log', 'ln', 'lim', 'exp'];
const MATHY_TOKEN =
  /[\^_=<>+*]|\d\/\d|[a-z0-9)]\/[a-z0-9(]|sqrt\(|\d[a-z]\b|\b[a-z]\d|->|!=|^[a-z]$|^[+\-=]$/i;

/** Converts one plain-text math expression (no surrounding prose) to LaTeX. */
export function plainMathToLatex(input: string): string {
  let s = input.trim();

  s = s.replace(/√\(([^()]+)\)/g, '\\sqrt{$1}').replace(/√([A-Za-z0-9.]+)/g, '\\sqrt{$1}').replace(/√/g, '\\sqrt{}');
  s = s.replace(/sqrt\(([^()]+)\)/gi, '\\sqrt{$1}');
  s = s.replace(/cbrt\(([^()]+)\)/gi, '\\sqrt[3]{$1}');

  s = s.replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ').replace(/!=/g, '\\ne ').replace(/->/g, '\\to ').replace(/\+-/g, '\\pm ');
  s = s.replace(/\bpi\b/gi, '\\pi ').replace(/\binfinity\b|\binf\b/gi, '\\infty ');
  s = s.replace(new RegExp(`\\b(${FUNCTIONS.join('|')})\\b(?!\\s*\\{)`, 'gi'), (m) => `\\${m.toLowerCase() === 'cosec' ? 'csc' : m.toLowerCase()}`);

  // Fractions: (a+b)/(c+d), then simple tokens a/b (possibly with ^ powers or sqrt results).
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/\(([^()]+)\)\s*\/\s*([A-Za-z0-9.\\]+(?:\^\{?[A-Za-z0-9+\-]+\}?)?)/g, '\\frac{$1}{$2}');
  s = s.replace(/([A-Za-z0-9.]+(?:\^\{?[A-Za-z0-9+\-]+\}?)?)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/(\\sqrt\{[^{}]+\}|[A-Za-z0-9.]+(?:\^\{?[A-Za-z0-9+\-]+\}?)?)\s*\/\s*(\\sqrt\{[^{}]+\}|[A-Za-z0-9.]+(?:\^\{?[A-Za-z0-9+\-]+\}?)?)/g, '\\frac{$1}{$2}');

  // Powers and subscripts written with parentheses or multiple characters.
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}').replace(/\^(-?[A-Za-z0-9.]{2,})/g, '^{$1}');
  s = s.replace(/_\(([^()]+)\)/g, '_{$1}').replace(/_([A-Za-z0-9]{2,})/g, '_{$1}');

  s = s.replace(/\*/g, '\\cdot ');
  s = s.replace(/[^\x00-\x7F]/g, (ch) => SYMBOLS[ch] ?? ch);
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Finds math-looking runs inside prose and wraps each converted run in $...$.
 * Existing $...$ / $$...$$ / \(...\) / \[...\] segments are left untouched.
 */
export function convertTextToLatex(text: string): string {
  if (!text) return text;
  const protectedPattern = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g;
  let result = '';
  let last = 0;
  for (const m of text.matchAll(protectedPattern)) {
    result += convertProse(text.slice(last, m.index));
    result += m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  return result + convertProse(text.slice(last));
}

function isMathToken(token: string): boolean {
  const core = token.replace(/^[("']+|[.,;:?!"')]+$/g, '');
  if (!core) return false;
  if (SYMBOL_CLASS.test(core)) return true;
  if (/^\d+(\.\d+)?$/.test(core)) return false;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(core)) return false;
  if (new RegExp(`^(${FUNCTIONS.join('|')})\\(`, 'i').test(core)) return true;
  return MATHY_TOKEN.test(core) && !/^[a-z]{2,}$/i.test(core) && !/^[A-Za-z]$/.test(core);
}

function convertProse(prose: string): string {
  const parts = prose.split(/(\s+)/);
  const out: string[] = [];
  let run: string[] = [];
  let pendingSpace: string[] = [];

  const flush = () => {
    if (!run.length) return;
    let expr = run.join('');
    let trailing = '';
    const t = expr.match(/[.,;:?!]+$/);
    if (t) { trailing = t[0]; expr = expr.slice(0, -trailing.length); }
    let leading = '';
    const l = expr.match(/^[("']+/);
    if (l && !expr.includes(')')) { leading = l[0]; expr = expr.slice(leading.length); }
    out.push(`${leading}$${plainMathToLatex(expr)}$${trailing}`);
    run = [];
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^\s+$/.test(part)) { pendingSpace.push(part); continue; }
    const connector = /^[+\-=<>*/×÷^]$/.test(part);
    const lastIsConnector = run.length > 0 && /^[+\-=<>*/×÷^]$/.test(run[run.length - 1]);
    const operand = lastIsConnector && /^[A-Za-z0-9.]+[.,;:?!]*$/.test(part);
    if (isMathToken(part) || (run.length && connector) || operand) {
      if (run.length) run.push(pendingSpace.join(''));
      else out.push(pendingSpace.join(''));
      run.push(part);
    } else {
      flush();
      out.push(pendingSpace.join(''), part);
    }
    pendingSpace = [];
  }
  flush();
  out.push(pendingSpace.join(''));
  return out.join('');
}
