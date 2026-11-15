import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Arena Canta Callao
          </h1>
          <p className="text-sm text-slate-500">
            Acceso al Sistema CRM & Autoservicio
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingrese su usuario"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold flex items-center justify-center gap-2 transition"
          >
            <LogIn className="w-5 h-5" />
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Kiosco de Autoservicio
          </Link>
        </div>
      </div>
    </div>
  );
}
