const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('🔄 Démarrage de la migration de la contrainte user_shifts...');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur lors de l\'ouverture de la base de données:', err.message);
    process.exit(1);
  }
  console.log('✅ Connexion à la base de données établie');
});

// Migration pour corriger la contrainte CHECK de user_shifts
const migration = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      console.log('📝 Création de la nouvelle table user_shifts...');
      
      // Créer une nouvelle table avec la contrainte CHECK mise à jour
      db.run(`
        CREATE TABLE user_shifts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          shift_id INTEGER NOT NULL,
          clock_in TIMESTAMP,
          clock_out TIMESTAMP,
          validated BOOLEAN DEFAULT FALSE,
          validated_by INTEGER,
          comment TEXT, 
          position TEXT CHECK (position IN ('cuisine', 'salle', 'bar', 'chaud', 'pain', 'envoi')),
          individual_start_time TEXT,
          individual_end_time TEXT, 
          role TEXT, 
          is_responsable INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE,
          FOREIGN KEY (validated_by) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('❌ Erreur lors de la création de la nouvelle table:', err.message);
          reject(err);
          return;
        }
        
        console.log('📋 Copie des données existantes...');
        
        // Copier toutes les données de l'ancienne table vers la nouvelle
        db.run(`
          INSERT INTO user_shifts_new 
          SELECT * FROM user_shifts
        `, (err) => {
          if (err) {
            console.error('❌ Erreur lors de la copie des données:', err.message);
            reject(err);
            return;
          }
          
          console.log('🗑️ Suppression de l\'ancienne table...');
          
          // Supprimer l'ancienne table
          db.run('DROP TABLE user_shifts', (err) => {
            if (err) {
              console.error('❌ Erreur lors de la suppression de l\'ancienne table:', err.message);
              reject(err);
              return;
            }
            
            console.log('🔄 Renommage de la nouvelle table...');
            
            // Renommer la nouvelle table
            db.run('ALTER TABLE user_shifts_new RENAME TO user_shifts', (err) => {
              if (err) {
                console.error('❌ Erreur lors du renommage:', err.message);
                reject(err);
                return;
              }
              
              console.log('✅ Migration terminée avec succès !');
              resolve();
            });
          });
        });
      });
    });
  });
};

// Exécuter la migration
migration()
  .then(() => {
    console.log('🎉 Migration réussie - Les positions chaud, pain, et envoi sont maintenant autorisées !');
    db.close((err) => {
      if (err) {
        console.error('❌ Erreur lors de la fermeture:', err.message);
      } else {
        console.log('📝 Base de données fermée');
      }
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error('💥 Échec de la migration:', err);
    db.close();
    process.exit(1);
  }); 