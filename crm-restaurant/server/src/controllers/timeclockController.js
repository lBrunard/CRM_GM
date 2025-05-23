const db = require('../config/db');

// Pointer l'entrée (clock-in)
const clockIn = (req, res) => {
  const { userId, shiftId } = req.body;
  
  if (!userId || !shiftId) {
    return res.status(400).json({ message: 'Id utilisateur et Id shift sont requis' });
  }
  
  // Vérifier si l'utilisateur est assigné à ce shift
  db.get(
    'SELECT * FROM user_shifts WHERE user_id = ? AND shift_id = ?',
    [userId, shiftId],
    (err, userShift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification de l\'affectation', error: err.message });
      }
      
      if (!userShift) {
        return res.status(404).json({ message: 'Utilisateur non assigné à ce shift' });
      }
      
      if (userShift.clock_in) {
        return res.status(400).json({ message: 'Vous avez déjà pointé votre entrée pour ce shift' });
      }
      
      // Enregistrer l'heure d'entrée
      const clockInTime = new Date().toISOString();
      
      db.run(
        'UPDATE user_shifts SET clock_in = ? WHERE id = ?',
        [clockInTime, userShift.id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors du pointage d\'entrée', error: err.message });
          }
          
          res.json({ 
            message: 'Entrée pointée avec succès',
            clockIn: clockInTime 
          });
        }
      );
    }
  );
};

// Pointer la sortie (clock-out)
const clockOut = (req, res) => {
  const { userId, shiftId } = req.body;
  
  if (!userId || !shiftId) {
    return res.status(400).json({ message: 'Id utilisateur et Id shift sont requis' });
  }
  
  // Vérifier si l'utilisateur est assigné à ce shift et a déjà pointé son entrée
  db.get(
    'SELECT * FROM user_shifts WHERE user_id = ? AND shift_id = ?',
    [userId, shiftId],
    (err, userShift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification de l\'affectation', error: err.message });
      }
      
      if (!userShift) {
        return res.status(404).json({ message: 'Utilisateur non assigné à ce shift' });
      }
      
      if (!userShift.clock_in) {
        return res.status(400).json({ message: 'Vous devez d\'abord pointer votre entrée' });
      }
      
      if (userShift.clock_out) {
        return res.status(400).json({ message: 'Vous avez déjà pointé votre sortie pour ce shift' });
      }
      
      // Enregistrer l'heure de sortie
      const clockOutTime = new Date().toISOString();
      
      db.run(
        'UPDATE user_shifts SET clock_out = ? WHERE id = ?',
        [clockOutTime, userShift.id],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors du pointage de sortie', error: err.message });
          }
          
          res.json({ 
            message: 'Sortie pointée avec succès',
            clockOut: clockOutTime 
          });
        }
      );
    }
  );
};

// Valider les heures de travail (pour les responsables et managers)
const validateHours = (req, res) => {
  const { userShiftId, validatorId, comment } = req.body;
  
  if (!userShiftId || !validatorId) {
    return res.status(400).json({ message: 'Id de shift utilisateur et Id du validateur sont requis' });
  }
  
  // Vérifier si le validateur est un responsable ou un manager
  db.get('SELECT role FROM users WHERE id = ?', [validatorId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification du validateur', error: err.message });
    }
    
    if (!user || (user.role !== 'responsable' && user.role !== 'manager')) {
      return res.status(403).json({ message: 'Seuls les responsables et les managers peuvent valider les heures' });
    }
    
    // Récupérer les données actuelles pour l'audit
    db.get('SELECT * FROM user_shifts WHERE id = ?', [userShiftId], (err, userShift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des données', error: err.message });
      }
      
      if (!userShift) {
        return res.status(404).json({ message: 'Affectation non trouvée' });
      }
      
      // Mettre à jour le statut de validation
      db.run(
        'UPDATE user_shifts SET validated = 1, validated_by = ?, comment = ? WHERE id = ?',
        [validatorId, comment || null, userShiftId],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la validation des heures', error: err.message });
          }
          
          // Enregistrer dans l'audit
          const action = userShift.validated ? 'REVALIDATE' : 'VALIDATE';
          db.run(
            `INSERT INTO hours_audit (user_shift_id, modified_by, action, old_validated, new_validated, reason)
             VALUES (?, ?, ?, ?, 1, ?)`,
            [userShiftId, validatorId, action, userShift.validated ? 1 : 0, comment],
            (auditErr) => {
              if (auditErr) {
                console.error('Erreur lors de l\'enregistrement de l\'audit:', auditErr);
              }
            }
          );
          
          res.json({ message: 'Heures validées avec succès' });
        }
      );
    });
  });
};

