import { css } from "../../styled-system/css";

export function Header() {
  return (
    <header className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 4 })}>
      <a href="/">
      <h1 className={css({ color: 'white', fontSize: '2xl', fontWeight: 'bold', letterSpacing: '-0.02em' })}>메트로놈들</h1>
      </a>
    </header>
  );
}
