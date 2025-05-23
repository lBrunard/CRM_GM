/**
 * Script pour migrer la base de données et ajouter la colonne position
 */
const db = require('../config/db');

// Fonction pour exécuter la migration
const runMigration = () => {
  console.log('Démarrage de la migration de la base de données...');

  // Ajouter la colonne position à la table user_shifts
  db.run(
    `ALTER TABLE user_shifts ADD COLUMN position TEXT CHECK (position IN ('cuisine', 'salle', 'bar'))`,
    (err) => {
      if (err) {
        if (err.message.includes('duplicate column')) {
          console.log('La colonne position existe déjà dans la table user_shifts.');
        } else {
          console.error('Erreur lors de l\'ajout de la colonne position:', err.message);
        }
      } else {
        console.log('Colonne position ajoutée avec succès à la table user_shifts.');
      }
    }
  );
};

// Exécuter la migration
runMigration();

// Si le script est exécuté directement
if (require.main === module) {
  // Fermer la connexion à la base de données après la migration
  setTimeout(() => {
    console.log('Migration terminée.');
    process.exit(0);
  }, 1000);
}

module.exports = { runMigration }; 