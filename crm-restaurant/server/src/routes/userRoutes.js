const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Routes publiques
router.post('/register', userController.register);
router.post('/login', userController.login);

// Routes protégées (utilisateur connecté)
router.get('/profile', authenticate, userController.getUserById);
router.get('/me', authenticate, userController.getCurrentUser);
router.put('/profile/:id', authenticate, userController.updateUserProfile);

// Routes pour managers
router.get('/', authenticate, authorize(['manager']), userController.getAllUsers);
router.get('/all', authenticate, authorize(['manager']), userController.getAllUsers);
router.get('/:id', authenticate, authorize(['manager']), userController.getUserById);
router.put('/:id', authenticate, authorize(['manager']), userController.updateUser);

module.exports = router; 