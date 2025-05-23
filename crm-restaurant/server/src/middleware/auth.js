const jwt = require('jsonwebtoken');

// Middleware pour vérifier le token JWT
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Accès refusé. Token manquant.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'crmrestaurantsecret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token invalide ou expiré.' });
  }
};

// Middleware pour vérifier les rôles
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Accès refusé. Utilisateur non authentifié.' });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé. Vous n\'avez pas les permissions nécessaires.' });
    }
    
    next();
  };
};

module.exports = { authenticate, authorize }; 