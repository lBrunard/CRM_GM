const bcrypt = require('bcrypt');
const db = require('../config/db');

// Liste des 31 prénoms
const firstNames = [
  'Alexandre', 'Baptiste', 'Camille', 'Damien', 'Elise', 'Fabien', 'Gabrielle', 
  'Hugo', 'Isabelle', 'Julien', 'Karine', 'Lucas', 'Marie', 'Nicolas', 'Oceane',
  'Pierre', 'Quentin', 'Roxane', 'Simon', 'Tiffany', 'Ulysse', 'Valerie', 
  'William', 'Xavier', 'Yasmine', 'Zacharie', 'Amelie', 'Benjamin', 'Celine', 
  'David', 'Emma'
];

// Fonction pour générer des positions aléatoires
const generateRandomPositions = () => {
  const allPositions = ['cuisine', 'salle', 'bar'];
  const numPositions = Math.floor(Math.random() * 3) + 1; // 1 à 3 positions
  const selectedPositions = [];
  
  for (let i = 0; i < numPositions; i++) {
    const availablePositions = allPositions.filter(pos => !selectedPositions.includes(pos));
    if (availablePositions.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      selectedPositions.push(availablePositions[randomIndex]);
    }
  }
  
  return selectedPositions;
};

// Fonction pour générer un salaire horaire aléatoire
const generateRandomSalary = () => {
  return (Math.random() * (18 - 12) + 12).toFixed(2); // Entre 12€ et 18€
};

// Fonction pour créer un utilisateur
const createUser = (firstName, index) => {
  return new Promise((resolve, reject) => {
    const username = firstName.toLowerCase();
    const email = `${username}@restaurant.com`;
    const password = 'az'; // Mot de passe demandé
    const role = 'personnel';
    const lastName = `Employé${index + 1}`;
    const hourlyRate = generateRandomSalary();
    const positions = JSON.stringify(generateRandomPositions());
    
    // Hasher le mot de passe
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Insérer l'utilisateur
      db.run(
        `INSERT INTO users (username, password, email, role, first_name, last_name, hourly_rate, positions) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, email, role, firstName, lastName, hourlyRate, positions],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              console.log(`⚠️  Utilisateur ${username} existe déjà, ignoré`);
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            console.log(`✅ Utilisateur ${username} créé avec succès (ID: ${this.lastID}, Positions: ${JSON.parse(positions).join(', ')}, Salaire: ${hourlyRate}€/h)`);
            resolve(this.lastID);
          }
        }
      );
    });
  });
};

// Fonction principale
const createAllUsers = async () => {
  console.log('🚀 Création de 31 utilisateurs personnel...\n');
  
  let successCount = 0;
  let skipCount = 0;
  
  for (let i = 0; i < firstNames.length; i++) {
    try {
      const userId = await createUser(firstNames[i], i);
      if (userId) {
        successCount++;
      } else {
        skipCount++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la création de ${firstNames[i]}:`, error.message);
    }
  }
  
  console.log('\n---------------------------------');
  console.log(`✅ ${successCount} utilisateur(s) créé(s) avec succès`);
  if (skipCount > 0) {
    console.log(`⚠️  ${skipCount} utilisateur(s) ignoré(s) (déjà existants)`);
  }
  console.log('---------------------------------');
  console.log('Tous les utilisateurs ont le mot de passe: az');
  console.log('Leurs noms d\'utilisateur sont leurs prénoms en minuscules');
  console.log('---------------------------------');
  
  // Fermer la connexion à la base de données
  db.close((err) => {
    if (err) {
      console.error('Erreur lors de la fermeture de la base de données:', err.message);
    } else {
      console.log('Connexion à la base de données fermée.');
    }
  });
};

// Exécuter le script
createAllUsers(); 