import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, userService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { POSITION_CONFIGS } from '../constants/positions';
import { 
  CalendarIcon, 
  ClockIcon,
  UsersIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

const WeeklyShiftGrid = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // États principaux
  const [selectedWeek, setSelectedWeek] = useState(getWeekStart(new Date()));
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modalités (si nécessaire pour d'autres fonctionnalités)

  // Horaires par défaut pour la salle (modifiables)
  const defaultSalleTimeSlots = [
    { role: 'Bar', time: 'Midi', start: '11:45', end: '15:00' },
    { role: 'Salle', time: 'Midi', start: '13:00', end: '15:00' },
    { role: 'Bar', time: 'Soir', start: '17:00', end: '23:00' },
    { role: 'Salle', time: 'Soir', start: '18:00', end: '23:00' }
  ];

  // Horaires par défaut pour la cuisine (modifiables)
  const defaultCuisineTimeSlots = [
    { role: 'Chaud', time: 'Midi', start: '11:30', end: '15:00' },
    { role: 'Pain', time: 'Midi', start: '11:45', end: '15:00' },
    { role: 'Envoi', time: 'Midi', start: '12:00', end: '15:00' },
    { role: 'Chaud', time: 'Soir', start: '17:30', end: '23:00' },
    { role: 'Pain', time: 'Soir', start: '18:00', end: '23:00' },
    { role: 'Envoi', time: 'Soir', start: '18:30', end: '23:00' }
  ];

  // Structure des grilles
  const [salleGrid, setSalleGrid] = useState([]);
  const [cuisineGrid, setCuisineGrid] = useState([]);

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

  // Grille par défaut selon le type (salle ou cuisine)
  function getDefaultGrid(gridType) {
    const timeSlots = gridType === 'salle' ? defaultSalleTimeSlots : defaultCuisineTimeSlots;
    return timeSlots.map((slot, index) => ({
      id: index + 1,
      role: slot.role,
      time: slot.time,
      start_time: slot.start,
      end_time: slot.end,
      editable: true,
      cells: {
        monday: { personnel: [], notes: '' },
        tuesday: { personnel: [], notes: '' },
        wednesday: { personnel: [], notes: '' },
        thursday: { personnel: [], notes: '' },
        friday: { personnel: [], notes: '' },
        saturday: { personnel: [], notes: '' },
        sunday: { personnel: [], notes: '' }
      }
    }));
  }

  useEffect(() => {
    if (!hasRole(['manager'])) {
      navigate('/unauthorized');
      return;
    }
    loadUsers();
    
    // Initialiser les grilles avec les horaires par défaut (copies indépendantes)
    const salleInitialGrid = getDefaultGrid('salle').map(row => ({
      ...row,
      id: `salle-${row.id}`, // IDs uniques pour la salle
      cells: {
        monday: { personnel: [], notes: '' },
        tuesday: { personnel: [], notes: '' },
        wednesday: { personnel: [], notes: '' },
        thursday: { personnel: [], notes: '' },
        friday: { personnel: [], notes: '' },
        saturday: { personnel: [], notes: '' },
        sunday: { personnel: [], notes: '' }
      }
    }));
    
    const cuisineInitialGrid = getDefaultGrid('cuisine').map(row => ({
      ...row,
      id: `cuisine-${row.id}`, // IDs uniques pour la cuisine
      cells: {
        monday: { personnel: [], notes: '' },
        tuesday: { personnel: [], notes: '' },
        wednesday: { personnel: [], notes: '' },
        thursday: { personnel: [], notes: '' },
        friday: { personnel: [], notes: '' },
        saturday: { personnel: [], notes: '' },
        sunday: { personnel: [], notes: '' }
      }
    }));
    
    setSalleGrid(salleInitialGrid);
    setCuisineGrid(cuisineInitialGrid);
  }, [hasRole, navigate]);

  const loadUsers = async () => {
    try {
      const response = await userService.getAllUsers();
      setAllUsers(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Impossible de charger les utilisateurs');
    }
  };

  // Naviguer entre les semaines
  const navigateWeek = (direction) => {
    const currentDate = new Date(selectedWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    setSelectedWeek(currentDate.toISOString().split('T')[0]);
    setError('');
    setSuccess('');
  };

  // Ajouter une personne à une cellule
  const addPersonToCell = (gridType, rowId, day, personId) => {
    const person = allUsers.find(u => u.id === parseInt(personId));
    if (!person) return;

    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;

    updateGrid(currentGrid.map(row => {
      if (row.id === rowId) {
        const newCells = { ...row.cells };
        if (!newCells[day].personnel.find(p => p.id === person.id)) {
          newCells[day].personnel = [...newCells[day].personnel, {
            id: person.id,
            username: person.username,
            positions: person.positions,
            isResponsable: false // Par défaut, pas responsable
          }];
        }
        return { ...row, cells: newCells };
      }
      return row;
    }));
  };

  // Retirer une personne d'une cellule
  const removePersonFromCell = (gridType, rowId, day, personId) => {
    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;

    updateGrid(currentGrid.map(row => {
      if (row.id === rowId) {
        const newCells = { ...row.cells };
        newCells[day].personnel = newCells[day].personnel.filter(p => p.id !== personId);
        return { ...row, cells: newCells };
      }
      return row;
    }));
  };

  // Basculer le statut de responsable d'une personne (un seul responsable par jour autorisé)
  const toggleResponsable = (gridType, rowId, day, personId) => {
    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;
    const otherGrid = gridType === 'salle' ? cuisineGrid : salleGrid;
    const updateOtherGrid = gridType === 'salle' ? setCuisineGrid : setSalleGrid;

    // Obtenir les informations du shift actuel
    const currentRow = currentGrid.find(row => row.id === rowId);
    if (!currentRow) return;
    
    const currentShiftTime = currentRow.time; // "Midi", "Soir", etc.
    
    // Vérifier s'il y a déjà un responsable dans ce shift (même service) dans les deux grilles
    const hasResponsableInThisShift = [...currentGrid, ...otherGrid]
      .filter(row => row.time === currentShiftTime) // Même service (Midi/Soir)
      .some(row => row.cells[day].personnel.some(person => person.isResponsable && person.id !== personId));

    const currentPerson = currentGrid
      .find(row => row.id === rowId)?.cells[day].personnel
      .find(person => person.id === personId);

    // Si on veut activer le responsable et qu'il y en a déjà un dans ce shift, empêcher
    if (!currentPerson?.isResponsable && hasResponsableInThisShift) {
      alert(`Un seul responsable est autorisé par shift (${currentShiftTime}). Désactivez d'abord l'autre responsable de ce service.`);
      return;
    }

    // Mettre à jour la grille actuelle
    updateGrid(currentGrid.map(row => {
      if (row.id === rowId) {
        const newCells = { ...row.cells };
        newCells[day].personnel = newCells[day].personnel.map(person => {
          if (person.id === personId) {
            return { ...person, isResponsable: !person.isResponsable };
          }
          return person;
        });
        return { ...row, cells: newCells };
      }
      return row;
    }));
  };

  // Ajouter un shift complet (tous les postes) à une grille
  const addNewRow = (gridType) => {
    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;
    
    // Déterminer les postes à ajouter selon le type de grille
    const postsToAdd = gridType === 'salle' 
      ? [{ role: 'Bar', time: 'Nouveau', start: '09:00', end: '17:00' },
         { role: 'Salle', time: 'Nouveau', start: '09:00', end: '17:00' }]
      : [{ role: 'Chaud', time: 'Nouveau', start: '09:00', end: '17:00' },
         { role: 'Pain', time: 'Nouveau', start: '09:00', end: '17:00' },
         { role: 'Envoi', time: 'Nouveau', start: '09:00', end: '17:00' }];
    
    // Générer un timestamp unique pour ce groupe de postes
    const timestamp = Date.now();
    
    // Créer tous les nouveaux postes
    const newRows = postsToAdd.map((post, index) => ({
      id: `${gridType}-${timestamp}-${index}`,
      role: post.role,
      time: post.time,
      start_time: post.start,
      end_time: post.end,
      editable: true,
      cells: {
        monday: { personnel: [], notes: '' },
        tuesday: { personnel: [], notes: '' },
        wednesday: { personnel: [], notes: '' },
        thursday: { personnel: [], notes: '' },
        friday: { personnel: [], notes: '' },
        saturday: { personnel: [], notes: '' },
        sunday: { personnel: [], notes: '' }
      }
    }));

    updateGrid([...currentGrid, ...newRows]);
  };

  // Supprimer une ligne d'une grille
  const removeRow = (gridType, rowId) => {
    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;
    
    updateGrid(currentGrid.filter(row => row.id !== rowId));
  };

  // Modifier les horaires d'une ligne
  const updateRowTimes = (gridType, rowId, field, value) => {
    const updateGrid = gridType === 'salle' ? setSalleGrid : setCuisineGrid;
    const currentGrid = gridType === 'salle' ? salleGrid : cuisineGrid;
    
    updateGrid(currentGrid.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Sauvegarder toute la semaine
  const saveWeeklyShifts = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const weekDays = getWeekDays(selectedWeek);
      const allShifts = [];

      // Pour chaque jour, créer des shifts unifiés par période horaire (Midi, Soir)
      weekDays.forEach(day => {
        const dayKey = getDayKey(day.date);
        
        // Map pour regrouper par période horaire uniquement (pas par type salle/cuisine)
        const shiftsByService = new Map();
        
        console.log(`--- Traitement du jour ${day.date} (${dayKey}) ---`);
        
        // Collecter toutes les assignations de la salle
        salleGrid.forEach(row => {
          if (row.cells[dayKey].personnel.length > 0) {
            console.log(`Salle - Ligne ${row.role} (${row.time}): ${row.cells[dayKey].personnel.length} personnes`);
            console.log(`  Horaires: ${row.start_time} - ${row.end_time}`);
            const serviceKey = row.time; // "Midi", "Soir", etc.
            
            if (!shiftsByService.has(serviceKey)) {
              console.log(`  Création nouveau shift pour ${serviceKey}`);
              shiftsByService.set(serviceKey, {
                start_time: row.start_time,
                end_time: row.end_time,
                title: row.time,
                personnel: []
              });
            } else {
              // Étendre les heures du shift pour couvrir tous les créneaux
              const existingShift = shiftsByService.get(serviceKey);
              if (row.start_time < existingShift.start_time) {
                existingShift.start_time = row.start_time;
              }
              if (row.end_time > existingShift.end_time) {
                existingShift.end_time = row.end_time;
              }
            }
            
            // Ajouter le personnel avec leurs horaires individuels
            row.cells[dayKey].personnel.forEach(person => {
              // Déterminer la position (garder la position originale même si responsable)
              let position = row.role.toLowerCase() === 'bar' ? 'bar' : 'salle';
              
              shiftsByService.get(serviceKey).personnel.push({
                userId: person.id,
                position: position,
                individual_start_time: row.start_time,
                individual_end_time: row.end_time,
                role: person.isResponsable ? `${row.role} (Responsable)` : row.role,
                isResponsable: person.isResponsable || false
              });
            });
          }
        });
        
        // Collecter toutes les assignations de la cuisine
        cuisineGrid.forEach(row => {
          if (row.cells[dayKey].personnel.length > 0) {
            console.log(`Cuisine - Ligne ${row.role} (${row.time}): ${row.cells[dayKey].personnel.length} personnes`);
            console.log(`  Horaires: ${row.start_time} - ${row.end_time}`);
            const serviceKey = row.time; // "Midi", "Soir", etc.
            
            if (!shiftsByService.has(serviceKey)) {
              console.log(`  Création nouveau shift pour ${serviceKey}`);
              shiftsByService.set(serviceKey, {
                start_time: row.start_time,
                end_time: row.end_time,
                title: row.time,
                personnel: []
              });
            } else {
              // Étendre les heures du shift pour couvrir tous les créneaux
              const existingShift = shiftsByService.get(serviceKey);
              if (row.start_time < existingShift.start_time) {
                existingShift.start_time = row.start_time;
              }
              if (row.end_time > existingShift.end_time) {
                existingShift.end_time = row.end_time;
              }
            }
            
            // Ajouter le personnel avec leurs horaires individuels
            row.cells[dayKey].personnel.forEach(person => {
              // Déterminer la position (garder la position originale même si responsable)
              const roleMap = {
                'chaud': 'chaud',
                'pain': 'pain', 
                'envoi': 'envoi'
              };
              let position = roleMap[row.role.toLowerCase()] || 'cuisine';
              
              shiftsByService.get(serviceKey).personnel.push({
                userId: person.id,
                position: position,
                individual_start_time: row.start_time,
                individual_end_time: row.end_time,
                role: person.isResponsable ? `${row.role} (Responsable)` : row.role,
                isResponsable: person.isResponsable || false
              });
            });
          }
        });
        
        // Créer les shifts unifiés par période horaire
        shiftsByService.forEach((shiftData, serviceKey) => {
          if (shiftData.personnel.length > 0) {
            console.log(`Shift créé pour ${serviceKey}: ${shiftData.personnel.length} personnes au total`);
            console.log('Personnel:', shiftData.personnel.map(p => `${p.userId} (${p.position})`));
            allShifts.push({
              title: shiftData.title, // "Midi", "Soir", etc.
              date: day.date,
              start_time: shiftData.start_time,
              end_time: shiftData.end_time,
              assigned_users: shiftData.personnel
            });
          }
        });
      });

      if (allShifts.length === 0) {
        setError('Aucun personnel assigné à sauvegarder');
        return;
      }

      await shiftService.createMultipleShifts({ shifts: allShifts });
      
      setSuccess(`✅ Semaine créée avec succès ! ${allShifts.length} shift(s) regroupé(s) planifié(s)`);
      
    } catch (err) {
      console.error('Erreur lors de la création des shifts:', err);
      setError('Erreur lors de la création de la semaine');
    } finally {
      setLoading(false);
    }
  };

  // Obtenir la clé du jour pour les cellules
  const getDayKey = (dateString) => {
    const date = new Date(dateString);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[date.getDay()];
  };

  // Obtenir les utilisateurs disponibles pour une position (sans conflits d'horaires)
  // Fonction pour mapper les rôles des shifts aux positions des utilisateurs
  const getRequiredPositionForRole = (role) => {
    const roleToPosition = {
      'Bar': 'bar',
      'Salle': 'salle',
      'Chaud': 'chaud',
      'Pain': 'pain',
      'Envoi': 'envoi',
      'Cuisine': 'cuisine'
    };
    return roleToPosition[role] || null;
  };

  const getAvailableUsers = (gridType, currentRowId, currentDay) => {
    // Fonction pour vérifier si deux créneaux horaires se chevauchent
    const hoursOverlap = (start1, end1, start2, end2) => {
      const s1 = new Date(`2000-01-01T${start1}:00`);
      const e1 = new Date(`2000-01-01T${end1}:00`);
      const s2 = new Date(`2000-01-01T${start2}:00`);
      const e2 = new Date(`2000-01-01T${end2}:00`);
      
      // Gérer les shifts qui se terminent le lendemain
      if (e1 <= s1) e1.setDate(e1.getDate() + 1);
      if (e2 <= s2) e2.setDate(e2.getDate() + 1);
      
      return s1 < e2 && s2 < e1;
    };

    // Obtenir le rôle spécifique de la ligne actuelle
    const targetRow = [...salleGrid, ...cuisineGrid].find(row => row.id === currentRowId);
    const requiredPosition = targetRow ? getRequiredPositionForRole(targetRow.role) : null;

    // Filtrer les utilisateurs selon le poste requis
    let baseUsers;
    if (requiredPosition) {
      // Filtrer par poste spécifique
      baseUsers = allUsers.filter(user => 
        user.positions && user.positions.includes(requiredPosition)
      );
    } else {
      // Fallback - filtrer par catégorie comme avant
      if (gridType === 'salle') {
        baseUsers = allUsers.filter(user => 
          user.positions && (user.positions.includes('salle') || user.positions.includes('bar'))
        );
      } else {
        baseUsers = allUsers.filter(user => 
          user.positions && (
            user.positions.includes('cuisine') ||
            user.positions.includes('chaud') ||
            user.positions.includes('pain') ||
            user.positions.includes('envoi')
          )
        );
      }
    }

    // Si on n'a pas les informations nécessaires pour vérifier les conflits, retourner la liste de base
    if (!currentRowId || !currentDay) {
      return baseUsers;
    }

    // Obtenir les horaires du poste actuel
    const currentRow = [...salleGrid, ...cuisineGrid].find(row => row.id === currentRowId);
    if (!currentRow) return baseUsers;

    const currentStartTime = currentRow.start_time;
    const currentEndTime = currentRow.end_time;

    // Filtrer les utilisateurs pour éviter les conflits
    return baseUsers.filter(user => {
      // Vérifier dans toutes les grilles (salle et cuisine) pour ce jour
      const allGrids = [salleGrid, cuisineGrid];
      
      for (const grid of allGrids) {
        for (const row of grid) {
          // Ignorer la ligne actuelle
          if (row.id === currentRowId) continue;
          
          // Vérifier si l'utilisateur est assigné à cette ligne ce jour-là
          const personnel = row.cells[currentDay]?.personnel || [];
          const isUserAssigned = personnel.some(p => p.id === user.id);
          
          if (isUserAssigned) {
            // Vérifier si les horaires se chevauchent
            if (hoursOverlap(currentStartTime, currentEndTime, row.start_time, row.end_time)) {
              return false; // Conflit d'horaires détecté
            }
          }
        }
      }
      
      return true; // Aucun conflit
    });
  };

  // Rendu d'une grille
  const renderGrid = (gridType, grid, setGrid) => {
    const weekDays = getWeekDays(selectedWeek);
    const gridTitle = gridType === 'salle' ? '🍽️ Grille Salle & Bar' : '👨‍🍳 Grille Cuisine';

    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{gridTitle}</h3>
            <button
              onClick={() => addNewRow(gridType)}
              className="btn-hero-outline btn-hero-sm"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Ajouter shift
            </button>
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
              {grid.map((row, rowIndex) => (
                <tr key={row.id} className={`${rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors`}>
                  <td className="sticky left-0 bg-inherit border-r border-slate-200 dark:border-slate-700 px-4 py-3">
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {row.role}
                        </span>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Poste requis: {getRequiredPositionForRole(row.role) || 'Général'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="time"
                          value={row.start_time}
                          onChange={(e) => updateRowTimes(gridType, row.id, 'start_time', e.target.value)}
                          className="bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5"
                        />
                        <span>→</span>
                        <input
                          type="time"
                          value={row.end_time}
                          onChange={(e) => updateRowTimes(gridType, row.id, 'end_time', e.target.value)}
                          className="bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5"
                        />
                      </div>
                      {grid.length > 1 && (
                        <button
                          onClick={() => removeRow(gridType, row.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const dayKey = getDayKey(day.date);
                    const cellPersonnel = row.cells[dayKey].personnel;
                    
                    return (
                      <td key={day.date} className="border-r border-b border-slate-200 dark:border-slate-700 p-2 min-h-[80px] align-top bg-yellow-50 dark:bg-yellow-900/10">
                        <div className="space-y-1">
                          {/* Personnel assigné */}
                          {cellPersonnel.map(person => (
                            <div key={person.id} className={`bg-white dark:bg-slate-700 rounded px-2 py-1 shadow-sm border-l-4 ${person.isResponsable ? 'border-l-yellow-500' : 'border-l-transparent'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-medium ${person.isResponsable ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {person.isResponsable && '👑 '}{person.username}
                                </span>
                                <button
                                  onClick={() => removePersonFromCell(gridType, row.id, dayKey, person.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  id={`respo-${gridType}-${row.id}-${dayKey}-${person.id}`}
                                  checked={person.isResponsable || false}
                                  onChange={() => toggleResponsable(gridType, row.id, dayKey, person.id)}
                                  className="h-3 w-3 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 dark:focus:ring-yellow-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <label
                                  htmlFor={`respo-${gridType}-${row.id}-${dayKey}-${person.id}`}
                                  className="ml-1 text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
                                >
                                  Respo
                                </label>
                              </div>
                            </div>
                          ))}
                          
                          {/* Ajouter du personnel */}
                          {(() => {
                            const availableUsers = getAvailableUsers(gridType, row.id, dayKey)
                              .filter(user => !cellPersonnel.find(p => p.id === user.id));
                            
                            if (availableUsers.length === 0) {
                              const requiredPos = getRequiredPositionForRole(row.role);
                              return (
                                <div className="text-xs text-slate-500 dark:text-slate-400 italic p-2 bg-slate-50 dark:bg-slate-700 rounded">
                                  Aucun personnel disponible{requiredPos ? ` pour le poste "${requiredPos}"` : ''}
                                </div>
                              );
                            }
                            
                            return (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    addPersonToCell(gridType, row.id, dayKey, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="w-full text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                              >
                                <option value="">+ Ajouter</option>
                                {availableUsers.map(user => (
                                  <option key={user.id} value={user.id}>{user.username}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const weekDays = getWeekDays(selectedWeek);
  const weekStart = new Date(selectedWeek);
  const weekEnd = new Date(selectedWeek);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">📊 Planning Hebdomadaire</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Interface type Excel pour créer les plannings de la semaine
          </p>
        </div>
        <button
          onClick={() => navigate('/calendar')}
          className="btn-hero-outline"
        >
          Retour au calendrier
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <div className="alert-hero-title">Erreur</div>
          <div className="alert-hero-description">{error}</div>
        </div>
      )}

      {success && (
        <div className="alert-hero alert-hero-success">
          <div className="alert-hero-title">Succès</div>
          <div className="alert-hero-description">{success}</div>
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
              ← Semaine précédente
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
              Semaine suivante →
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={saveWeeklyShifts}
              disabled={loading}
              className="btn-hero-primary"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Sauvegarde...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Valider la semaine
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grilles */}
      <div className="space-y-8">
        {renderGrid('salle', salleGrid, setSalleGrid)}
        {renderGrid('cuisine', cuisineGrid, setCuisineGrid)}
      </div>

      {/* Résumé de la semaine */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">📈 Résumé de la semaine</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {weekDays.reduce((total, day) => {
                const dayKey = getDayKey(day.date);
                return total + salleGrid.reduce((dayTotal, row) => dayTotal + row.cells[dayKey].personnel.length, 0);
              }, 0)}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Assignations Salle</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {weekDays.reduce((total, day) => {
                const dayKey = getDayKey(day.date);
                return total + cuisineGrid.reduce((dayTotal, row) => dayTotal + row.cells[dayKey].personnel.length, 0);
              }, 0)}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Assignations Cuisine</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{salleGrid.length + cuisineGrid.length}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Postes définis</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">7</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Jours planifiés</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyShiftGrid;