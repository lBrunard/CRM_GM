const db = require('../config/db');

// Créer un nouveau shift
const createShift = (req, res) => {
  const { title, date, start_time, end_time } = req.body;
  
  if (!title || !date || !start_time || !end_time) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }
  
  db.run(
    'INSERT INTO shifts (title, date, start_time, end_time) VALUES (?, ?, ?, ?)',
    [title, date, start_time, end_time],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la création du shift', error: err.message });
      }
      
      res.status(201).json({
        message: 'Shift créé avec succès',
        shiftId: this.lastID
      });
    }
  );
};

// Récupérer tous les shifts
const getAllShifts = (req, res) => {
  db.all('SELECT * FROM shifts ORDER BY date ASC, start_time ASC', (err, shifts) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la récupération des shifts', error: err.message });
    }
    res.json(shifts);
  });
};

// Récupérer un shift par ID
const getShiftById = (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM shifts WHERE id = ?', [id], (err, shift) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la récupération du shift', error: err.message });
    }
    
    if (!shift) {
      return res.status(404).json({ message: 'Shift non trouvé' });
    }
    
    res.json(shift);
  });
};

// Mettre à jour un shift
const updateShift = (req, res) => {
  const { id } = req.params;
  const { title, date, start_time, end_time } = req.body;
  
  if (!title || !date || !start_time || !end_time) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }
  
  db.run(
    'UPDATE shifts SET title = ?, date = ?, start_time = ?, end_time = ? WHERE id = ?',
    [title, date, start_time, end_time, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la mise à jour du shift', error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Shift non trouvé' });
      }
      
      res.json({ message: 'Shift mis à jour avec succès' });
    }
  );
};

// Supprimer un shift
const deleteShift = (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM shifts WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la suppression du shift', error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ message: 'Shift non trouvé' });
    }
    
    res.json({ message: 'Shift supprimé avec succès' });
  });
};

// Assigner un utilisateur à un shift
const assignUserToShift = (req, res) => {
  const { userId, shiftId, position } = req.body;
  
  if (!userId || !shiftId || !position) {
    return res.status(400).json({ message: 'Id utilisateur, Id shift et position sont requis' });
  }

  if (!['cuisine', 'salle', 'bar'].includes(position)) {
    return res.status(400).json({ message: 'La position doit être cuisine, salle ou bar' });
  }
  
  // Vérifier si l'utilisateur existe
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Vérifier si le shift existe
    db.get('SELECT * FROM shifts WHERE id = ?', [shiftId], (err, shift) => {
      if (err || !shift) {
        return res.status(404).json({ message: 'Shift non trouvé' });
      }
      
      // Vérifier si l'affectation existe déjà
      db.get(
        'SELECT * FROM user_shifts WHERE user_id = ? AND shift_id = ?',
        [userId, shiftId],
        (err, userShift) => {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la vérification de l\'affectation', error: err.message });
          }
          
          if (userShift) {
            return res.status(409).json({ message: 'Utilisateur déjà assigné à ce shift' });
          }
          
          // Créer la nouvelle affectation
          db.run(
            'INSERT INTO user_shifts (user_id, shift_id, position) VALUES (?, ?, ?)',
            [userId, shiftId, position],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Erreur lors de l\'affectation', error: err.message });
              }
              
              res.status(201).json({
                message: 'Utilisateur assigné au shift avec succès',
                userShiftId: this.lastID
              });
            }
          );
        }
      );
    });
  });
};

