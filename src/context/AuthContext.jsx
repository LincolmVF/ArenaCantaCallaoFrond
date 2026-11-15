import { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('acc_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem('acc_token', data.token);
    localStorage.setItem('acc_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('acc_token');
    localStorage.removeItem('acc_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
