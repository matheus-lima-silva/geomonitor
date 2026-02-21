import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function AuthView() {
  const { login, register, resetPassword } = useAuth();
  const { show } = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');

  async function onSubmit(event) {
    event.preventDefault();

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          show('As senhas não coincidem.', 'error');
          return;
        }
        await register(email, password, nome);
        show('Conta criada. Aguarde aprovação de um administrador.', 'success');
        return;
      }

      if (mode === 'reset') {
        await resetPassword(email);
        show('Email de recuperação enviado.', 'success');
        setMode('login');
        return;
      }

      await login(email, password);
      show('Login realizado com sucesso', 'success');
    } catch {
      show('Não foi possível concluir a ação.', 'error');
    }
  }

  return (
    <section className="panel auth">
      <h1>GeoMonitor</h1>
      <p className="muted">
        {mode === 'login' && 'Entrar no sistema'}
        {mode === 'register' && 'Criar nova conta'}
        {mode === 'reset' && 'Recuperar palavra-passe'}
      </p>

      <form onSubmit={onSubmit} className="grid-form">
        {mode === 'register' && (
          <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        )}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />

        {mode !== 'reset' && (
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        )}

        {mode === 'register' && (
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        )}

        <button type="submit">
          {mode === 'login' && 'Entrar'}
          {mode === 'register' && 'Criar conta'}
          {mode === 'reset' && 'Enviar recuperação'}
        </button>
      </form>

      <div className="inline-row">
        {mode !== 'login' && <button type="button" className="secondary" onClick={() => setMode('login')}>Entrar</button>}
        {mode !== 'register' && <button type="button" className="secondary" onClick={() => setMode('register')}>Criar conta</button>}
        {mode !== 'reset' && <button type="button" className="secondary" onClick={() => setMode('reset')}>Recuperar senha</button>}
      </div>
    </section>
  );
}

export default AuthView;
