// Configuration centralisée des postes de travail (serveur)
const POSITION_CONFIGS = {
  // Postes de service
  'salle': {
    label: 'Salle',
    description: 'Service en salle',
    category: 'service'
  },
  'bar': {
    label: 'Bar',
    description: 'Service au bar',
    category: 'service'
  },
  
  // Postes de cuisine
  'cuisine': {
    label: 'Cuisine (général)',
    description: 'Polyvalent cuisine',
    category: 'cuisine'
  },
  'chaud': {
    label: 'Chaud',
    description: 'Poste chaud',
    category: 'cuisine'
  },
  'pain': {
    label: 'Pain',
    description: 'Poste pain',
    category: 'cuisine'
  },
  'envoi': {
    label: 'Envoi',
    description: 'Poste envoi',
    category: 'cuisine'
  }
};

// Liste de toutes les positions disponibles
const ALL_POSITIONS = Object.keys(POSITION_CONFIGS);

// Positions par catégorie
const SERVICE_POSITIONS = ALL_POSITIONS.filter(pos => 
  POSITION_CONFIGS[pos].category === 'service'
);

const CUISINE_POSITIONS = ALL_POSITIONS.filter(pos => 
  POSITION_CONFIGS[pos].category === 'cuisine'
);

// Fonction pour valider une position
const isValidPosition = (position) => {
  return ALL_POSITIONS.includes(position);
};

// Fonction pour valider un tableau de positions
const validatePositions = (positions) => {
  if (!Array.isArray(positions)) return [];
  return positions.filter(pos => isValidPosition(pos));
};

module.exports = {
  POSITION_CONFIGS,
  ALL_POSITIONS,
  SERVICE_POSITIONS,
  CUISINE_POSITIONS,
  isValidPosition,
  validatePositions
}; 