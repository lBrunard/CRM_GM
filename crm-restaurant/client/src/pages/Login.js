import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
      
      console.log('Tentative de connexion avec:', { ...credentials, password: '***' });
      
      const response = await login(credentials);
      console.log('Réponse de connexion:', response);
      navigate('/dashboard');
    } catch (err) {
      console.error('Détails de l\'erreur:', err);
      setError(
        err.response?.data?.message || 
        'Une erreur est survenue lors de la connexion'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction utilitaire pour accéder directement à l'API
  const testDirectLogin = async () => {
    try {
      // Montrer un message pour indiquer que le test est en cours
      setError('Test de connexion directe en cours...');
      setIsLoading(true);
      
      console.log('Données envoyées:', credentials);
      
      // Appel direct à l'API sans passer par le service Auth
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      console.log('Statut HTTP:', response.status);
      console.log('Headers:', Object.fromEntries([...response.headers.entries()]));
      
      // Récupérer le texte brut d'abord
      const textResponse = await response.text();
      console.log('Réponse texte brute:', textResponse);
      
      let data;
      try {
        // Essayer de parser en JSON si possible
        data = textResponse ? JSON.parse(textResponse) : {};
        console.log('Données JSON parsées:', data);
      } catch (parseError) {
        console.error('Erreur de parsing JSON:', parseError);
        data = { message: 'Format de réponse invalide' };
      }
      
      if (response.ok) {
        setError('Test direct réussi! ' + (textResponse.substring(0, 100) || 'Pas de contenu'));
      } else {
        setError(`Test échoué (${response.status}): ` + (data.message || textResponse.substring(0, 100) || response.statusText));
      }
    } catch (err) {
      console.error('Erreur lors du test direct:', err);
      setError('Erreur lors du test direct: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h4 className="mb-0">Connexion</h4>
            </div>
            <div className="card-body">
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="username"
                    name="username"
                    value={credentials.username}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    name="password"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="d-grid gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Connexion...' : 'Se connecter'}
                  </button>
                  
                  <button 
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={testDirectLogin}
                    disabled={isLoading}
                  >
                    Tester connexion directe API
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 