// Obtenir les heures qui nécessitent une validation (pour les responsables et managers)
const getUnvalidatedHours = (req, res) => {
  db.all(
    `SELECT us.id, us.user_id, us.shift_id, us.clock_in, us.clock_out, 
     u.username, u.email, 
     s.title, s.date, s.start_time, s.end_time
     FROM user_shifts us
     JOIN users u ON us.user_id = u.id
     JOIN shifts s ON us.shift_id = s.id
     WHERE us.clock_in IS NOT NULL 
     AND us.clock_out IS NOT NULL 
     AND us.validated = 0
     ORDER BY s.date ASC, s.start_time ASC`,
    (err, unvalidatedHours) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des heures non validées', error: err.message });
      }
      
      res.json(unvalidatedHours);
    }
  );
};

// Obtenir toutes les heures (validées et non validées) pour les managers
const getAllHours = (req, res) => {
  db.all(
    `SELECT us.id, us.user_id, us.shift_id, us.clock_in, us.clock_out, us.validated,
     u.username, u.email, 
     s.title, s.date, s.start_time, s.end_time
     FROM user_shifts us
     JOIN users u ON us.user_id = u.id
     JOIN shifts s ON us.shift_id = s.id
     WHERE us.clock_in IS NOT NULL 
     AND us.clock_out IS NOT NULL 
     ORDER BY s.date DESC, s.start_time ASC`,
    (err, allHours) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération de toutes les heures', error: err.message });
      }
      
      res.json(allHours);
    }
  );
};

