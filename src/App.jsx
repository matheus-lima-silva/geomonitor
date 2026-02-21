import { useAuth } from './context/AuthContext';
import AuthView from './views/AuthView';
import DashboardView from './views/DashboardView';

function App() {
  const { loading, user } = useAuth();

  if (loading) return <div className="container">Carregando sessão...</div>;
  return user ? <DashboardView /> : <main className="container"><AuthView /></main>;
}

export default App;
