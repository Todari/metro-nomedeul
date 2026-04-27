import { Link } from 'react-router-dom';
import { css } from '../../styled-system/css';
import { hstack } from '../../styled-system/patterns';

export function Footer() {
  return (
    <footer
      className={hstack({
        gap: 4,
        justifyContent: 'center',
        alignItems: 'center',
        py: 6,
        px: 4,
        color: 'neutral.500',
        fontSize: 'xs',
      })}
    >
      <Link
        to="/privacy"
        className={css({ _hover: { color: 'neutral.300' } })}
      >
        개인정보처리방침
      </Link>
      <span className={css({ color: 'neutral.700' })}>·</span>
      <Link
        to="/terms"
        className={css({ _hover: { color: 'neutral.300' } })}
      >
        이용약관
      </Link>
    </footer>
  );
}
