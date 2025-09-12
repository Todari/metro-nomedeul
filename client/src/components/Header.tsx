import { css } from "../../styled-system/css";
import { useNavigate } from "react-router-dom";

export function Header() {
  const navigate = useNavigate();
  
  return (
    <header className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 4 })}>
      <button onClick={() => navigate('/')}>
      <h1 className={css({ color: 'white', fontSize: '2xl', fontWeight: 'bold', letterSpacing: '-0.02em' })}>메트로놈들</h1>
      </button>
    </header>
  );
}