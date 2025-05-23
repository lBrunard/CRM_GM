import { useState, useEffect, useContext, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import fr from 'date-fns/locale/fr';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { shiftService, timeclockService, userService } from '../services/api';
import * as Excel from 'exceljs';
import { saveAs } from 'file-saver';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { formatDistanceToNow } from 'date-fns';
import { frCA } from 'date-fns/locale';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/calendar.css';

// Configuration de la localisation pour le calendrier
const locales = {
  'fr': fr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Messages traduits pour le calendrier
const messages = {
  allDay: 'Journée',
  previous: 'Précédent',
  next: 'Suivant',
  today: "Aujourd'hui",
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  agenda: 'Planning',
  date: 'Date',
  time: 'Heure',
  event: 'Événement',
  noEventsInRange: 'Aucun shift sur cette période',
};

const ShiftCalendar = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // État pour la modal de détail de shift
  const [showDetails, setShowDetails] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);

  // États pour l'édition des shifts
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showSalaries, setShowSalaries] = useState(false);
  const [shiftSalaries, setShiftSalaries] = useState([]);

  // Vérifier que seuls les responsables et managers ont accès à cette page
  useEffect(() => {
    if (!hasRole(['responsable', 'manager', 'personnel'])) {
      navigate('/unauthorized');
      return;
    }
    
    // Initialiser les dates par défaut (mois en cours)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setStartDate(format(firstDayOfMonth, 'yyyy-MM-dd'));
    setEndDate(format(lastDayOfMonth, 'yyyy-MM-dd'));
    
    loadAllShifts();
  }, [hasRole, navigate]);

  // Charger tous les shifts avec leur statut de validation
  const loadAllShifts = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Récupérer tous les shifts selon le rôle
      let shiftsResponse;
      if (hasRole(['manager', 'responsable'])) {
        // Managers et responsables voient tous les shifts
        shiftsResponse = await shiftService.getAllShifts();
      } else {
        // Le personnel ne voit que ses propres shifts
        shiftsResponse = await shiftService.getUserShifts(user.id);
        // Convertir le format pour être compatible avec getAllShifts
        const userShifts = shiftsResponse.data;
        const uniqueShifts = userShifts.reduce((acc, userShift) => {
          const existingShift = acc.find(s => s.id === userShift.shift_id);
          if (!existingShift) {
            acc.push({
              id: userShift.shift_id,
              title: userShift.title,
              date: userShift.date,
              start_time: userShift.start_time,
              end_time: userShift.end_time
            });
          }
          return acc;
        }, []);
        shiftsResponse = { data: uniqueShifts };
      }
      
      const allShifts = shiftsResponse.data;
      
      // Pour chaque shift, récupérer les utilisateurs assignés et leur statut
      const shiftsWithUsers = await Promise.all(
        allShifts.map(async (shift) => {
          try {
            // Récupérer le personnel assigné à ce shift
            const personnelResponse = await shiftService.getShiftPersonnel(shift.id);
            
            // Récupérer les données détaillées des user_shifts pour ce shift (pour validation et heures)
            const userShiftsResponse = await shiftService.getShiftDetails(shift.id);
            const userShifts = userShiftsResponse.data;
            
            // Déterminer le statut global de validation du shift
            const now = new Date();
            const shiftDate = new Date(shift.date);
            const [endHour, endMinute] = shift.end_time.split(':').map(Number);
            const shiftEndTime = new Date(shiftDate);
            shiftEndTime.setHours(endHour, endMinute, 0, 0);
            
            // Le shift est-il passé?
            const isPastShift = now > shiftEndTime;
            
            // Statut de validation:
            // Si tous les user_shifts sont validés -> "validated"
            // Si pas tous validés mais le shift est passé -> "pending"
            // Si le shift n'est pas encore terminé -> "upcoming"
            let validationStatus = "upcoming";
            
            if (isPastShift) {
              const allValidated = userShifts.every(us => us.validated);
              validationStatus = allValidated ? "validated" : "pending";
            }
            
            // Fusionner les données du personnel avec leurs heures de pointage
            const personnelWithHours = {
              cuisine: personnelResponse.data.cuisine.map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              salle: personnelResponse.data.salle.map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              bar: personnelResponse.data.bar.map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              })
            };
            
            return {
              ...shift,
              personnel: personnelWithHours,
              validationStatus,
              userShifts
            };
          } catch (err) {
            console.error(`Erreur lors de la récupération du personnel pour le shift ${shift.id}:`, err);
            return {
              ...shift,
              personnel: { cuisine: [], salle: [], bar: [] },
              validationStatus: "error",
              userShifts: []
            };
          }
        })
      );
      
      setShifts(shiftsWithUsers);
      
      // Charger la liste des utilisateurs pour l'édition (managers seulement)
      if (hasRole(['manager'])) {
        try {
          const usersResponse = await userService.getAllUsers();
          setAllUsers(usersResponse.data);
        } catch (err) {
          console.error('Erreur lors du chargement des utilisateurs:', err);
        }
      }
    } catch (err) {
      console.error('Erreur lors du chargement des shifts:', err);
      setError('Impossible de charger les shifts');
    } finally {
      setLoading(false);
    }
  };

  // Transformer les shifts pour l'affichage dans le calendrier
  const calendarEvents = useMemo(() => {
    // Grouper les shifts par date
    const shiftsByDate = shifts.reduce((acc, shift) => {
      const date = shift.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(shift);
      return acc;
    }, {});

    // Créer un événement par jour contenant tous les shifts
    return Object.entries(shiftsByDate).map(([date, dayShifts]) => {
      const [year, month, day] = date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      
      // Compter le personnel total de tous les shifts de la journée
      const totalCuisine = dayShifts.reduce((sum, shift) => sum + (shift.personnel?.cuisine?.length || 0), 0);
      const totalSalle = dayShifts.reduce((sum, shift) => sum + (shift.personnel?.salle?.length || 0), 0);
      const totalBar = dayShifts.reduce((sum, shift) => sum + (shift.personnel?.bar?.length || 0), 0);
      
      // Déterminer le statut global de la journée
      const hasValidated = dayShifts.some(s => s.validationStatus === 'validated');
      const hasPending = dayShifts.some(s => s.validationStatus === 'pending');
      const hasUpcoming = dayShifts.some(s => s.validationStatus === 'upcoming');
      
      let globalStatus = 'upcoming';
      if (hasValidated && !hasPending) {
        globalStatus = 'validated';
      } else if (hasPending) {
        globalStatus = 'pending';
      }
      
      return {
        id: `day-${date}`,
        title: `${dayShifts.length} shift${dayShifts.length > 1 ? 's' : ''}`,
        start: eventDate,
        end: eventDate,
        allDay: true,
        cuisineCount: totalCuisine,
        salleCount: totalSalle,
        barCount: totalBar,
        validationStatus: globalStatus,
        shifts: dayShifts, // Garder tous les shifts pour la modal
        date: date
      };
    });
  }, [shifts]);

  // Gérer le clic sur un événement
  const handleEventClick = (event) => {
    setSelectedShift(event);
    setShowDetails(true);
  };

  // Fermer la modal de détails
  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  // Formater les données pour l'export Excel
  const formatShiftsForExport = (shiftsToExport) => {
    return shiftsToExport.map(shift => {
      // Liste des employés par catégorie
      const cuisineStaff = shift.personnel?.cuisine?.map(p => p.username).join(', ') || '';
      const salleStaff = shift.personnel?.salle?.map(p => p.username).join(', ') || '';
      const barStaff = shift.personnel?.bar?.map(p => p.username).join(', ') || '';
      
      return {
        Date: shift.date,
        Titre: shift.title,
        Début: shift.start_time,
        Fin: shift.end_time,
        Cuisine: cuisineStaff,
        Salle: salleStaff,
        Bar: barStaff,
        Status: shift.validationStatus === 'validated' ? 'Validé' : 
                shift.validationStatus === 'pending' ? 'En attente' : 'À venir'
      };
    });
  };

  // Exporter les shifts en fichier Excel
  const exportToExcel = async () => {
    if (!hasRole(['manager'])) {
      alert('Seuls les managers peuvent exporter les données');
      return;
    }
    
    try {
      // Filtrer les shifts selon la période sélectionnée
      const filteredShifts = shifts.filter(shift => {
        return shift.date >= startDate && shift.date <= endDate;
      });
      
      if (filteredShifts.length === 0) {
        alert('Aucun shift sur cette période');
        return;
      }
      
      // Formater les données
      const data = formatShiftsForExport(filteredShifts);
      
      // Créer un nouveau classeur Excel
      const workbook = new Excel.Workbook();
      const worksheet = workbook.addWorksheet('Shifts');
      
      // Ajouter les en-têtes
      worksheet.columns = [
        { header: 'Date', key: 'Date', width: 15 },
        { header: 'Titre', key: 'Titre', width: 20 },
        { header: 'Horaire début', key: 'Début', width: 15 },
        { header: 'Horaire fin', key: 'Fin', width: 15 },
        { header: 'Personnel cuisine', key: 'Cuisine', width: 30 },
        { header: 'Personnel salle', key: 'Salle', width: 30 },
        { header: 'Personnel bar', key: 'Bar', width: 30 },
        { header: 'Statut', key: 'Status', width: 15 }
      ];
      
      // Appliquer un style aux en-têtes
      worksheet.getRow(1).font = { bold: true };
      
      // Ajouter les données
      worksheet.addRows(data);
      
      // Générer le fichier Excel
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `shifts_${startDate}_${endDate}.xlsx`);
      
    } catch (err) {
      console.error('Erreur lors de l\'export Excel:', err);
      alert('Erreur lors de la génération du fichier Excel');
    }
  };

  // Personnaliser l'affichage des événements du calendrier selon le statut
  const eventStyleGetter = (event) => {
    let backgroundColor;
    
    switch (event.validationStatus) {
      case 'validated':
        backgroundColor = '#28a745'; // Vert pour validé
        break;
      case 'pending':
        backgroundColor = '#fd7e14'; // Orange pour en attente de validation
        break;
      case 'upcoming':
        backgroundColor = '#0d6efd'; // Bleu pour à venir
        break;
      default:
        backgroundColor = '#6c757d'; // Gris par défaut
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        color: 'white',
        border: 'none',
        display: 'block',
        cursor: 'pointer' // Indique que l'événement est cliquable
      }
    };
  };

  // Formatter un timestamp pour affichage
  const formatTimeStamp = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Contenu à afficher au survol d'un événement
  const EventTooltip = ({ event }) => {
    return (
      <div style={{ cursor: 'pointer' }}>
        <strong>{event.title}</strong>
        <p>
          {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
        </p>
        <p>
          Cuisine: {event.cuisineCount} | 
          Salle: {event.salleCount} | 
          Bar: {event.barCount}
        </p>
      </div>
    );
  };

  // Composant pour la fenêtre modale de détails du shift
  const ShiftDetailsModal = () => {
    if (!selectedShift) return null;
    
    const [year, month, day] = selectedShift.date.split('-').map(Number);
    const shiftDate = new Date(year, month - 1, day);
    
    return (
      <Modal show={showDetails} onHide={handleCloseDetails} size="xl" className="shift-details-modal">
        <Modal.Header closeButton>
          <Modal.Title>Shifts du {format(shiftDate, 'd MMMM yyyy', { locale: fr })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedShift.shifts.map((shift, index) => (
            <div key={shift.id} className={`mb-4 ${index < selectedShift.shifts.length - 1 ? 'border-bottom pb-4' : ''}`}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>{shift.title}</h5>
                <div className="d-flex gap-2">
                  <span className="badge bg-primary">
                    {shift.start_time} - {shift.end_time}
                  </span>
                  <span className={`badge ${
                    shift.validationStatus === 'validated' ? 'bg-success' : 
                    shift.validationStatus === 'pending' ? 'bg-warning' :
                    'bg-primary'
                  }`}>
                    {shift.validationStatus === 'validated' ? 'Validé' : 
                     shift.validationStatus === 'pending' ? 'En attente' : 
                     'À venir'}
                  </span>
                </div>
              </div>
              
              <div className="row">
                {/* Personnel de cuisine */}
                <div className="col-md-4">
                  <h6 className="border-bottom pb-1">Personnel de cuisine</h6>
                  {shift.personnel.cuisine.length === 0 ? (
                    <p className="text-muted small">Aucun personnel assigné</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Entrée</th>
                            <th>Sortie</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.cuisine.map(person => (
                            <tr key={`cuisine-${person.user_id}-${shift.id}`}>
                              <td>{person.username}</td>
                              <td>{formatTimeStamp(person.clock_in)}</td>
                              <td>{formatTimeStamp(person.clock_out)}</td>
                              <td>
                                {person.validated ? (
                                  <span className="badge bg-success">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="badge bg-warning">En attente</span>
                                ) : (
                                  <span className="badge bg-secondary">Non pointé</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Personnel de salle */}
                <div className="col-md-4">
                  <h6 className="border-bottom pb-1">Personnel de salle</h6>
                  {shift.personnel.salle.length === 0 ? (
                    <p className="text-muted small">Aucun personnel assigné</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Entrée</th>
                            <th>Sortie</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.salle.map(person => (
                            <tr key={`salle-${person.user_id}-${shift.id}`}>
                              <td>{person.username}</td>
                              <td>{formatTimeStamp(person.clock_in)}</td>
                              <td>{formatTimeStamp(person.clock_out)}</td>
                              <td>
                                {person.validated ? (
                                  <span className="badge bg-success">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="badge bg-warning">En attente</span>
                                ) : (
                                  <span className="badge bg-secondary">Non pointé</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Personnel de bar */}
                <div className="col-md-4">
                  <h6 className="border-bottom pb-1">Personnel de bar</h6>
                  {shift.personnel.bar.length === 0 ? (
                    <p className="text-muted small">Aucun personnel assigné</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Entrée</th>
                            <th>Sortie</th>
                            <th>Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.bar.map(person => (
                            <tr key={`bar-${person.user_id}-${shift.id}`}>
                              <td>{person.username}</td>
                              <td>{formatTimeStamp(person.clock_in)}</td>
                              <td>{formatTimeStamp(person.clock_out)}</td>
                              <td>
                                {person.validated ? (
                                  <span className="badge bg-success">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="badge bg-warning">En attente</span>
                                ) : (
                                  <span className="badge bg-secondary">Non pointé</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions pour ce shift spécifique */}
              {hasRole(['manager']) && (
                <div className="mt-3 d-flex gap-2">
                  <Button 
                    variant="info" 
                    size="sm"
                    onClick={() => loadShiftSalaries(shift.id)}
                  >
                    Voir salaires
                  </Button>
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={() => startEditingShift(shift)}
                  >
                    Modifier personnel
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => deleteShift(shift.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDetails}>
            Fermer
          </Button>
          
          <div className="d-flex gap-2">
            {selectedShift.validationStatus === 'pending' && hasRole(['responsable', 'manager']) && (
              <Button variant="warning" onClick={() => navigate('/validate')}>
                Validation en attente
              </Button>
            )}
            {hasRole(['responsable', 'manager']) && (
              <Button variant="primary" onClick={() => navigate('/validate')}>
                Gérer les heures
              </Button>
            )}
          </div>
        </Modal.Footer>
      </Modal>
    );
  };

  // Commencer l'édition d'un shift
  const startEditingShift = (shift) => {
    setEditingShift({
      ...shift,
      personnel: {
        cuisine: [...shift.personnel.cuisine],
        salle: [...shift.personnel.salle],
        bar: [...shift.personnel.bar]
      }
    });
    setShowEditModal(true);
  };

  // Ajouter un utilisateur à une position
  const addUserToPosition = (position, userId) => {
    const user = allUsers.find(u => u.id === parseInt(userId));
    if (!user) return;

    // Vérifier que l'utilisateur n'est pas déjà assigné
    const isAlreadyAssigned = ['cuisine', 'salle', 'bar'].some(pos => 
      editingShift.personnel[pos].some(p => p.user_id === user.id)
    );

    if (isAlreadyAssigned) {
      alert('Cet utilisateur est déjà assigné à ce shift');
      return;
    }

    setEditingShift({
      ...editingShift,
      personnel: {
        ...editingShift.personnel,
        [position]: [...editingShift.personnel[position], { user_id: user.id, username: user.username }]
      }
    });
  };

  // Retirer un utilisateur d'une position
  const removeUserFromPosition = (position, userId) => {
    setEditingShift({
      ...editingShift,
      personnel: {
        ...editingShift.personnel,
        [position]: editingShift.personnel[position].filter(p => p.user_id !== userId)
      }
    });
  };

  // Sauvegarder les modifications du shift
  const saveShiftChanges = async () => {
    try {
      setLoading(true);
      await shiftService.updateShiftPersonnel(editingShift.id, editingShift.personnel);
      setShowEditModal(false);
      setEditingShift(null);
      loadAllShifts(); // Recharger
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Erreur lors de la sauvegarde des modifications');
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un shift
  const deleteShift = async (shiftId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce shift ?')) {
      return;
    }

    try {
      setLoading(true);
      await shiftService.deleteShift(shiftId);
      loadAllShifts(); // Recharger
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression du shift');
    } finally {
      setLoading(false);
    }
  };

  // Charger les salaires d'un shift
  const loadShiftSalaries = async (shiftId) => {
    try {
      const response = await timeclockService.getShiftSalaries(shiftId);
      setShiftSalaries(response.data);
      setShowSalaries(true);
    } catch (err) {
      console.error('Erreur lors du chargement des salaires:', err);
      setError('Erreur lors du chargement des salaires');
    }
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-2">Chargement du calendrier des shifts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      <h1 className="mb-4">Calendrier des shifts</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Calendrier */}
      <div className="card">
        <div className="card-body">
          <div style={{ height: 600 }}>
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              messages={messages}
              culture='fr'
              eventPropGetter={eventStyleGetter}
              tooltipAccessor={null}
              components={{
                event: EventTooltip
              }}
              views={['month', 'week', 'day']}
              onSelectEvent={handleEventClick}
              popup
            />
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="card mb-3">
        <div className="card-body">
          <h6>Légende des couleurs</h6>
          <div className="d-flex flex-wrap gap-3">
            <div>
              <span className="badge bg-success me-2" style={{ width: '20px', height: '20px', display: 'inline-block' }}></span>
              Heures validées
            </div>
            <div>
              <span className="badge bg-warning me-2" style={{ width: '20px', height: '20px', display: 'inline-block' }}></span>
              Heures en attente de validation
            </div>
            <div>
              <span className="badge bg-primary me-2" style={{ width: '20px', height: '20px', display: 'inline-block' }}></span>
              Shift à venir
            </div>
            <div>
              <span className="badge bg-secondary me-2" style={{ width: '20px', height: '20px', display: 'inline-block' }}></span>
              Erreur/Non défini
            </div>
          </div>
          <p className="mt-2 mb-0 small text-muted">Cliquez sur un shift pour voir les détails du personnel</p>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Outils</h5>
        </div>
        <div className="card-body">
          <div className="row">
            {/* Filtre de période pour l'export */}
            <div className="col-md-8">
              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label">Date de début</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label">Date de fin</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            {/* Bouton d'export (uniquement pour les managers) */}
            <div className="col-md-4 d-flex align-items-end">
              {hasRole(['manager']) && (
                <button 
                  className="btn btn-success mt-3"
                  onClick={exportToExcel}
                >
                  <i className="bi bi-file-excel me-2"></i>
                  Exporter en Excel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de détails */}
      <ShiftDetailsModal />
      
      {/* Modal d'édition du personnel (managers seulement) */}
      {showEditModal && editingShift && hasRole(['manager']) && (
        <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Modifier le personnel - {editingShift.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="row">
              {/* Personnel de cuisine */}
              <div className="col-md-4">
                <h6>Cuisine</h6>
                <div className="mb-2">
                  <select 
                    className="form-select form-select-sm"
                    onChange={(e) => e.target.value && addUserToPosition('cuisine', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border p-2" style={{ minHeight: '100px' }}>
                  {editingShift.personnel.cuisine.map(person => (
                    <div key={person.user_id} className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small">{person.username}</span>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => removeUserFromPosition('cuisine', person.user_id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Personnel de salle */}
              <div className="col-md-4">
                <h6>Salle</h6>
                <div className="mb-2">
                  <select 
                    className="form-select form-select-sm"
                    onChange={(e) => e.target.value && addUserToPosition('salle', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border p-2" style={{ minHeight: '100px' }}>
                  {editingShift.personnel.salle.map(person => (
                    <div key={person.user_id} className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small">{person.username}</span>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => removeUserFromPosition('salle', person.user_id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Personnel de bar */}
              <div className="col-md-4">
                <h6>Bar</h6>
                <div className="mb-2">
                  <select 
                    className="form-select form-select-sm"
                    onChange={(e) => e.target.value && addUserToPosition('bar', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border p-2" style={{ minHeight: '100px' }}>
                  {editingShift.personnel.bar.map(person => (
                    <div key={person.user_id} className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small">{person.username}</span>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => removeUserFromPosition('bar', person.user_id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={saveShiftChanges}>
              Sauvegarder
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      
      {/* Modal des salaires */}
      {showSalaries && (
        <Modal show={showSalaries} onHide={() => setShowSalaries(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Calcul des salaires</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {shiftSalaries.length === 0 ? (
              <p>Aucune donnée de salaire disponible pour ce shift.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Position</th>
                      <th>Heures travaillées</th>
                      <th>Taux horaire</th>
                      <th>Salaire</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftSalaries.map((salary, index) => (
                      <tr key={index}>
                        <td>
                          {salary.first_name || salary.last_name 
                            ? `${salary.first_name || ''} ${salary.last_name || ''}`.trim()
                            : salary.username
                          }
                        </td>
                        <td>
                          <span className={`badge ${
                            salary.position === 'cuisine' ? 'bg-danger' : 
                            salary.position === 'salle' ? 'bg-primary' : 'bg-success'
                          }`}>
                            {salary.position}
                          </span>
                        </td>
                        <td>{salary.hours_worked}h</td>
                        <td>
                          {salary.hourly_rate !== undefined ? `${salary.hourly_rate}€/h` : 'Non visible'}
                        </td>
                        <td>
                          <strong>
                            {salary.salary !== undefined ? `${salary.salary}€` : 'Non visible'}
                          </strong>
                        </td>
                        <td>
                          <span className={`badge ${salary.validated ? 'bg-success' : 'bg-warning'}`}>
                            {salary.validated ? 'Validé' : 'En attente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {shiftSalaries.some(s => s.salary !== undefined) && (
                    <tfoot>
                      <tr className="table-info">
                        <td colSpan="4"><strong>Total</strong></td>
                        <td>
                          <strong>
                            {shiftSalaries
                              .filter(s => s.salary !== undefined)
                              .reduce((total, s) => total + s.salary, 0)
                              .toFixed(2)}€
                          </strong>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSalaries(false)}>
              Fermer
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default ShiftCalendar; 