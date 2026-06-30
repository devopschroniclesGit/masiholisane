import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login         from './pages/Login';
import Register      from './pages/Register';
import Dashboard     from './pages/Dashboard';
import JoinPool      from './pages/JoinPool';
import PoolWaiting   from './pages/PoolWaiting';
import GroupDetail   from './pages/GroupDetail';
import Wallet     from './pages/Wallet';
import VAS        from './pages/VAS';
import Profile       from './pages/Profile';
import Layout        from './components/Layout';

import AdminLogin     from './pages/admin/AdminLogin';
import AdminLayout    from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMembers   from './pages/admin/AdminMembers';
import AdminGroups    from './pages/admin/AdminGroups';
import AdminReports   from './pages/admin/AdminReports';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-navy font-bold animate-pulse">Loading...</div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/waiting" element={
            <ProtectedRoute><PoolWaiting /></ProtectedRoute>
          } />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="join"       element={<JoinPool />} />
            <Route path="group/:id"  element={<GroupDetail />} />
            <Route path="wallet"       element={<Wallet />} />
            <Route path="vas"          element={<VAS />} />
            <Route path="profile"    element={<Profile />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="members"   element={<AdminMembers />} />
            <Route path="groups"    element={<AdminGroups />} />
            <Route path="reports"   element={<AdminReports />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
