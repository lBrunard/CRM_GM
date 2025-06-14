const db = require('../config/db');

// Marquer un utilisateur comme non disponible pour un shift
const markUnavailable = (req, res) => {
  const { shiftId, reason } = req.body;
  const userId = req.user.id;
  
  if (!shiftId) {
    return res.status(400).json({ message: 'ID du shift requis' });
  }
  
  // Vérifier que le shift existe et que l'utilisateur y est assigné
  db.get(
    `SELECT us.*, s.title, s.date, s.start_time, s.end_time 
     FROM user_shifts us 
     JOIN shifts s ON us.shift_id = s.id 
     WHERE us.user_id = ? AND us.shift_id = ?`,
    [userId, shiftId],
    (err, userShift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification du shift', error: err.message });
      }
      
      if (!userShift) {
        return res.status(404).json({ message: 'Vous n\'êtes pas assigné à ce shift' });
      }
      
      // Vérifier que le shift n'a pas encore commencé
      if (userShift.clock_in) {
        return res.status(400).json({ message: 'Impossible de se déclarer indisponible pour un shift déjà commencé' });
      }
      
      // Vérifier si une indisponibilité existe déjà
      db.get(
        'SELECT * FROM shift_unavailabilities WHERE user_id = ? AND shift_id = ?',
        [userId, shiftId],
        (err, existing) => {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
          }
          
          if (existing) {
            return res.status(409).json({ message: 'Vous avez déjà déclaré votre indisponibilité pour ce shift' });
          }
          
          // Créer l'indisponibilité
          db.run(
            'INSERT INTO shift_unavailabilities (user_id, shift_id, reason) VALUES (?, ?, ?)',
            [userId, shiftId, reason || null],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Erreur lors de l\'enregistrement', error: err.message });
              }
              
              res.status(201).json({
                message: 'Indisponibilité enregistrée avec succès',
                unavailabilityId: this.lastID
              });
            }
          );
        }
      );
    }
  );
};

// Proposer de remplacer quelqu'un
const proposeReplacement = (req, res) => {
  const { shiftId, originalUserId } = req.body;
  const replacementUserId = req.user.id;
  
  if (!shiftId) {
    return res.status(400).json({ message: 'ID du shift requis' });
  }
  
  // Récupérer l'utilisateur qui a déclaré son indisponibilité pour ce shift
  db.get(
    `SELECT ua.user_id as unavailable_user_id 
     FROM shift_unavailabilities ua 
     WHERE ua.shift_id = ?`,
    [shiftId],
    (err, shift) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification du shift', error: err.message });
      }
      
      if (!shift) {
        return res.status(404).json({ message: 'Aucune indisponibilité trouvée pour ce shift' });
      }
      
      const originalUserId = shift.unavailable_user_id;
      
      // Vérifier s'il y a déjà une demande en attente de ce remplaçant pour ce shift
      db.get(
        `SELECT id, status FROM shift_replacements 
         WHERE shift_id = ? AND replacement_user_id = ?`,
        [shiftId, replacementUserId],
        (err, existingRequest) => {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la vérification des demandes existantes', error: err.message });
          }
          
          if (existingRequest && existingRequest.status === 'pending') {
            return res.status(400).json({ message: 'Vous avez déjà une demande en attente pour ce shift' });
          }
          
          if (existingRequest && existingRequest.status === 'rejected') {
            // Réactiver la demande rejetée
            db.run(
              `UPDATE shift_replacements 
               SET status = 'pending', created_at = datetime('now'), original_user_id = ?
               WHERE id = ?`,
              [originalUserId, existingRequest.id],
              function(updateErr) {
                if (updateErr) {
                  return res.status(500).json({ message: 'Erreur lors de la réactivation de la demande', error: updateErr.message });
                }
                
                res.json({ message: 'Demande de remplacement réactivée avec succès' });
              }
            );
          } else {
            // Créer une nouvelle demande
            db.run(
              `INSERT INTO shift_replacements (shift_id, original_user_id, replacement_user_id, status, created_at)
               VALUES (?, ?, ?, 'pending', datetime('now'))`,
              [shiftId, originalUserId, replacementUserId],
              function(insertErr) {
                if (insertErr) {
                  return res.status(500).json({ message: 'Erreur lors de la création de la demande', error: insertErr.message });
                }
                
                res.json({ message: 'Demande de remplacement créée avec succès' });
              }
            );
          }
        }
      );
    }
  );
};

