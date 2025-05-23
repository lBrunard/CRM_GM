import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { timeclockService } from '../services/api';
import { useNavigate } from 'react-router-dom';

const ValidateHours = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationLoading, setValidationLoading] = useState(false);
  const [comments, setComments] = useState({});
  const [editingHours, setEditingHours] = useState({});
  const [showValidated, setShowValidated] = useState(false);

  // Vérifier que seuls les responsables et managers ont accès à cette page
  useEffect(() => {
    if (!hasRole(['responsable', 'manager'])) {
      navigate('/unauthorized');
    }
    loadHours();
  }, [hasRole, navigate, showValidated]);

  // Charger les heures selon le rôle et les filtres
  const loadHours = async () => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (user.role === 'manager') {
        // Les managers peuvent voir toutes les heures ou seulement les non validées
        if (showValidated) {
          response = await timeclockService.getAllHours();
        } else {
          response = await timeclockService.getUnvalidatedHours();
        }
      } else {
        // Les responsables ne voient que les shifts auxquels ils participent
        if (showValidated) {
          response = await timeclockService.getResponsableShifts(user.id);
        } else {
          response = await timeclockService.getUnvalidatedHours();
          // Filtrer pour ne garder que les shifts où le responsable est présent
          const responsableShiftsResponse = await timeclockService.getResponsableShifts(user.id);
          const responsableShiftIds = responsableShiftsResponse.data.map(rs => rs.shift_id);
          response.data = response.data.filter(h => responsableShiftIds.includes(h.shift_id));
        }
      }
      
      setHours(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement des heures:', err);
      setError('Impossible de charger les heures');
    } finally {
      setLoading(false);
    }
  };

  // Grouper les heures par date puis par shift
  const groupedHours = hours.reduce((acc, hour) => {
    const date = hour.date;
    const shiftKey = `${hour.shift_id}-${hour.title}`;
    
    if (!acc[date]) {
      acc[date] = {};
    }
    
    if (!acc[date][shiftKey]) {
      acc[date][shiftKey] = {
        shift_id: hour.shift_id,
        title: hour.title,
        date: hour.date,
        start_time: hour.start_time,
        end_time: hour.end_time,
        hours: []
      };
    }
    
    acc[date][shiftKey].hours.push(hour);
    return acc;
  }, {});

  // Trier les dates
  const sortedDates = Object.keys(groupedHours).sort((a, b) => new Date(b) - new Date(a));

  // Gérer la validation des heures
  const handleValidate = async (userShiftId) => {
    try {
      setValidationLoading(true);
      setError('');
      setSuccess('');

      await timeclockService.validateHours({
        userShiftId,
        validatorId: user.id,
        comment: comments[userShiftId] || ''
      });

      setSuccess('Heures validées avec succès');
      
      // Recharger les données
      loadHours();
      
      // Effacer le commentaire validé
      const updatedComments = { ...comments };
      delete updatedComments[userShiftId];
      setComments(updatedComments);
    } catch (err) {
      console.error('Erreur lors de la validation des heures:', err);
      setError(err.response?.data?.message || 'Erreur lors de la validation des heures');
    } finally {
      setValidationLoading(false);
    }
  };

  // Commencer l'édition des heures
  const startEditingHours = (hourId, clockIn, clockOut) => {
    setEditingHours({
      ...editingHours,
      [hourId]: {
        clockIn: formatTimeForInput(clockIn),
        clockOut: formatTimeForInput(clockOut)
      }
    });
  };

  // Annuler l'édition
  const cancelEditingHours = (hourId) => {
    const updated = { ...editingHours };
    delete updated[hourId];
    setEditingHours(updated);
  };

  // Sauvegarder les heures modifiées
  const saveEditedHours = async (hourId) => {
    try {
      setValidationLoading(true);
      setError('');
      setSuccess('');

      const editedData = editingHours[hourId];
      const clockInTimestamp = editedData.clockIn ? new Date(`2000-01-01T${editedData.clockIn}:00`).toISOString() : undefined;
      const clockOutTimestamp = editedData.clockOut ? new Date(`2000-01-01T${editedData.clockOut}:00`).toISOString() : undefined;

      await timeclockService.updateHours({
        userShiftId: hourId,
        clockIn: clockInTimestamp,
        clockOut: clockOutTimestamp,
        validatorId: user.id
      });

      setSuccess('Heures modifiées avec succès');
      
      // Arrêter l'édition
      cancelEditingHours(hourId);
      
      // Recharger les données
      loadHours();
    } catch (err) {
      console.error('Erreur lors de la modification des heures:', err);
      setError(err.response?.data?.message || 'Erreur lors de la modification des heures');
    } finally {
      setValidationLoading(false);
    }
  };

  // Mettre à jour les heures en cours d'édition
  const updateEditingHours = (hourId, field, value) => {
    setEditingHours({
      ...editingHours,
      [hourId]: {
        ...editingHours[hourId],
        [field]: value
      }
    });
  };

  // Mettre à jour le commentaire
  const handleCommentChange = (userShiftId, value) => {
    setComments({
      ...comments,
      [userShiftId]: value
    });
  };

  // Formater une date pour l'affichage
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Formater un horodatage pour l'affichage
  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Formater un horodatage pour l'input time
  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Calculer la durée entre entrée et sortie
  const calculateDuration = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return '-';
    
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diff = end - start;
    
    // Convertir en heures et minutes
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    return `${hours}h${minutes < 10 ? '0' : ''}${minutes}`;
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-2">Chargement des heures à valider...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      <h1 className="mb-4">Validation et modification des heures</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}
      
      {/* Filtres */}
      {user.role === 'manager' && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="form-check form-switch">
              <input 
                className="form-check-input" 
                type="checkbox" 
                id="showValidatedSwitch"
                checked={showValidated}
                onChange={(e) => setShowValidated(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="showValidatedSwitch">
                Afficher aussi les heures déjà validées
              </label>
            </div>
          </div>
        </div>
      )}
      
      {hours.length === 0 ? (
        <div className="alert alert-info">
          {showValidated ? 'Aucune heure trouvée.' : 'Aucune heure en attente de validation.'}
        </div>
      ) : (
        <>
          {sortedDates.map(date => (
            <div key={date} className="mb-4">
              <h4 className="border-bottom pb-2 mb-3">
                {formatDate(date)}
              </h4>
              
              {Object.values(groupedHours[date]).map(shiftGroup => (
                <div key={`${shiftGroup.shift_id}-${shiftGroup.title}`} className="card mb-3">
                  <div className="card-header bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">
                        {shiftGroup.title}
                      </h5>
                      <span className="badge bg-primary">
                        {shiftGroup.start_time} - {shiftGroup.end_time}
                      </span>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr>
                            <th>Employé</th>
                            <th>Pointages</th>
                            <th>Durée</th>
                            <th>Statut</th>
                            <th>Commentaire</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shiftGroup.hours.map(hour => {
                            const isEditing = editingHours[hour.id];
                            
                            return (
                              <tr key={hour.id}>
                                <td>
                                  <strong>{hour.username}</strong>
                                </td>
                                <td>
                                  {isEditing ? (
                                    <div className="d-flex gap-2">
                                      <input 
                                        type="time"
                                        className="form-control form-control-sm"
                                        value={isEditing.clockIn}
                                        onChange={(e) => updateEditingHours(hour.id, 'clockIn', e.target.value)}
                                      />
                                      <span>-</span>
                                      <input 
                                        type="time"
                                        className="form-control form-control-sm"
                                        value={isEditing.clockOut}
                                        onChange={(e) => updateEditingHours(hour.id, 'clockOut', e.target.value)}
                                      />
                                    </div>
                                  ) : (
                                    `${formatTime(hour.clock_in)} - ${formatTime(hour.clock_out)}`
                                  )}
                                </td>
                                <td>
                                  {calculateDuration(hour.clock_in, hour.clock_out)}
                                </td>
                                <td>
                                  <span className={`badge ${hour.validated ? 'bg-success' : 'bg-warning'}`}>
                                    {hour.validated ? 'Validé' : 'En attente'}
                                  </span>
                                </td>
                                <td>
                                  <textarea 
                                    className="form-control form-control-sm"
                                    placeholder="Commentaire optionnel"
                                    value={comments[hour.id] || ''}
                                    onChange={(e) => handleCommentChange(hour.id, e.target.value)}
                                    disabled={isEditing}
                                    rows="1"
                                  />
                                </td>
                                <td>
                                  <div className="btn-group-vertical" role="group">
                                    {isEditing ? (
                                      <>
                                        <button 
                                          className="btn btn-success btn-sm mb-1"
                                          onClick={() => saveEditedHours(hour.id)}
                                          disabled={validationLoading}
                                        >
                                          Sauvegarder
                                        </button>
                                        <button 
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => cancelEditingHours(hour.id)}
                                          disabled={validationLoading}
                                        >
                                          Annuler
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button 
                                          className="btn btn-warning btn-sm mb-1"
                                          onClick={() => startEditingHours(hour.id, hour.clock_in, hour.clock_out)}
                                          disabled={validationLoading}
                                        >
                                          Modifier
                                        </button>
                                        {!hour.validated && (
                                          <button 
                                            className="btn btn-success btn-sm"
                                            onClick={() => handleValidate(hour.id)}
                                            disabled={validationLoading}
                                          >
                                            {validationLoading ? 'En cours...' : 'Valider'}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Actions groupées pour le shift */}
                    <div className="mt-3 border-top pt-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-muted">
                            {shiftGroup.hours.filter(h => h.validated).length} / {shiftGroup.hours.length} validé(s)
                          </small>
                        </div>
                        <div>
                          {shiftGroup.hours.some(h => !h.validated) && (
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                // Valider tous les heures non validées de ce shift
                                shiftGroup.hours
                                  .filter(h => !h.validated)
                                  .forEach(h => handleValidate(h.id));
                              }}
                              disabled={validationLoading}
                            >
                              Valider tout le shift
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
      
      {hours.length > 0 && (
        <div className="mt-3">
          {user.role === 'responsable' && (
            <p><strong>Responsable:</strong> Vous ne pouvez modifier que les shifts auxquels vous participez.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidateHours; 