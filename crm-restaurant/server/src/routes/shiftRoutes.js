const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, authorize } = require('../middleware/auth');

// Obtenir tous les shifts (tous les rôles authentifiés)
router.get('/', authenticate, shiftController.getAllShifts);

// Obtenir un shift par ID (tous les rôles authentifiés)
router.get('/:id', authenticate, shiftController.getShiftById);

// Obtenir tous les shifts d'un utilisateur
router.get('/user/:userId', authenticate, shiftController.getUserShifts);

// Obtenir le personnel d'un shift
router.get('/:shiftId/personnel', authenticate, shiftController.getShiftPersonnel);

// Obtenir les détails complets d'un shift (incluant user_shifts)
router.get('/:shiftId/details', authenticate, shiftController.getShiftDetails);

// Routes réservées aux responsables et managers
const managerRoutes = [
  { method: 'post', path: '/', handler: shiftController.createShift },
  { method: 'post', path: '/multiple', handler: shiftController.createMultipleShifts },
  { method: 'put', path: '/:id', handler: shiftController.updateShift },
  { method: 'delete', path: '/:id', handler: shiftController.deleteShift },
  { method: 'post', path: '/assign', handler: shiftController.assignUserToShift },
  { method: 'delete', path: '/unassign', handler: shiftController.removeUserFromShift },
  { method: 'put', path: '/:shiftId/personnel', handler: shiftController.updateShiftPersonnel }
];

managerRoutes.forEach(route => {
  router[route.method](
    route.path, 
    authenticate, 
    authorize(['responsable', 'manager']), 
    route.handler
  );
});

module.exports = router; 