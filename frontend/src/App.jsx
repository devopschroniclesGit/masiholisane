import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login         from './pages/Login';
import Register      from './pages/Register';
import VerifyOtp      from './pages/VerifyOtp';
import Dashboard     from './pages/Dashboard';
import JoinPool      from './pages/JoinPool';
import PoolWaiting   from './pages/PoolWaiting';
import GroupDetail   from './pages/GroupDetail';
import PayoutHelp    from './pages/PayoutHelp';
import SuspensionHelp from './pages/SuspensionHelp';
import HelpCenter    from './pages/HelpCenter';
import FAQ           from './pages/FAQ';
import TalkToUs      from './pages/TalkToUs';
import TrustHistory  from './pages/TrustHistory';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RequestAccountDeletion from './pages/RequestAccountDeletion';
import Wallet     from './pages/Wallet';
import VAS        from './pages/VAS';
import Profile       from './pages/Profile';
import Layout        from './components/Layout';

import AdminLogin     from './pages/admin/AdminLogin';
import AdminLayout    from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminMembers   from './pages/admin/AdminMembers';
import AdminVerifications from './pages/admin/AdminVerifications';
import AdminGroups    from './pages/admin/AdminGroups';
import AdminReports   from './pages/admin/AdminReports';
import AdminLogs      from './pages/admin/AdminLogs';
import AdminVasFees   from './pages/admin/AdminVasFees';
import AdminDeletions from './pages/admin/AdminDeletions';

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
          <Route path="/verify-otp" element={<VerifyOtp />} />

          <Route path="/waiting" element={
            <ProtectedRoute><PoolWaiting /></ProtectedRoute>
          } />

          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="join"       element={<JoinPool />} />
            <Route path="group/:id"  element={<GroupDetail />} />
            <Route path="payout-help" element={<PayoutHelp />} />
            <Route path="suspension-help" element={<SuspensionHelp />} />
            <Route path="help" element={<HelpCenter />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="talk-to-us" element={<TalkToUs />} />
            <Route path="trust-history" element={<TrustHistory />} />
            <Route path="terms" element={<TermsOfService />} />
            <Route path="privacy" element={<PrivacyPolicy />} />
            <Route path="request-deletion" element={<RequestAccountDeletion />} />
            <Route path="wallet"       element={<Wallet />} />
            <Route path="vas"          element={<VAS />} />
            <Route path="profile"    element={<Profile />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="members"   element={<AdminMembers />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="groups"    element={<AdminGroups />} />
            <Route path="reports"   element={<AdminReports />} />
            <Route path="logs"      element={<AdminLogs />} />
            <Route path="vas-fees"  element={<AdminVasFees />} />
            <Route path="deletions" element={<AdminDeletions />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
