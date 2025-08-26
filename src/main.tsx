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
            bgGradient: 'to-b',
            gradientFrom: 'gray.50',
            gradientTo: 'gray.200',
            color: 'gray.900',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, Apple SD Gothic Neo, sans-serif'
          })
        }
      >
        <div className={container({ px: { base: 4, md: 8 }, py: 8, maxW: '720px' })}>
          <RouterProvider router={router} />
        </div>
      </div>
    </QueryClientProvider>
  </StrictMode>,
)
