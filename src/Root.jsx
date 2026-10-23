import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import AdminPage from './components/admin/AdminPage';
import App from './App';
import LandingPage from './components/site/LandingPage';

const FullScreenLoader = () => (
  <div className="min-h-screen bg-canvas flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
  </div>
);

// Signed-in only; remembers where the user was going so sign-in can return there
const RequireAuth = ({ children, adminOnly = false }) => {
  const { status, isAdmin } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status !== 'signed-in') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/app" replace />;
  return children;
};

const Root = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/app/admin" element={<RequireAuth adminOnly><AdminPage /></RequireAuth>} />
        <Route path="/app/*" element={<RequireAuth><App /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default Root;
