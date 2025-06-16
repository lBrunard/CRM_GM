const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Enregistrement d'un nouvel utilisateur
const register = (req, res) => {
  console.log('Tentative d\'inscription avec données:', { ...req.body, password: '***' });
  
  const { 
    username, 
    email, 
    password, 
    role, 
    first_name, 
    last_name, 
    phone, 
    national_number, 
    address 
  } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Les champs nom d\'utilisateur, email et mot de passe sont requis' });
  }

  if (!first_name || !last_name || !phone || !national_number || !address) {
    return res.status(400).json({ message: 'Tous les champs d\'informations personnelles sont requis' });
  }
  
  // Si aucun rôle n'est fourni, on utilise "personnel" par défaut
  const userRole = role || 'personnel';
  
  if (!['personnel', 'responsable', 'manager'].includes(userRole)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }

  // Vérifier si l'utilisateur existe déjà
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
    if (err) {
      console.error('Erreur SQL lors de la vérification de l\'utilisateur:', err);
      return res.status(500).json({ message: 'Erreur lors de la vérification de l\'utilisateur', error: err.message });
    }
    
    if (user) {
      return res.status(409).json({ message: 'Utilisateur ou email déjà existant' });
    }
    
    try {
      // Hachage du mot de passe
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Insertion du nouvel utilisateur avec tous les champs
      db.run(
        `INSERT INTO users (
          username, email, password, role, first_name, last_name, 
          phone, national_number, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, email, hashedPassword, userRole, first_name, last_name, phone, national_number, address],
        function(err) {
          if (err) {
            console.error('Erreur SQL lors de la création de l\'utilisateur:', err);
            return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur', error: err.message });
          }
          
          res.status(201).json({ 
            message: 'Utilisateur créé avec succès',
            userId: this.lastID 
          });
        }
      );
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur', error: error.message });
    }
  });
};

// Connexion d'un utilisateur
const login = (req, res) => {
  console.log('Tentative de connexion pour:', req.body.username);
  console.log('Données reçues:', req.body);
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('Erreur: champs manquants');
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Erreur SQL lors de la connexion:', err);
      return res.status(500).json({ message: 'Erreur lors de la connexion', error: err.message });
    }
    
    if (!user) {
      console.log(`Utilisateur '${username}' non trouvé dans la DB`);
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
    
    console.log(`Utilisateur '${username}' trouvé, vérification du mot de passe...`);
    
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        console.log('Mot de passe incorrect');
        return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
      }
      
      console.log('Authentification réussie, génération du token JWT...');
      
      // Génération du token JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'crmrestaurantsecret',
        { expiresIn: '24h' }
      );
      
      console.log('Connexion réussie pour:', username);
      
      res.json({
        message: 'Connexion réussie',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
      
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      res.status(500).json({ message: 'Erreur lors de la connexion', error: error.message });
    }
  });
};

// Récupération de tous les utilisateurs (réservé aux managers)
const getAllUsers = (req, res) => {
  const { position } = req.query; // Paramètre optionnel pour filtrer par position
  
  let query = `SELECT id, username, email, role, first_name, last_name, phone, 
               national_number, address, iban, hourly_rate, positions, created_at FROM users`;
  let params = [];
  
  // Si une position est spécifiée, filtrer les utilisateurs qui peuvent occuper cette position
  if (position && ['cuisine', 'salle', 'bar'].includes(position)) {
    query += ` WHERE positions LIKE ?`;
    params.push(`%"${position}"%`);
  }
  
  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs', error: err.message });
    }
    
    // Parser les positions JSON pour chaque utilisateur
    const usersWithPositions = users.map(user => ({
      ...user,
      positions: user.positions ? JSON.parse(user.positions) : []
    }));
    
    res.json(usersWithPositions);
  });
};

// Récupération d'un utilisateur par ID
const getUserById = (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT id, username, email, role, first_name, last_name, phone, 
          national_number, address, iban, hourly_rate, positions, created_at FROM users WHERE id = ?`, [id], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Parser les positions JSON
    const userWithPositions = {
      ...user,
      positions: user.positions ? JSON.parse(user.positions) : []
    };
    
    res.json(userWithPositions);
  });
};

