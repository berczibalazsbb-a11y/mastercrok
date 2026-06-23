import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Lobby from './pages/Lobby';
import Match from './pages/Match';
import Join from './pages/Join';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/match/:id" element={<Match />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
