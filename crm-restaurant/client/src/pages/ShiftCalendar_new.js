import { useState, useEffect, useContext } from 'react';
import format from 'date-fns/format';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { shiftService, timeclockService, userService } from '../services/api';
import * as Excel from 'exceljs';
import { saveAs } from 'file-saver';
import '../styles/calendar.css';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { 
  CalendarIcon, 
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CheckCircleIcon,
  UsersIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const ShiftCalendar = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // État pour la nouvelle vue grille
  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()));
  const [weeklyShifts, setWeeklyShifts] = useState([]);
  
  // État pour la modal de détail de shift
  const [showDetails, setShowDetails] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);

  // États pour l'édition des shifts
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [showSalaries, setShowSalaries] = useState(false);
  const [shiftSalaries, setShiftSalaries] = useState([]);

  // États pour la vue mobile-friendly
  const [viewMode, setViewMode] = useState('grid'); // 'list' ou 'grid'

  // États pour l'ajout manuel des heures de pointage
  const [showManualHoursModal, setShowManualHoursModal] = useState(false);
  const [selectedUserShift, setSelectedUserShift] = useState(null);
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');
  const [manualHoursLoading, setManualHoursLoading] = useState(false);

  // États pour la gestion des horaires individuels
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedPersonForTime, setSelectedPersonForTime] = useState(null);
  const [individualStartTime, setIndividualStartTime] = useState('');
  const [individualEndTime, setIndividualEndTime] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fonction pour obtenir le début de la semaine
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lundi comme premier jour
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  // Fonction pour obtenir les jours de la semaine
  function getWeekDays(weekStart) {
    const days = [];
    const startDate = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push({
        date: day.toISOString().split('T')[0],
        dayName: day.toLocaleDateString('fr-FR', { weekday: 'long' }),
        dayShort: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
        dayNumber: day.getDate(),
        month: day.getMonth() + 1
      });
    }
    return days;
  }

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
    
    loadWeeklyShifts();
  }, [hasRole, navigate, selectedWeek]);

  // Charger les shifts de la semaine sélectionnée
  const loadWeeklyShifts = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Calculer la plage de dates de la semaine
      const weekDays = getWeekDays(selectedWeek);
      const startOfWeek = weekDays[0].date;
      const endOfWeek = weekDays[6].date;
      
      // Récupérer tous les shifts selon le rôle
      let shiftsResponse;
      if (hasRole(['manager'])) {
        shiftsResponse = await shiftService.getAllShiftsWithPersonnel();
      } else {
        shiftsResponse = await shiftService.getUserShifts(user.id);
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
      
      // Filtrer les shifts de la semaine
      const weekShifts = allShifts.filter(shift => 
        shift.date >= startOfWeek && shift.date <= endOfWeek
      );
      
      // Pour chaque shift, récupérer les utilisateurs assignés et leur statut
      const shiftsWithUsers = await Promise.all(
        weekShifts.map(async (shift) => {
          try {
            // Récupérer le personnel assigné à ce shift
            const personnelResponse = await shiftService.getShiftPersonnel(shift.id);
            
            // Récupérer les données détaillées des user_shifts pour ce shift (pour validation et heures)
            const userShiftsResponse = await shiftService.getShiftDetails(shift.id);
            const userShifts = userShiftsResponse.data;
            
            // Déterminer le statut global de validation du shift
            const now = new Date();
            const shiftDate = new Date(shift.date);
            const [startHour, startMinute] = shift.start_time.split(':').map(Number);
            const [endHour, endMinute] = shift.end_time.split(':').map(Number);
            
            const shiftStartTime = new Date(shiftDate);
            shiftStartTime.setHours(startHour, startMinute, 0, 0);
            
            const shiftEndTime = new Date(shiftDate);
            shiftEndTime.setHours(endHour, endMinute, 0, 0);
            
            // Gérer les shifts qui se terminent le lendemain
            if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
              shiftEndTime.setDate(shiftEndTime.getDate() + 1);
            }
            
            // Déterminer le statut selon l'heure actuelle
            let validationStatus = "upcoming";
            
            if (now >= shiftStartTime && now <= shiftEndTime) {
              validationStatus = "in_progress";
            } else if (now > shiftEndTime) {
              const allValidated = userShifts.every(us => us.validated);
              validationStatus = allValidated ? "validated" : "pending";
            }
            
            // Fusionner les données du personnel avec leurs heures de pointage
            const personnelWithHours = {
              salle: (personnelResponse.data?.salle || []).map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              bar: (personnelResponse.data?.bar || []).map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              chaud: (personnelResponse.data?.chaud || []).map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              pain: (personnelResponse.data?.pain || []).map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
              envoi: (personnelResponse.data?.envoi || []).map(person => {
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
              personnel: { salle: [], bar: [], chaud: [], pain: [], envoi: [] },
              validationStatus: "error",
              userShifts: []
            };
          }
        })
      );
      
      setWeeklyShifts(shiftsWithUsers);
      
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

  // Naviguer entre les semaines
  const navigateWeek = (direction) => {
    const currentDate = new Date(selectedWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    setSelectedWeek(currentDate.toISOString().split('T')[0]);
    setError('');
  };

  // Gérer le clic sur un shift
  const handleShiftClick = (shift) => {
    setSelectedShift({
      ...shift,
      shifts: [shift],
      validationStatus: shift.validationStatus,
      date: shift.date
    });
    setShowDetails(true);
  };

  // Fermer la modal de détails
  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  // Formater un timestamp pour affichage
  const formatTimeStamp = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Renderiser la grille hebdomadaire
  const renderWeeklyGrid = () => {
    const weekDays = getWeekDays(selectedWeek);
    
    // Organiser les shifts par type (unique shifts par jour)
    const uniqueShifts = weeklyShifts.reduce((acc, shift) => {
      const key = `${shift.title}-${shift.start_time}-${shift.end_time}`;
      if (!acc[key]) {
        acc[key] = {
          title: shift.title,
          start_time: shift.start_time,
          end_time: shift.end_time,
          shifts: []
        };
      }
      acc[key].shifts.push(shift);
      return acc;
    }, {});

    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">📋 Planning de la semaine</h3>
            {hasRole(['manager']) && (
              <button
                onClick={() => navigate('/weekly-grid')}
                className="btn-hero-outline btn-hero-sm"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Modifier planning
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="sticky left-0 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-sm font-medium text-slate-900 dark:text-slate-100 min-w-[200px]">
                  Shift / Heure
                </th>
                {weekDays.map(day => (
                  <th key={day.date} className="border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-center text-sm font-medium text-slate-900 dark:text-slate-100 min-w-[150px]">
                    <div className="flex flex-col">
                      <span className="capitalize font-bold">{day.dayShort}</span>
                      <span className="text-xs text-slate-500">{day.dayNumber}/{day.month}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.values(uniqueShifts).map((shiftGroup, rowIndex) => (
                <tr key={`${shiftGroup.title}-${shiftGroup.start_time}`} className={`${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}>
                  <td className="sticky left-0 bg-inherit border-r border-slate-200 dark:border-slate-700 px-4 py-3">
                    <div className="space-y-2">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                        {shiftGroup.title}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <ClockIcon className="h-3 w-3" />
                        <span>{shiftGroup.start_time} → {shiftGroup.end_time}</span>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const dayShift = shiftGroup.shifts.find(s => s.date === day.date);
                    
                    return (
                      <td key={day.date} className="border-r border-b border-slate-200 dark:border-slate-700 p-2 min-h-[80px] align-top bg-blue-50 dark:bg-blue-900/10">
                        {dayShift ? (
                          <div 
                            className="space-y-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800/30 rounded p-2 transition-colors"
                            onClick={() => handleShiftClick(dayShift)}
                          >
                            {/* Indicateur de statut */}
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                dayShift.validationStatus === 'validated' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                dayShift.validationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                dayShift.validationStatus === 'in_progress' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {dayShift.validationStatus === 'validated' ? '✅' : 
                                 dayShift.validationStatus === 'pending' ? '⏳' : 
                                 dayShift.validationStatus === 'in_progress' ? '🔄' : '📅'}
                              </span>
                            </div>

                            {/* Personnel par position */}
                            <div className="space-y-1">
                              {/* Salle */}
                              {dayShift.personnel?.salle?.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">🍽️ Salle:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {dayShift.personnel.salle.map(person => (
                                      <span key={person.user_id} className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-xs">
                                        {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Bar */}
                              {dayShift.personnel?.bar?.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-medium text-green-700 dark:text-green-300">🍸 Bar:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {dayShift.personnel.bar.map(person => (
                                      <span key={person.user_id} className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-1 py-0.5 rounded text-xs">
                                        {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Cuisine */}
                              {(dayShift.personnel?.chaud?.length > 0 || dayShift.personnel?.pain?.length > 0 || dayShift.personnel?.envoi?.length > 0) && (
                                <div className="text-xs">
                                  <span className="font-medium text-red-700 dark:text-red-300">👨‍🍳 Cuisine:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {dayShift.personnel.chaud?.map(person => (
                                      <span key={person.user_id} className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-1 py-0.5 rounded text-xs">
                                        🔥 {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                    {dayShift.personnel.pain?.map(person => (
                                      <span key={person.user_id} className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                                        🥖 {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                    {dayShift.personnel.envoi?.map(person => (
                                      <span key={person.user_id} className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-1 py-0.5 rounded text-xs">
                                        📦 {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Si aucun personnel */}
                              {(!dayShift.personnel?.salle?.length && !dayShift.personnel?.bar?.length && 
                                !dayShift.personnel?.chaud?.length && !dayShift.personnel?.pain?.length && 
                                !dayShift.personnel?.envoi?.length) && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                                  Aucun personnel assigné
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                            Aucun shift
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {Object.keys(uniqueShifts).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun shift planifié cette semaine</p>
                    {hasRole(['manager']) && (
                      <button
                        onClick={() => navigate('/weekly-grid')}
                        className="btn-hero-primary mt-4"
                      >
                        Créer des shifts
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Composant de détails de shift (version simplifiée)
  const ShiftDetailsModal = () => {
    if (!selectedShift) return null;
    
    const shift = selectedShift.shifts[0];
    const [year, month, day] = shift.date.split('-').map(Number);
    const shiftDate = new Date(year, month - 1, day);
    
    return (
      <Modal show={showDetails} onHide={handleCloseDetails} size="xl" className="shift-details-modal">
        <Modal.Header closeButton onClose={handleCloseDetails}>
          <Modal.Title>Détails du shift - {format(shiftDate, 'd MMMM yyyy', { locale: fr })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{shift.title}</h3>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {shift.start_time} - {shift.end_time}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  shift.validationStatus === 'validated' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                  shift.validationStatus === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                  shift.validationStatus === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {shift.validationStatus === 'validated' ? 'Validé' : 
                   shift.validationStatus === 'pending' ? 'En attente' : 
                   shift.validationStatus === 'in_progress' ? 'En cours' :
                   'À venir'}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personnel de salle */}
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">🍽️ Personnel de salle</h4>
                {(!shift.personnel?.salle || shift.personnel.salle.length === 0) ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                ) : (
                  <div className="space-y-2">
                    {shift.personnel.salle.map(person => (
                      <div key={`salle-${person.user_id}`} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <div>
                          <div className="font-medium text-blue-900 dark:text-blue-100">{person.username}</div>
                          {person.individual_start_time && person.individual_end_time && (
                            <div className="text-xs text-blue-600">{person.individual_start_time} - {person.individual_end_time}</div>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          person.validated ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {person.validated ? 'Validé' : 'En attente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Personnel de bar */}
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">🍸 Personnel de bar</h4>
                {(!shift.personnel?.bar || shift.personnel.bar.length === 0) ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                ) : (
                  <div className="space-y-2">
                    {shift.personnel.bar.map(person => (
                      <div key={`bar-${person.user_id}`} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div>
                          <div className="font-medium text-green-900 dark:text-green-100">{person.username}</div>
                          {person.individual_start_time && person.individual_end_time && (
                            <div className="text-xs text-green-600">{person.individual_start_time} - {person.individual_end_time}</div>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          person.validated ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {person.validated ? 'Validé' : 'En attente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Personnel de cuisine */}
            <div>
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">👨‍🍳 Personnel de cuisine</h4>
              {(!shift.personnel?.chaud?.length && !shift.personnel?.pain?.length && !shift.personnel?.envoi?.length) ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Chaud */}
                  {shift.personnel?.chaud?.length > 0 && (
                    <div>
                      <h5 className="font-medium text-red-800 mb-2">🔥 Chaud</h5>
                      <div className="space-y-1">
                        {shift.personnel.chaud.map(person => (
                          <div key={`chaud-${person.user_id}`} className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <div className="font-medium text-red-900 dark:text-red-100">{person.username}</div>
                            {person.individual_start_time && person.individual_end_time && (
                              <div className="text-xs text-red-600">{person.individual_start_time} - {person.individual_end_time}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Pain */}
                  {shift.personnel?.pain?.length > 0 && (
                    <div>
                      <h5 className="font-medium text-orange-800 mb-2">🥖 Pain</h5>
                      <div className="space-y-1">
                        {shift.personnel.pain.map(person => (
                          <div key={`pain-${person.user_id}`} className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                            <div className="font-medium text-orange-900 dark:text-orange-100">{person.username}</div>
                            {person.individual_start_time && person.individual_end_time && (
                              <div className="text-xs text-orange-600">{person.individual_start_time} - {person.individual_end_time}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Envoi */}
                  {shift.personnel?.envoi?.length > 0 && (
                    <div>
                      <h5 className="font-medium text-purple-800 mb-2">📦 Envoi</h5>
                      <div className="space-y-1">
                        {shift.personnel.envoi.map(person => (
                          <div key={`envoi-${person.user_id}`} className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <div className="font-medium text-purple-900 dark:text-purple-100">{person.username}</div>
                            {person.individual_start_time && person.individual_end_time && (
                              <div className="text-xs text-purple-600">{person.individual_start_time} - {person.individual_end_time}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDetails}>
            Fermer
          </Button>
          {hasRole(['responsable', 'manager']) && (
            <Button variant="primary" onClick={() => navigate(`/validate?shift_id=${shift.id}&date=${shift.date}`)}>
              Gérer les heures
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 text-blue-600 mx-auto" role="status">
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement du calendrier des shifts...</p>
        </div>
      </div>
    );
  }

  const weekDays = getWeekDays(selectedWeek);
  const weekStart = new Date(selectedWeek);
  const weekEnd = new Date(selectedWeek);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">📋 Calendrier des shifts</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Vue planning avec équipes et statuts de validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn-hero-sm ${viewMode === 'grid' ? 'btn-hero-primary' : 'btn-hero-outline'}`}
            onClick={() => setViewMode('grid')}
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Grille
          </button>
        </div>
      </div>
      
      {/* Messages */}
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <div className="alert-hero-title">Erreur</div>
          <div className="alert-hero-description">{error}</div>
        </div>
      )}

      {/* Navigation de semaine et actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateWeek(-1)}
              className="btn-hero-outline btn-hero-sm"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Semaine précédente
            </button>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Semaine du {weekStart.toLocaleDateString('fr-FR')} au {weekEnd.toLocaleDateString('fr-FR')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {weekDays[0].dayName} {weekDays[0].dayNumber}/{weekDays[0].month} - {weekDays[6].dayName} {weekDays[6].dayNumber}/{weekDays[6].month}
              </p>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="btn-hero-outline btn-hero-sm"
            >
              Semaine suivante
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
          
          {hasRole(['manager']) && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/weekly-grid')}
                className="btn-hero-primary"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Créer/Modifier planning
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      {renderWeeklyGrid()}

      {/* Résumé de la semaine */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">📈 Résumé de la semaine</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {weeklyShifts.reduce((total, shift) => {
                return total + (shift.personnel?.salle?.length || 0) + (shift.personnel?.bar?.length || 0);
              }, 0)}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Assignations Salle/Bar</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {weeklyShifts.reduce((total, shift) => {
                return total + (shift.personnel?.chaud?.length || 0) + (shift.personnel?.pain?.length || 0) + (shift.personnel?.envoi?.length || 0);
              }, 0)}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Assignations Cuisine</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{weeklyShifts.length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Shifts planifiés</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {weeklyShifts.filter(s => s.validationStatus === 'validated').length}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Shifts validés</div>
          </div>
        </div>
      </div>
      
      {/* Modal de détails */}
      <ShiftDetailsModal />
    </div>
  );
};

export default ShiftCalendar; 