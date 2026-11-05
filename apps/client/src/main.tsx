import './ga';
import { StrictMode } from 'react'
import './index.css'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRouter } from './routes.tsx';
import { AppShell } from './AppShell';
import { initSentry, Sentry } from './utils/sentry';
import { ErrorFallback } from './components/ErrorFallback';

initSentry();

const queryClient = new QueryClient();

const tree = (
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <AppRouter />
        </AppShell>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);

const root = document.getElementById('root')!;
// 빌드 시 미리 렌더링된 페이지(/, /privacy, /terms)는 하이드레이션하고,
// 빈 셸(app.html: /room/* 등)은 처음부터 렌더링한다. scripts/prerender.mjs 참고.
if (root.hasChildNodes()) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
