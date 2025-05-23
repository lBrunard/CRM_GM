const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données SQLite
const dbPath = path.join(__dirname, '../server/database.sqlite');

// Liste des utilisateurs à ajouter
const users = [
  { username: 'Raja', first_name: 'Raja', last_name: 'Adam' },
  { username: 'Leandro', first_name: 'Leandro', last_name: 'Martins Thomas' },
  { username: 'Romain', first_name: 'Romain', last_name: 'Nyssens' },
  { username: 'Terence', first_name: 'Terence', last_name: 'Delvaux' },
  { username: 'Marco', first_name: 'Marco', last_name: 'Depierreux' },
  { username: 'Antoine', first_name: 'Antoine', last_name: 'Bael' },
  { username: 'João', first_name: 'João Pedro', last_name: 'Emerenciano Frias' },
  { username: 'Pablo', first_name: 'Pablo', last_name: 'Liettefti Lens' },
  { username: 'Pierrot', first_name: 'Pierrot', last_name: 'Delvaux' },
  { username: 'Jules', first_name: 'Jules', last_name: 'Close' },
  { username: 'Baptiste', first_name: 'Baptiste', last_name: 'De Planter' },
  { username: 'Méline', first_name: 'Méline', last_name: 'Van Cangh' },
  { username: 'Zoé', first_name: 'Zoé', last_name: 'Faravel' },
  { username: 'Camille', first_name: 'Camille', last_name: 'Etienne' },
  { username: 'Philippe', first_name: 'Philippe', last_name: 'Ribeiro' },
  { username: 'Victor', first_name: 'Victor', last_name: 'Ribeiro Pinheiro Frey' },
  { username: 'Shanna', first_name: 'Shanna', last_name: 'Vandenbosch' },
  { username: 'Mailys', first_name: 'Mailys', last_name: 'Deldaele' },
  { username: 'Marius', first_name: 'Marius', last_name: 'Descamps' },
  { username: 'Alejandra', first_name: 'Alejandra', last_name: 'Sanchez' },
  { username: 'Dominika', first_name: 'Dominika', last_name: 'Zielinska' },
  { username: 'Jakub', first_name: 'Jakub', last_name: '' },
  { username: 'Mattheo', first_name: 'Mattheo', last_name: 'Aiosa' },
  { username: 'Hélène', first_name: 'Hélène', last_name: 'Watelet' },
  { username: 'Adrien', first_name: 'Adrien', last_name: 'Hausman' },
  { username: 'Mathys', first_name: 'Mathys', last_name: 'Van Hove' },
  { username: 'Merveille', first_name: 'Merveille', last_name: 'Baptiste' },
  { username: 'Lucas', first_name: 'Lucas', last_name: 'Corsado' },
  { username: 'Lison', first_name: 'Lison', last_name: 'Magain' },
  { username: 'Juliette', first_name: 'Juliette', last_name: 'Couchard' },
  { username: 'DosSantos', first_name: '', last_name: 'Dos Santos' }
];

async function addUsers() {
  return new Promise(async (resolve, reject) => {
    try {
      // Hash du mot de passe "az"
      const passwordHash = await bcrypt.hash('az', 10);
      
      // Connexion à la base de données SQLite
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erreur de connexion à la base de données:', err.message);
          reject(err);
          return;
        }
        console.log('Connecté à la base de données SQLite');
      });

      let addedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Fonction pour ajouter un utilisateur
      const addUser = (user) => {
        return new Promise((resolveUser, rejectUser) => {
          const email = `${user.username.toLowerCase()}@restaurant.com`;
          
          db.run(
            `INSERT INTO users (username, password, email, first_name, last_name, role, hourly_rate, created_at)
             VALUES (?, ?, ?, ?, ?, 'personnel', 15.00, datetime('now'))`,
            [user.username, passwordHash, email, user.first_name, user.last_name],
            function(err) {
              if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                  console.log(`⚠ Utilisateur ${user.username} existe déjà, ignoré`);
                  skippedCount++;
                } else {
                  console.error(`✗ Erreur lors de l'ajout de ${user.username}:`, err.message);
                  errorCount++;
                }
              } else {
                console.log(`✓ Utilisateur ${user.username} ajouté avec succès (ID: ${this.lastID})`);
                addedCount++;
              }
              resolveUser();
            }
          );
        });
      };

      // Ajouter tous les utilisateurs
      for (const user of users) {
        await addUser(user);
      }

      // Afficher le résumé
      console.log('\n📊 Résumé:');
      console.log(`✓ ${addedCount} utilisateurs ajoutés`);
      console.log(`⚠ ${skippedCount} utilisateurs ignorés (déjà existants)`);
      console.log(`✗ ${errorCount} erreurs`);

      // Afficher tous les utilisateurs
      db.all('SELECT username, email, role FROM users ORDER BY username', [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des utilisateurs:', err.message);
        } else {
          console.log('\n📋 Tous les utilisateurs dans la base:');
          console.table(rows);
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

    } catch (error) {
      console.error('Erreur générale:', error);
      reject(error);
    }
  });
}

// Exécuter le script
addUsers().catch(console.error); 