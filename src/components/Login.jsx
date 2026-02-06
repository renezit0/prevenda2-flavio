import React, { useState } from 'react';
import '../styles/Login.css';

const Login = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const user = String(usuario || '').trim().toUpperCase();
      const pass = String(senha || '').trim();
      if (user === 'BITTENCOURT' && pass === '12345') {
        onLoginSuccess({
          nome: 'BITTENCOURT',
          usuario: 'BITTENCOURT',
          loja_id: 22,
          loja_nome: 'Filial 22',
        });
        return;
      }
      setErro('Usuário ou senha inválidos');
    } catch (error) {
      console.error('Erro no login:', error);
      setErro('Erro ao validar login');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src="/favicon.png" alt="seeLL" className="login-logo" />
          <h1>Consulta de Preço</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {erro && (
            <div className="login-error">
              <i className="fas fa-exclamation-circle"></i>
              {erro}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="usuario">
              <i className="fas fa-user"></i>
              Usuário
            </label>
            <input
              type="text"
              id="usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Digite seu usuário"
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          <div className="login-field">
            <label htmlFor="senha">
              <i className="fas fa-lock"></i>
              Senha
            </label>
            <input
              type="password"
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={carregando}
          >
            {carregando ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Entrando...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>PreVenda</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
