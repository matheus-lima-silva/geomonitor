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

  if (loading) return <div className="container">Carregando sessão...</div>;
  return user ? <DashboardView /> : <main className="container"><AuthView /></main>;
}

function App() {
  if (isSidebarReviewMode()) return <SidebarReviewView />;
  return <AuthenticatedApp />;
}

export default App;
