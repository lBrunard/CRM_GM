const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données SQLite
const dbPath = path.join(__dirname, '../server/database.sqlite');

// Fonction pour obtenir une date dans le format YYYY-MM-DD
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Fonction pour créer un timestamp avec une date et heure donnée
const createTimestamp = (date, timeString) => {
  const [hours, minutes] = timeString.split(':');
  const timestamp = new Date(date);
  timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return timestamp.toISOString();
};

// Fonction pour ajouter des minutes aléatoires à une heure (-5 à +10 minutes)
const addRandomDelay = (baseTime, minDelay = -5, maxDelay = 10) => {
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  const [hours, minutes] = baseTime.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes) + delay, 0, 0);
  return date.toTimeString().slice(0, 5);
};

// Shifts de test pour les 7 derniers jours
const testShifts = [
  // Aujourd'hui
  {
    title: 'Service Midi',
    date: formatDate(new Date()),
    start_time: '11:00',
    end_time: '15:00',
    employees: [
      { username: 'Marco', position: 'cuisine', clockIn: '10:55', clockOut: '15:05' },
      { username: 'Antoine', position: 'salle', clockIn: '11:02', clockOut: '15:08' },
      { username: 'Méline', position: 'bar', clockIn: '10:58', clockOut: '15:02' },
      { username: 'Jules', position: 'cuisine', clockIn: '11:05', clockOut: '15:12' }
    ]
  },
  {
    title: 'Service Soir',
    date: formatDate(new Date()),
    start_time: '18:00',
    end_time: '23:00',
    employees: [
      { username: 'Leandro', position: 'cuisine', clockIn: '17:55', clockOut: '23:10' },
      { username: 'Romain', position: 'salle', clockIn: '18:03', clockOut: '23:05' },
      { username: 'Zoé', position: 'bar', clockIn: '17:58', clockOut: '23:15' },
      { username: 'Pablo', position: 'salle', clockIn: '18:00', clockOut: '23:08' },
      { username: 'Camille', position: 'cuisine', clockIn: '17:52', clockOut: '23:20' }
    ]
  },
  
  // Hier
  {
    title: 'Service Midi',
    date: formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    start_time: '11:00',
    end_time: '15:00',
    employees: [
      { username: 'Terence', position: 'cuisine', clockIn: '10:58', clockOut: '15:03' },
      { username: 'João', position: 'salle', clockIn: '11:01', clockOut: '15:10' },
      { username: 'Shanna', position: 'bar', clockIn: '11:05', clockOut: '15:05' }
    ]
  },
  {
    title: 'Service Soir',
    date: formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    start_time: '18:00',
    end_time: '23:00',
    employees: [
      { username: 'Raja', position: 'cuisine', clockIn: '17:50', clockOut: '23:25' },
      { username: 'Pierrot', position: 'salle', clockIn: '18:02', clockOut: '23:00' },
      { username: 'Baptiste', position: 'cuisine', clockIn: '17:58', clockOut: '23:18' },
      { username: 'Mailys', position: 'salle', clockIn: '18:05', clockOut: '23:12' },
      { username: 'Victor', position: 'bar', clockIn: '17:55', clockOut: '23:08' }
    ]
  },

  // Il y a 2 jours
  {
    title: 'Brunch Weekend',
    date: formatDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
    start_time: '10:00',
    end_time: '16:00',
    employees: [
      { username: 'Marius', position: 'cuisine', clockIn: '09:55', clockOut: '16:10' },
      { username: 'Alejandra', position: 'salle', clockIn: '10:02', clockOut: '16:05' },
      { username: 'Dominika', position: 'bar', clockIn: '09:58', clockOut: '16:15' },
      { username: 'Jakub', position: 'cuisine', clockIn: '10:00', clockOut: '16:08' },
      { username: 'Mattheo', position: 'salle', clockIn: '10:05', clockOut: '16:02' }
    ]
  },
  {
    title: 'Service Soir',
    date: formatDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
    start_time: '18:00',
    end_time: '23:30',
    employees: [
      { username: 'Hélène', position: 'cuisine', clockIn: '17:52', clockOut: '23:35' },
      { username: 'Adrien', position: 'salle', clockIn: '18:00', clockOut: '23:30' },
      { username: 'Mathys', position: 'bar', clockIn: '17:58', clockOut: '23:40' }
    ]
  },

  // Il y a 3 jours
  {
    title: 'Service Midi',
    date: formatDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
    start_time: '11:00',
    end_time: '15:00',
    employees: [
      { username: 'Merveille', position: 'cuisine', clockIn: '10:55', clockOut: '15:12' },
      { username: 'Lucas', position: 'salle', clockIn: '11:03', clockOut: '15:05' },
      { username: 'Lison', position: 'bar', clockIn: '11:00', clockOut: '15:08' },
      { username: 'Juliette', position: 'salle', clockIn: '11:02', clockOut: '15:15' }
    ]
  },
  {
    title: 'Service Soir',
    date: formatDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
    start_time: '18:00',
    end_time: '23:00',
    employees: [
      { username: 'Philippe', position: 'cuisine', clockIn: '17:58', clockOut: '23:05' },
      { username: 'DosSantos', position: 'salle', clockIn: '18:02', clockOut: '23:10' },
      { username: 'Marco', position: 'cuisine', clockIn: '17:55', clockOut: '23:20' }
    ]
  },

  // Il y a 4 jours
  {
    title: 'Service Midi',
    date: formatDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
    start_time: '11:00',
    end_time: '15:00',
    employees: [
      { username: 'Antoine', position: 'cuisine', clockIn: '10:52', clockOut: '15:08' },
      { username: 'João', position: 'salle', clockIn: '11:05', clockOut: '15:03' },
      { username: 'Méline', position: 'bar', clockIn: '10:58', clockOut: '15:10' }
    ]
  },

  // Il y a 5 jours
  {
    title: 'Service Complet',
    date: formatDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
    start_time: '11:00',
    end_time: '23:00',
    employees: [
      { username: 'Leandro', position: 'cuisine', clockIn: '10:55', clockOut: '23:15' },
      { username: 'Romain', position: 'salle', clockIn: '11:00', clockOut: '23:05' },
      { username: 'Zoé', position: 'bar', clockIn: '10:58', clockOut: '23:10' },
      { username: 'Pablo', position: 'salle', clockIn: '11:02', clockOut: '23:08' },
      { username: 'Camille', position: 'cuisine', clockIn: '10:50', clockOut: '23:20' },
      { username: 'Jules', position: 'cuisine', clockIn: '11:05', clockOut: '23:12' }
    ]
  },

  // Il y a 6 jours
  {
    title: 'Service Midi',
    date: formatDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
    start_time: '11:00',
    end_time: '15:00',
    employees: [
      { username: 'Terence', position: 'cuisine', clockIn: '10:57', clockOut: '15:05' },
      { username: 'Shanna', position: 'salle', clockIn: '11:02', clockOut: '15:08' },
      { username: 'Baptiste', position: 'bar', clockIn: '11:00', clockOut: '15:02' }
    ]
  },
  {
    title: 'Service Soir',
    date: formatDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
    start_time: '18:00',
    end_time: '23:00',
    employees: [
      { username: 'Raja', position: 'cuisine', clockIn: '17:55', clockOut: '23:18' },
      { username: 'Pierrot', position: 'salle', clockIn: '18:00', clockOut: '23:02' },
      { username: 'Mailys', position: 'salle', clockIn: '18:03', clockOut: '23:12' },
      { username: 'Victor', position: 'bar', clockIn: '17:58', clockOut: '23:05' }
    ]
  }
];

