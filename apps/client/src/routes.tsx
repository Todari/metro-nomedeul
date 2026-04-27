import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import { RoomPage } from './pages/room/roomPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { TermsPage } from './pages/legal/TermsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/room/:uuid',
    element: <RoomPage />,
  },
  {
    path: '/privacy',
    element: <PrivacyPage />,
  },
  {
    path: '/terms',
    element: <TermsPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
