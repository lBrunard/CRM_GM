/**
 * Script pour créer plusieurs utilisateurs test avec différents rôles
 * 
 * Usage: node create-users.js
 */

const bcrypt = require('bcrypt');
const db = require('../config/db');

// Liste des utilisateurs à créer
const users = [
  {
    username: 'manager',
    email: 'manager@restaurant.com',
    password: 'password123',
    role: 'manager'
  },
  {
    username: 'responsable',
    email: 'responsable@restaurant.com',
    password: 'password123',
    role: 'responsable'
  },
  {
    username: 'personnel',
    email: 'personnel@restaurant.com',
    password: 'password123',
    role: 'personnel'
  }
];

async function createUsers() {
  try {
    let createdCount = 0;
    
    for (const userData of users) {
      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Utiliser une promesse pour gérer les opérations asynchrones de SQLite
      await new Promise((resolve, reject) => {
        // Vérifier si l'utilisateur existe déjà
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', 
          [userData.username, userData.email],
          (err, user) => {
            if (err) {
              console.error(`Erreur lors de la vérification de ${userData.username}:`, err.message);
              return reject(err);
            }
            
            if (user) {
              console.log(`L'utilisateur ${userData.username} ou l'email ${userData.email} existe déjà.`);
              return resolve();
            }
            
            // Insérer le nouvel utilisateur
            db.run(
              'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
              [userData.username, userData.email, hashedPassword, userData.role],
              function(err) {
                if (err) {
                  console.error(`Erreur lors de la création de ${userData.username}:`, err.message);
                  return reject(err);
                }
                
                console.log(`✅ Utilisateur ${userData.username} (${userData.role}) créé avec succès (ID: ${this.lastID})`);
                createdCount++;
                return resolve();
              }
            );
          }
        );
      });
    }
    
    console.log('\n---------------------------------');
    console.log(`${createdCount} utilisateur(s) créé(s) avec succès`);
    console.log('---------------------------------');
    console.log('Identifiants de connexion:');
    users.forEach(user => {
      console.log(`- ${user.username} / ${user.password} (${user.role})`);
    });
    console.log('---------------------------------');
    
    // Fermer la connexion à la base de données
    db.close((err) => {
      if (err) {
        console.error('Erreur lors de la fermeture de la base de données:', err.message);
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter la fonction
createUsers(); 