import { useAuth } from './context/AuthContext';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';
import SidebarReviewView from './views/SidebarReviewView';

function isSidebarReviewMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('uiReview') === 'sidebar';
}

function AuthenticatedApp() {
  const { loading, user } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500 text-sm">Carregando sessão...</div>;
  return user ? <DashboardView /> : <AuthView />;
}

function App() {
  if (isSidebarReviewMode()) return <SidebarReviewView />;
  return <AuthenticatedApp />;
}

export default App;
