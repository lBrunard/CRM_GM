const db = require('../config/db');

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

// Fonction pour mettre à jour les positions des utilisateurs
const updateUserPositions = () => {
  console.log('🔄 Mise à jour des positions des utilisateurs...\n');
  
  // Récupérer tous les utilisateurs qui n'ont pas de positions ou ont des positions vides
  db.all(
    `SELECT id, username, positions FROM users 
     WHERE positions IS NULL OR positions = '' OR positions = '[]'`,
    [],
    (err, users) => {
      if (err) {
        console.error('❌ Erreur lors de la récupération des utilisateurs:', err.message);
        return;
      }
      
      if (users.length === 0) {
        console.log('✅ Tous les utilisateurs ont déjà des positions assignées');
        db.close();
        return;
      }
      
      console.log(`📝 ${users.length} utilisateur(s) à mettre à jour:\n`);
      
      let updatedCount = 0;
      
      users.forEach((user, index) => {
        const newPositions = generateRandomPositions();
        const positionsJson = JSON.stringify(newPositions);
        
        db.run(
          `UPDATE users SET positions = ? WHERE id = ?`,
          [positionsJson, user.id],
          function(err) {
            if (err) {
              console.error(`❌ Erreur lors de la mise à jour de ${user.username}:`, err.message);
            } else {
              console.log(`✅ ${user.username} -> Positions: ${newPositions.join(', ')}`);
              updatedCount++;
            }
            
            // Si c'est le dernier utilisateur, afficher le résumé et fermer la DB
            if (index === users.length - 1) {
              setTimeout(() => {
                console.log('\n---------------------------------');
                console.log(`✅ ${updatedCount} utilisateur(s) mis à jour avec succès`);
                console.log('---------------------------------');
                
                db.close((err) => {
                  if (err) {
                    console.error('Erreur lors de la fermeture de la base de données:', err.message);
                  } else {
                    console.log('Connexion à la base de données fermée.');
                  }
                });
              }, 100);
            }
          }
        );
      });
    }
  );
};

// Exécuter le script
updateUserPositions(); 