import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, timeclockService, userService } from '../services/api';
import { Link } from 'react-router-dom';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  CurrencyEuroIcon,
  PlayIcon,
  StopIcon,
  CalendarIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, hasRole } = useContext(AuthContext);
  const [pastShifts, setPastShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [activeClockingShift, setActiveClockingShift] = useState(null);
  const [unvalidatedHours, setUnvalidatedHours] = useState([]);
  const [shiftColleagues, setShiftColleagues] = useState({});
  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [clockInLoading, setClockInLoading] = useState(false);
  const [clockOutLoading, setClockOutLoading] = useState(false);
  const [monthlyShifts, setMonthlyShifts] = useState([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Récupérer les détails de l'utilisateur pour obtenir le salaire horaire
        if (user) {
          const userDetailsResponse = await userService.getCurrentUser();
          setUserDetails(userDetailsResponse.data);

          const response = await shiftService.getUserShifts(user.id);
          
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];
          
          // Filtrer les shifts à venir (aujourd'hui et futurs)
          const upcoming = response.data.filter(shift => 
            shift.date >= today && !shift.clock_out
          );
          
          // Filtrer les shifts passés récents (derniers 7 jours)
          const past = response.data.filter(shift => 
            shift.date >= sevenDaysAgoString && 
            shift.date < today && 
            shift.clock_in && shift.clock_out
          ).sort((a, b) => new Date(b.date) - new Date(a.date)); // Plus récent en premier
          
          // Filtrer les shifts du mois en cours pour les analytics
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const monthlyShifts = response.data.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shiftDate.getMonth() === currentMonth && 
                   shiftDate.getFullYear() === currentYear;
          });
          
          setPastShifts(past);
          setMonthlyShifts(monthlyShifts);
          
          // Trouver le shift actif pour le pointage (10 min avant le début jusqu'à la fin)
          const activeShift = upcoming.find(shift => {
            if (shift.date !== today) return false;
            
            const [year, month, day] = shift.date.split('-').map(Number);
            const [startHour, startMinute] = shift.start_time.split(':').map(Number);
            const [endHour, endMinute] = shift.end_time.split(':').map(Number);
            
            const shiftStartTime = new Date(year, month - 1, day, startHour, startMinute);
            const shiftEndTime = new Date(year, month - 1, day, endHour, endMinute);
            
            // Si l'heure de fin est inférieure à celle de début, c'est le lendemain
            if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
              shiftEndTime.setDate(shiftEndTime.getDate() + 1);
            }
            
            const tenMinutesBefore = new Date(shiftStartTime.getTime() - 10 * 60 * 1000); // 10 minutes avant
            
            // Activer la box 10 minutes avant le début jusqu'à la fin du shift
            return now >= tenMinutesBefore && now <= shiftEndTime;
          });
          
          setActiveClockingShift(activeShift || null);
          
          // Charger les collègues pour les shifts du mois
          const colleaguesData = {};
          for (const shift of monthlyShifts) {
            try {
              const personnelResponse = await shiftService.getShiftPersonnel(shift.shift_id);
              const allPersonnel = [
                ...(personnelResponse.data?.cuisine || []),
                ...(personnelResponse.data?.salle || []),
                ...(personnelResponse.data?.bar || [])
              ].filter(person => person.user_id !== user.id); // Exclure l'utilisateur actuel
              
              colleaguesData[shift.shift_id] = allPersonnel;
            } catch (err) {
              console.error(`Erreur lors du chargement du personnel pour le shift ${shift.shift_id}:`, err);
              colleaguesData[shift.shift_id] = [];
            }
          }
          setShiftColleagues(colleaguesData);
          
          // Déterminer si l'utilisateur est actuellement en shift (pour les stats)
          const current = activeShift && activeShift.clock_in && !activeShift.clock_out ? activeShift : null;
          setCurrentShift(current);
          
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

  // Formater la date avec le jour de la semaine
  const formatDateWithDay = (dateString) => {
    const date = new Date(dateString);
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  // Obtenir le statut de pointage pour la box active
  const getClockingStatus = (shift) => {
    const now = new Date();
    const [year, month, day] = shift.date.split('-').map(Number);
    const [startHour, startMinute] = shift.start_time.split(':').map(Number);
    const shiftStartTime = new Date(year, month - 1, day, startHour, startMinute);
    
    const diffToStart = shiftStartTime - now;
    const minutesToStart = Math.floor(diffToStart / (1000 * 60));
    
    if (shift.clock_in && !shift.clock_out) {
      return 'in_progress';
    } else if (!shift.clock_in && minutesToStart > 0) {
      return `starts_in_${minutesToStart}`;
    } else if (!shift.clock_in && minutesToStart <= 0) {
      return 'can_start';
    }
    
    return 'unknown';
  };

  // Affichage pendant le chargement
  if (isLoading) {
    return (
      <div className="mx-auto max-w-md">
        <div className="text-center py-12">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tableau de bord</h1>
        <p className="text-muted-foreground">Bienvenue, {user?.username}</p>
      </div>
      
      {error && (
        <div className="alert-hero alert-hero-destructive mb-6">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <div className="alert-hero-description">{error}</div>
        </div>
      )}

      {/* Box de pointage active */}
      {activeClockingShift && (
        <div className="mb-6">
          <div className="card-hero border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg">
            <div className="card-hero-content">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <ClockIcon className="h-6 w-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {activeClockingShift.title}
                    </h3>
                    <span className={`badge-hero ${
                      activeClockingShift.position === 'cuisine' ? 'cuisine-badge' :
                      activeClockingShift.position === 'salle' ? 'salle-badge' :
                      activeClockingShift.position === 'bar' ? 'bar-badge' :
                      'badge-hero-secondary'
                    }`}>
                      {activeClockingShift.position === 'cuisine' ? 'Cuisine' :
                       activeClockingShift.position === 'salle' ? 'Salle' : 
                       activeClockingShift.position === 'bar' ? 'Bar' : 
                       'Non défini'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span>📅 {formatDateWithDay(activeClockingShift.date)}</span>
                    <span>⏰ {activeClockingShift.start_time} - {activeClockingShift.end_time}</span>
                    {activeClockingShift.clock_in && (
                      <span className="text-green-600 font-medium">
                        ✅ Pointé à {formatTime(activeClockingShift.clock_in)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  {!activeClockingShift.clock_in ? (
                    <button 
                      className="btn-hero-primary btn-hero-lg px-8"
                      onClick={() => handleClockIn(activeClockingShift.shift_id)}
                      disabled={clockInLoading}
                    >
                      {clockInLoading ? (
                        <>
                          <div className="loading-spinner h-5 w-5 mr-2"></div>
                          Pointage...
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-5 w-5 mr-2" />
                          Pointer l'entrée
                        </>
                      )}
                    </button>
                  ) : !activeClockingShift.clock_out ? (
                    <button 
                      className="btn-hero bg-warning-500 hover:bg-warning-600 text-white btn-hero-lg px-8"
                      onClick={() => handleClockOut(activeClockingShift.shift_id)}
                      disabled={clockOutLoading}
                    >
                      {clockOutLoading ? (
                        <>
                          <div className="loading-spinner h-5 w-5 mr-2"></div>
                          Pointage...
                        </>
                      ) : (
                        <>
                          <StopIcon className="h-5 w-5 mr-2" />
                          Pointer la sortie
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center text-green-600 font-medium">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Shift terminé
                    </div>
                  )}
                </div>
              </div>
              
              {/* Informations de statut */}
              <div className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {(() => {
                  const status = getClockingStatus(activeClockingShift);
                  if (status === 'in_progress') {
                    return (
                      <div className="flex items-center text-orange-600">
                        <ClockIcon className="h-4 w-4 mr-2" />
                        Shift en cours depuis {formatTime(activeClockingShift.clock_in)}
                      </div>
                    );
                  } else if (status.startsWith('starts_in_')) {
                    const minutes = status.split('_')[2];
                    return (
                      <div className="flex items-center text-blue-600">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Shift commence dans {minutes} minute{minutes > 1 ? 's' : ''}
                      </div>
                    );
                  } else if (status === 'can_start') {
                    return (
                      <div className="flex items-center text-green-600">
                        <PlayIcon className="h-4 w-4 mr-2" />
                        Vous pouvez maintenant pointer votre entrée
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Analytics du user */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="stat-value text-primary-600">{monthlyShifts.length}</div>
              <div className="stat-label">
                <ClockIcon className="h-4 w-4 inline mr-1" />
                Shifts ce mois
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-success-600">
                {monthlyShifts.filter(s => s.validated).length}
              </div>
              <div className="stat-label">
                <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                Heures validées
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-warning-600">
                {hasRole(['responsable', 'manager']) ? 
                  monthlyShifts.filter(s => s.clock_in && s.clock_out && !s.validated).length :
                  (() => {
                    // Calculer les heures prévues pour le mois
                    const totalPlannedHours = monthlyShifts.reduce((total, shift) => {
                      const [startHour, startMinute] = shift.start_time.split(':').map(Number);
                      const [endHour, endMinute] = shift.end_time.split(':').map(Number);
                      
                      let startTime = startHour + startMinute / 60;
                      let endTime = endHour + endMinute / 60;
                      
                      // Si l'heure de fin est inférieure à celle de début, c'est le lendemain
                      if (endTime < startTime) {
                        endTime += 24;
                      }
                      
                      return total + (endTime - startTime);
                    }, 0);
                    
                    return Math.round(totalPlannedHours);
                  })()
                }
              </div>
              <div className="stat-label">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                {hasRole(['responsable', 'manager']) ? 'En attente' : 'Heures prévues'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-info-600">
                {(() => {
                  if (!userDetails?.hourly_rate) return 'Non défini';
                  
                  // Calculer le salaire estimé basé sur les heures réellement travaillées
                  const totalWorkedHours = monthlyShifts.reduce((total, shift) => {
                    // Si le shift est terminé (clock_in et clock_out existent), calculer les heures réelles
                    if (shift.clock_in && shift.clock_out) {
                      const clockIn = new Date(shift.clock_in);
                      const clockOut = new Date(shift.clock_out);
                      const actualHours = (clockOut - clockIn) / (1000 * 60 * 60);
                      return total + actualHours;
                    }
                    
                    // Si le shift est en cours (clock_in mais pas clock_out), calculer depuis le début
                    if (shift.clock_in && !shift.clock_out) {
                      const clockIn = new Date(shift.clock_in);
                      const now = new Date();
                      const hoursWorkedSoFar = (now - clockIn) / (1000 * 60 * 60);
                      return total + Math.max(0, hoursWorkedSoFar);
                    }
                    
                    // Si le shift n'a pas commencé, estimer avec les heures théoriques
                    if (!shift.clock_in) {
                      const [startHour, startMinute] = shift.start_time.split(':').map(Number);
                      const [endHour, endMinute] = shift.end_time.split(':').map(Number);
                      
                      let startTime = startHour + startMinute / 60;
                      let endTime = endHour + endMinute / 60;
                      
                      // Si l'heure de fin est inférieure à celle de début, c'est le lendemain
                      if (endTime < startTime) {
                        endTime += 24;
                      }
                      
                      return total + (endTime - startTime);
                    }
                    
                    return total;
                  }, 0);
                  
                  const estimatedEarnings = Math.round(totalWorkedHours * userDetails.hourly_rate);
                  return `${estimatedEarnings}€`;
                })()}
              </div>
              <div className="stat-label">
                <CurrencyEuroIcon className="h-4 w-4 inline mr-1" />
                Salaire estimé
              </div>
            </div>
          </div>

          {/* Liste des shifts à venir */}
          <div className="card-hero">
            <div className="card-hero-header bg-primary-600 text-white rounded-t-lg">
              <h3 className="card-hero-title text-white">
                <CalendarIcon className="h-5 w-5 inline mr-2" />
                Prochains shifts
              </h3>
            </div>
            <div className="card-hero-content">
              {monthlyShifts.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun shift planifié prochainement.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Vue desktop - table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-medium">Titre</th>
                          <th className="text-left py-3 px-4 font-medium">Date</th>
                          <th className="text-left py-3 px-4 font-medium">Horaires</th>
                          <th className="text-left py-3 px-4 font-medium">Poste</th>
                          <th className="text-left py-3 px-4 font-medium">Collègues</th>
                          <th className="text-left py-3 px-4 font-medium">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyShifts.map(shift => (
                          <tr key={shift.user_shift_id} className="border-b border-border hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{shift.title}</td>
                            <td className="py-3 px-4">{formatDateWithDay(shift.date)}</td>
                            <td className="py-3 px-4">
                              <span className="text-sm">{shift.start_time} - {shift.end_time}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`badge-hero ${
                                shift.position === 'cuisine' ? 'cuisine-badge' :
                                shift.position === 'salle' ? 'salle-badge' :
                                shift.position === 'bar' ? 'bar-badge' :
                                'badge-hero-secondary'
                              }`}>
                                {shift.position === 'cuisine' ? 'Cuisine' :
                                 shift.position === 'salle' ? 'Salle' : 
                                 shift.position === 'bar' ? 'Bar' : 
                                 'Non défini'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {shiftColleagues[shift.shift_id] && shiftColleagues[shift.shift_id].length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {shiftColleagues[shift.shift_id].map(colleague => (
                                    <span 
                                      key={colleague.user_id}
                                      className={`badge-hero text-xs ${
                                        colleague.position === 'cuisine' ? 'cuisine-badge' :
                                        colleague.position === 'salle' ? 'salle-badge' :
                                        colleague.position === 'bar' ? 'bar-badge' :
                                        'badge-hero-secondary'
                                      }`}
                                      title={`${colleague.username} - ${colleague.position}`}
                                    >
                                      {colleague.username}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Aucun collègue</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {!shift.clock_in && !shift.clock_out && (
                                <span className="badge-hero-secondary">
                                  <CalendarIcon className="h-3 w-3 mr-1" />
                                  Planifié
                                </span>
                              )}
                              {shift.clock_in && !shift.clock_out && (
                                <span className="badge-hero bg-warning-500 text-white">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  En cours
                                </span>
                              )}
                              {shift.clock_in && shift.clock_out && !shift.validated && (
                                <span className="badge-hero-secondary">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  En attente
                                </span>
                              )}
                              {shift.clock_in && shift.clock_out && shift.validated && (
                                <span className="badge-hero bg-success-500 text-white">
                                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                                  Validé
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vue mobile - cards */}
                  <div className="md:hidden space-y-4">
                    {monthlyShifts.map(shift => (
                      <div key={shift.user_shift_id} className="mobile-card-hero">
                        <div className="mobile-card-hero-header">
                          <span className="font-semibold">{shift.title}</span>
                          <span className={`badge-hero ${
                            shift.position === 'cuisine' ? 'cuisine-badge' :
                            shift.position === 'salle' ? 'salle-badge' :
                            shift.position === 'bar' ? 'bar-badge' :
                            'badge-hero-secondary'
                          }`}>
                            {shift.position === 'cuisine' ? 'Cuisine' :
                             shift.position === 'salle' ? 'Salle' : 
                             shift.position === 'bar' ? 'Bar' : 
                             'Non défini'}
                          </span>
                        </div>
                        <div className="mobile-card-hero-body">
                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">
                              <CalendarIcon className="h-4 w-4 inline mr-1" />
                              Date
                            </span>
                            <span>{formatDateWithDay(shift.date)}</span>
                          </div>
                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              Horaires
                            </span>
                            <span>{shift.start_time} - {shift.end_time}</span>
                          </div>
                          {shiftColleagues[shift.shift_id] && shiftColleagues[shift.shift_id].length > 0 && (
                            <div className="mobile-card-hero-row">
                              <span className="text-muted-foreground">
                                <UsersIcon className="h-4 w-4 inline mr-1" />
                                
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {shiftColleagues[shift.shift_id].map(colleague => (
                                  <span 
                                    key={colleague.user_id}
                                    className={`badge-hero text-xs ${
                                      colleague.position === 'cuisine' ? 'cuisine-badge' :
                                      colleague.position === 'salle' ? 'salle-badge' :
                                      colleague.position === 'bar' ? 'bar-badge' :
                                      'badge-hero-secondary'
                                    }`}
                                    title={`${colleague.username} - ${colleague.position}`}
                                  >
                                    {colleague.username}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">Statut</span>
                            <div>
                              {!shift.clock_in && !shift.clock_out && (
                                <span className="badge-hero-secondary">
                                  <CalendarIcon className="h-3 w-3 mr-1" />
                                  Planifié
                                </span>
                              )}
                              {shift.clock_in && !shift.clock_out && (
                                <span className="badge-hero bg-warning-500 text-white">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  En cours
                                </span>
                              )}
                              {shift.clock_in && shift.clock_out && !shift.validated && (
                                <span className="badge-hero-secondary">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  En attente
                                </span>
                              )}
                              {shift.clock_in && shift.clock_out && shift.validated && (
                                <span className="badge-hero bg-success-500 text-white">
                                  <CheckCircleIcon className="h-3 w-3 mr-1" />
                                  Validé
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Widget Statistiques de la semaine */}
          <div className="card-hero">
            <div className="card-hero-header bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
              <h3 className="card-hero-title text-white">
                📊 Cette semaine
              </h3>
            </div>
            <div className="card-hero-content">
              {(() => {
                const now = new Date();
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                
                const weekShifts = monthlyShifts.filter(shift => {
                  const shiftDate = new Date(shift.date);
                  return shiftDate >= weekStart && shiftDate <= weekEnd;
                });
                
                const totalHoursThisWeek = weekShifts.reduce((total, shift) => {
                  if (!shift.clock_in || !shift.clock_out) return total;
                  const clockIn = new Date(shift.clock_in);
                  const clockOut = new Date(shift.clock_out);
                  const hours = (clockOut - clockIn) / (1000 * 60 * 60);
                  return total + hours;
                }, 0);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{weekShifts.length}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Shifts planifiés</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{totalHoursThisWeek.toFixed(1)}h</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Heures travaillées</div>
                      </div>
                    </div>
                    
                    {userDetails?.hourly_rate && (
                      <div className="text-center p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg">
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          Gains cette semaine: {Math.round(totalHoursThisWeek * userDetails.hourly_rate)}€
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Widget Historique récent */}
          {!currentShift && monthlyShifts.filter(s => s.clock_out).length > 0 && (
            <div className="card-hero">
              <div className="card-hero-header bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-t-lg">
                <h3 className="card-hero-title text-white">
                  📈 Historique récent
                </h3>
              </div>
              <div className="card-hero-content">
                <div className="space-y-3">
                  {monthlyShifts
                    .filter(shift => shift.clock_out)
                    .sort((a, b) => new Date(b.clock_out) - new Date(a.clock_out))
                    .slice(0, 3)
                    .map(shift => (
                      <div key={shift.user_shift_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">{shift.title}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDateWithDay(shift.date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {(() => {
                              const clockIn = new Date(shift.clock_in);
                              const clockOut = new Date(shift.clock_out);
                              const duration = (clockOut - clockIn) / (1000 * 60 * 60);
                              return `${duration.toFixed(1)}h`;
                            })()}
                          </div>
                          <div className={`text-xs ${shift.validated ? 'text-green-600' : 'text-orange-600'}`}>
                            {shift.validated ? '✅ Validé' : '⏳ En attente'}
                          </div>
                        </div>
                      </div>
                    ))}
                  <div className="text-center">
                    <Link to="/calendar" className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
                      Voir tout l'historique →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shifts passés récents */}
          {pastShifts.length > 0 && (
            <div className="card-hero">
              <div className="card-hero-header bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-t-lg">
                <h3 className="card-hero-title text-white">
                  📋 Shifts récents
                </h3>
              </div>
              <div className="card-hero-content">
                {/* Vue desktop - Tableau */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Date</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Shift</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Horaires</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Heures travaillées</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Statut</th>
                        {userDetails?.hourly_rate && (
                          <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Salaire</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pastShifts.map(shift => {
                        const clockIn = new Date(shift.clock_in);
                        const clockOut = new Date(shift.clock_out);
                        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
                        const earnings = userDetails?.hourly_rate ? hoursWorked * userDetails.hourly_rate : 0;
                        
                        return (
                          <tr key={shift.user_shift_id} className="border-b border-border hover:bg-muted/50">
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                              {formatDateWithDay(shift.date)}
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{shift.title}</span>
                                <span className={`badge-hero text-xs ${
                                  shift.position === 'cuisine' ? 'cuisine-badge' :
                                  shift.position === 'salle' ? 'salle-badge' :
                                  shift.position === 'bar' ? 'bar-badge' :
                                  'badge-hero-secondary'
                                }`}>
                                  {shift.position}
                                </span>
                              </div>
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                              {shift.start_time} - {shift.end_time}
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                              {formatTime(shift.clock_in)} - {formatTime(shift.clock_out)}
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {hoursWorked.toFixed(1)}h travaillées
                              </div>
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                              <span className={`badge-hero text-xs ${
                                shift.validated ? 'badge-hero-success' : 'badge-hero-warning'
                              }`}>
                                {shift.validated ? 'Validé' : 'En attente'}
                              </span>
                            </td>
                            {userDetails?.hourly_rate && (
                              <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {earnings.toFixed(2)}€
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vue mobile - Cartes */}
                <div className="md:hidden space-y-4">
                  {pastShifts.map(shift => {
                    const clockIn = new Date(shift.clock_in);
                    const clockOut = new Date(shift.clock_out);
                    const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
                    const earnings = userDetails?.hourly_rate ? hoursWorked * userDetails.hourly_rate : 0;
                    
                    return (
                      <div key={shift.user_shift_id} className="mobile-card-hero">
                        <div className="mobile-card-hero-header">
                          <div className="flex items-center justify-between">
                            <h4 className="mobile-card-hero-title">{shift.title}</h4>
                            <span className={`badge-hero text-xs ${
                              shift.validated ? 'badge-hero-success' : 'badge-hero-warning'
                            }`}>
                              {shift.validated ? 'Validé' : 'En attente'}
                            </span>
                          </div>
                          <p className="mobile-card-hero-subtitle">{formatDateWithDay(shift.date)}</p>
                        </div>

                        <div className="mobile-card-hero-content">
                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              Position
                            </span>
                            <span className={`badge-hero text-xs ${
                              shift.position === 'cuisine' ? 'cuisine-badge' :
                              shift.position === 'salle' ? 'salle-badge' :
                              shift.position === 'bar' ? 'bar-badge' :
                              'badge-hero-secondary'
                            }`}>
                              {shift.position}
                            </span>
                          </div>

                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              Horaires prévus
                            </span>
                            <span>{shift.start_time} - {shift.end_time}</span>
                          </div>

                          <div className="mobile-card-hero-row">
                            <span className="text-muted-foreground">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              Heures travaillées
                            </span>
                            <div className="text-right">
                              <div>{formatTime(shift.clock_in)} - {formatTime(shift.clock_out)}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {hoursWorked.toFixed(1)}h travaillées
                              </div>
                            </div>
                          </div>

                          {userDetails?.hourly_rate && (
                            <div className="mobile-card-hero-row">
                              <span className="text-muted-foreground">
                                <CurrencyEuroIcon className="h-4 w-4 inline mr-1" />
                                Salaire
                              </span>
                              <span className="font-medium text-green-600 dark:text-green-400">
                                {earnings.toFixed(2)}€
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
          
        {/* Section pour responsables et managers */}
        {hasRole(['responsable', 'manager']) && (
          <div className="lg:col-span-1">
            <div className="card-hero">
              <div className="card-hero-header bg-warning-500 text-white rounded-t-lg">
                <h3 className="card-hero-title text-white">
                  <ClockIcon className="h-5 w-5 inline mr-2" />
                  Heures à valider
                </h3>
              </div>
              <div className="card-hero-content">
                {unvalidatedHours.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground text-sm">Aucune heure en attente de validation.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="alert-hero border-info-200 bg-info-50 dark:bg-info-900/20 p-3">
                      <div className="flex items-center space-x-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-info-600" />
                        <span className="text-sm font-medium">
                          {unvalidatedHours.length} pointage{unvalidatedHours.length > 1 ? 's' : ''} à valider
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {unvalidatedHours.slice(0, 5).map(hour => (
                        <div key={hour.id} className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <h6 className="font-medium text-sm">{hour.username}</h6>
                              <span className="text-xs text-muted-foreground">
                                {new Date(hour.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-primary-600 font-medium">{hour.title}</p>
                            <div className="text-xs text-muted-foreground">
                              <ClockIcon className="h-3 w-3 inline mr-1" />
                              {new Date(hour.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                              {new Date(hour.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                      {unvalidatedHours.length > 5 && (
                        <div className="text-center text-muted-foreground text-sm py-2">
                          ... et {unvalidatedHours.length - 5} autre{unvalidatedHours.length - 5 > 1 ? 's' : ''} pointage{unvalidatedHours.length - 5 > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <Link to="/validate" className="btn-hero-primary w-full">
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Aller à la validation
                    </Link>
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