async function addTestShifts() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Erreur de connexion à la base de données:', err.message);
          reject(err);
          return;
        }
        console.log('Connecté à la base de données SQLite');
      });

      let addedShifts = 0;
      let addedPointages = 0;
      let validatedPointages = 0;

      // Récupérer tous les utilisateurs existants
      const users = await new Promise((resolve, reject) => {
        db.all('SELECT id, username FROM users', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const userMap = {};
      users.forEach(user => {
        userMap[user.username] = user.id;
      });

      console.log(`👥 ${users.length} utilisateurs trouvés dans la base`);

      // Fonction pour ajouter un shift
      const addShift = (shift) => {
        return new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO shifts (title, date, start_time, end_time, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [shift.title, shift.date, shift.start_time, shift.end_time],
            function(err) {
              if (err) {
                console.error(`✗ Erreur lors de l'ajout du shift ${shift.title}:`, err.message);
                reject(err);
              } else {
                console.log(`✓ Shift "${shift.title}" ajouté (${shift.date}) - ID: ${this.lastID}`);
                addedShifts++;
                resolve(this.lastID);
              }
            }
          );
        });
      };

      // Fonction pour ajouter un pointage
      const addPointage = (userId, shiftId, employee, shiftDate) => {
        return new Promise((resolve, reject) => {
          const clockInTimestamp = createTimestamp(new Date(shiftDate), employee.clockIn);
          const clockOutTimestamp = createTimestamp(new Date(shiftDate), employee.clockOut);
          
          // 80% des pointages sont validés, 20% en attente
          const isValidated = Math.random() < 0.8;
          const validatedBy = isValidated ? (Math.random() < 0.7 ? 1 : 2) : null; // Manager ou responsable

          db.run(
            `INSERT INTO user_shifts (user_id, shift_id, position, clock_in, clock_out, validated, validated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, shiftId, employee.position, clockInTimestamp, clockOutTimestamp, isValidated, validatedBy],
            function(err) {
              if (err) {
                console.error(`✗ Erreur lors de l'ajout du pointage pour ${employee.username}:`, err.message);
                reject(err);
              } else {
                console.log(`  📍 Pointage ajouté pour ${employee.username} (${employee.position}) ${isValidated ? '✅' : '⏳'}`);
                addedPointages++;
                if (isValidated) validatedPointages++;
                resolve();
              }
            }
          );
        });
      };

      // Traitement de tous les shifts
      for (const shift of testShifts) {
        try {
          // Vérifier si le shift existe déjà
          const existingShift = await new Promise((resolve, reject) => {
            db.get(
              'SELECT id FROM shifts WHERE title = ? AND date = ? AND start_time = ?',
              [shift.title, shift.date, shift.start_time],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          let shiftId;
          if (existingShift) {
            console.log(`⚠ Shift "${shift.title}" (${shift.date}) existe déjà - ID: ${existingShift.id}`);
            shiftId = existingShift.id;
          } else {
            shiftId = await addShift(shift);
          }

          // Ajouter les pointages pour ce shift
          for (const employee of shift.employees) {
            const userId = userMap[employee.username];
            if (userId) {
              // Vérifier si le pointage existe déjà
              const existingPointage = await new Promise((resolve, reject) => {
                db.get(
                  'SELECT id FROM user_shifts WHERE user_id = ? AND shift_id = ?',
                  [userId, shiftId],
                  (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                  }
                );
              });

              if (!existingPointage) {
                await addPointage(userId, shiftId, employee, shift.date);
              } else {
                console.log(`  ⚠ Pointage pour ${employee.username} existe déjà`);
              }
            } else {
              console.warn(`  ⚠ Utilisateur ${employee.username} non trouvé`);
            }
          }
        } catch (error) {
          console.error(`Erreur lors du traitement du shift ${shift.title}:`, error);
        }
      }

      // Afficher le résumé
      console.log('\n📊 Résumé:');
      console.log(`🏪 ${addedShifts} shifts ajoutés`);
      console.log(`📍 ${addedPointages} pointages ajoutés`);
      console.log(`✅ ${validatedPointages} pointages validés`);
      console.log(`⏳ ${addedPointages - validatedPointages} pointages en attente`);

      // Afficher les statistiques finales
      db.all(`
        SELECT 
          COUNT(DISTINCT s.id) as total_shifts,
          COUNT(us.id) as total_pointages,
          SUM(CASE WHEN us.validated = 1 THEN 1 ELSE 0 END) as validated_pointages,
          SUM(CASE WHEN us.validated = 0 THEN 1 ELSE 0 END) as pending_pointages
        FROM shifts s
        LEFT JOIN user_shifts us ON s.id = us.shift_id
        WHERE s.date >= date('now', '-7 days')
      `, [], (err, rows) => {
        if (err) {
          console.error('Erreur lors de la récupération des stats:', err.message);
        } else {
          const stats = rows[0];
          console.log('\n📈 Statistiques totales (7 derniers jours):');
          console.log(`🏪 Shifts total: ${stats.total_shifts}`);
          console.log(`📍 Pointages total: ${stats.total_pointages}`);
          console.log(`✅ Validés: ${stats.validated_pointages}`);
          console.log(`⏳ En attente: ${stats.pending_pointages}`);
        }

        db.close((err) => {
          if (err) {
            console.error('Erreur lors de la fermeture:', err.message);
          } else {
            console.log('\n🔒 Connexion fermée');
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
console.log('🚀 Ajout des shifts et pointages de test...\n');
addTestShifts().catch(console.error); 