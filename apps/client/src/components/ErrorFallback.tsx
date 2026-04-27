import { css } from '../../styled-system/css';
import { vstack } from '../../styled-system/patterns';

interface ErrorFallbackProps {
  resetError?: () => void;
}

export function ErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <div
      className={vstack({
        gap: 4,
        p: 8,
        minH: '60dvh',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
      })}
    >
      <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'white' })}>
        문제가 발생했어요
      </h1>
      <p className={css({ color: 'neutral.400', lineHeight: '1.6' })}>
        예기치 못한 오류로 화면을 표시할 수 없습니다.
        <br />
        잠시 후 다시 시도해주세요.
      </p>
      <button
        type="button"
        onClick={() => {
          resetError?.();
          window.location.href = '/';
        }}
        className={css({
          mt: 2,
          px: 6,
          py: 3,
          bg: 'orange.500',
          color: 'white',
          rounded: 'xl',
          fontWeight: 'bold',
          cursor: 'pointer',
          _hover: { bg: 'orange.600' },
        })}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}
