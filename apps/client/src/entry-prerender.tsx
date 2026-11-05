import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import App from './App';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { TermsPage } from './pages/legal/TermsPage';

interface PrerenderPage {
  /** dist/ 안에 쓸 파일 이름. vercel.json의 routes가 경로를 이 파일로 보낸다. */
  file: string;
  element: ReactElement;
  /** 있으면 scripts/prerender.mjs가 title·설명·canonical을 이 값으로 바꾼다. 없으면 index.html 기본값(랜딩)을 쓴다. */
  title?: string;
  description?: string;
}

/** 빌드 시 정적 HTML로 미리 렌더링하는 경로. /room/*는 실시간 상태라 빈 셸(app.html)을 쓴다. */
export const PAGES: Record<string, PrerenderPage> = {
  '/': { file: 'index.html', element: <App /> },
  '/privacy': {
    file: 'privacy.html',
    element: <PrivacyPage />,
    title: '개인정보처리방침 | 메트로놈들',
    description: '메트로놈들이 수집하는 정보와 이용 목적, 보관 기간, 이용자의 권리를 안내합니다.',
  },
  '/terms': {
    file: 'terms.html',
    element: <TermsPage />,
    title: '이용약관 | 메트로놈들',
    description: '온라인 그룹 메트로놈 서비스 메트로놈들의 이용 조건과 책임 범위를 안내합니다.',
  },
};

export function render(path: string): string {
  return renderToString(
    <AppShell>
      <QueryClientProvider client={new QueryClient()}>{PAGES[path].element}</QueryClientProvider>
    </AppShell>,
  );
}
