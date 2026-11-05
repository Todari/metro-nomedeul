import { css } from "../../styled-system/css";

export function Header() {
  return (
    <header className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 4 })}>
      <a href="/">
      {/* h1은 각 페이지 본문(랜딩 제목, 약관 제목)이 가진다. 로고는 모든 페이지에 반복되므로 h1이 아니다. */}
      <span className={css({ color: 'white', fontSize: '2xl', fontWeight: 'bold', letterSpacing: '-0.02em' })}>메트로놈들</span>
      </a>
    </header>
  );
}
