// Configuration centralisée des postes de travail
export const POSITION_CONFIGS = {
  // Postes de service
  'salle': {
    label: 'Salle',
    description: 'Service en salle',
    category: 'service',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  },
  'bar': {
    label: 'Bar',
    description: 'Service au bar',
    category: 'service',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  },
  
  // Postes de cuisine
  'cuisine': {
    label: 'Cuisine (général)',
    description: 'Polyvalent cuisine',
    category: 'cuisine',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  },
  'chaud': {
    label: 'Chaud',
    description: 'Poste chaud',
    category: 'cuisine',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  },
  'pain': {
    label: 'Pain',
    description: 'Poste pain',
    category: 'cuisine',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  },
  'envoi': {
    label: 'Envoi',
    description: 'Poste envoi',
    category: 'cuisine',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  }
};

// Liste de toutes les positions disponibles
export const ALL_POSITIONS = Object.keys(POSITION_CONFIGS);

// Positions par catégorie
export const SERVICE_POSITIONS = ALL_POSITIONS.filter(pos => 
  POSITION_CONFIGS[pos].category === 'service'
);

export const CUISINE_POSITIONS = ALL_POSITIONS.filter(pos => 
  POSITION_CONFIGS[pos].category === 'cuisine'
);

// Fonction utilitaire pour obtenir la configuration d'un poste
export const getPositionConfig = (position) => {
  return POSITION_CONFIGS[position] || {
    label: position,
    description: '',
    category: 'unknown',
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
  };
};

// Fonction utilitaire pour obtenir le label d'un poste
export const getPositionLabel = (position) => {
  return getPositionConfig(position).label;
};

// Fonction utilitaire pour obtenir la couleur d'un poste
export const getPositionColor = (position) => {
  return getPositionConfig(position).color;
}; 