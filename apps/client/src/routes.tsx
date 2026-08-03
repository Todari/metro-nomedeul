import { useEffect } from 'react';
import App from './App';
import { RoomPage } from './pages/room/roomPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { TermsPage } from './pages/legal/TermsPage';

function RedirectHome() {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return null;
}

export function AppRouter() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const roomMatch = pathname.match(/^\/room\/([^/]+)$/);

  if (roomMatch) {
    return <RoomPage uuid={decodeURIComponent(roomMatch[1])} />;
  }

  switch (pathname) {
    case '/':
      return <App />;
    case '/privacy':
      return <PrivacyPage />;
    case '/terms':
      return <TermsPage />;
    default:
      return <RedirectHome />;
  }
}
