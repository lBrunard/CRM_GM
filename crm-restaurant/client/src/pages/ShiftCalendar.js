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

  // États pour les nouvelles fonctionnalités manager
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [currentShiftSalaries, setCurrentShiftSalaries] = useState([]);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('');

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
    loadAllUsers();
  }, [hasRole, navigate, selectedWeek]);

  // Charger tous les utilisateurs pour l'édition
  const loadAllUsers = async () => {
    try {
      const response = await userService.getAllUsers();
      setAllUsers(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
    }
  };

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
      if (hasRole(['manager', 'responsable'])) {
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
      
      // Charger la liste des utilisateurs pour l'édition (managers et responsables seulement)
      if (hasRole(['manager', 'responsable'])) {
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
    if (hasRole(['manager', 'responsable'])) {
      // Pour les managers et responsables, ouvrir la modal d'édition
      setEditingShift(shift);
      setShowEditModal(true);
    } else {
      // Pour les autres, ouvrir la modal de détails
      setSelectedShift({
        ...shift,
        shifts: [shift],
        validationStatus: shift.validationStatus,
        date: shift.date
      });
      setShowDetails(true);
    }
  };

  // Supprimer un shift
  const deleteShift = async (shiftId) => {
    try {
      setEditLoading(true);
      await shiftService.deleteShift(shiftId);
      setShowEditModal(false);
      setEditingShift(null);
      setShowDetails(false); // Fermer aussi la modal de détails si ouverte
      setSelectedShift(null);
      loadWeeklyShifts(); // Recharger les shifts
    } catch (err) {
      console.error('Erreur lors de la suppression du shift:', err);
      setError('Impossible de supprimer le shift');
    } finally {
      setEditLoading(false);
    }
  };

  // Assigner un utilisateur à une position
  const assignUserToPosition = async (position, userId, replaceUserId = null) => {
    const currentShift = selectedShift?.shifts[0] || editingShift;
    if (!currentShift) return;

    try {
      if (replaceUserId) {
        // Remplacer directement sans modal de temps
        await shiftService.assignUserToShift(currentShift.id, {
          user_id: userId,
          position: position,
          replace_user_id: replaceUserId
        });
      } else {
        // Nouveau assignment - ouvrir modal pour horaires individuels
        setSelectedPersonForTime({ userId, position, shift: currentShift });
        setIndividualStartTime(currentShift.start_time);
        setIndividualEndTime(currentShift.end_time);
        setShowTimeModal(true);
        return;
      }

      // Recharger les shifts
      await loadWeeklyShifts();
      
      // Mettre à jour le shift en cours d'édition si applicable
      if (editingShift) {
        const updatedShift = weeklyShifts.find(s => s.id === editingShift.id);
        if (updatedShift) {
          setEditingShift(updatedShift);
        }
      }
      
      // Mettre à jour le shift sélectionné si applicable
      if (selectedShift) {
        const updatedShift = weeklyShifts.find(s => s.id === currentShift.id);
        if (updatedShift) {
          setSelectedShift({ shifts: [updatedShift] });
        }
      }
    } catch (err) {
      console.error('Erreur lors de l\'assignation:', err);
      setError('Impossible d\'assigner l\'utilisateur');
    }
  };

  // Confirmer l'assignation avec horaires individuels
  const confirmAssignmentWithTime = async () => {
    if (!selectedPersonForTime || !individualStartTime || !individualEndTime) return;

    try {
      setEditLoading(true);
      
      const { userId, position, replaceUserId, shift } = selectedPersonForTime;
      
      await shiftService.assignUserToShift(shift.id, {
        user_id: userId,
        position: position,
        individual_start_time: individualStartTime,
        individual_end_time: individualEndTime,
        replace_user_id: replaceUserId || null
      });

      // Fermer la modal et recharger
      setShowTimeModal(false);
      setSelectedPersonForTime(null);
      setIndividualStartTime('');
      setIndividualEndTime('');
      
      await loadWeeklyShifts();
      
      // Mettre à jour le shift en cours d'édition si applicable
      if (editingShift) {
        const updatedShift = weeklyShifts.find(s => s.id === editingShift.id);
        if (updatedShift) {
          setEditingShift(updatedShift);
        }
      }
      
      // Mettre à jour le shift sélectionné si applicable
      if (selectedShift) {
        const updatedShift = weeklyShifts.find(s => s.id === shift.id);
        if (updatedShift) {
          setSelectedShift({ shifts: [updatedShift] });
        }
      }
    } catch (err) {
      console.error('Erreur lors de l\'assignation avec horaires:', err);
      setError('Impossible d\'assigner l\'utilisateur avec les horaires spécifiés');
    } finally {
      setEditLoading(false);
    }
  };

  // Retirer un utilisateur d'une position
  const removeUserFromPosition = async (position, userId) => {
    const currentShift = selectedShift?.shifts[0] || editingShift;
    if (!currentShift) return;

    try {
      await shiftService.removeUserFromShift(currentShift.id, userId);
      
      // Recharger les shifts
      await loadWeeklyShifts();
      
      // Mettre à jour le shift en cours d'édition si applicable
      if (editingShift) {
        const updatedShift = weeklyShifts.find(s => s.id === editingShift.id);
        if (updatedShift) {
          setEditingShift(updatedShift);
        }
      }
      
      // Mettre à jour le shift sélectionné si applicable
      if (selectedShift) {
        const updatedShift = weeklyShifts.find(s => s.id === currentShift.id);
        if (updatedShift) {
          setSelectedShift({ shifts: [updatedShift] });
        }
      }
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Impossible de retirer l\'utilisateur');
    }
  };

  // Sauvegarder les changements du shift
  const saveShiftChanges = async () => {
    try {
      setEditLoading(true);
      
      // Fermer la modal et recharger
      setShowEditModal(false);
      setEditingShift(null);
      setError('');
      await loadWeeklyShifts();
      
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError('Impossible de sauvegarder les changements');
    } finally {
      setEditLoading(false);
    }
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

  // Calculer les salaires pour un shift
  const calculateShiftSalaries = async (shift) => {
    try {
      const salaries = [];
      const allPersonnel = [
        ...(shift.personnel?.salle || []),
        ...(shift.personnel?.bar || []),
        ...(shift.personnel?.chaud || []),
        ...(shift.personnel?.pain || []),
        ...(shift.personnel?.envoi || [])
      ];

      for (const person of allPersonnel) {
        if (person.clock_in && person.clock_out && person.validated) {
          // Récupérer les détails de l'utilisateur pour avoir le taux horaire
          const userResponse = await userService.getUserById(person.user_id);
          const hourlyRate = userResponse.data.hourly_rate || 0;
          
          const clockIn = new Date(person.clock_in);
          const clockOut = new Date(person.clock_out);
          const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
          const salary = hoursWorked * hourlyRate;
          
          salaries.push({
            username: person.username,
            position: person.position || 'Non défini',
            hoursWorked: hoursWorked.toFixed(2),
            hourlyRate: hourlyRate,
            salary: salary.toFixed(2),
            clockIn: formatTimeStamp(person.clock_in),
            clockOut: formatTimeStamp(person.clock_out)
          });
        }
      }
      
      setCurrentShiftSalaries(salaries);
      setShowSalaryModal(true);
    } catch (err) {
      console.error('Erreur lors du calcul des salaires:', err);
      setError('Impossible de calculer les salaires');
    }
  };

  // Ouvrir la modal d'ajout de personnel
  const openAddPersonModal = (position) => {
    setSelectedPosition(position);
    setShowAddPersonModal(true);
  };

  // Renderiser la grille hebdomadaire
  const renderWeeklyGrid = () => {
    const weekDays = getWeekDays(selectedWeek);

    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">📋 Planning de la semaine</h3>
            {hasRole(['manager', 'responsable']) && (
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
                {weekDays.map(day => {
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = day.date === today;
                  
                  return (
                    <th key={day.date} className={`border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-center text-sm font-medium min-w-[200px] ${
                      isToday 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                        : 'text-slate-900 dark:text-slate-100'
                    }`}>
                      <div className="flex flex-col">
                        <span className={`capitalize font-bold ${isToday ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                          {day.dayName}
                          {isToday && ' 📅'}
                        </span>
                        <span className={`text-xs ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}>
                          {day.dayNumber}/{day.month}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDays.map(day => {
                  const dayShifts = weeklyShifts.filter(shift => shift.date === day.date);
                  const today = new Date().toISOString().split('T')[0];
                  const isToday = day.date === today;
                  
                  return (
                    <td key={day.date} className={`border-r border-slate-200 dark:border-slate-700 p-3 align-top min-h-[400px] ${
                      isToday 
                        ? 'bg-blue-100 dark:bg-blue-900/20 border-l-4 border-l-blue-500' 
                        : 'bg-blue-50 dark:bg-blue-900/10'
                    }`}>
                      <div className="space-y-3">
                        {dayShifts.map(shift => (
                          <div 
                            key={shift.id}
                            className="bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-3 cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleShiftClick(shift)}
                          >
                            {/* Header du shift */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                  {shift.title}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  shift.validationStatus === 'validated' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                  shift.validationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  shift.validationStatus === 'in_progress' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}>
                                  {shift.validationStatus === 'validated' ? '✅' : 
                                   shift.validationStatus === 'pending' ? '⏳' : 
                                   shift.validationStatus === 'in_progress' ? '🔄' : '📅'}
                                </span>
                              </div>
                            </div>

                            {/* Horaires */}
                            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-3">
                              <ClockIcon className="h-3 w-3" />
                              <span>{shift.start_time} → {shift.end_time}</span>
                            </div>

                            {/* Personnel */}
                            <div className="space-y-2">
                              {/* Salle */}
                              {shift.personnel?.salle?.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">🍽️ Salle:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {shift.personnel.salle.map(person => (
                                      <span key={person.user_id} className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-1 py-0.5 rounded text-xs">
                                        {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Bar */}
                              {shift.personnel?.bar?.length > 0 && (
                                <div className="text-xs">
                                  <span className="font-medium text-green-700 dark:text-green-300">🍸 Bar:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {shift.personnel.bar.map(person => (
                                      <span key={person.user_id} className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-1 py-0.5 rounded text-xs">
                                        {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Cuisine */}
                              {(shift.personnel?.chaud?.length > 0 || shift.personnel?.pain?.length > 0 || shift.personnel?.envoi?.length > 0) && (
                                <div className="text-xs">
                                  <span className="font-medium text-red-700 dark:text-red-300">👨‍🍳 Cuisine:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {shift.personnel.chaud?.map(person => (
                                      <span key={person.user_id} className="bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-1 py-0.5 rounded text-xs">
                                         {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                    {shift.personnel.pain?.map(person => (
                                      <span key={person.user_id} className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-1 py-0.5 rounded text-xs">
                                         {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                    {shift.personnel.envoi?.map(person => (
                                      <span key={person.user_id} className="bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-1 py-0.5 rounded text-xs">
                                         {person.username}
                                        {person.individual_start_time && ` (${person.individual_start_time}-${person.individual_end_time})`}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Si aucun personnel */}
                              {(!shift.personnel?.salle?.length && !shift.personnel?.bar?.length && 
                                !shift.personnel?.chaud?.length && !shift.personnel?.pain?.length && 
                                !shift.personnel?.envoi?.length) && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                                  Aucun personnel assigné
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {dayShifts.length === 0 && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
                            Aucun shift planifié
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
              
              {weeklyShifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun shift planifié cette semaine</p>
                    {hasRole(['manager', 'responsable']) && (
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
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            person.validated ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {person.validated ? 'Validé' : 'En attente'}
                          </span>
                          {hasRole(['manager', 'responsable']) && (
                            <button 
                              onClick={() => removeUserFromPosition('salle', person.user_id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Retirer cette personne"
                            >
                              ×
                            </button>
                          )}
                        </div>
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
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            person.validated ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {person.validated ? 'Validé' : 'En attente'}
                          </span>
                          {hasRole(['manager', 'responsable']) && (
                            <button 
                              onClick={() => removeUserFromPosition('bar', person.user_id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Retirer cette personne"
                            >
                              ×
                            </button>
                          )}
                        </div>
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
                          <div key={`chaud-${person.user_id}`} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <div>
                              <div className="font-medium text-red-900 dark:text-red-100">{person.username}</div>
                              {person.individual_start_time && person.individual_end_time && (
                                <div className="text-xs text-red-600">{person.individual_start_time} - {person.individual_end_time}</div>
                              )}
                            </div>
                            {hasRole(['manager', 'responsable']) && (
                              <button 
                                onClick={() => removeUserFromPosition('chaud', person.user_id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Retirer cette personne"
                              >
                                ×
                              </button>
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
                          <div key={`pain-${person.user_id}`} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                            <div>
                              <div className="font-medium text-orange-900 dark:text-orange-100">{person.username}</div>
                              {person.individual_start_time && person.individual_end_time && (
                                <div className="text-xs text-orange-600">{person.individual_start_time} - {person.individual_end_time}</div>
                              )}
                            </div>
                            {hasRole(['manager', 'responsable']) && (
                              <button 
                                onClick={() => removeUserFromPosition('pain', person.user_id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Retirer cette personne"
                              >
                                ×
                              </button>
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
                          <div key={`envoi-${person.user_id}`} className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <div>
                              <div className="font-medium text-purple-900 dark:text-purple-100">{person.username}</div>
                              {person.individual_start_time && person.individual_end_time && (
                                <div className="text-xs text-purple-600">{person.individual_start_time} - {person.individual_end_time}</div>
                              )}
                            </div>
                            {hasRole(['manager', 'responsable']) && (
                              <button 
                                onClick={() => removeUserFromPosition('envoi', person.user_id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Retirer cette personne"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options pour les managers et responsables */}
            {hasRole(['manager', 'responsable']) && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">⚙️ Options de gestion</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Boutons d'ajout de personnel */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">Ajouter du personnel</h5>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openAddPersonModal('salle')}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
                      >
                        + Salle
                      </button>
                      <button
                        onClick={() => openAddPersonModal('bar')}
                        className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
                      >
                        + Bar
                      </button>
                      <button
                        onClick={() => openAddPersonModal('chaud')}
                        className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200"
                      >
                        + Chaud
                      </button>
                      <button
                        onClick={() => openAddPersonModal('pain')}
                        className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm hover:bg-orange-200"
                      >
                        + Pain
                      </button>
                      <button
                        onClick={() => openAddPersonModal('envoi')}
                        className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm hover:bg-purple-200"
                      >
                        + Envoi
                      </button>
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">Actions</h5>
                    <div className="space-y-2">
                      <button
                        onClick={() => calculateShiftSalaries(shift)}
                        className="w-full px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm hover:bg-green-200 flex items-center gap-2"
                      >
                        💰 Voir les salaires
                      </button>
                      <button
                        onClick={() => navigate(`/validate?shift_id=${shift.id}&date=${shift.date}`)}
                        className="w-full px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200 flex items-center gap-2"
                      >
                        ✅ Valider les heures
                      </button>
                      <button
                        onClick={() => deleteShift(shift.id)}
                        className="w-full px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm hover:bg-red-200 flex items-center gap-2"
                      >
                        🗑️ Supprimer le shift
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
          {/* Boutons de vue retirés */}
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
          
          {/* Bouton pour revenir à aujourd'hui et actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedWeek(getWeekStart(new Date()))}
              className="btn-hero-secondary btn-hero-sm"
              title="Revenir à la semaine actuelle"
            >
              📅 Aujourd'hui
            </button>
            
            {/* Bouton Créer/Modifier planning retiré */}
          </div>
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
      
      {/* Modal d'édition du personnel (managers et responsables seulement) */}
      {showEditModal && editingShift && hasRole(['manager', 'responsable']) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    👥 Modifier l'équipe
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {editingShift.title} - {new Date(editingShift.date).toLocaleDateString('fr-FR')} ({editingShift.start_time} - {editingShift.end_time})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deleteShift(editingShift.id)}
                    disabled={editLoading}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Supprimer le shift"
                  >
                    🗑️
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingShift(null);
                      setError('');
                      setSearchTerm('');
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="alert-hero alert-hero-destructive mb-4">
                  <div className="alert-hero-title">Erreur</div>
                  <div className="alert-hero-description">{error}</div>
                </div>
              )}

              {/* Équipe actuelle - Vue simplifiée */}
              <div className="mb-6 flex flex-wrap gap-2">
                {/* Afficher les gens assignés de manière simple */}
                {editingShift.personnel?.salle?.map(person => (
                  <div key={person.user_id} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    <span>🍽️ {person.username}</span>
                    <button 
                      onClick={() => removeUserFromPosition('salle', person.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editingShift.personnel?.bar?.map(person => (
                  <div key={person.user_id} className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    <span>🍸 {person.username}</span>
                    <button 
                      onClick={() => removeUserFromPosition('bar', person.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editingShift.personnel?.chaud?.map(person => (
                  <div key={person.user_id} className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    <span>🔥 {person.username}</span>
                    <button 
                      onClick={() => removeUserFromPosition('chaud', person.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editingShift.personnel?.pain?.map(person => (
                  <div key={person.user_id} className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                    <span>🥖 {person.username}</span>
                    <button 
                      onClick={() => removeUserFromPosition('pain', person.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {editingShift.personnel?.envoi?.map(person => (
                  <div key={person.user_id} className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    <span>📦 {person.username}</span>
                    <button 
                      onClick={() => removeUserFromPosition('envoi', person.user_id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Interface de sélection par position */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  ➕ Ajouter du personnel
                </h4>
                
                {/* Sélecteurs par position */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Salle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      🍽️ Salle
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignUserToPosition('salle', parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner...</option>
                      {allUsers
                        .filter(user => user.positions?.includes('salle') || user.positions?.includes('bar'))
                        .filter(user => !editingShift.personnel?.salle?.find(p => p.user_id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Bar */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      🍸 Bar
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignUserToPosition('bar', parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner...</option>
                      {allUsers
                        .filter(user => user.positions?.includes('bar') || user.positions?.includes('salle'))
                        .filter(user => !editingShift.personnel?.bar?.find(p => p.user_id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Chaud */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      🔥 Chaud
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignUserToPosition('chaud', parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner...</option>
                      {allUsers
                        .filter(user => user.positions?.includes('chaud') || user.positions?.includes('cuisine'))
                        .filter(user => !editingShift.personnel?.chaud?.find(p => p.user_id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Pain */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      🥖 Pain
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignUserToPosition('pain', parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner...</option>
                      {allUsers
                        .filter(user => user.positions?.includes('pain') || user.positions?.includes('cuisine'))
                        .filter(user => !editingShift.personnel?.pain?.find(p => p.user_id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Envoi */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      📦 Envoi
                    </label>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignUserToPosition('envoi', parseInt(e.target.value));
                          e.target.value = '';
                        }
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">Sélectionner...</option>
                      {allUsers
                        .filter(user => user.positions?.includes('envoi') || user.positions?.includes('cuisine'))
                        .filter(user => !editingShift.personnel?.envoi?.find(p => p.user_id === user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingShift(null);
                    setError('');
                    setSearchTerm('');
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={saveShiftChanges}
                  disabled={editLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center"
                >
                  {editLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Sauvegarder
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de gestion des horaires individuels */}
      {showTimeModal && selectedPersonForTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    ⏰ Horaires individuels
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Position: {selectedPersonForTime.position}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTimeModal(false);
                    setSelectedPersonForTime(null);
                    setIndividualStartTime('');
                    setIndividualEndTime('');
                    setError('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="alert-hero alert-hero-destructive">
                  <div className="alert-hero-title">Erreur</div>
                  <div className="alert-hero-description">{error}</div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    🕐 Heure de début
                  </label>
                  <input 
                    type="time"
                    className="w-full p-3 text-lg border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={individualStartTime}
                    onChange={(e) => setIndividualStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    🕐 Heure de fin
                  </label>
                  <input 
                    type="time"
                    className="w-full p-3 text-lg border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={individualEndTime}
                    onChange={(e) => setIndividualEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTimeModal(false);
                    setSelectedPersonForTime(null);
                    setIndividualStartTime('');
                    setIndividualEndTime('');
                    setError('');
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 py-3 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmAssignmentWithTime}
                  disabled={editLoading || !individualStartTime || !individualEndTime}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  {editLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Assignation...
                    </>
                  ) : (
                    <>
                      <ClockIcon className="w-4 h-4 mr-2" />
                      Confirmer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal des salaires */}
      {showSalaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  💰 Salaires du shift
                </h3>
                <button
                  onClick={() => {
                    setShowSalaryModal(false);
                    setCurrentShiftSalaries([]);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {currentShiftSalaries.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">
                    Aucun salaire calculable pour ce shift.<br/>
                    Les heures doivent être validées pour calculer les salaires.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Personne</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Position</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Heures</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Taux/h</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Horaires</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Salaire</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentShiftSalaries.map((salary, index) => (
                          <tr key={index} className="border-b border-slate-100 dark:border-slate-700">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                              {salary.username}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                salary.position === 'salle' ? 'bg-blue-100 text-blue-800' :
                                salary.position === 'bar' ? 'bg-green-100 text-green-800' :
                                salary.position === 'chaud' ? 'bg-red-100 text-red-800' :
                                salary.position === 'pain' ? 'bg-orange-100 text-orange-800' :
                                salary.position === 'envoi' ? 'bg-purple-100 text-purple-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {salary.position}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              {salary.hoursWorked}h
                            </td>
                            <td className="py-3 px-4 text-center font-mono">
                              {salary.hourlyRate}€
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-slate-600 dark:text-slate-400">
                              {salary.clockIn} - {salary.clockOut}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-green-600">
                              {salary.salary}€
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                          <td colSpan="5" className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                            Total :
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-600 text-lg">
                            {currentShiftSalaries.reduce((total, salary) => total + parseFloat(salary.salary), 0).toFixed(2)}€
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowSalaryModal(false);
                  setCurrentShiftSalaries([]);
                }}
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'ajout de personnel */}
      {showAddPersonModal && selectedPosition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  👥 Ajouter du personnel - {selectedPosition}
                </h3>
                <button
                  onClick={() => {
                    setShowAddPersonModal(false);
                    setSelectedPosition('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Sélectionner une personne
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      assignUserToPosition(selectedPosition, parseInt(e.target.value));
                      setShowAddPersonModal(false);
                      setSelectedPosition('');
                    }
                  }}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Choisir...</option>
                  {allUsers
                    .filter(user => {
                      // Filtrer selon la position
                      if (selectedPosition === 'salle') return user.positions?.includes('salle');
                      if (selectedPosition === 'bar') return user.positions?.includes('bar');
                      if (selectedPosition === 'chaud') return user.positions?.includes('chaud') || user.positions?.includes('cuisine');
                      if (selectedPosition === 'pain') return user.positions?.includes('pain') || user.positions?.includes('cuisine');
                      if (selectedPosition === 'envoi') return user.positions?.includes('envoi') || user.positions?.includes('cuisine');
                      return false;
                    })
                    .filter(user => {
                      // Vérifier que la personne n'est pas déjà assignée à ce shift
                      const shift = selectedShift?.shifts[0];
                      if (!shift) return true;
                      const allAssigned = [
                        ...(shift.personnel?.salle || []),
                        ...(shift.personnel?.bar || []),
                        ...(shift.personnel?.chaud || []),
                        ...(shift.personnel?.pain || []),
                        ...(shift.personnel?.envoi || [])
                      ];
                      return !allAssigned.find(p => p.user_id === user.id);
                    })
                    .map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowAddPersonModal(false);
                  setSelectedPosition('');
                }}
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftCalendar; 