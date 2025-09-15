import { StrictMode } from 'react'
import './index.css'
import { css } from "../styled-system/css";
import { container } from "../styled-system/patterns";
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router';
import { router } from './routes.tsx';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div
        className={
          css({
            minH: '100dvh',
            bg: 'neutral.900',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, Apple SD Gothic Neo, sans-serif',
          })
        }
      >
        <div className={container({ maxW: '720px' })}>
          <RouterProvider router={router} />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
)
