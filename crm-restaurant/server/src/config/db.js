const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Création du chemin vers la base de données
const dbPath = path.resolve(__dirname, '../../database.sqlite');

// Initialisation de la connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite');
    initializeDatabase();
  }
});

// Fonction pour initialiser les tables de la base de données
function initializeDatabase() {
  // Création de la table des utilisateurs
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('personnel', 'responsable', 'manager')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table users:', err.message);
    } else {
      console.log('Table users créée ou déjà existante');
    }
  });

  // Création de la table des shifts
  db.run(`CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table shifts:', err.message);
    } else {
      console.log('Table shifts créée ou déjà existante');
    }
  });

  // Création de la table des affectations d'utilisateurs aux shifts
  db.run(`CREATE TABLE IF NOT EXISTS user_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shift_id INTEGER NOT NULL,
    position TEXT CHECK (position IN ('cuisine', 'salle', 'bar')),
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    validated BOOLEAN DEFAULT FALSE,
    validated_by INTEGER,
    comment TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts (id) ON DELETE CASCADE,
    FOREIGN KEY (validated_by) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table user_shifts:', err.message);
    } else {
      console.log('Table user_shifts créée ou déjà existante');
    }
  });
}

module.exports = db; 