// Obtenir les shifts disponibles pour remplacement
const getAvailableShifts = (req, res) => {
  const userId = req.user.id;
  
  db.all(
    `SELECT s.id as shift_id, s.title, s.date, s.start_time, s.end_time,
            us.position, us.user_id as current_user_id, u.username as current_username,
            ua.reason, ua.created_at as unavailable_since, ua.user_id as original_user_id
     FROM shifts s
     JOIN user_shifts us ON s.id = us.shift_id
     JOIN shift_unavailabilities ua ON s.id = ua.shift_id AND ua.user_id = us.user_id
     JOIN users u ON us.user_id = u.id
     WHERE s.date >= date('now') 
       AND us.clock_in IS NULL 
       AND us.user_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM shift_replacements sr 
         WHERE sr.shift_id = s.id 
           AND sr.replacement_user_id = ?
           AND sr.status = 'pending'
       )
       AND NOT EXISTS (
         SELECT 1 FROM user_shifts us2 
         WHERE us2.shift_id = s.id 
           AND us2.user_id = ?
       )
     ORDER BY s.date ASC, s.start_time ASC`,
    [userId, userId, userId],
    (err, shifts) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des shifts', error: err.message });
      }
      
      // Renommer pour clarifier qui est actuellement assigné au shift
      const formattedShifts = shifts.map(shift => ({
        ...shift,
        original_username: shift.current_username, // L'utilisateur actuellement assigné
        original_user_id: shift.current_user_id
      }));
      
      res.json(formattedShifts);
    }
  );
};

// Obtenir les demandes de remplacement en attente (pour managers)
const getPendingReplacements = (req, res) => {
  db.all(
    `SELECT sr.id, sr.shift_id, sr.original_user_id, sr.replacement_user_id, sr.created_at,
            s.title as shift_title, s.date, s.start_time, s.end_time,
            u1.username as original_username, u2.username as replacement_username,
            us.position
     FROM shift_replacements sr 
     JOIN shifts s ON sr.shift_id = s.id 
     JOIN users u1 ON sr.original_user_id = u1.id
     JOIN users u2 ON sr.replacement_user_id = u2.id
     JOIN user_shifts us ON sr.shift_id = us.shift_id AND sr.original_user_id = us.user_id
     WHERE sr.status = 'pending'
     ORDER BY sr.created_at ASC`,
    [],
    (err, replacements) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des demandes', error: err.message });
      }
      
      // Si pas de demandes, retourner un tableau vide
      if (!replacements || replacements.length === 0) {
        return res.json([]);
      }
      
      // Pour chaque demande, récupérer l'équipe du shift
      let processedCount = 0;
      const replacementsWithTeam = [];
      
      replacements.forEach((replacement, index) => {
        // Récupérer tous les membres de l'équipe pour ce shift
        db.all(
          `SELECT us.user_id, us.position, u.username, u.first_name, u.last_name
           FROM user_shifts us
           JOIN users u ON us.user_id = u.id
           WHERE us.shift_id = ?
           ORDER BY us.position, u.username`,
          [replacement.shift_id],
          (err, teamMembers) => {
            if (err) {
              console.error('Erreur lors de la récupération de l\'équipe:', err);
              teamMembers = [];
            }
            
            replacementsWithTeam[index] = {
              ...replacement,
              team_members: teamMembers || []
            };
            
            processedCount++;
            
            // Quand toutes les demandes ont été traitées, envoyer la réponse
            if (processedCount === replacements.length) {
              res.json(replacementsWithTeam);
            }
          }
        );
      });
    }
  );
};