// Obtenir les shifts où un responsable est présent
const getResponsableShifts = (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT DISTINCT us2.id, us2.user_id, us2.shift_id, us2.clock_in, us2.clock_out, us2.validated,
     u2.username, u2.email, 
     s.title, s.date, s.start_time, s.end_time
     FROM user_shifts us1
     JOIN shifts s ON us1.shift_id = s.id
     JOIN user_shifts us2 ON us2.shift_id = s.id
     JOIN users u2 ON us2.user_id = u2.id
     WHERE us1.user_id = ? 
     AND us2.clock_in IS NOT NULL 
     AND us2.clock_out IS NOT NULL 
     ORDER BY s.date DESC, s.start_time ASC`,
    [userId],
    (err, responsableShifts) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des shifts du responsable', error: err.message });
      }
      
      res.json(responsableShifts);
    }
  );
};

// Modifier les heures de pointage
const updateHours = (req, res) => {
  const { userShiftId, clockIn, clockOut, validatorId } = req.body;
  
  if (!userShiftId || !validatorId) {
    return res.status(400).json({ message: 'Id de shift utilisateur et Id du modificateur sont requis' });
  }
  
  // Vérifier si le modificateur est un responsable ou un manager
  db.get('SELECT role FROM users WHERE id = ?', [validatorId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification du modificateur', error: err.message });
    }
    
    if (!user || (user.role !== 'responsable' && user.role !== 'manager')) {
      return res.status(403).json({ message: 'Seuls les responsables et les managers peuvent modifier les heures' });
    }
    
    // Vérifier si l'affectation existe
    db.get('SELECT * FROM user_shifts WHERE id = ?', [userShiftId], (err, userShift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification du shift', error: err.message });
      }
      
      if (!userShift) {
        return res.status(404).json({ message: 'Affectation non trouvée' });
      }
      
      // Si c'est un responsable, vérifier qu'il est présent sur ce shift
      if (user.role === 'responsable') {
        db.get(
          'SELECT * FROM user_shifts WHERE user_id = ? AND shift_id = ?',
          [validatorId, userShift.shift_id],
          (err, responsableInShift) => {
            if (err) {
              return res.status(500).json({ message: 'Erreur lors de la vérification de la présence du responsable', error: err.message });
            }
            
            if (!responsableInShift) {
              return res.status(403).json({ message: 'Un responsable ne peut modifier que les shifts auxquels il participe' });
            }
            
            // Procéder à la modification
            performUpdate();
          }
        );
      } else {
        // C'est un manager, il peut tout modifier
        performUpdate();
      }
      
      function performUpdate() {
        // Construire la requête de mise à jour
        let updateQuery = 'UPDATE user_shifts SET ';
        let updateParams = [];
        let updateFields = [];
        
        if (clockIn !== undefined) {
          updateFields.push('clock_in = ?');
          updateParams.push(clockIn);
        }
        
        if (clockOut !== undefined) {
          updateFields.push('clock_out = ?');
          updateParams.push(clockOut);
        }
        
        // Remettre le statut de validation à 0 si on modifie les heures
        if (clockIn !== undefined || clockOut !== undefined) {
          updateFields.push('validated = 0');
          updateFields.push('validated_by = NULL');
          updateFields.push('comment = NULL');
        }
        
        updateQuery += updateFields.join(', ');
        updateQuery += ' WHERE id = ?';
        updateParams.push(userShiftId);
        
        db.run(updateQuery, updateParams, function(err) {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la modification des heures', error: err.message });
          }
          
          // Enregistrer dans l'audit
          db.run(
            `INSERT INTO hours_audit (user_shift_id, modified_by, action, old_clock_in, new_clock_in, old_clock_out, new_clock_out, old_validated, new_validated, reason)
             VALUES (?, ?, 'UPDATE_HOURS', ?, ?, ?, ?, ?, 0, ?)`,
            [
              userShiftId, 
              validatorId, 
              userShift.clock_in, 
              clockIn || userShift.clock_in,
              userShift.clock_out, 
              clockOut || userShift.clock_out,
              userShift.validated ? 1 : 0,
              'Modification manuelle des heures'
            ],
            (auditErr) => {
              if (auditErr) {
                console.error('Erreur lors de l\'enregistrement de l\'audit:', auditErr);
              }
            }
          );
          
          res.json({ message: 'Heures modifiées avec succès' });
        });
      }
    });
  });
};

// Calculer les salaires pour un shift
const getShiftSalaries = (req, res) => {
  const { shiftId } = req.params;
  const requestUserRole = req.user.role;
  const requestUserId = req.user.id;
  
  db.all(
    `SELECT us.id, us.user_id, us.clock_in, us.clock_out, us.validated, us.position,
     u.username, u.email, u.role, u.hourly_rate, u.first_name, u.last_name
     FROM user_shifts us
     JOIN users u ON us.user_id = u.id
     WHERE us.shift_id = ? AND us.clock_in IS NOT NULL AND us.clock_out IS NOT NULL`,
    [shiftId],
    (err, userShifts) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des données de salaire', error: err.message });
      }
      
      const salaries = userShifts.map(userShift => {
        // Calculer les heures travaillées
        const clockIn = new Date(userShift.clock_in);
        const clockOut = new Date(userShift.clock_out);
        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60); // en heures
        
        // Calculer le salaire
        const hourlyRate = parseFloat(userShift.hourly_rate) || 0;
        const salary = hoursWorked * hourlyRate;
        
        const result = {
          user_id: userShift.user_id,
          username: userShift.username,
          first_name: userShift.first_name,
          last_name: userShift.last_name,
          position: userShift.position,
          hours_worked: Math.round(hoursWorked * 100) / 100, // arrondir à 2 décimales
          validated: userShift.validated
        };
        
        // Seuls les managers peuvent voir tous les salaires
        // Les autres ne voient que le leur
        if (requestUserRole === 'manager' || userShift.user_id === requestUserId) {
          result.hourly_rate = hourlyRate;
          result.salary = Math.round(salary * 100) / 100; // arrondir à 2 décimales
        }
        
        return result;
      });
      
      res.json(salaries);
    }
  );
};

module.exports = {
  clockIn,
  clockOut,
  validateHours,
  getUnvalidatedHours,
  getAllHours,
  getResponsableShifts,
  updateHours,
  getShiftSalaries
}; 