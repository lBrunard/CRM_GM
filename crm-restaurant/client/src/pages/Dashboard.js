import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, timeclockService } from '../services/api';

const Dashboard = () => {
  const { user, hasRole } = useContext(AuthContext);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [unvalidatedHours, setUnvalidatedHours] = useState([]);
  const [shiftColleagues, setShiftColleagues] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [clockInLoading, setClockInLoading] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Récupérer les shifts de l'utilisateur
        if (user) {
          const response = await shiftService.getUserShifts(user.id);
          
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          
          // Filtrer les shifts à venir (aujourd'hui et futurs)
          const upcoming = response.data.filter(shift => 
            shift.date >= today && !shift.clock_out
          );
          
          setUpcomingShifts(upcoming);
          
          // Charger les collègues pour chaque shift à venir
          const colleaguesData = {};
          for (const shift of upcoming) {
            try {
              const personnelResponse = await shiftService.getShiftPersonnel(shift.shift_id);
              const allPersonnel = [
                ...personnelResponse.data.cuisine,
                ...personnelResponse.data.salle,
                ...personnelResponse.data.bar
              ].filter(person => person.user_id !== user.id); // Exclure l'utilisateur actuel
              
              colleaguesData[shift.shift_id] = allPersonnel;
            } catch (err) {
              console.error(`Erreur lors du chargement du personnel pour le shift ${shift.shift_id}:`, err);
              colleaguesData[shift.shift_id] = [];
            }
          }
          setShiftColleagues(colleaguesData);
          
          // Déterminer si l'utilisateur est actuellement en shift
          const current = upcoming.find(shift => {
            // Si le shift est aujourd'hui et a été commencé mais pas terminé
            return shift.date === today && 
                   shift.clock_in && 
                   !shift.clock_out;
          });
          
          setCurrentShift(current || null);
          
          // Pour les responsables et managers, récupérer les heures non validées
          if (hasRole(['responsable', 'manager'])) {
            const unvalidatedResponse = await timeclockService.getUnvalidatedHours();
            setUnvalidatedHours(unvalidatedResponse.data);
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement des données:', err);
        setError('Impossible de charger les données du tableau de bord');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [user, hasRole]);

  const handleClockIn = async (shiftId) => {
    try {
      setClockInLoading(true);
      
      await timeclockService.clockIn({
        userId: user.id,
        shiftId
      });
      
      // Recharger les données
      window.location.reload();
    } catch (err) {
      console.error('Erreur lors du pointage d\'entrée:', err);
      setError(err.response?.data?.message || 'Erreur lors du pointage d\'entrée');
    } finally {
      setClockInLoading(false);
    }
  };

  const handleClockOut = async (shiftId) => {
    try {
      setClockOutLoading(true);
      
      await timeclockService.clockOut({
        userId: user.id,
        shiftId
      });
      
      // Recharger les données
      window.location.reload();
    } catch (err) {
      console.error('Erreur lors du pointage de sortie:', err);
      setError(err.response?.data?.message || 'Erreur lors du pointage de sortie');
    } finally {
      setClockOutLoading(false);
    }
  };

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Affichage pendant le chargement
  if (isLoading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-2">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Tableau de bord</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      <div className="row">
        <div className="col-md-8">
          {/* Analytics du user */}
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-primary">{upcomingShifts.length}</h5>
                  <p className="card-text">Shifts à venir</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-success">
                    {upcomingShifts.filter(s => s.validated).length}
                  </h5>
                  <p className="card-text">Heures validées</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-warning">
                    {upcomingShifts.filter(s => s.clock_in && s.clock_out && !s.validated).length}
                  </h5>
                  <p className="card-text">En attente</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center">
                <div className="card-body">
                  <h5 className="card-title text-info">{user?.role}</h5>
                  <p className="card-text">Votre rôle</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Section de pointage pour shift actuel */}
          {currentShift && (
            <div className="alert alert-info mb-4">
              <h5>Vous êtes actuellement en service</h5>
              <p><strong>Shift:</strong> {currentShift.title}</p>
              <p><strong>Début:</strong> {formatTime(currentShift.clock_in)}</p>
              <button 
                className="btn btn-warning"
                onClick={() => handleClockOut(currentShift.shift_id)}
                disabled={clockOutLoading}
              >
                {clockOutLoading ? 'Pointage en cours...' : 'Pointer la sortie'}
              </button>
            </div>
          )}
          
          {/* Liste des shifts à venir */}
          <div className="card">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">Mes prochains shifts</h5>
            </div>
            <div className="card-body">
              {upcomingShifts.length === 0 ? (
                <p>Aucun shift planifié prochainement.</p>
              ) : (
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Date</th>
                      <th>Horaires</th>
                      <th>Poste</th>
                      <th>Collègues</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingShifts.map(shift => (
                      <tr key={shift.user_shift_id}>
                        <td>{shift.title}</td>
                        <td>{new Date(shift.date).toLocaleDateString()}</td>
                        <td>{shift.start_time} - {shift.end_time}</td>
                        <td>
                          <span className={`badge ${
                            shift.position === 'cuisine' ? 'bg-danger' :
                            shift.position === 'salle' ? 'bg-primary' :
                            shift.position === 'bar' ? 'bg-warning' :
                            'bg-secondary'
                          }`}>
                            {shift.position === 'cuisine' ? 'Cuisine' :
                             shift.position === 'salle' ? 'Salle' : 
                             shift.position === 'bar' ? 'Bar' : 
                             'Non défini'}
                          </span>
                        </td>
                        <td>
                          {shiftColleagues[shift.shift_id] && shiftColleagues[shift.shift_id].length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {shiftColleagues[shift.shift_id].map(colleague => (
                                <span 
                                  key={colleague.user_id}
                                  className={`badge ${
                                    colleague.position === 'cuisine' ? 'bg-danger' :
                                    colleague.position === 'salle' ? 'bg-primary' :
                                    colleague.position === 'bar' ? 'bg-warning' :
                                    'bg-secondary'
                                  }`}
                                  title={`${colleague.username} - ${colleague.position}`}
                                >
                                  {colleague.username}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <small className="text-muted">Aucun collègue</small>
                          )}
                        </td>
                        <td>
                          {!shift.clock_in && (
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleClockIn(shift.shift_id)}
                              disabled={clockInLoading}
                            >
                              {clockInLoading ? '...' : 'Pointer l\'entrée'}
                            </button>
                          )}
                          {shift.clock_in && !shift.clock_out && (
                            <button 
                              className="btn btn-sm btn-warning"
                              onClick={() => handleClockOut(shift.shift_id)}
                              disabled={clockOutLoading}
                            >
                              {clockOutLoading ? '...' : 'Pointer la sortie'}
                            </button>
                          )}
                          {shift.clock_in && shift.clock_out && !shift.validated && (
                            <span className="badge bg-secondary">En attente de validation</span>
                          )}
                          {shift.clock_in && shift.clock_out && shift.validated && (
                            <span className="badge bg-success">Validé</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        
        {/* Section pour responsables et managers */}
        {hasRole(['responsable', 'manager']) && (
          <div className="col-md-4">
            <div className="card">
              <div className="card-header bg-warning">
                <h5 className="mb-0">Heures à valider</h5>
              </div>
              <div className="card-body">
                {unvalidatedHours.length === 0 ? (
                  <p>Aucune heure en attente de validation.</p>
                ) : (
                  <div>
                    <p>Il y a <strong>{unvalidatedHours.length}</strong> pointages à valider.</p>
                    <div className="list-group mb-3">
                      {unvalidatedHours.slice(0, 3).map(hour => (
                        <div key={hour.id} className="list-group-item list-group-item-action">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">{hour.username}</h6>
                            <small>{new Date(hour.date).toLocaleDateString()}</small>
                          </div>
                          <p className="mb-1">{hour.title}</p>
                          <small>{new Date(hour.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(hour.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                        </div>
                      ))}
                      {unvalidatedHours.length > 3 && (
                        <div className="list-group-item text-muted text-center">
                          ... et {unvalidatedHours.length - 3} autres pointages
                        </div>
                      )}
                    </div>
                    <a href="/validate" className="btn btn-warning w-100">
                      Aller à la page de validation
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 