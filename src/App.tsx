import { Routes, Route, Navigate } from 'react-router-dom';

// Pages are added in Phase 6. For now a placeholder home so the app compiles
// and the engine/UI can be developed underneath.
function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold text-amber-400">Master Crok</h1>
      <p className="text-slate-300 max-w-md">
        Real-time multiplayer Crok battles. Lobby &amp; match UI under
        construction.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
