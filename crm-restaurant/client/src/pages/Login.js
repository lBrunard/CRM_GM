import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  EyeIcon, 
  EyeSlashIcon,
  UserIcon,
  LockClosedIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials({ ...credentials, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      await login(credentials);
      navigate('/dashboard');
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(
        err.response?.data?.message || 
        'Nom d\'utilisateur ou mot de passe incorrect'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-xl">
            <svg 
              className="h-8 w-8 text-blue-600" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L9.7 14.7l.79.8 4.49-4.49z"/>
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Restaurant Staff Manager
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Connectez-vous à votre compte
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Erreur de connexion
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Nom d'utilisateur */}
            <div>
              <label htmlFor="username" className="label-hero">
                <UserIcon className="h-4 w-4 inline mr-2" />
                Nom d'utilisateur
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="input-hero"
                  placeholder="Entrez votre nom d'utilisateur"
                  value={credentials.username}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="label-hero">
                <LockClosedIcon className="h-4 w-4 inline mr-2" />
                Mot de passe
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="input-hero pr-10"
                  placeholder="Entrez votre mot de passe"
                  value={credentials.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Bouton de connexion */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-hero-primary w-full btn-hero-lg"
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </div>
          </form>

          {/* Comptes de test */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-900 mb-4 text-center">
              Comptes de démonstration
            </h3>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-medium text-slate-900">Manager</div>
                <div className="text-slate-600">manager / password123</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-medium text-slate-900">Responsable</div>
                <div className="text-slate-600">responsable / password123</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="font-medium text-slate-900">Personnel</div>
                <div className="text-slate-600">personnel / password123</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-400">
            © 2024 Restaurant Staff Manager. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 