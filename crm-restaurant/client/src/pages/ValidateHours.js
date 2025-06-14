import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { timeclockService } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  UserIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const ValidateHours = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationLoading, setValidationLoading] = useState(false);
  const [comments, setComments] = useState({});
  const [showValidated, setShowValidated] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState(new Set());
  
  // Nouveau : sélecteur de semaine
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  
  // États pour le modal d'édition
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEditingHour, setCurrentEditingHour] = useState(null);

  // Fonction pour obtenir la semaine actuelle
  function getCurrentWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Lundi = début de semaine
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    };
  }
  
  // Fonction pour obtenir les semaines disponibles (8 semaines : 4 passées + semaine actuelle + 3 futures)
  function getAvailableWeeks() {
    const weeks = [];
    const today = new Date();
    
    for (let i = -4; i <= 3; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1 + (i * 7)); // Lundi de la semaine
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekLabel = i === 0 ? 'Cette semaine' : 
                      i === -1 ? 'Semaine passée' :
                      i < 0 ? `Il y a ${Math.abs(i)} semaines` :
                      i === 1 ? 'Semaine prochaine' :
                      `Dans ${i} semaines`;
      
      weeks.push({
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
        label: weekLabel,
        value: `${weekStart.toISOString().split('T')[0]}_${weekEnd.toISOString().split('T')[0]}`
      });
    }
    
    return weeks;
  }

  // Vérifier que seuls les responsables et managers ont accès à cette page
  useEffect(() => {
    if (!hasRole(['responsable', 'manager'])) {
      navigate('/unauthorized');
    }
    loadHours();
  }, [hasRole, navigate, showValidated, selectedWeek]);

  // Vérifier les paramètres URL pour filtrage automatique
  useEffect(() => {
    const shiftId = searchParams.get('shift_id');
    const date = searchParams.get('date');
    
    if (shiftId && date) {
      // Calculer la semaine contenant cette date
      const targetDate = new Date(date);
      const startOfWeek = new Date(targetDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Lundi = début de semaine
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      setSelectedWeek({
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
      });
      
      // Ouvrir automatiquement ce jour spécifique
      const collapsedSet = new Set();
      setCollapsedDays(collapsedSet); // Ne pas collabser les jours pour montrer le shift
    }
  }, [searchParams]);

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
      
      // Filtrer par semaine sélectionnée
      const filteredHours = response.data.filter(hour => {
        const hourDate = hour.date;
        return hourDate >= selectedWeek.start && hourDate <= selectedWeek.end;
      });
      
      setHours(filteredHours);
      
      // Mettre toutes les journées en mode diminué par défaut
      const allDates = [...new Set(filteredHours.map(h => h.date))];
      setCollapsedDays(new Set(allDates));
      
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

  // Ouvrir le modal d'édition
  const openEditModal = (hour) => {
    setCurrentEditingHour({
      ...hour,
      clockIn: formatTimeForInput(hour.clock_in),
      clockOut: formatTimeForInput(hour.clock_out)
    });
    setEditModalOpen(true);
  };

  // Fermer le modal d'édition
  const closeEditModal = () => {
    setEditModalOpen(false);
    setCurrentEditingHour(null);
  };

  // Sauvegarder les heures modifiées
  const saveEditedHours = async () => {
    if (!currentEditingHour) return;
    
    try {
      setValidationLoading(true);
      setError('');
      setSuccess('');

      const clockInTimestamp = currentEditingHour.clockIn ? 
        new Date(`2000-01-01T${currentEditingHour.clockIn}:00`).toISOString() : undefined;
      const clockOutTimestamp = currentEditingHour.clockOut ? 
        new Date(`2000-01-01T${currentEditingHour.clockOut}:00`).toISOString() : undefined;

      await timeclockService.updateHours({
        userShiftId: currentEditingHour.id,
        clockIn: clockInTimestamp,
        clockOut: clockOutTimestamp,
        validatorId: user.id
      });

      setSuccess('Heures modifiées avec succès');
      closeEditModal();
      
      // Recharger les données
      loadHours();
    } catch (err) {
      console.error('Erreur lors de la modification des heures:', err);
      setError(err.response?.data?.message || 'Erreur lors de la modification des heures');
    } finally {
      setValidationLoading(false);
    }
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
    return new Date(dateString).toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Formater un horodatage pour l'affichage
  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Formater un horodatage pour les inputs
  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toTimeString().slice(0, 5);
  };

  // Calculer la durée de travail
  const calculateDuration = (clockIn, clockOut) => {
    if (!clockIn || !clockOut) return '-';
    
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const duration = end - start;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  // Basculer la visibilité d'un jour
  const toggleDayVisibility = (date) => {
    const newCollapsed = new Set(collapsedDays);
    if (newCollapsed.has(date)) {
      newCollapsed.delete(date);
    } else {
      newCollapsed.add(date);
    }
    setCollapsedDays(newCollapsed);
  };

  // Obtenir les stats d'un jour
  const getDayStats = (date) => {
    const dayShifts = Object.values(groupedHours[date]);
    const totalHours = dayShifts.reduce((acc, shift) => acc + shift.hours.length, 0);
    const validatedHours = dayShifts.reduce((acc, shift) => acc + shift.hours.filter(h => h.validated).length, 0);
    const pendingHours = totalHours - validatedHours;
    
    return { totalHours, validatedHours, pendingHours };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Chargement des heures à valider...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Validation des heures
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gérez et validez les pointages des employés
        </p>
      </div>
      
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <div className="alert-hero-description">{error}</div>
        </div>
      )}
      
      {success && (
        <div className="alert-hero alert-hero-success">
          <CheckCircleIcon className="h-4 w-4" />
          <div className="alert-hero-description">{success}</div>
        </div>
      )}
      
      {/* Filtres */}
      <div className="card-hero">
        <div className="card-hero-content">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Sélecteur de semaine */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Semaine à afficher:
              </label>
              <select 
                value={`${selectedWeek.start}_${selectedWeek.end}`}
                onChange={(e) => {
                  const [start, end] = e.target.value.split('_');
                  setSelectedWeek({ start, end });
                }}
                className="input-hero"
              >
                {getAvailableWeeks().map(week => (
                  <option key={week.value} value={week.value}>
                    {week.label} ({new Date(week.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {new Date(week.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Checkbox pour afficher les validées (managers seulement) */}
            {user.role === 'manager' && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showValidated}
                  onChange={(e) => setShowValidated(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Afficher aussi les heures déjà validées
                </span>
              </label>
            )}
          </div>
        </div>
      </div>
      
      {hours.length === 0 ? (
        <div className="card-hero">
          <div className="card-hero-content text-center py-12">
            <ClockIcon className="h-16 w-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Aucun pointage trouvé
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {showValidated ? 'Aucune heure trouvée dans la base de données.' : 'Aucune heure en attente de validation.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {sortedDates.map(date => {
            const dayStats = getDayStats(date);
            const isCollapsed = collapsedDays.has(date);
            
            return (
              <div key={date} className="space-y-4">
                {/* Header du jour avec stats */}
                <div 
                  className="card-hero cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => toggleDayVisibility(date)}
                >
                  <div className="card-hero-content">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {isCollapsed ? (
                          <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                        )}
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {formatDate(date)}
                          </h2>
                          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              {dayStats.validatedHours} validé{dayStats.validatedHours > 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                              {dayStats.pendingHours} en attente
                            </span>
                            <span className="text-slate-400">
                              Total: {dayStats.totalHours} pointage{dayStats.totalHours > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {dayStats.pendingHours === 0 && dayStats.totalHours > 0 && (
                        <div className="badge-hero bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                          Jour validé
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Contenu du jour */}
                {!isCollapsed && Object.values(groupedHours[date]).map(shiftGroup => (
                  <div key={`${shiftGroup.shift_id}-${shiftGroup.title}`} className="card-hero">
                    <div className="card-hero-header bg-slate-50 dark:bg-slate-800">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {shiftGroup.title}
                        </h3>
                        <div className="badge-hero bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {shiftGroup.start_time} - {shiftGroup.end_time}
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-hero-content">
                      {/* Vue desktop - Tableau */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Employé</th>
                              <th className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Pointages</th>
                              <th className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Durée</th>
                              <th className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Statut</th>
                              <th className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftGroup.hours.map(hour => (
                              <tr key={hour.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <UserIcon className="h-5 w-5 text-slate-400" />
                                    <span className="font-medium text-slate-900 dark:text-slate-100">{hour.username}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                    {formatTime(hour.clock_in)} - {formatTime(hour.clock_out)}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {calculateDuration(hour.clock_in, hour.clock_out)}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    hour.validated 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                  }`}>
                                    {hour.validated ? (
                                      <>
                                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                                        Validé
                                      </>
                                    ) : (
                                      <>
                                        <ClockIcon className="h-4 w-4 mr-1" />
                                        En attente
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => openEditModal(hour)}
                                      className="btn-hero-secondary btn-hero-sm"
                                    >
                                      <PencilIcon className="h-4 w-4 mr-1" />
                                      Modifier
                                    </button>
                                    {!hour.validated && (
                                      <button
                                        onClick={() => handleValidate(hour.id)}
                                        disabled={validationLoading}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center shadow-sm"
                                      >
                                        <CheckIcon className="h-4 w-4 mr-1" />
                                        {validationLoading ? 'Validation...' : 'Valider'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Vue mobile modernisée */}
                      <div className="lg:hidden space-y-3">
                        {shiftGroup.hours.map(hour => {
                          const isToday = hour.date === new Date().toISOString().split('T')[0];
                          const isTomorrow = hour.date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                          
                          return (
                            <div 
                              key={hour.id} 
                              className={`rounded-xl p-4 border-2 transition-all duration-200 ${
                                isToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700' :
                                'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {/* Header avec indicateur visuel */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full ${isToday ? 'bg-blue-500' : isTomorrow ? 'bg-orange-400' : 'bg-slate-400'} ${isToday ? 'animate-pulse' : ''}`}></div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <UserIcon className="h-5 w-5 text-slate-400" />
                                      <span className={`font-bold text-lg ${isToday ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {hour.username}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Statut avec design moderne */}
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  hour.validated 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}>
                                  {hour.validated ? (
                                    <>
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Validé
                                    </>
                                  ) : (
                                    <>
                                      <ClockIcon className="h-4 w-4 mr-1" />
                                      En attente
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Contenu principal avec design moderne */}
                              <div className="space-y-3">
                                {/* Informations de temps */}
                                <div>
                                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">⏰ Horaires de travail</div>
                                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                                    <div className="text-center">
                                      <div className="text-lg font-mono font-bold text-slate-900 dark:text-slate-100">
                                        {formatTime(hour.clock_in)} - {formatTime(hour.clock_out)}
                                      </div>
                                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                        Durée: <span className="font-semibold text-blue-600 dark:text-blue-400">{calculateDuration(hour.clock_in, hour.clock_out)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Commentaire */}
                                <div>
                                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">💬 Commentaire de validation</div>
                                  <textarea 
                                    className="w-full p-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    placeholder="Ajouter un commentaire de validation..."
                                    value={comments[hour.id] || ''}
                                    onChange={(e) => handleCommentChange(hour.id, e.target.value)}
                                    rows="2"
                                  />
                                </div>
                                
                                {/* Actions avec design moderne */}
                                <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <button
                                    onClick={() => openEditModal(hour)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center"
                                  >
                                    <PencilIcon className="h-4 w-4 mr-2" />
                                    Modifier
                                  </button>
                                  {!hour.validated && (
                                    <button
                                      onClick={() => handleValidate(hour.id)}
                                      disabled={validationLoading}
                                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center shadow-sm active:scale-95"
                                    >
                                      <CheckIcon className="h-4 w-4 mr-2" />
                                      {validationLoading ? 'Validation...' : 'Valider'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Actions groupées pour le shift avec design moderne */}
                              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                  <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                    📊 Progression: <span className="font-bold text-slate-900 dark:text-slate-100">{shiftGroup.hours.filter(h => h.validated).length} / {shiftGroup.hours.length}</span> validé{shiftGroup.hours.length > 1 ? 's' : ''}
                                  </div>
                                  {shiftGroup.hours.some(h => !h.validated) && (
                                    <button 
                                      onClick={() => {
                                        shiftGroup.hours
                                          .filter(h => !h.validated)
                                          .forEach(h => handleValidate(h.id));
                                      }}
                                      disabled={validationLoading}
                                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-sm flex items-center gap-2 active:scale-95"
                                    >
                                      <CheckCircleIcon className="h-4 w-4" />
                                      Valider tout le shift
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* Modal d'édition */}
      {editModalOpen && currentEditingHour && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Modifier les heures
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {currentEditingHour.username}
                  </p>
                </div>
                <button
                  onClick={closeEditModal}
                  className="btn-hero-secondary btn-hero-sm"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Heure d'entrée
                </label>
                <input 
                  type="time"
                  className="input-hero w-full text-lg"
                  value={currentEditingHour.clockIn}
                  onChange={(e) => setCurrentEditingHour({
                    ...currentEditingHour,
                    clockIn: e.target.value
                  })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Heure de sortie
                </label>
                <input 
                  type="time"
                  className="input-hero w-full text-lg"
                  value={currentEditingHour.clockOut}
                  onChange={(e) => setCurrentEditingHour({
                    ...currentEditingHour,
                    clockOut: e.target.value
                  })}
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={closeEditModal}
                    className="btn-hero-secondary w-full py-3"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEditedHours}
                    disabled={validationLoading}
                    className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm"
                  >
                    {validationLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {hours.length > 0 && user.role === 'responsable' && (
        <div className="card-hero bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="card-hero-content text-center">
            <div className="flex items-center justify-center gap-2 text-blue-800 dark:text-blue-200">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <p className="font-medium">
                Note importante
              </p>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              En tant que responsable, vous ne pouvez modifier que les shifts auxquels vous participez.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidateHours; 