// Récupérer tous les shifts d'un utilisateur
const getUserShifts = (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT us.id as user_shift_id, us.clock_in, us.clock_out, us.validated, 
      COALESCE(us.position, 'non-défini') as position,
      s.id as shift_id, s.title, s.date, s.start_time, s.end_time
      FROM user_shifts us
      JOIN shifts s ON us.shift_id = s.id
      WHERE us.user_id = ?
      ORDER BY s.date ASC, s.start_time ASC`,
    [userId],
    (err, shifts) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des shifts', error: err.message });
      }
      
      res.json(shifts);
    }
  );
};

// Créer plusieurs shifts à la fois
const createMultipleShifts = (req, res) => {
  const { shifts } = req.body;
  
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
    return res.status(400).json({ message: 'Un tableau de shifts est requis' });
  }
  
  // Commencer une transaction pour garantir l'atomicité
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const createdShifts = [];
    let hasError = false;
    let errorMessage = '';
    
    // Traiter chaque shift
    const processNextShift = (index) => {
      if (index >= shifts.length) {
        // Tous les shifts ont été traités, finaliser la transaction
        if (hasError) {
          db.run('ROLLBACK', () => {
            res.status(500).json({ message: errorMessage });
          });
        } else {
          db.run('COMMIT', () => {
            res.status(201).json({
              message: 'Shifts créés avec succès',
              shifts: createdShifts
            });
          });
        }
        return;
      }
      
      const shift = shifts[index];
      const { title, date, start_time, end_time, assigned_users } = shift;
      
      if (!title || !date || !start_time || !end_time) {
        hasError = true;
        errorMessage = 'Tous les champs sont requis pour chaque shift';
        processNextShift(shifts.length); // Skip to end
        return;
      }
      
      // Insérer le shift
      db.run(
        'INSERT INTO shifts (title, date, start_time, end_time) VALUES (?, ?, ?, ?)',
        [title, date, start_time, end_time],
        function(err) {
          if (err) {
            hasError = true;
            errorMessage = 'Erreur lors de la création d\'un shift';
            processNextShift(shifts.length); // Skip to end
            return;
          }
          
          const shiftId = this.lastID;
          createdShifts.push({
            id: shiftId,
            title,
            date,
            start_time,
            end_time
          });
          
          // Si des utilisateurs sont assignés à ce shift
          if (assigned_users && Array.isArray(assigned_users) && assigned_users.length > 0) {
            let userAssignments = 0;
            
            // Assigner chaque utilisateur
            assigned_users.forEach(assignment => {
              const { userId, position } = assignment;
              
              if (!userId || !position || !['cuisine', 'salle', 'bar'].includes(position)) {
                processNextUserAssignment();
                return;
              }
              
              db.run(
                'INSERT INTO user_shifts (user_id, shift_id, position) VALUES (?, ?, ?)',
                [userId, shiftId, position],
                (err) => {
                  if (err) {
                    console.error('Erreur lors de l\'assignation:', err);
                  }
                  processNextUserAssignment();
                }
              );
              
              function processNextUserAssignment() {
                userAssignments++;
                if (userAssignments === assigned_users.length) {
                  processNextShift(index + 1);
                }
              }
            });
          } else {
            processNextShift(index + 1);
          }
        }
      );
    };
    
    // Commencer le traitement avec le premier shift
    processNextShift(0);
  });
};

// Obtenir le personnel assigné à un shift
const getShiftPersonnel = (req, res) => {
  const { shiftId } = req.params;
  
  db.all(
    `SELECT us.id as user_shift_id, us.position, 
      u.id as user_id, u.username, u.email, u.role
      FROM user_shifts us
      JOIN users u ON us.user_id = u.id
      WHERE us.shift_id = ?
      ORDER BY us.position`,
    [shiftId],
    (err, personnel) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération du personnel', error: err.message });
      }
      
      // Organiser les résultats par position
      const result = {
        cuisine: personnel.filter(p => p.position === 'cuisine'),
        salle: personnel.filter(p => p.position === 'salle'),
        bar: personnel.filter(p => p.position === 'bar')
      };
      
      res.json(result);
    }
  );
};

// Obtenir les détails complets d'un shift incluant les user_shifts
const getShiftDetails = (req, res) => {
  const { shiftId } = req.params;
  
  db.all(
    `SELECT us.id, us.user_id, us.clock_in, us.clock_out, us.validated, us.position,
      u.username, u.email, u.role
      FROM user_shifts us
      JOIN users u ON us.user_id = u.id
      WHERE us.shift_id = ?`,
    [shiftId],
    (err, userShifts) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des détails du shift', error: err.message });
      }
      
      res.json(userShifts);
    }
  );
};

// Retirer un utilisateur d'un shift
const removeUserFromShift = (req, res) => {
  const { userId, shiftId } = req.body;
  
  if (!userId || !shiftId) {
    return res.status(400).json({ message: 'Id utilisateur et Id shift sont requis' });
  }
  
  // Vérifier si l'affectation existe
  db.get('SELECT * FROM user_shifts WHERE user_id = ? AND shift_id = ?', [userId, shiftId], (err, userShift) => {
    if (err) {
      return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
    }
    
    if (!userShift) {
      return res.status(404).json({ message: 'Affectation non trouvée' });
    }
    
    // Supprimer l'affectation
    db.run('DELETE FROM user_shifts WHERE user_id = ? AND shift_id = ?', [userId, shiftId], function(err) {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la suppression de l\'affectation', error: err.message });
      }
      
      res.json({ message: 'Utilisateur retiré du shift avec succès' });
    });
  });
};

// Mettre à jour le personnel d'un shift (NOUVELLE VERSION QUI PRÉSERVE LES HEURES)
const updateShiftPersonnel = (req, res) => {
  const { shiftId } = req.params;
  const { personnel } = req.body; // { cuisine: [...], salle: [...], bar: [...] }
  
  if (!personnel) {
    return res.status(400).json({ message: 'Données du personnel requises' });
  }
  
  // Vérifier si le shift existe
  db.get('SELECT * FROM shifts WHERE id = ?', [shiftId], (err, shift) => {
    if (err || !shift) {
      return res.status(404).json({ message: 'Shift non trouvé' });
    }
    
    // Récupérer les affectations actuelles
    db.all('SELECT * FROM user_shifts WHERE shift_id = ?', [shiftId], (err, currentAssignments) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des affectations actuelles', error: err.message });
      }
      
      // Préparer la nouvelle liste du personnel
      const newPersonnel = [
        ...personnel.cuisine.map(user => ({ user_id: user.user_id, position: 'cuisine' })),
        ...personnel.salle.map(user => ({ user_id: user.user_id, position: 'salle' })),
        ...personnel.bar.map(user => ({ user_id: user.user_id, position: 'bar' }))
      ];
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let operationsCompleted = 0;
        let hasError = false;
        
        // Calculer les opérations nécessaires
        const currentUserIds = currentAssignments.map(a => a.user_id);
        const newUserIds = newPersonnel.map(p => p.user_id);
        
        // Utilisateurs à supprimer (présents actuellement mais pas dans la nouvelle liste)
        const usersToRemove = currentAssignments.filter(a => !newUserIds.includes(a.user_id));
        
        // Utilisateurs à ajouter (dans la nouvelle liste mais pas actuellement présents)
        const usersToAdd = newPersonnel.filter(p => !currentUserIds.includes(p.user_id));
        
        // Utilisateurs à mettre à jour (présents dans les deux mais position différente)
        const usersToUpdate = newPersonnel.filter(p => {
          const current = currentAssignments.find(a => a.user_id === p.user_id);
          return current && current.position !== p.position;
        });
        
        const totalOperations = usersToRemove.length + usersToAdd.length + usersToUpdate.length;
        
        if (totalOperations === 0) {
          // Aucun changement nécessaire
          db.run('COMMIT', () => {
            res.json({ message: 'Personnel du shift mis à jour avec succès (aucun changement)' });
          });
          return;
        }
        
        const completeOperation = () => {
          operationsCompleted++;
          if (operationsCompleted === totalOperations && !hasError) {
            db.run('COMMIT', () => {
              res.json({ message: 'Personnel du shift mis à jour avec succès' });
            });
          }
        };
        
        const handleError = (error) => {
          if (!hasError) {
            hasError = true;
            db.run('ROLLBACK');
            res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
          }
        };
        
        // Supprimer les utilisateurs qui ne sont plus assignés (PRÉSERVE LES HEURES si elles existent)
        usersToRemove.forEach(assignment => {
          // Vérifier si l'utilisateur a des heures pointées
          if (assignment.clock_in || assignment.clock_out) {
            // Ne pas supprimer, juste marquer comme "non assigné" ou laisser tel quel
            console.log(`Utilisateur ${assignment.user_id} a des heures pointées, conservation de l'enregistrement`);
            completeOperation();
          } else {
            // Supprimer seulement si pas d'heures pointées
            db.run('DELETE FROM user_shifts WHERE id = ?', [assignment.id], (err) => {
              if (err) {
                handleError(err);
              } else {
                completeOperation();
              }
            });
          }
        });
        
        // Ajouter les nouveaux utilisateurs
        usersToAdd.forEach(person => {
          db.run(
            'INSERT INTO user_shifts (user_id, shift_id, position) VALUES (?, ?, ?)',
            [person.user_id, shiftId, person.position],
            (err) => {
              if (err) {
                handleError(err);
              } else {
                completeOperation();
              }
            }
          );
        });
        
        // Mettre à jour la position des utilisateurs existants
        usersToUpdate.forEach(person => {
          db.run(
            'UPDATE user_shifts SET position = ? WHERE user_id = ? AND shift_id = ?',
            [person.position, person.user_id, shiftId],
            (err) => {
              if (err) {
                handleError(err);
              } else {
                completeOperation();
              }
            }
          );
        });
      });
    });
  });
};

module.exports = {
  createShift,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
  assignUserToShift,
  getUserShifts,
  createMultipleShifts,
  getShiftPersonnel,
  getShiftDetails,
  removeUserFromShift,
  updateShiftPersonnel
}; 