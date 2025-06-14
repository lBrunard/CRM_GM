const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { 
  markUnavailable, 
  proposeReplacement, 
  getAvailableShifts, 
  getPendingReplacements, 
  approveReplacement, 
  cancelUnavailability, 
  getUserUnavailabilities,
  getReplacementHistory,
  deleteReplacementFromHistory
} = require('../controllers/availabilityController');

// Marquer comme non disponible
router.post('/unavailable', authenticate, markUnavailable);

// Proposer de remplacer
router.post('/replace', authenticate, proposeReplacement);

// Obtenir les shifts disponibles pour remplacement
router.get('/available-shifts', authenticate, getAvailableShifts);

// Obtenir les demandes de remplacement en attente (managers)
router.get('/pending-replacements', authenticate, authorize(['manager']), getPendingReplacements);

// Approuver/rejeter une demande de remplacement
router.patch('/replacements/:replacementId', authenticate, authorize(['manager']), approveReplacement);

// Annuler sa propre indisponibilité
router.delete('/unavailable/:shiftId', authenticate, cancelUnavailability);

// Obtenir les indisponibilités de l'utilisateur courant
router.get('/my-unavailabilities', authenticate, getUserUnavailabilities);

// Obtenir l'historique des remplacements (managers)
router.get('/replacement-history', authenticate, authorize(['manager']), getReplacementHistory);

// Supprimer un remplacement de l'historique (managers)
router.delete('/replacement-history/:replacementId', authenticate, authorize(['manager']), deleteReplacementFromHistory);

module.exports = router; 