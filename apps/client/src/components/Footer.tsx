import { Link } from 'react-router-dom';
import { css } from '../../styled-system/css';
import { hstack, vstack } from '../../styled-system/patterns';

const GITHUB_URL = 'https://github.com/Todari';
const EMAIL = 'rhymint@gmail.com';

const linkStyle = css({
  color: 'neutral.500',
  _hover: { color: 'neutral.300' },
  transition: 'color 0.15s ease',
});

const iconLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  w: 8,
  h: 8,
  rounded: 'md',
  color: 'neutral.500',
  _hover: { color: 'neutral.200', bg: 'neutral.800' },
  transition: 'all 0.15s ease',
});

export function Footer() {
  return (
    <footer
      className={vstack({
        gap: 3,
        alignItems: 'center',
        py: 8,
        px: 4,
        color: 'neutral.500',
        fontSize: 'xs',
      })}
    >
      <div className={hstack({ gap: 4, alignItems: 'center' })}>
        <Link to="/privacy" className={linkStyle}>
          개인정보처리방침
        </Link>
        <span className={css({ color: 'neutral.700' })}>·</span>
        <Link to="/terms" className={linkStyle}>
          이용약관
        </Link>
      </div>

      <div
        className={hstack({
          gap: 2,
          alignItems: 'center',
        })}
      >
        <span className={css({ color: 'neutral.600' })}>made by</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={css({
            color: 'neutral.300',
            fontWeight: 'semibold',
            _hover: { color: 'orange.400' },
            transition: 'color 0.15s ease',
          })}
        >
          Todari
        </a>
      </div>

      <div className={hstack({ gap: 1, alignItems: 'center' })}>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className={iconLinkStyle}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
          </svg>
        </a>
        <a
          href={`mailto:${EMAIL}`}
          aria-label="Email"
          className={iconLinkStyle}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
