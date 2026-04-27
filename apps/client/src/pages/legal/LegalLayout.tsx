import { ReactNode } from 'react';
import { css } from '../../../styled-system/css';
import { vstack } from '../../../styled-system/patterns';
import { Header } from '../../components/Header';

interface LegalLayoutProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className={vstack({ alignItems: 'stretch', gap: 0 })}>
      <Header />
      <div className={vstack({ gap: 4, p: 4, alignItems: 'stretch' })}>
        <div
          className={css({
            w: 'full',
            p: 6,
            bg: 'neutral.800',
            rounded: '2xl',
          })}
        >
          <div className={vstack({ gap: 4, alignItems: 'flex-start' })}>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'white' })}>
              {title}
            </h1>
            <p className={css({ color: 'neutral.500', fontSize: 'sm' })}>
              시행일: {updatedAt}
            </p>
            <div
              className={css({
                w: 'full',
                color: 'neutral.300',
                fontSize: 'sm',
                lineHeight: '1.7',
                '& h2': {
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  color: 'white',
                  mt: 4,
                  mb: 2,
                },
                '& p': { mb: 3 },
                '& ul': { pl: 5, mb: 3 },
                '& li': { mb: 1, listStyle: 'disc' },
                '& a': { color: 'orange.400', textDecoration: 'underline' },
              })}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
