import axios from 'axios';

// Créer une instance axios avec la configuration de base
// Utilisation de chemins relatifs - le proxy dans package.json redirige vers le serveur
const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Intercepteur pour ajouter le token JWT aux requêtes
api.interceptors.request.use(
  (config) => {
    console.log('Envoi de requête à:', config.url);
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Erreur de requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Erreur de réponse:', error);
    if (error.response) {
      // La requête a été faite et le serveur a répondu avec un code d'erreur
      console.error('Données d\'erreur:', error.response.data);
      console.error('Statut d\'erreur:', error.response.status);
    } else if (error.request) {
      // La requête a été faite mais pas de réponse reçue
      console.error('Pas de réponse reçue:', error.request);
    } else {
      // Quelque chose s'est mal passé dans la création de la requête
      console.error('Erreur de configuration:', error.message);
    }
    return Promise.reject(error);
  }
);

// Services d'authentification
const authService = {
  register: (userData) => api.post('/users/register', userData),
  login: (credentials) => api.post('/users/login', credentials),
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
    return null;
  },
  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }
};

// Services de gestion des shifts
const shiftService = {
  getAllShifts: () => api.get('/shifts'),
  getAllShiftsWithPersonnel: () => api.get('/shifts/with-personnel'),
  getShiftById: (id) => api.get(`/shifts/${id}`),
  createShift: (shiftData) => api.post('/shifts', shiftData),
  createMultipleShifts: (shiftsData) => api.post('/shifts/multiple', shiftsData),
  updateShift: (id, shiftData) => api.put(`/shifts/${id}`, shiftData),
  deleteShift: (id) => api.delete(`/shifts/${id}`),
  getUserShifts: (userId) => api.get(`/shifts/user/${userId}`),
  assignUserToShift: (assignData) => api.post('/shifts/assign', assignData),
  removeUserFromShift: (removeData) => api.delete('/shifts/unassign', { data: removeData }),
  getShiftPersonnel: (shiftId) => api.get(`/shifts/${shiftId}/personnel`),
  getShiftDetails: (shiftId) => api.get(`/shifts/${shiftId}/details`),
  updateShiftPersonnel: (shiftId, personnelData) => api.put(`/shifts/${shiftId}/personnel`, personnelData)
};

// Services de pointage
const timeclockService = {
  clockIn: (data) => api.post('/timeclock/clock-in', data),
  clockOut: (data) => api.post('/timeclock/clock-out', data),
  validateHours: (validationData) => api.post('/timeclock/validate', validationData),
  getUnvalidatedHours: () => api.get('/timeclock/unvalidated'),
  updateHours: (updateData) => api.put('/timeclock/update-hours', updateData),
  updateUserShiftHours: (updateData) => api.put('/timeclock/manual-hours', updateData),
  getAllHours: () => api.get('/timeclock/all-hours'),
  getResponsableShifts: (userId) => api.get(`/timeclock/responsable-shifts/${userId}`),
  getShiftSalaries: (shiftId) => api.get(`/timeclock/shift-salaries/${shiftId}`)
};

// Services de gestion des utilisateurs
const userService = {
  getAllUsers: () => api.get('/users'),
  getUserById: (id) => api.get(`/users/${id}`),
  getCurrentUser: () => api.get('/users/me'),
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  updateProfile: (id, profileData) => api.put(`/users/${id}/profile`, profileData),
  updateUserProfile: (id, profileData) => api.put(`/users/${id}/profile`, profileData)
};

// Services de disponibilité et remplacements
const availabilityService = {
  // Marquer comme non disponible
  markUnavailable: (shiftId, reason) => api.post('/availability/unavailable', { shiftId, reason }),
  
  // Proposer de remplacer
  proposeReplacement: (shiftId, originalUserId) => api.post('/availability/replace', { shiftId, originalUserId }),
  
  // Obtenir les shifts disponibles pour remplacement
  getAvailableShifts: () => api.get('/availability/available-shifts'),
  
  // Obtenir les demandes de remplacement en attente (pour managers)
  getPendingReplacements: () => api.get('/availability/pending-replacements'),
  
  // Obtenir l'historique des remplacements (pour managers)
  getReplacementHistory: () => api.get('/availability/replacement-history'),
  
  // Approuver/rejeter un remplacement (pour managers)
  approveReplacement: (replacementId, approved) => api.patch(`/availability/replacements/${replacementId}`, { approved }),
  
  // Annuler sa propre indisponibilité
  cancelUnavailability: (shiftId) => api.delete(`/availability/unavailable/${shiftId}`),
  
  // Obtenir les indisponibilités de l'utilisateur courant
  getUserUnavailabilities: () => api.get('/availability/my-unavailabilities'),
  
  deleteReplacementFromHistory: (replacementId) => api.delete(`/availability/replacement-history/${replacementId}`)
};

export {
  api,
  authService,
  shiftService,
  timeclockService,
  userService,
  availabilityService
}; 