// Récupération des informations de l'utilisateur connecté (accessible à tous les utilisateurs connectés)
const getCurrentUser = (req, res) => {
  const userId = req.user.id; // L'ID vient du token JWT décodé par le middleware authenticate
  
  db.get(`SELECT id, username, email, role, first_name, last_name, phone, 
          national_number, address, iban, hourly_rate, positions, created_at FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Parser les positions JSON
    const userWithPositions = {
      ...user,
      positions: user.positions ? JSON.parse(user.positions) : []
    };
    
    res.json(userWithPositions);
  });
};

// Mise à jour complète d'un utilisateur (réservé aux managers)
const updateUser = (req, res) => {
  const { id } = req.params;
  const { username, email, role, first_name, last_name, phone, national_number, address, iban, hourly_rate, positions } = req.body;
  
  if (!username || !email || !role) {
    return res.status(400).json({ message: 'Username, email et rôle sont requis' });
  }
  
  if (!['personnel', 'responsable', 'manager'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  
  // Valider les positions si fournies
  let positionsJson = null;
  if (positions && Array.isArray(positions)) {
    const validPositions = positions.filter(pos => ['cuisine', 'salle', 'bar'].includes(pos));
    positionsJson = JSON.stringify(validPositions);
  }
  
  // Vérifier que l'username ou email ne sont pas déjà utilisés par un autre utilisateur
  db.get('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, id], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
    }
    
    if (existingUser) {
      return res.status(409).json({ message: 'Username ou email déjà utilisé par un autre utilisateur' });
    }
    
    db.run(
      `UPDATE users SET username = ?, email = ?, role = ?, first_name = ?, last_name = ?, 
       phone = ?, national_number = ?, address = ?, iban = ?, hourly_rate = ?, positions = ? WHERE id = ?`,
      [username, email, role, first_name || null, last_name || null, phone || null, 
       national_number || null, address || null, iban || null, hourly_rate || 0, positionsJson, id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Erreur lors de la mise à jour', error: err.message });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json({ message: 'Utilisateur mis à jour avec succès' });
      }
    );
  });
};

// Mise à jour du profil utilisateur (accessible à tous les utilisateurs connectés)
const updateUserProfile = (req, res) => {
  const { id } = req.params;
  const { username, email, first_name, last_name, phone, national_number, address, iban, positions } = req.body;
  
  if (!username || !email) {
    return res.status(400).json({ message: 'Username et email sont requis' });
  }
  
  // Valider les positions si fournies
  let positionsJson = null;
  if (positions && Array.isArray(positions)) {
    const validPositions = positions.filter(pos => ['cuisine', 'salle', 'bar'].includes(pos));
    positionsJson = JSON.stringify(validPositions);
  }
  
  // Vérifier que l'username ou email ne sont pas déjà utilisés par un autre utilisateur
  db.get('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, id], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
    }
    
    if (existingUser) {
      return res.status(409).json({ message: 'Username ou email déjà utilisé par un autre utilisateur' });
    }
    
    db.run(
      `UPDATE users SET username = ?, email = ?, first_name = ?, last_name = ?, 
       phone = ?, national_number = ?, address = ?, iban = ?, positions = ? WHERE id = ?`,
      [username, email, first_name || null, last_name || null, phone || null, 
       national_number || null, address || null, iban || null, positionsJson, id],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Erreur lors de la mise à jour', error: err.message });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        
        res.json({ message: 'Profil mis à jour avec succès' });
      }
    );
  });
};

module.exports = {
  register,
  login,
  getAllUsers,
  getUserById,
  updateUser,
  updateUserProfile,
  getCurrentUser
}; 