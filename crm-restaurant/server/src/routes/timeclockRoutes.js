const express = require('express');
const router = express.Router();
const timeclockController = require('../controllers/timeclockController');
const { authenticate, authorize } = require('../middleware/auth');

// Routes de pointage (pour le personnel et supérieur)
router.post('/clock-in', authenticate, timeclockController.clockIn);
router.post('/clock-out', authenticate, timeclockController.clockOut);

// Routes réservées aux responsables et managers
router.post('/validate', 
  authenticate, 
  authorize(['responsable', 'manager']), 
  timeclockController.validateHours
);

router.get('/unvalidated', 
  authenticate, 
  authorize(['responsable', 'manager']), 
  timeclockController.getUnvalidatedHours
);

// Routes pour la modification des heures
router.put('/update-hours',
  authenticate,
  authorize(['responsable', 'manager']),
  timeclockController.updateHours
);

// Route pour obtenir toutes les heures (managers seulement)
router.get('/all-hours',
  authenticate,
  authorize(['manager']),
  timeclockController.getAllHours
);

// Route pour obtenir les shifts d'un responsable
router.get('/responsable-shifts/:userId',
  authenticate,
  authorize(['responsable', 'manager']),
  timeclockController.getResponsableShifts
);

// Route pour obtenir les salaires d'un shift
router.get('/shift-salaries/:shiftId',
  authenticate,
  timeclockController.getShiftSalaries
);

module.exports = router; 