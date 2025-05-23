/**
 * Script pour créer un utilisateur test dans la base de données
 * 
 * Usage: node create-test-user.js
 */

const bcrypt = require('bcrypt');
const db = require('../config/db');

async function createTestUser() {
  try {
    // Données de l'utilisateur test
    const userData = {
      username: 'manager',
      email: 'manager@restaurant.com',
      password: 'password123',  // Mot de passe en clair (sera hashé)
      role: 'manager'  // Rôle: 'personnel', 'responsable', ou 'manager'
    };

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Vérifier si l'utilisateur existe déjà
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', 
      [userData.username, userData.email],
      (err, user) => {
        if (err) {
          console.error('Erreur lors de la vérification de l\'utilisateur:', err.message);
          process.exit(1);
        }
        
        if (user) {
          console.log(`L'utilisateur ${userData.username} ou l'email ${userData.email} existe déjà.`);
          process.exit(0);
        }
        
        // Insérer le nouvel utilisateur
        db.run(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [userData.username, userData.email, hashedPassword, userData.role],
          function(err) {
            if (err) {
              console.error('Erreur lors de la création de l\'utilisateur:', err.message);
              process.exit(1);
            }
            
            console.log('✅ Utilisateur test créé avec succès');
            console.log('---------------------------------');
            console.log(`ID: ${this.lastID}`);
            console.log(`Nom d'utilisateur: ${userData.username}`);
            console.log(`Email: ${userData.email}`);
            console.log(`Mot de passe: ${userData.password} (non hashé)`);
            console.log(`Rôle: ${userData.role}`);
            console.log('---------------------------------');
            console.log('Vous pouvez maintenant vous connecter avec ces identifiants.');
            
            // Fermer la connexion à la base de données
            db.close((err) => {
              if (err) {
                console.error('Erreur lors de la fermeture de la base de données:', err.message);
              }
              process.exit(0);
            });
          }
        );
      }
    );
    
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter la fonction
createTestUser(); 