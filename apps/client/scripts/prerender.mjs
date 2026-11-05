// `vite build`가 만든 dist/index.html(SPA 셸)로부터 정적 HTML을 만든다.
//  - index.html            : 랜딩(/)을 서버 렌더링해 넣는다. 검색·AI 크롤러가 JS 없이 본문을 읽는다.
//  - privacy.html, terms.html : 페이지별 title·설명·canonical을 가진 정적 페이지.
//  - app.html              : 빈 셸. /room/* 같은 실시간 페이지가 쓴다(noindex).
// 경로→파일 매핑은 vercel.json의 routes, 렌더링 대상은 src/entry-prerender.tsx에 있다.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const ssrOut = resolve(root, 'dist-ssr');
const EMPTY_ROOT = /<div id="root"><\/div>/;

// index.html의 태그가 바뀌어 치환이 조용히 빠지는 일을 막는다.
function mustReplace(html, pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`prerender: index.html에서 ${pattern}를 찾지 못했습니다`);
  return html.replace(pattern, replacement);
}

const stripJsonLd = (html) => mustReplace(html, /\n\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');

function withMeta(html, { title, description, path }) {
  const url = `https://metronome.todari.dev${path}`;
  html = mustReplace(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = mustReplace(html, /(<link rel="canonical" href=")[^"]*/, `$1${url}`);
  html = mustReplace(html, /(<meta property="og:url" content=")[^"]*/, `$1${url}`);
  for (const attr of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
    html = mustReplace(html, new RegExp(`(<meta ${attr} content=")[^"]*`), `$1${description}`);
  }
  for (const attr of ['property="og:title"', 'name="twitter:title"']) {
    html = mustReplace(html, new RegExp(`(<meta ${attr} content=")[^"]*`), `$1${title}`);
  }
  return html;
}

async function main() {
  await build({
    root,
    logLevel: 'warn',
    build: { ssr: 'src/entry-prerender.tsx', outDir: ssrOut, emptyOutDir: true },
  });
  try {
    const { PAGES, render } = await import(pathToFileURL(resolve(ssrOut, 'entry-prerender.js')).href);
    const shell = await readFile(resolve(dist, 'index.html'), 'utf8');

    const outputs = {
      'app.html': [
        (html) => stripJsonLd(html),
        (html) => mustReplace(html, /\n\s*<link rel="canonical"[^>]*>/, ''),
        (html) => mustReplace(html, /<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex"'),
        (html) => mustReplace(html, /<title>[^<]*<\/title>/, '<title>메트로놈들</title>'),
      ].reduce((html, step) => step(html), shell),
    };
    for (const [path, page] of Object.entries(PAGES)) {
      const html = page.title ? stripJsonLd(withMeta(shell, { ...page, path })) : shell;
      outputs[page.file] = mustReplace(html, EMPTY_ROOT, `<div id="root">${render(path)}</div>`);
    }
    for (const [file, html] of Object.entries(outputs)) {
      await writeFile(resolve(dist, file), html);
    }
    console.log(`prerender: ${Object.keys(outputs).join(', ')}`);
  } finally {
    await rm(ssrOut, { recursive: true, force: true });
  }
}

// Vite 설정이 끌어오는 플러그인이 미처리 예외를 로그만 남기고 삼켜 종료 코드가 0이 되므로 직접 실패시킨다.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
