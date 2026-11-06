import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FullHighlighter from 'react-syntax-highlighter';
import LightHighlighter from '../highlighter';
import darkTheme from '../CodeBlockDarkTheme';

// Blocos típicos de respostas, com as tags que os modelos costumam usar.
const SAMPLES: [string, string][] = [
  ['javascript', 'const a = [1, 2].map((x) => x * 2);\nconsole.log(`v=${a}`);'],
  [
    'typescript',
    'interface A { b: number }\nexport const f = (a: A): string => String(a.b);',
  ],
  [
    'python',
    'def soma(a, b):\n    """doc"""\n    return a + b  # comentário\nprint(soma(1, 2))',
  ],
  ['bash', 'for f in *.txt; do\n  echo "$f" | grep -i foo\ndone'],
  ['json', '{"a": 1, "b": [true, null, "x"]}'],
  [
    'xml',
    '<div class="x"><script>let a = 1;</script><style>p{color:red}</style></div>',
  ],
  ['css', '.a > b:hover { color: #fff; margin: 0 auto; }'],
  ['sql', 'SELECT id, nome FROM usuarios WHERE idade > 18 ORDER BY nome;'],
  [
    'java',
    'public class A { public static void main(String[] a) { System.out.println("oi"); } }',
  ],
  ['go', 'package main\nimport "fmt"\nfunc main() { fmt.Println("oi") }'],
  ['rust', 'fn main() { let v: Vec<i32> = vec![1, 2]; println!("{:?}", v); }'],
  ['cpp', '#include <iostream>\nint main() { std::cout << "oi"; return 0; }'],
  ['c', '#include <stdio.h>\nint main(void) { printf("oi\\n"); return 0; }'],
  [
    'csharp',
    'using System;\nclass A { static void Main() { Console.WriteLine("oi"); } }',
  ],
  ['php', '<?php echo "oi"; $a = [1, 2]; ?>'],
  ['ruby', 'def oi(n)\n  puts "oi #{n}"\nend'],
  [
    'yaml',
    'services:\n  app:\n    image: vane:latest\n    ports: ["3000:3000"]',
  ],
  ['dockerfile', 'FROM node:20\nRUN yarn install\nCMD ["yarn", "start"]'],
  ['diff', '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new'],
  ['kotlin', 'fun main() { val x = listOf(1, 2); println(x) }'],
  ['swift', 'let x = [1, 2].map { $0 * 2 }\nprint(x)'],
  ['markdown', '# Título\n\n- item **negrito**'],
  ['powershell', 'Get-ChildItem -Path . | Where-Object { $_.Length -gt 0 }'],
  ['', 'const a = 1;\nfunction f() { return a; }'],
  ['text', 'texto simples'],
  ['js', 'const a = [1, 2].map((x) => x * 2);\nconsole.log(`v=${a}`);'],
  [
    'ts',
    'interface A { b: number }\nexport const f = (a: A): string => String(a.b);',
  ],
  ['tsx', 'export const C = () => <div className="a">{1}</div>;'],
  ['jsx', 'const C = () => <div className="a">{1}</div>;'],
  ['py', 'def soma(a, b):\n    return a + b  # comentário'],
  ['sh', 'npm install && echo "$HOME"'],
  ['shell', '$ yarn build\nDone in 3s.'],
  ['html', '<!doctype html><html><body><p class="a">oi</p></body></html>'],
  ['yml', 'a:\n  b: 1'],
  ['vue', '<template><div>{{ a }}</div></template>'],
  ['haskell', 'main = putStrLn "oi"'],
  ['', 'SELECT * FROM t WHERE a = 1;'],
  ['', 'def f(x):\n    return x * 2'],
  ['', '<div><span>oi</span></div>'],
  ['', 'pip install requests'],
  ['', 'Resultado: 42 itens processados em 3s.'],
];

const render = (C: any, language: string, code: string) =>
  renderToStaticMarkup(
    React.createElement(
      C,
      { language, style: darkTheme, showInlineLineNumbers: true },
      code,
    ),
  );

describe('CodeBlock light highlighter', () => {
  it.each(SAMPLES)(
    'renders %s exactly like the full build',
    (language, code) => {
      expect(render(LightHighlighter, language, code)).toBe(
        render(FullHighlighter, language, code),
      );
    },
  );
});
