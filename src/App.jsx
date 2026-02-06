import React, { useState } from 'react';
import Login from './components/Login';
import WindowSimulador from './components/windows/WindowSimulador';
import './styles/App.css';
import './styles/ConsultaGlobal.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);

  const handleLoginSuccess = (user) => {
    setIsAuthenticated(true);
    setUserData(user);
  };

  return (
    <div className="App">
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="preco-standalone-page">
          <WindowSimulador embedded userData={userData} />
        </div>
      )}
    </div>
  );
}

export default App;
