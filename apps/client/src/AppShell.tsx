import type { ReactNode } from 'react';
import { css } from '../styled-system/css';
import { container } from '../styled-system/patterns';

/**
 * 페이지 공통 배경·글꼴·폭.
 * main.tsx(브라우저)와 entry-prerender.tsx(빌드 시 정적 렌더링)가 같은 마크업을 내도록 공유한다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        minH: '100dvh',
        bg: 'neutral.900',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans KR, Apple SD Gothic Neo, sans-serif',
      })}
    >
      <div className={container({ maxW: '720px' })}>{children}</div>
    </div>
  );
}
