const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Routes publiques
router.post('/register', userController.register);
router.post('/login', userController.login);

// Routes protégées
router.get('/all', authenticate, authorize(['manager']), userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);

// Routes de mise à jour (managers seulement pour updateUser)
router.put('/:id', authenticate, authorize(['manager']), userController.updateUser);

// Route de mise à jour du profil (utilisateur peut modifier le sien)
router.put('/:id/profile', authenticate, userController.updateProfile);

module.exports = router; 