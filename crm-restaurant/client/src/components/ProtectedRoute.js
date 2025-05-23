import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Composant pour protéger les routes en fonction de l'authentification et des rôles
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, hasRole } = useContext(AuthContext);
  
  // Si l'authentification est en cours de chargement, on affiche rien pour éviter des redirections flash
  if (loading) {
    return null;
  }
  
  // Si l'utilisateur n'est pas authentifié, on le redirige vers la page de connexion
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Si des rôles sont spécifiés et que l'utilisateur n'a pas le bon rôle, on le redirige
  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  // Si tout est OK, on affiche le contenu de la route
  return children;
};

export default ProtectedRoute; 