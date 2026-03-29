import { useAuth } from './context/AuthContext';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import SidebarReviewView from './views/SidebarReviewView';
import ResetPasswordConfirmView from './views/ResetPasswordConfirmView';

function isSidebarReviewMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('uiReview') === 'sidebar';
}

function getResetPasswordToken() {
  const path = window.location.pathname;
  if (path !== '/reset-password') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || null;
}

function AuthenticatedApp() {
  const { loading, user } = useAuth();

  const resetToken = getResetPasswordToken();
  if (resetToken) {
    return (
      <ResetPasswordConfirmView
        token={resetToken}
        onDone={() => { window.history.replaceState(null, '', '/'); window.location.reload(); }}
      />
    );
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500 text-sm">Carregando sessão...</div>;
  return user ? <DashboardView /> : <AuthView />;
}

function App() {
  if (isSidebarReviewMode()) return <SidebarReviewView />;
  return <AuthenticatedApp />;
}

export default App;