// Approuver ou rejeter une demande de remplacement (managers)
const approveReplacement = (req, res) => {
  const { replacementId } = req.params;
  const { approved } = req.body;
  
  if (!replacementId || approved === undefined) {
    return res.status(400).json({ message: 'ID de remplacement et décision requis' });
  }
  
  // Récupérer les détails de la demande
  db.get(
    `SELECT sr.*, s.title, s.date, s.start_time, s.end_time 
     FROM shift_replacements sr 
     JOIN shifts s ON sr.shift_id = s.id 
     WHERE sr.id = ? AND sr.status = 'pending'`,
    [replacementId],
    (err, replacement) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération de la demande', error: err.message });
      }
      
      if (!replacement) {
        return res.status(404).json({ message: 'Demande de remplacement non trouvée ou déjà traitée' });
      }
      
      if (approved) {
        // Approuver le remplacement
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          try {
            // 1. Mettre à jour le statut de la demande
            db.run(
              'UPDATE shift_replacements SET status = ?, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?',
              ['approved', req.user.id, replacementId]
            );
            
            // 2. Remplacer l'utilisateur dans user_shifts
            db.run(
              'UPDATE user_shifts SET user_id = ? WHERE shift_id = ? AND user_id = ?',
              [replacement.replacement_user_id, replacement.shift_id, replacement.original_user_id]
            );
            
            // 3. Rejeter toutes les autres demandes en attente pour ce même shift
            db.run(
              'UPDATE shift_replacements SET status = ?, rejected_at = CURRENT_TIMESTAMP, rejected_by = ? WHERE shift_id = ? AND original_user_id = ? AND status = \'pending\' AND id != ?',
              ['rejected', req.user.id, replacement.shift_id, replacement.original_user_id, replacementId]
            );
            
            // 4. Supprimer l'indisponibilité
            db.run(
              'DELETE FROM shift_unavailabilities WHERE shift_id = ? AND user_id = ?',
              [replacement.shift_id, replacement.original_user_id]
            );
            
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Erreur lors de l\'approbation', error: err.message });
              }
              
              res.json({ 
                message: 'Remplacement approuvé avec succès',
                replacement: {
                  ...replacement,
                  status: 'approved'
                }
              });
            });
            
          } catch (error) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Erreur lors de l\'approbation', error: error.message });
          }
        });
        
      } else {
        // Rejeter le remplacement - le shift retourne dans les disponibilités
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          try {
            // 1. Mettre à jour le statut de la demande comme rejetée
            db.run(
              'UPDATE shift_replacements SET status = ?, rejected_at = CURRENT_TIMESTAMP, rejected_by = ? WHERE id = ?',
              ['rejected', req.user.id, replacementId]
            );
            
            // 2. Rejeter toutes les autres demandes en attente pour ce même shift
            db.run(
              'UPDATE shift_replacements SET status = ?, rejected_at = CURRENT_TIMESTAMP, rejected_by = ? WHERE shift_id = ? AND original_user_id = ? AND status = \'pending\' AND id != ?',
              ['rejected', req.user.id, replacement.shift_id, replacement.original_user_id, replacementId]
            );
            
            // 3. IMPORTANT: L'indisponibilité (shift_unavailabilities) reste active
            // pour que le shift continue d'être disponible pour d'autres remplaçants
            
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Erreur lors du rejet', error: err.message });
              }
              
              res.json({ 
                message: 'Remplacement rejeté. Le shift est de nouveau disponible pour d\'autres remplaçants.',
                replacement: {
                  ...replacement,
                  status: 'rejected'
                }
              });
            });
            
          } catch (error) {
            db.run('ROLLBACK');
            return res.status(500).json({ message: 'Erreur lors du rejet', error: error.message });
          }
        });
      }
    }
  );
};

