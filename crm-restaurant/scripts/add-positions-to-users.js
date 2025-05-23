const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données SQLite
const dbPath = path.join(__dirname, '../server/database.sqlite');

// Positions possibles et leurs probabilités d'assignation
const positionsData = [
  { position: 'cuisine', weight: 3 },
  { position: 'salle', weight: 4 },
  { position: 'bar', weight: 2 }
];

async function addPositionsToUsers() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Erreur de connexion à la base de données:', err.message);
        reject(err);
        return;
      }
      console.log('Connecté à la base de données SQLite');
    });

    // Ajouter la colonne positions si elle n'existe pas
    db.run(`ALTER TABLE users ADD COLUMN positions TEXT DEFAULT NULL`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Erreur lors de l\'ajout de la colonne positions:', err.message);
        reject(err);
        return;
      }
      
      if (!err) {
        console.log('✓ Colonne positions ajoutée à la table users');
      } else {
        console.log('✓ Colonne positions existe déjà');
      }

      // Récupérer tous les utilisateurs
      db.all('SELECT id, username, role FROM users WHERE role = "personnel"', (err, users) => {
        if (err) {
          console.error('Erreur lors de la récupération des utilisateurs:', err.message);
          reject(err);
          return;
        }

        let updatedCount = 0;
        const totalUsers = users.length;

        if (totalUsers === 0) {
          console.log('Aucun utilisateur personnel trouvé');
          db.close();
          resolve();
          return;
        }

        // Fonction pour assigner des positions aléatoirement
        const assignRandomPositions = () => {
          const positions = [];
          const numPositions = Math.floor(Math.random() * 3) + 1; // 1 à 3 positions

          // Créer un pool de positions selon les poids
          const positionPool = [];
          positionsData.forEach(({ position, weight }) => {
            for (let i = 0; i < weight; i++) {
              positionPool.push(position);
            }
          });

          // Sélectionner des positions uniques
          const availablePositions = ['cuisine', 'salle', 'bar'];
          for (let i = 0; i < numPositions; i++) {
            if (availablePositions.length === 0) break;
            
            const randomIndex = Math.floor(Math.random() * availablePositions.length);
            const selectedPosition = availablePositions[randomIndex];
            positions.push(selectedPosition);
            availablePositions.splice(randomIndex, 1);
          }

          return JSON.stringify(positions);
        };

        // Mettre à jour chaque utilisateur
        users.forEach((user, index) => {
          const positions = assignRandomPositions();
          
          db.run(
            'UPDATE users SET positions = ? WHERE id = ?',
            [positions, user.id],
            function(err) {
              if (err) {
                console.error(`✗ Erreur lors de la mise à jour de ${user.username}:`, err.message);
              } else {
                const parsedPositions = JSON.parse(positions);
                console.log(`✓ ${user.username}: ${parsedPositions.join(', ')}`);
                updatedCount++;
              }

              // Vérifier si c'est le dernier utilisateur
              if (index === totalUsers - 1) {
                console.log(`\n📊 Résumé:`);
                console.log(`✓ ${updatedCount}/${totalUsers} utilisateurs mis à jour`);
                
                // Afficher la répartition des positions
                db.all(`
                  SELECT positions, COUNT(*) as count 
                  FROM users 
                  WHERE positions IS NOT NULL 
                  GROUP BY positions
                `, (err, stats) => {
                  if (!err && stats.length > 0) {
                    console.log(`\n📈 Répartition des positions:`);
                    stats.forEach(stat => {
                      const positions = JSON.parse(stat.positions);
                      console.log(`${positions.join(' + ')}: ${stat.count} utilisateur(s)`);
                    });
                  }

                  db.close((err) => {
                    if (err) {
                      console.error('Erreur lors de la fermeture de la base:', err.message);
                    } else {
                      console.log('\nConnexion fermée');
                    }
                    resolve();
                  });
                });
              }
            }
          );
        });
      });
    });
  });
}

// Exécuter le script
addPositionsToUsers().catch(console.error); 