import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, timeclockService, userService, availabilityService } from '../services/api';
import { Link } from 'react-router-dom';
import { getPositionConfig } from '../constants/positions';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  CurrencyEuroIcon,
  PlayIcon,
  StopIcon,
  CalendarIcon,
  UsersIcon,
  XMarkIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  UserPlusIcon,
  UserGroupIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, hasRole } = useContext(AuthContext);

  // Fonctions utilitaires pour l'affichage des positions
  const getPositionLabel = (position) => {
    const config = getPositionConfig(position);
    const icons = {
      'cuisine': '👨‍🍳',
      'chaud': '🔥',
      'pain': '🥖',
      'envoi': '📤',
      'salle': '🍽️',
      'bar': '🍸'
    };
    return `${icons[position] || '👤'} ${config.label}`;
  };

  const getPositionColorClass = (position) => {
    const colorMap = {
      'cuisine': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'chaud': 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
      'pain': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'envoi': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'salle': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'bar': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colorMap[position] || 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
  };

  const getPositionDotColor = (position) => {
    const colorMap = {
      'cuisine': 'bg-red-500',
      'chaud': 'bg-red-600',
      'pain': 'bg-orange-500',
      'envoi': 'bg-purple-500',
      'salle': 'bg-blue-500',
      'bar': 'bg-green-500'
    };
    return colorMap[position] || 'bg-slate-500';
  };
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
  const [allMonthlyShifts, setAllMonthlyShifts] = useState([]);
  
  // États pour la vue mobile minimaliste
  const [expandedShift, setExpandedShift] = useState(null);
  const [currentShiftIndex, setCurrentShiftIndex] = useState(0);
  
  // États pour la modal de détails
  const [selectedShift, setSelectedShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);

  // États pour la gestion des disponibilités
  const [availableShifts, setAvailableShifts] = useState([]);
  const [pendingReplacements, setPendingReplacements] = useState([]);
  const [unavailabilityReason, setUnavailabilityReason] = useState('');
  const [showUnavailabilityModal, setShowUnavailabilityModal] = useState(false);
  const [selectedShiftForUnavailability, setSelectedShiftForUnavailability] = useState(null);
  const [showReplacementDetailsModal, setShowReplacementDetailsModal] = useState(false);
  const [selectedReplacementRequest, setSelectedReplacementRequest] = useState(null);
  const [userUnavailabilities, setUserUnavailabilities] = useState([]);

  // États pour l'historique des remplacements
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [replacementHistory, setReplacementHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // État pour forcer la mise à jour en temps réel
  const [currentTime, setCurrentTime] = useState(new Date());
  


  // Charger les shifts disponibles et demandes de remplacement
  const loadAvailabilityData = async () => {
    try {
      // Charger les shifts disponibles pour remplacement
      const availableResponse = await availabilityService.getAvailableShifts();
      setAvailableShifts(availableResponse.data);

      // Pour les managers, charger les demandes en attente
      if (hasRole(['manager'])) {
        const pendingResponse = await availabilityService.getPendingReplacements();
        setPendingReplacements(pendingResponse.data);
      }

      // Charger les indisponibilités de l'utilisateur courant
      const unavailabilitiesResponse = await availabilityService.getUserUnavailabilities();
      setUserUnavailabilities(unavailabilitiesResponse.data);
    } catch (err) {
      console.error('Erreur lors du chargement des disponibilités:', err);
    }
  };

  // Fonction pour rafraîchir seulement les données de disponibilité (optimisée)
  const refreshAvailabilityData = async () => {
    try {
      // Exécuter les requêtes en parallèle pour plus de rapidité
      const promises = [
        availabilityService.getAvailableShifts(),
        availabilityService.getUserUnavailabilities()
      ];

      // Ajouter la requête des demandes de remplacement seulement pour les managers
      if (hasRole(['manager'])) {
        promises.push(availabilityService.getPendingReplacements());
      }

      const results = await Promise.all(promises);
      
      // Traiter les shifts disponibles
      setAvailableShifts(results[0].data);

      // Traiter les indisponibilités
      setUserUnavailabilities(results[1].data);

      // Traiter les demandes de remplacement (si applicable)
      if (hasRole(['manager']) && results[2]) {
        setPendingReplacements(results[2].data);
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des disponibilités:', err);
    }
  };

  // Fonction pour rafraîchir seulement le shift actif (optimisée pour la vitesse)
  const refreshActiveShift = async () => {
    try {
      if (user) {
        // Récupérer seulement les shifts d'aujourd'hui pour optimiser
        const response = await shiftService.getUserShifts(user.id);
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Optimisation: traiter seulement les shifts d'aujourd'hui
        const todayShifts = response.data.filter(shift => shift.date === today);
        
        // Trouver le shift actif pour le pointage (10 min avant le début jusqu'à la fin)
        const activeShift = todayShifts.find(shift => {
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
          return now >= tenMinutesBefore && now <= shiftEndTime && !shift.clock_out;
        });
        
        // Mettre à jour seulement si le shift a changé (optimisation)
        if (activeShift?.shift_id !== activeClockingShift?.shift_id || 
            activeShift?.clock_in !== activeClockingShift?.clock_in ||
            activeShift?.clock_out !== activeClockingShift?.clock_out) {
          setActiveClockingShift(activeShift || null);
        }
        
        // Déterminer si l'utilisateur est actuellement en shift (pour les stats)
        const current = activeShift && activeShift.clock_in && !activeShift.clock_out ? activeShift : null;
        if (current?.shift_id !== currentShift?.shift_id) {
          setCurrentShift(current);
        }
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement du shift actif:', err);
    }
  };

  // Marquer comme non disponible
  const markUnavailable = async (shift, reason) => {
    try {
      await availabilityService.markUnavailable(shift.shift_id, reason);
      setShowUnavailabilityModal(false);
      setUnavailabilityReason('');
      setSelectedShiftForUnavailability(null);
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshAvailabilityData();
      setTimeout(() => refreshAvailabilityData(), 500);
      setTimeout(() => refreshAvailabilityData(), 1000);
      setError('');
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.response?.data?.message || 'Erreur lors de la déclaration d\'indisponibilité');
    }
  };

  // Annuler l'indisponibilité (reprendre son shift)
  const cancelUnavailability = async (shiftId) => {
    try {
      await availabilityService.cancelUnavailability(shiftId);
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshAvailabilityData();
      setTimeout(() => refreshAvailabilityData(), 500);
      setTimeout(() => refreshAvailabilityData(), 1000);
      setError('');
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'annulation de l\'indisponibilité');
    }
  };

  // Proposer de remplacer
  const proposeReplacement = async (shift) => {
    try {
      await availabilityService.proposeReplacement(shift.shift_id, shift.original_user_id);
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshAvailabilityData();
      setTimeout(() => refreshAvailabilityData(), 500);
      setTimeout(() => refreshAvailabilityData(), 1000);
      setError('');
      alert('Demande de remplacement envoyée !');
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.response?.data?.message || 'Erreur lors de la demande de remplacement');
    }
  };

  // Approuver/rejeter un remplacement (managers)
  const handleReplacementDecision = async (replacementId, approved) => {
    try {
      await availabilityService.approveReplacement(replacementId, approved);
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshAvailabilityData();
      setTimeout(() => refreshAvailabilityData(), 500);
      setTimeout(() => refreshAvailabilityData(), 1000);
      setError('');
      alert(approved ? 'Remplacement approuvé !' : 'Remplacement rejeté');
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.response?.data?.message || 'Erreur lors de la décision');
    }
  };

  // Ouvrir la modal d'indisponibilité
  const openUnavailabilityModal = (shift) => {
    setSelectedShiftForUnavailability(shift);
    setShowUnavailabilityModal(true);
  };

  // Ouvrir la modal de détails de demande de remplacement
  const openReplacementDetailsModal = (replacement) => {
    setSelectedReplacementRequest(replacement);
    setShowReplacementDetailsModal(true);
  };

  // Fermer la modal de détails de demande de remplacement
  const closeReplacementDetailsModal = () => {
    setShowReplacementDetailsModal(false);
    setSelectedReplacementRequest(null);
  };

  // Vérifier si un shift a une indisponibilité déclarée
  const isShiftUnavailable = (shiftId) => {
    return userUnavailabilities.some(unavail => unavail.shift_id === shiftId);
  };

  // Ouvrir la modal d'historique des remplacements
  const openHistoryModal = async () => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const response = await availabilityService.getReplacementHistory();
      setReplacementHistory(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement de l\'historique:', err);
      setError('Erreur lors du chargement de l\'historique');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fermer la modal d'historique
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setReplacementHistory([]);
  };

  // Supprimer un remplacement de l'historique
  const deleteReplacementFromHistory = async (replacementId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce remplacement de l\'historique ?')) {
      return;
    }
    
    try {
      await availabilityService.deleteReplacementFromHistory(replacementId);
      
      // Recharger l'historique
      const response = await availabilityService.getReplacementHistory();
      setReplacementHistory(response.data);
      
      setError('');
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

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
          
          // Tous les shifts du mois (pour les calculs d'heures validées et salaire)
          const allMonthlyShifts = response.data.filter(shift => {
            const shiftDate = new Date(shift.date);
            return shiftDate.getMonth() === currentMonth && 
                   shiftDate.getFullYear() === currentYear;
          });
          
          // Shifts à venir du mois (pour l'affichage de la liste)
          const monthlyShifts = allMonthlyShifts.filter(shift => 
            shift.date >= today
          );
          
          setPastShifts(past);
          setMonthlyShifts(monthlyShifts);
          setAllMonthlyShifts(allMonthlyShifts);
          
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
                ...(personnelResponse.data?.bar || []),
                ...(personnelResponse.data?.chaud || []),
                ...(personnelResponse.data?.pain || []),
                ...(personnelResponse.data?.envoi || [])
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
          
          // Charger les données de disponibilité
          await loadAvailabilityData();
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

  // Système de rafraîchissement automatique en temps réel ultra-rapide
  useEffect(() => {
    if (!user || isLoading) return;

    // Déclencher immédiatement le premier rafraîchissement
    refreshAvailabilityData();
    refreshActiveShift();

    // Mettre à jour l'heure actuelle toutes les 5 secondes pour les compteurs
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); // Toutes les 5 secondes

    // Rafraîchir les données de disponibilité toutes les 3 secondes (ultra-rapide)
    const availabilityInterval = setInterval(() => {
      refreshAvailabilityData();
    }, 3000); // Toutes les 3 secondes

    // Rafraîchir le shift actif toutes les 5 secondes (pour le pointage)
    const activeShiftInterval = setInterval(() => {
      refreshActiveShift();
    }, 5000); // Toutes les 5 secondes

    return () => {
      clearInterval(timeInterval);
      clearInterval(availabilityInterval);
      clearInterval(activeShiftInterval);
    };
  }, [user, isLoading]);

  const handleClockIn = async (shiftId) => {
    try {
      setClockInLoading(true);
      
      await timeclockService.clockIn({
        userId: user.id,
        shiftId
      });
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshActiveShift();
      setTimeout(() => refreshActiveShift(), 300);
      setTimeout(() => refreshActiveShift(), 800);
      setError('');
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
      
      // Recharger immédiatement et plusieurs fois pour garantir la mise à jour
      refreshActiveShift();
      setTimeout(() => refreshActiveShift(), 300);
      setTimeout(() => refreshActiveShift(), 800);
      setError('');
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
    const now = currentTime; // Utiliser l'état currentTime pour les mises à jour automatiques
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

  // Fonction pour ouvrir la modal de détails
  const openShiftModal = (shift) => {
    setSelectedShift(shift);
    setShowShiftModal(true);
  };

  // Fonction pour fermer la modal
  const closeShiftModal = () => {
    setSelectedShift(null);
    setShowShiftModal(false);
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
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header unifié */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
          Tableau de bord
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Bienvenue, <span className="font-semibold text-blue-600">{user?.username}</span>
        </p>
      </div>
      
      {/* Messages d'erreur */}
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <div className="alert-hero-description">{error}</div>
        </div>
      )}

      {/* Section 1: Box de pointage active */}
      {activeClockingShift && (
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 shadow-xl">
            {/* Effet visuel de fond */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-purple-400/10 dark:from-blue-400/5 dark:to-purple-400/5"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-400/20 dark:bg-blue-400/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-400/20 dark:bg-purple-400/10 rounded-full blur-3xl"></div>
            
            <div className="relative p-6 md:p-8">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                {/* Informations du shift */}
                <div className="flex-1 space-y-6">
                  {/* Header avec titre et statut */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <ClockIcon className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                          {activeClockingShift.title}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPositionColorClass(activeClockingShift.position)}`}>
                            {getPositionLabel(activeClockingShift.position)}
                          </span>
                          {activeClockingShift.clock_in && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              ✅ Pointé à {formatTime(activeClockingShift.clock_in)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Détails du shift */}
                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                          <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Date</div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatDateWithDay(activeClockingShift.date)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                          <ClockIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Horaires</div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {activeClockingShift.start_time} - {activeClockingShift.end_time}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Statut du shift */}
                    <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                      {(() => {
                        const status = getClockingStatus(activeClockingShift);
                        if (status === 'in_progress') {
                          return (
                            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                              <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              <span className="font-medium text-orange-900 dark:text-orange-100">
                                Shift en cours depuis {formatTime(activeClockingShift.clock_in)}
                              </span>
                            </div>
                          );
                        } 
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Boutons d'action */}
                <div className="flex flex-col gap-4 w-full lg:w-auto lg:min-w-[200px]">
                  {!activeClockingShift.clock_in ? (
                    <button 
                      className="relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      onClick={() => handleClockIn(activeClockingShift.shift_id)}
                      disabled={clockInLoading}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                      <div className="relative flex items-center justify-center gap-3">
                        {clockInLoading ? (
                          <>
                            <div className="loading-spinner h-5 w-5"></div>
                            <span>Pointage...</span>
                          </>
                        ) : (
                          <>
                            <PlayIcon className="h-6 w-6" />
                            <span>Pointer l'entrée</span>
                          </>
                        )}
                      </div>
                    </button>
                  ) : !activeClockingShift.clock_out ? (
                    <button 
                      className="relative overflow-hidden bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      onClick={() => handleClockOut(activeClockingShift.shift_id)}
                      disabled={clockOutLoading}
                    >
                      <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                      <div className="relative flex items-center justify-center gap-3">
                        {clockOutLoading ? (
                          <>
                            <div className="loading-spinner h-5 w-5"></div>
                            <span>Pointage...</span>
                          </>
                        ) : (
                          <>
                            <StopIcon className="h-6 w-6" />
                            <span>Pointer la sortie</span>
                          </>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 font-semibold py-4 px-8 rounded-xl border border-green-200 dark:border-green-700">
                      <CheckCircleIcon className="h-6 w-6" />
                      <span>Shift terminé</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      
      {/* Section 2: Grid principal */}
      <section>
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Colonne principale - 3/4 */}
          <div className="xl:col-span-3 space-y-8">
            
            {/* Analytics utilisateur */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="stat-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
                <div className="stat-value text-blue-600">{allMonthlyShifts.length}</div>
                <div className="stat-label">
                  <CalendarIcon className="h-4 w-4 inline mr-1" />
                  Shifts ce mois
                </div>
              </div>
              
              <div className="stat-card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700">
                <div className="stat-value text-indigo-600">
                  {(() => {
                    const totalPlannedHours = allMonthlyShifts.reduce((total, shift) => {
                        const [startHour, startMinute] = shift.start_time.split(':').map(Number);
                        const [endHour, endMinute] = shift.end_time.split(':').map(Number);
                        
                        let startTime = startHour + startMinute / 60;
                        let endTime = endHour + endMinute / 60;
                        
                        if (endTime < startTime) {
                          endTime += 24;
                        }
                        
                        return total + (endTime - startTime);
                      }, 0);
                      
                      return Math.round(totalPlannedHours);
                  })()}h
                </div>
                <div className="stat-label">
                  <ClockIcon className="h-4 w-4 inline mr-1" />
                  Heures prévues
                </div>
              </div>
              
              <div className="stat-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700">
                <div className="stat-value text-green-600">
                  {(() => {
                    const totalValidatedHours = allMonthlyShifts.reduce((total, shift) => {
                      if (shift.clock_in && shift.clock_out && shift.validated) {
                        const clockIn = new Date(shift.clock_in);
                        const clockOut = new Date(shift.clock_out);
                        const actualHours = (clockOut - clockIn) / (1000 * 60 * 60);
                        return total + actualHours;
                      }
                      return total;
                    }, 0);
                    
                    return Math.round(totalValidatedHours * 10) / 10;
                  })()}h
                </div>
                <div className="stat-label">
                  <CheckCircleIcon className="h-4 w-4 inline mr-1" />
                  Heures validées
                </div>
              </div>
              
              <div className="stat-card bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700">
                <div className="stat-value text-emerald-600">
                  {(() => {
                    if (!userDetails?.hourly_rate) return 'Non défini';
                    
                    const totalValidatedHours = allMonthlyShifts.reduce((total, shift) => {
                      if (shift.clock_in && shift.clock_out && shift.validated) {
                        const clockIn = new Date(shift.clock_in);
                        const clockOut = new Date(shift.clock_out);
                        const actualHours = (clockOut - clockIn) / (1000 * 60 * 60);
                        return total + actualHours;
                      }
                      return total;
                    }, 0);
                    
                    const validatedEarnings = Math.round(totalValidatedHours * userDetails.hourly_rate * 100) / 100;
                    return `${validatedEarnings.toFixed(2)}€`;
                  })()}
                </div>
                <div className="stat-label">
                  <CurrencyEuroIcon className="h-4 w-4 inline mr-1" />
                  Salaire validé
                </div>
              </div>
            </div>

            {/* Prochains shifts */}
            <div className="card-hero">
              <div className="card-hero-header">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <CalendarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Prochains shifts
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {monthlyShifts.length > 0 
                        ? `${monthlyShifts.length} shift${monthlyShifts.length > 1 ? 's' : ''} planifié${monthlyShifts.length > 1 ? 's' : ''}`
                        : 'Aucun shift prévu prochainement'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="card-hero-content">
                {monthlyShifts.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-600 dark:text-slate-400">Aucun shift planifié prochainement.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Vue desktop - table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium">Quand</th>
                            <th className="text-left py-3 px-4 font-medium">Où</th>
                            <th className="text-left py-3 px-4 font-medium">Avec qui</th>
                            <th className="text-center py-3 px-4 font-medium">Statut</th>
                            <th className="text-center py-3 px-4 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyShifts.map(shift => {
                            const isToday = shift.date === new Date().toISOString().split('T')[0];
                            const isTomorrow = shift.date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            const shiftUnavailable = isShiftUnavailable(shift.shift_id);
                            
                            return (
                              <tr key={shift.user_shift_id} className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group ${
                                isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 
                                shiftUnavailable ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : ''
                              }`} onClick={() => openShiftModal(shift)}>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${
                                      isToday ? 'bg-blue-500' : 
                                      isTomorrow ? 'bg-orange-400' : 
                                      shiftUnavailable ? 'bg-orange-500' : 
                                      'bg-slate-400'
                                    }`}></div>
                                    <div>
                                      <div className={`font-semibold ${
                                        isToday ? 'text-blue-900 dark:text-blue-100' : 
                                        shiftUnavailable ? 'text-orange-900 dark:text-orange-100' : 
                                        'text-slate-900 dark:text-slate-100'
                                      }`}>
                                        {isToday ? "Aujourd'hui" : isTomorrow ? "Demain" : new Date(shift.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                        {shiftUnavailable && <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Indisponible</span>}
                                      </div>
                                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {shift.start_time} - {shift.end_time}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPositionColorClass(shift.position)}`}>
                                    {getPositionLabel(shift.position)}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  {shiftColleagues[shift.shift_id] && shiftColleagues[shift.shift_id].length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {shiftColleagues[shift.shift_id].slice(0, 3).map(colleague => (
                                        <span 
                                          key={colleague.user_id}
                                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                          title={`${colleague.username} - ${colleague.position}`}
                                        >
                                          {colleague.username}
                                        </span>
                                      ))}
                                      {shiftColleagues[shift.shift_id].length > 3 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                                          +{shiftColleagues[shift.shift_id].length - 3}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-500 dark:text-slate-400">Seul(e)</span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex justify-center">
                                    {!shift.clock_in && !shift.clock_out && !shiftUnavailable && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                        <CalendarIcon className="h-4 w-4 mr-1" />
                                        Planifié
                                      </span>
                                    )}
                                    {!shift.clock_in && !shift.clock_out && shiftUnavailable && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                        <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                        En recherche de remplaçant
                                      </span>
                                    )}
                                    {shift.clock_in && !shift.clock_out && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                        <ClockIcon className="h-4 w-4 mr-1" />
                                        En cours
                                      </span>
                                    )}
                                    {shift.clock_in && shift.clock_out && !shift.validated && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                        <ClockIcon className="h-4 w-4 mr-1" />
                                        En attente
                                      </span>
                                    )}
                                    {shift.clock_in && shift.clock_out && shift.validated && (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                                        Validé
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  {!shift.clock_in && !shift.clock_out && !shiftUnavailable && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openUnavailabilityModal(shift);
                                      }}
                                      className="btn-hero-outline border-orange-300 text-orange-600 hover:bg-orange-50 text-sm px-3 py-1 whitespace-nowrap"
                                    >
                                      <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                                      Pas disponible
                                    </button>
                                  )}
                                  {!shift.clock_in && !shift.clock_out && shiftUnavailable && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelUnavailability(shift.shift_id);
                                      }}
                                      className="btn-hero-outline border-green-300 text-green-600 hover:bg-green-50 text-sm px-3 py-1"
                                    >
                                      <CheckIcon className="h-4 w-4 mr-1" />
                                      Je suis disponible
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Vue mobile - cards */}
                    <div className="md:hidden space-y-3">
                      {monthlyShifts.map(shift => {
                        const isToday = shift.date === new Date().toISOString().split('T')[0];
                        const isTomorrow = shift.date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        const shiftUnavailable = isShiftUnavailable(shift.shift_id);
                        
                        return (
                          <div key={shift.user_shift_id} className={`rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer active:scale-95 ${
                            isToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700' :
                            shiftUnavailable ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' :
                            'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`} onClick={() => openShiftModal(shift)}>
                            {/* Header avec indicateur visuel */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${
                                  isToday ? 'bg-blue-500' : 
                                  isTomorrow ? 'bg-orange-400' : 
                                  shiftUnavailable ? 'bg-orange-500' : 
                                  'bg-slate-400'
                                } ${isToday ? 'animate-pulse' : ''}`}></div>
                                <div>
                                  <div className={`font-bold text-lg ${
                                    isToday ? 'text-blue-900 dark:text-blue-100' : 
                                    shiftUnavailable ? 'text-orange-900 dark:text-orange-100' : 
                                    'text-slate-900 dark:text-slate-100'
                                  }`}>
                                    {isToday ? "🌟 Aujourd'hui" : isTomorrow ? "📅 Demain" : new Date(shift.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    {shiftUnavailable && <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Indisponible</span>}
                                  </div>
                                  <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                    {shift.start_time} - {shift.end_time}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Position */}
                              <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold ${getPositionColorClass(shift.position)}`}>
                                {getPositionLabel(shift.position)}
                              </span>
                            </div>

                            {/* Contenu principal */}
                            <div className="space-y-3">
                              {/* Équipe */}
                              {shiftColleagues[shift.shift_id] && shiftColleagues[shift.shift_id].length > 0 && (
                                <div>
                                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">👥 Équipe</div>
                                  <div className="flex flex-wrap gap-2">
                                    {shiftColleagues[shift.shift_id].slice(0, 4).map(colleague => (
                                      <span 
                                        key={colleague.user_id}
                                        className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                      >
                                        {colleague.username}
                                      </span>
                                    ))}
                                    {shiftColleagues[shift.shift_id].length > 4 && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                                        +{shiftColleagues[shift.shift_id].length - 4}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Statut */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Statut</span>
                                <div>
                                  {!shift.clock_in && !shift.clock_out && !shiftUnavailable && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                      <CalendarIcon className="h-4 w-4 mr-1" />
                                      Planifié
                                    </span>
                                  )}
                                  {!shift.clock_in && !shift.clock_out && shiftUnavailable && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                      En recherche de remplaçant
                                    </span>
                                  )}
                                  {shift.clock_in && !shift.clock_out && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                      <ClockIcon className="h-4 w-4 mr-1" />
                                      En cours
                                    </span>
                                  )}
                                  {shift.clock_in && shift.clock_out && !shift.validated && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                      <ClockIcon className="h-4 w-4 mr-1" />
                                      En attente
                                    </span>
                                  )}
                                  {shift.clock_in && shift.clock_out && shift.validated && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                                      Validé
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              {!shift.clock_in && !shift.clock_out && !shiftUnavailable && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openUnavailabilityModal(shift);
                                    }}
                                    className="w-full btn-hero-outline border-orange-300 text-orange-600 hover:bg-orange-50 text-sm py-2"
                                  >
                                    <ExclamationCircleIcon className="h-4 w-4 mr-2" />
                                    Je ne suis pas disponible
                                  </button>
                                </div>
                              )}
                              {!shift.clock_in && !shift.clock_out && shiftUnavailable && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelUnavailability(shift.shift_id);
                                    }}
                                    className="w-full btn-hero-outline border-green-300 text-green-600 hover:bg-green-50 text-sm py-2"
                                  >
                                    <CheckIcon className="h-4 w-4 mr-2" />
                                    Je suis disponible
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Shifts passés récents */}
            {pastShifts.length > 0 && (
              <div className="card-hero">
                <div className="card-hero-header">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center">
                      <ClockIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Shifts récents
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {pastShifts.length} shift{pastShifts.length > 1 ? 's' : ''} effectué{pastShifts.length > 1 ? 's' : ''} ces 7 derniers jours
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card-hero-content">
                  <div className="space-y-4">
                    {/* Vue desktop - table moderne */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium">Quand</th>
                            <th className="text-left py-3 px-4 font-medium">Où</th>
                            <th className="text-left py-3 px-4 font-medium">Durée</th>
                            <th className="text-center py-3 px-4 font-medium">Statut</th>
                            {userDetails?.hourly_rate && (
                              <th className="text-center py-3 px-4 font-medium">Salaire</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {pastShifts.map(shift => {
                            const clockIn = new Date(shift.clock_in);
                            const clockOut = new Date(shift.clock_out);
                            const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
                            const earnings = userDetails?.hourly_rate ? hoursWorked * userDetails.hourly_rate : 0;
                            const daysAgo = Math.floor((new Date() - new Date(shift.date)) / (1000 * 60 * 60 * 24));
                            
                            return (
                              <tr 
                                key={shift.user_shift_id} 
                                className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
                                onClick={() => openShiftModal(shift)}
                              >
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                                    <div>
                                      <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {daysAgo === 0 ? "Aujourd'hui" : daysAgo === 1 ? "Hier" : new Date(shift.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                      </div>
                                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {shift.start_time} - {shift.end_time}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPositionColorClass(shift.position)}`}>
                                    {getPositionLabel(shift.position)}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {hoursWorked.toFixed(1)}h travaillées
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                      {formatTime(shift.clock_in)} - {formatTime(shift.clock_out)}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex justify-center">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                      shift.validated ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    }`}>
                                      {shift.validated ? (
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
                                </td>
                                {userDetails?.hourly_rate && (
                                  <td className="py-4 px-4 text-center">
                                    <span className="font-bold text-green-600 dark:text-green-400">
                                      {earnings.toFixed(2)}€
                                    </span>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Vue mobile - Cartes modernes */}
                    <div className="md:hidden space-y-3">
                      {pastShifts.map(shift => {
                        const clockIn = new Date(shift.clock_in);
                        const clockOut = new Date(shift.clock_out);
                        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60);
                        const earnings = userDetails?.hourly_rate ? hoursWorked * userDetails.hourly_rate : 0;
                        const daysAgo = Math.floor((new Date() - new Date(shift.date)) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div 
                            key={shift.user_shift_id} 
                            className="rounded-xl p-4 border-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 cursor-pointer active:scale-95"
                            onClick={() => openShiftModal(shift)}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full bg-slate-400"></div>
                                <div>
                                  <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                    {daysAgo === 0 ? "🌟 Aujourd'hui" : daysAgo === 1 ? "📅 Hier" : new Date(shift.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                  </div>
                                  <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                    {shift.start_time} - {shift.end_time}
                                  </div>
                                </div>
                              </div>

                              {/* Position */}
                              <span className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-bold ${getPositionColorClass(shift.position)}`}>
                                {getPositionLabel(shift.position)}
                              </span>
                            </div>

                            {/* Contenu principal */}
                            <div className="space-y-3">
                              {/* Durée et heures */}
                              <div>
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">⏱️ Temps travaillé</div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xl text-slate-900 dark:text-slate-100">
                                    {hoursWorked.toFixed(1)}h
                                  </span>
                                  <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {formatTime(shift.clock_in)} - {formatTime(shift.clock_out)}
                                  </span>
                                </div>
                              </div>

                              {/* Statut et salaire */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Statut</span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    shift.validated ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  }`}>
                                    {shift.validated ? (
                                      <>
                                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                                        Validé
                                      </>
                                    ) : (
                                      <>
                                        <ClockIcon className="h-3 w-3 mr-1" />
                                        En attente
                                      </>
                                    )}
                                  </span>
                                </div>

                                {userDetails?.hourly_rate && (
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Salaire</div>
                                    <div className="font-bold text-lg text-green-600 dark:text-green-400">
                                      {earnings.toFixed(2)}€
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne latérale - 1/4 */}
          <div className="xl:col-span-1 space-y-8">
            {/* Section pour responsables et managers */}
            {hasRole(['responsable', 'manager']) && (
              <div className="card-hero">
                <div className="card-hero-header">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
                      <ClockIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Heures à valider
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {unvalidatedHours.length > 0 
                          ? `${unvalidatedHours.length} pointage${unvalidatedHours.length > 1 ? 's' : ''} en attente`
                          : 'Aucun pointage à valider'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                <div className="card-hero-content">
                  {unvalidatedHours.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircleIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                      <p className="text-slate-600 dark:text-slate-400 text-sm">Aucune heure en attente de validation.</p>
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
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Remplacements disponibles et demandes de remplacement */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Remplacements disponibles */}
        <div className="card-hero">
          <div className="card-hero-header">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center">
                <UserPlusIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Remplacements disponibles
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {availableShifts.length > 0 
                    ? `${availableShifts.length} shift${availableShifts.length > 1 ? 's' : ''} à remplacer`
                    : 'Aucun shift disponible actuellement'
                  }
                </p>
              </div>
            </div>
          </div>
          
          <div className="card-hero-content">
            {availableShifts.length === 0 ? (
              <div className="text-center py-12">
                <UserPlusIcon className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Aucun shift à remplacer
                </h4>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Quand vos collègues se déclarent indisponibles, leurs shifts apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {availableShifts.map((shift) => (
                  <div 
                    key={shift.shift_id} 
                    className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg transition-all duration-300 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            {shift.title}
                          </h4>

                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {new Date(shift.date).toLocaleDateString('fr-FR')} • {shift.start_time} - {shift.end_time}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        shift.position === 'cuisine' ? 'bg-red-100 text-red-800' :
                        shift.position === 'salle' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {shift.position}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        👤 {shift.original_username}
                      </span>
                      <button
                        onClick={() => proposeReplacement(shift)}
                        className="btn-hero-outline border-orange-300 text-orange-600 hover:bg-orange-50 text-sm px-3 py-1"
                      >
                        Proposer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demandes de remplacement (managers uniquement) */}
        {hasRole(['manager']) && (
          <div className="card-hero">
            <div className="card-hero-header">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Demandes de remplacement
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {pendingReplacements.length > 0 
                      ? `${pendingReplacements.length} demande${pendingReplacements.length > 1 ? 's' : ''} en attente`
                      : 'Aucune demande en attente'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card-hero-content">
              {pendingReplacements.length === 0 ? (
                <div className="text-center py-12">
                  <UsersIcon className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Aucune demande en attente
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    Les demandes de remplacement apparaîtront ici pour validation.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {pendingReplacements.map((replacement) => (
                    <div 
                      key={replacement.id} 
                      className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer transition-all duration-300 hover:shadow-md"
                      onClick={() => openReplacementDetailsModal(replacement)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                              {replacement.shift_title}
                            </h4>

                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {new Date(replacement.date).toLocaleDateString('fr-FR')} • {replacement.start_time} - {replacement.end_time}
                          </p>
                        </div>
                        <InformationCircleIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">{replacement.original_username}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-green-600">{replacement.replacement_username}</span>
                        </div>
                        
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleReplacementDecision(replacement.id, false)}
                            className="btn-hero bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1"
                          >
                            Refuser
                          </button>
                          <button
                            onClick={() => handleReplacementDecision(replacement.id, true)}
                            className="btn-hero bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                          >
                            Approuver
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bouton historique */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={openHistoryModal}
                  className="w-full btn-hero-outline border-blue-300 text-blue-600 hover:bg-blue-50 text-sm py-2"
                >
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Voir l'historique
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Modal de détails du shift */}
      {showShiftModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeShiftModal}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header de la modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <InformationCircleIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Détails du shift
                </h2>
              </div>
              <button 
                onClick={closeShiftModal}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Contenu de la modal */}
            <div className="p-6 space-y-6">
              {/* Informations principales */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      {selectedShift.title || 'Shift sans titre'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400">
                      {new Date(selectedShift.date).toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                {/* Position */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Position</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getPositionColorClass(selectedShift.position)}`}>
                    {getPositionLabel(selectedShift.position)}
                  </span>
                </div>

                {/* Horaires */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">⏰ Horaires prévus</div>
                    <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                      {selectedShift.start_time} - {selectedShift.end_time}
                    </div>
                  </div>
                  
                  {selectedShift.clock_in && selectedShift.clock_out && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">🕐 Heures réelles</div>
                      <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                        {formatTime(selectedShift.clock_in)} - {formatTime(selectedShift.clock_out)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {((new Date(selectedShift.clock_out) - new Date(selectedShift.clock_in)) / (1000 * 60 * 60)).toFixed(1)}h travaillées
                      </div>
                    </div>
                  )}
                </div>

                {/* Équipe */}
                {shiftColleagues[selectedShift.shift_id] && shiftColleagues[selectedShift.shift_id].length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">👥 Équipe ({shiftColleagues[selectedShift.shift_id].length})</div>
                    <div className="grid grid-cols-2 gap-2">
                      {shiftColleagues[selectedShift.shift_id].map(colleague => (
                        <div key={colleague.user_id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg">
                          <span className={`w-3 h-3 rounded-full ${
                            colleague.position === 'cuisine' ? 'bg-red-500' :
                            colleague.position === 'chaud' ? 'bg-red-600' :
                            colleague.position === 'pain' ? 'bg-orange-500' :
                            colleague.position === 'envoi' ? 'bg-purple-500' :
                            colleague.position === 'salle' ? 'bg-blue-500' :
                            colleague.position === 'bar' ? 'bg-green-500' :
                            'bg-slate-500'
                          }`}></span>
                          <div>
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{colleague.username}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">{colleague.position}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Statut et salaire */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Statut</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      !selectedShift.clock_in && !selectedShift.clock_out ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                      selectedShift.clock_in && !selectedShift.clock_out ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                      selectedShift.clock_in && selectedShift.clock_out && !selectedShift.validated ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {!selectedShift.clock_in && !selectedShift.clock_out && (
                        <>
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          Planifié
                        </>
                      )}
                      {selectedShift.clock_in && !selectedShift.clock_out && (
                        <>
                          <ClockIcon className="h-4 w-4 mr-1" />
                          En cours
                        </>
                      )}
                      {selectedShift.clock_in && selectedShift.clock_out && !selectedShift.validated && (
                        <>
                          <ClockIcon className="h-4 w-4 mr-1" />
                          En attente
                        </>
                      )}
                      {selectedShift.clock_in && selectedShift.clock_out && selectedShift.validated && (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Validé
                        </>
                      )}
                    </span>
                  </div>

                  {userDetails?.hourly_rate && selectedShift.clock_in && selectedShift.clock_out && (
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">💰 Salaire gagné</span>
                      <span className="font-bold text-xl text-green-600 dark:text-green-400">
                        {(((new Date(selectedShift.clock_out) - new Date(selectedShift.clock_in)) / (1000 * 60 * 60)) * userDetails.hourly_rate).toFixed(2)}€
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer de la modal */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl">
              <button 
                onClick={closeShiftModal}
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'indisponibilité */}
      {showUnavailabilityModal && selectedShiftForUnavailability && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowUnavailabilityModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <ExclamationCircleIcon className="h-6 w-6 text-orange-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Déclarer une indisponibilité
                </h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {selectedShiftForUnavailability.title}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {formatDateWithDay(selectedShiftForUnavailability.date)} • {selectedShiftForUnavailability.start_time} - {selectedShiftForUnavailability.end_time}
                  </p>
                </div>
                
                <div>
                  <label className="label-hero">Raison (optionnelle)</label>
                  <textarea
                    className="input-hero mt-1"
                    rows="3"
                    placeholder="Ex: Maladie, rendez-vous médical, urgence familiale..."
                    value={unavailabilityReason}
                    onChange={(e) => setUnavailabilityReason(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowUnavailabilityModal(false)}
                    className="btn-hero-outline flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => markUnavailable(selectedShiftForUnavailability, unavailabilityReason)}
                    className="btn-hero bg-orange-600 hover:bg-orange-700 text-white flex-1"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de détails de demande de remplacement */}
      {showReplacementDetailsModal && selectedReplacementRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeReplacementDetailsModal}>
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header simple */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Demande de remplacement
                </h2>
                <button 
                  onClick={closeReplacementDetailsModal}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Contenu principal */}
            <div className="p-6 space-y-6">
              {/* Informations du shift */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  {selectedReplacementRequest.shift_title}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Date :</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">
                      {new Date(selectedReplacementRequest.date).toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long' 
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Horaires :</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">
                      {selectedReplacementRequest.start_time} - {selectedReplacementRequest.end_time}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Position :</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">
                      {selectedReplacementRequest.position === 'cuisine' ? 'Cuisine' :
                       selectedReplacementRequest.position === 'salle' ? 'Salle' : 'Bar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">Équipe :</span>
                    <span className="ml-2 font-medium text-slate-900 dark:text-slate-100">
                      {selectedReplacementRequest.team_members?.length || 0} membre{(selectedReplacementRequest.team_members?.length || 0) > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Équipe détaillée */}
              {selectedReplacementRequest.team_members && selectedReplacementRequest.team_members.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Équipe du shift :</h4>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedReplacementRequest.team_members.map(member => (
                        <div key={member.user_id} className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            member.position === 'cuisine' ? 'bg-red-500' :
                            member.position === 'salle' ? 'bg-blue-500' :
                            'bg-green-500'
                          }`}></span>
                          <span className="text-slate-900 dark:text-slate-100">{member.username}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-xs">({member.position})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Remplacement */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Remplacement :</h4>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedReplacementRequest.original_username}
                      </div>
                      <div className="text-sm text-red-600 dark:text-red-400">Indisponible</div>
                    </div>
                    
                    <div className="text-slate-400">→</div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedReplacementRequest.replacement_username}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">Volontaire</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Approuver :</strong> {selectedReplacementRequest.replacement_username} sera assigné au shift.<br/>
                  <strong>Refuser :</strong> Le shift reste disponible pour d'autres volontaires.
                </p>
              </div>
            </div>

            {/* Footer avec boutons */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex gap-3">
                <button 
                  onClick={closeReplacementDetailsModal}
                  className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    handleReplacementDecision(selectedReplacementRequest.id, false);
                    closeReplacementDetailsModal();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Refuser
                </button>
                <button
                  onClick={() => {
                    handleReplacementDecision(selectedReplacementRequest.id, true);
                    closeReplacementDetailsModal();
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Approuver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'historique des remplacements */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeHistoryModal}>
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <ClockIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Historique des remplacements
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      30 derniers jours
                    </p>
                  </div>
                </div>
                <button 
                  onClick={closeHistoryModal}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="overflow-y-auto max-h-[70vh]">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="loading-spinner h-8 w-8 mr-3"></div>
                  <span className="text-slate-600 dark:text-slate-400">Chargement...</span>
                </div>
              ) : replacementHistory.length === 0 ? (
                <div className="text-center py-12">
                  <ClockIcon className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Aucun historique
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Aucun remplacement n'a encore été traité ces 30 derniers jours.
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Vue desktop */}
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Shift</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Date</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Remplacement</th>
                            <th className="text-center py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Statut</th>
                            <th className="text-center py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Traité par</th>
                            <th className="text-center py-3 px-4 font-medium text-slate-700 dark:text-slate-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {replacementHistory.map((item) => (
                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-4 px-4">
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {item.shift_title}
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {item.start_time} - {item.end_time}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {new Date(item.date).toLocaleDateString('fr-FR', { 
                                      weekday: 'short',
                                      day: 'numeric', 
                                      month: 'short' 
                                    })}
                                  </div>
                                  <div className="text-slate-600 dark:text-slate-400">
                                    {new Date(item.created_at).toLocaleDateString('fr-FR')}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-red-600 dark:text-red-400">{item.original_username}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-green-600 dark:text-green-400">{item.replacement_username}</span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {item.position}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  item.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  item.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}>
                                  {item.status === 'approved' && '✅ Approuvé'}
                                  {item.status === 'rejected' && '❌ Refusé'}
                                  {item.status === 'pending' && '⏳ En attente'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="text-sm">
                                  {item.status === 'approved' && item.approved_by_username && (
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-slate-100">
                                        {item.approved_by_username}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {new Date(item.approved_at).toLocaleDateString('fr-FR')}
                                      </div>
                                    </div>
                                  )}
                                  {item.status === 'rejected' && item.rejected_by_username && (
                                    <div>
                                      <div className="font-medium text-slate-900 dark:text-slate-100">
                                        {item.rejected_by_username}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {new Date(item.rejected_at).toLocaleDateString('fr-FR')}
                                      </div>
                                    </div>
                                  )}
                                  {item.status === 'pending' && (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                {item.status !== 'pending' && (
                                  <button
                                    onClick={() => deleteReplacementFromHistory(item.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Supprimer de l'historique"
                                  >
                                    <XMarkIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Vue mobile */}
                  <div className="md:hidden space-y-4">
                    {replacementHistory.map((item) => (
                      <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                              {item.shift_title}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              item.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              item.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {item.status === 'approved' && '✅ Approuvé'}
                              {item.status === 'rejected' && '❌ Refusé'}
                              {item.status === 'pending' && '⏳ En attente'}
                            </span>
                            {item.status !== 'pending' && (
                              <button
                                onClick={() => deleteReplacementFromHistory(item.id)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Supprimer de l'historique"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-400">Horaires:</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {item.start_time} - {item.end_time}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 dark:text-slate-400">Remplacement:</span>
                            <span className="text-red-600 dark:text-red-400">{item.original_username}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-green-600 dark:text-green-400">{item.replacement_username}</span>
                          </div>
                          {((item.status === 'approved' && item.approved_by_username) || (item.status === 'rejected' && item.rejected_by_username)) && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 dark:text-slate-400">Traité par:</span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {item.approved_by_username || item.rejected_by_username}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
              <button 
                onClick={closeHistoryModal}
                className="w-full btn-hero-outline py-3"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 