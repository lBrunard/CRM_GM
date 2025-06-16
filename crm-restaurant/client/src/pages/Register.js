import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
  EyeIcon, 
  EyeSlashIcon,
  UserIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  HomeIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline';

const Register = () => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone: '',
    national_number: '',
    address: '',
    role: 'personnel' // Rôle par défaut
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();
  const { register } = useContext(AuthContext);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData({ ...userData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation de base
    if (!userData.username || !userData.email || !userData.password || !userData.confirmPassword || 
        !userData.first_name || !userData.last_name || !userData.phone || !userData.national_number || !userData.address) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    if (userData.password !== userData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (userData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      // On ne passe pas confirmPassword à l'API
      const { confirmPassword, ...registerData } = userData;
      
      await register(registerData);
      setSuccess('Inscription réussie ! Redirection vers la page de connexion...');
      
      // Rediriger vers la page de connexion après un court délai
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (err) {
      console.error('Erreur lors de l\'inscription:', err);
      setError(
        err.response?.data?.message || 
        'Une erreur est survenue lors de l\'inscription'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl w-full space-y-8">
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
            Créer un compte
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Rejoignez l'équipe du restaurant
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
                    Erreur d'inscription
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Inscription réussie
                  </h3>
                  <div className="mt-1 text-sm text-green-700">
                    {success}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Informations de connexion */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-900 border-b pb-2">
                Informations de connexion
              </h3>

              {/* Nom d'utilisateur */}
              <div>
                <label htmlFor="username" className="label-hero">
                  <UserIcon className="h-4 w-4 inline mr-2" />
                  Nom d'utilisateur *
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
                    value={userData.username}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="label-hero">
                  <EnvelopeIcon className="h-4 w-4 inline mr-2" />
                  Adresse e-mail *
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input-hero"
                    placeholder="votre.email@exemple.com"
                    value={userData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mot de passe */}
                <div>
                  <label htmlFor="password" className="label-hero">
                    <LockClosedIcon className="h-4 w-4 inline mr-2" />
                    Mot de passe *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="input-hero pr-10"
                      placeholder="Entrez votre mot de passe"
                      value={userData.password}
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

                {/* Confirmation mot de passe */}
                <div>
                  <label htmlFor="confirmPassword" className="label-hero">
                    <LockClosedIcon className="h-4 w-4 inline mr-2" />
                    Confirmer le mot de passe *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      className="input-hero pr-10"
                      placeholder="Confirmez votre mot de passe"
                      value={userData.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeSlashIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                      ) : (
                        <EyeIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations personnelles */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-900 border-b pb-2">
                Informations personnelles
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prénom */}
                <div>
                  <label htmlFor="first_name" className="label-hero">
                    Prénom *
                  </label>
                  <div className="mt-1">
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      autoComplete="given-name"
                      required
                      className="input-hero"
                      placeholder="Votre prénom"
                      value={userData.first_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Nom */}
                <div>
                  <label htmlFor="last_name" className="label-hero">
                    Nom *
                  </label>
                  <div className="mt-1">
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      autoComplete="family-name"
                      required
                      className="input-hero"
                      placeholder="Votre nom"
                      value={userData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Téléphone */}
                <div>
                  <label htmlFor="phone" className="label-hero">
                    <PhoneIcon className="h-4 w-4 inline mr-2" />
                    Téléphone *
                  </label>
                  <div className="mt-1">
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      className="input-hero"
                      placeholder="0123456789"
                      value={userData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Numéro national */}
                <div>
                  <label htmlFor="national_number" className="label-hero">
                    <IdentificationIcon className="h-4 w-4 inline mr-2" />
                    Numéro national *
                  </label>
                  <div className="mt-1">
                    <input
                      id="national_number"
                      name="national_number"
                      type="text"
                      required
                      className="input-hero"
                      placeholder="00.00.00-000.00"
                      value={userData.national_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label htmlFor="address" className="label-hero">
                  <HomeIcon className="h-4 w-4 inline mr-2" />
                  Adresse complète *
                </label>
                <div className="mt-1">
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    required
                    className="input-hero resize-none"
                    placeholder="Rue de la Station 1, 1000 Bruxelles"
                    value={userData.address}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Bouton d'inscription */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="btn-hero-primary w-full btn-hero-lg"
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Inscription en cours...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </div>
          </form>

          {/* Lien vers la connexion */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="text-center">
              <p className="text-sm text-slate-600">
                Vous avez déjà un compte ?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Se connecter
                </button>
              </p>
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

export default Register; 