// Annuler sa propre indisponibilité
const cancelUnavailability = (req, res) => {
  const { shiftId } = req.params;
  const userId = req.user.id;
  
  // Vérifier que l'indisponibilité existe et appartient à l'utilisateur
  db.get(
    'SELECT * FROM shift_unavailabilities WHERE user_id = ? AND shift_id = ?',
    [userId, shiftId],
    (err, unavailability) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
      }
      
      if (!unavailability) {
        return res.status(404).json({ message: 'Indisponibilité non trouvée' });
      }
      
      // Vérifier qu'aucun remplacement n'a été approuvé
      db.get(
        'SELECT * FROM shift_replacements WHERE shift_id = ? AND original_user_id = ? AND status = \'approved\'',
        [shiftId, userId],
        (err, approvedReplacement) => {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la vérification des remplacements', error: err.message });
          }
          
          if (approvedReplacement) {
            return res.status(400).json({ message: 'Impossible d\'annuler : un remplacement a déjà été approuvé' });
          }
          
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Supprimer l'indisponibilité
            db.run(
              'DELETE FROM shift_unavailabilities WHERE id = ?',
              [unavailability.id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ message: 'Erreur lors de la suppression', error: err.message });
                }
                
                // Rejeter toutes les demandes de remplacement en attente pour ce shift
                db.run(
                  'UPDATE shift_replacements SET status = \'rejected\' WHERE shift_id = ? AND original_user_id = ? AND status = \'pending\'',
                  [shiftId, userId],
                  function(err) {
                    if (err) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ message: 'Erreur lors de la mise à jour des demandes', error: err.message });
                    }
                    
                    db.run('COMMIT', (err) => {
                      if (err) {
                        return res.status(500).json({ message: 'Erreur lors de la validation', error: err.message });
                      }
                      
                      res.json({
                        message: 'Indisponibilité annulée avec succès'
                      });
                    });
                  }
                );
              }
            );
          });
        }
      );
    }
  );
};

// Obtenir les indisponibilités de l'utilisateur courant
const getUserUnavailabilities = (req, res) => {
  const userId = req.user.id;
  
  db.all(
    `SELECT ua.*, s.title, s.date, s.start_time, s.end_time
     FROM shift_unavailabilities ua
     JOIN shifts s ON ua.shift_id = s.id
     JOIN user_shifts us ON ua.shift_id = us.shift_id AND ua.user_id = us.user_id
     WHERE ua.user_id = ?
     ORDER BY s.date ASC`,
    [userId],
    (err, unavailabilities) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des indisponibilités', error: err.message });
      }
      
      res.json(unavailabilities);
    }
  );
};

// Obtenir l'historique complet des remplacements (pour managers)
const getReplacementHistory = (req, res) => {
  db.all(
    `SELECT sr.id, sr.shift_id, sr.original_user_id, sr.replacement_user_id, 
            sr.status, sr.created_at, sr.approved_at, sr.rejected_at,
            s.title as shift_title, s.date, s.start_time, s.end_time,
            u1.username as original_username, u2.username as replacement_username,
            u3.username as approved_by_username, u4.username as rejected_by_username
     FROM shift_replacements sr 
     JOIN shifts s ON sr.shift_id = s.id 
     JOIN users u1 ON sr.original_user_id = u1.id
     JOIN users u2 ON sr.replacement_user_id = u2.id
     LEFT JOIN users u3 ON sr.approved_by = u3.id
     LEFT JOIN users u4 ON sr.rejected_by = u4.id
     WHERE s.date >= date('now', '-30 days')
     ORDER BY sr.created_at DESC`,
    [],
    (err, history) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique', error: err.message });
      }
      
      res.json(history);
    }
  );
};

// Supprimer un remplacement de l'historique (pour managers)
const deleteReplacementFromHistory = (req, res) => {
  const { replacementId } = req.params;
  
  if (!replacementId) {
    return res.status(400).json({ message: 'ID de remplacement requis' });
  }
  
  // Vérifier que le remplacement existe et n'est pas en cours (pending)
  db.get(
    'SELECT * FROM shift_replacements WHERE id = ?',
    [replacementId],
    (err, replacement) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la vérification', error: err.message });
      }
      
      if (!replacement) {
        return res.status(404).json({ message: 'Remplacement non trouvé' });
      }
      
      if (replacement.status === 'pending') {
        return res.status(400).json({ message: 'Impossible de supprimer un remplacement en attente. Veuillez d\'abord le rejeter.' });
      }
      
      // Supprimer le remplacement
      db.run(
        'DELETE FROM shift_replacements WHERE id = ?',
        [replacementId],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Erreur lors de la suppression', error: err.message });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Remplacement non trouvé' });
          }
          
          res.json({ message: 'Remplacement supprimé de l\'historique avec succès' });
        }
      );
    }
  );
};

module.exports = {
  markUnavailable,
  proposeReplacement,
  getAvailableShifts,
  getPendingReplacements,
  approveReplacement,
  cancelUnavailability,
  getUserUnavailabilities,
  getReplacementHistory,
  deleteReplacementFromHistory
}; 