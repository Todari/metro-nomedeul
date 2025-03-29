import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { RoomPage } from "./pages/room/roomPage";

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/room/:uuid',
    element: <RoomPage />,
  },
]);
