import { useState, useEffect, useContext, useMemo } from 'react';
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
  ChevronDownIcon,
  ClockIcon,
  CheckCircleIcon,
  UsersIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

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

  // États pour la vue mobile-friendly
  const [viewMode, setViewMode] = useState('calendar'); // 'list' ou 'calendar'
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState(new Set()); // Nouveaux états pour gérer l'ouverture/fermeture des jours

  // États pour la création rapide de shifts
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [quickCreateDate, setQuickCreateDate] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false); // État spécifique pour la sauvegarde
  const [searchTerm, setSearchTerm] = useState(''); // État pour la recherche d'employés

  // États pour l'ajout manuel des heures de pointage
  const [showManualHoursModal, setShowManualHoursModal] = useState(false);
  const [selectedUserShift, setSelectedUserShift] = useState(null);
  const [manualClockIn, setManualClockIn] = useState('');
  const [manualClockOut, setManualClockOut] = useState('');
  const [manualHoursLoading, setManualHoursLoading] = useState(false);

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
      if (hasRole(['manager'])) {
        // Les managers voient tous les shifts
        shiftsResponse = await shiftService.getAllShifts();
      } else {
        // Le personnel et responsables ne voient que leurs propres shifts
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
              // Le shift est en cours
              validationStatus = "in_progress";
            } else if (now > shiftEndTime) {
              // Le shift est terminé
              const allValidated = userShifts.every(us => us.validated);
              validationStatus = allValidated ? "validated" : "pending";
            }
            
            // Fusionner les données du personnel avec leurs heures de pointage
            const personnelWithHours = {
              cuisine: (personnelResponse.data?.cuisine || []).map(person => {
                const userShift = userShifts.find(us => us.user_id === person.user_id);
                return {
                  ...person,
                  clock_in: userShift?.clock_in || null,
                  clock_out: userShift?.clock_out || null,
                  validated: userShift?.validated || false
                };
              }),
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
    return shifts.map(shift => {
      const [year, month, day] = shift.date.split('-').map(Number);
      const [startHour, startMinute] = shift.start_time.split(':').map(Number);
      const [endHour, endMinute] = shift.end_time.split(':').map(Number);
      
      // Créer les dates de début et fin avec les heures correctes
      const startDate = new Date(year, month - 1, day, startHour, startMinute);
      const endDate = new Date(year, month - 1, day, endHour, endMinute);
      
      // Si l'heure de fin est inférieure à celle de début, c'est le lendemain
      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        endDate.setDate(endDate.getDate() + 1);
      }
      
      // Compter le personnel total de ce shift
      const totalCuisine = shift.personnel?.cuisine?.length || 0;
      const totalSalle = shift.personnel?.salle?.length || 0;
      const totalBar = shift.personnel?.bar?.length || 0;
      const totalPersonnel = totalCuisine + totalSalle + totalBar;
      
      return {
        id: shift.id,
        title: `${shift.title} (${totalPersonnel} pers.)`,
        mobileTitle: `${totalPersonnel} pers.`,
        start: startDate,
        end: endDate,
        allDay: false, // Important : ne pas afficher toute la journée
        cuisineCount: totalCuisine,
        salleCount: totalSalle,
        barCount: totalBar,
        validationStatus: shift.validationStatus,
        shifts: [shift], // Garder le shift pour la modal
        date: shift.date,
        shift_id: shift.id,
        personnel: shift.personnel,
        userShifts: shift.userShifts
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
    const exportData = [];
    
    shiftsToExport.forEach(shift => {
      // Traiter chaque personne de chaque position
      const allPersonnel = [
        ...(shift.personnel?.cuisine || []),
        ...(shift.personnel?.salle || []),
        ...(shift.personnel?.bar || [])
      ];
      
      allPersonnel.forEach(person => {
        // Calculer la différence de temps si clock_in et clock_out sont disponibles
        let workDuration = '';
        if (person.clock_in && person.clock_out && person.validated) {
          const clockIn = new Date(`${shift.date}T${person.clock_in}`);
          const clockOut = new Date(`${shift.date}T${person.clock_out}`);
          
          // Gérer les shifts qui se terminent le lendemain
          if (clockOut < clockIn) {
            clockOut.setDate(clockOut.getDate() + 1);
          }
          
          const diffInMs = clockOut - clockIn;
          const diffInHours = diffInMs / (1000 * 60 * 60);
          workDuration = `${diffInHours.toFixed(2)}h`;
        }
        
        exportData.push({
          NAME: person.username || person.first_name && person.last_name 
            ? `${person.first_name || ''} ${person.last_name || ''}`.trim() 
            : 'N/A',
          NISS: person.niss || person.social_security_number || '',
          DATE: shift.date,
          IN: person.validated && person.clock_in ? person.clock_in : '',
          OUT: person.validated && person.clock_out ? person.clock_out : '',
          DIF: workDuration
        });
      });
    });
    
    return exportData;
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
      
      if (data.length === 0) {
        alert('Aucune donnée de pointage à exporter sur cette période');
        return;
      }
      
      // Créer un nouveau classeur Excel
      const workbook = new Excel.Workbook();
      const worksheet = workbook.addWorksheet('Pointages');
      
      // Ajouter les en-têtes
      worksheet.columns = [
        { header: 'NAME', key: 'NAME', width: 25 },
        { header: 'NISS', key: 'NISS', width: 15 },
        { header: 'DATE', key: 'DATE', width: 15 },
        { header: 'IN', key: 'IN', width: 12 },
        { header: 'OUT', key: 'OUT', width: 12 },
        { header: 'DIF', key: 'DIF', width: 12 }
      ];
      
      // Appliquer un style aux en-têtes
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E2E2' }
      };
      
      // Ajouter les données
      worksheet.addRows(data);
      
      // Ajouter des bordures et formater les cellules
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Format de date
          if (cell.col === 3 && rowNumber > 1) { // Colonne DATE (maintenant en position 3)
            cell.numFmt = 'dd/mm/yyyy';
          }
        });
      });
      
      // Générer le fichier Excel
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `pointages_${startDate}_${endDate}.xlsx`;
      saveAs(new Blob([buffer]), filename);
      
      alert(`Export Excel généré avec succès : ${data.length} enregistrements`);
      
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
      case 'in_progress':
        backgroundColor = '#ffd700'; // Jaune pour en cours
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
      </div>
    );
  };

  // Composant d'événement personnalisé pour gérer l'affichage mobile/desktop
  const CustomEvent = ({ event }) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth <= 768);
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    return (
      <div className="h-full w-full px-1 py-0.5 text-xs font-medium">
        {isMobile ? event.mobileTitle : event.title}
      </div>
    );
  };

  // Utilitaires pour la nouvelle interface
  const getDaysInWeek = (date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      days.push(currentDay);
    }
    
    return days;
  };

  const getShiftsForDate = (date) => {
    if (!date) return [];
    const dateString = format(date, 'yyyy-MM-dd');
    return shifts.filter(shift => shift.date === dateString);
  };

  const navigateWeek = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const formatDateWithDay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Fonction pour basculer la visibilité d'un jour
  const toggleDayVisibility = (date) => {
    const newCollapsedDays = new Set(collapsedDays);
    if (newCollapsedDays.has(date)) {
      newCollapsedDays.delete(date);
    } else {
      newCollapsedDays.add(date);
    }
    setCollapsedDays(newCollapsedDays);
  };

  // Fonction pour créer une journée type (3 shifts standards)
  const createTypicalDay = async () => {
    if (!quickCreateDate) {
      setError('Veuillez sélectionner une date');
      return;
    }

    try {
      setQuickCreateLoading(true);
      setError('');

      const typicalShifts = [
        {
          title: 'Service Midi',
          date: quickCreateDate,
          start_time: '11:00',
          end_time: '15:00',
          assigned_users: []
        },
        {
          title: 'Service Après-Midi', 
          date: quickCreateDate,
          start_time: '15:00',
          end_time: '18:00',
          assigned_users: []
        },
        {
          title: 'Service Soir',
          date: quickCreateDate,
          start_time: '18:15',
          end_time: '23:00',
          assigned_users: []
        }
      ];

      await shiftService.createMultipleShifts({ shifts: typicalShifts });
      
      setShowQuickCreateModal(false);
      setQuickCreateDate('');
      loadAllShifts(); // Recharger les shifts
      
      // Message de succès
      const dateFormatted = new Date(quickCreateDate).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric'
      });
      alert(`✅ Journée type créée avec succès pour le ${dateFormatted}`);
      
    } catch (err) {
      console.error('Erreur lors de la création:', err);
      setError('Erreur lors de la création de la journée type');
    } finally {
      setQuickCreateLoading(false);
    }
  };

  // Composant pour la fenêtre modale de détails du shift
  const ShiftDetailsModal = () => {
    if (!selectedShift) return null;
    
    const [year, month, day] = selectedShift.date.split('-').map(Number);
    const shiftDate = new Date(year, month - 1, day);
    
    return (
      <Modal show={showDetails} onHide={handleCloseDetails} size="xl" className="shift-details-modal">
        <Modal.Header closeButton onClose={handleCloseDetails}>
          <Modal.Title>Shifts du {format(shiftDate, 'd MMMM yyyy', { locale: fr })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedShift.shifts.map((shift, index) => (
            <div key={shift.id} className={`space-y-4 ${index < selectedShift.shifts.length - 1 ? 'border-b border-slate-200 dark:border-slate-700 pb-6 mb-6' : ''}`}>
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Personnel de cuisine */}
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de cuisine</h4>
                  {(!shift.personnel?.cuisine || shift.personnel.cuisine.length === 0) ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800">
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Nom</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Entrée</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Sortie</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.cuisine.map(person => (
                            <tr key={`cuisine-${person.user_id}-${shift.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{person.username}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_in)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_out)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1">
                                <div className="flex items-center gap-2">
                                  {person.validated ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                  ) : person.clock_in && person.clock_out ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
                                  )}
                                  
                                  {/* Bouton d'ajout d'heures pour responsables/managers */}
                                  {hasRole(['responsable', 'manager']) && (!person.clock_in || !person.clock_out) && (
                                    <button
                                      onClick={() => openManualHoursModal(person, 'cuisine', shift)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                      title="Ajouter les heures manuellement"
                                    >
                                      <ClockIcon className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Personnel de salle */}
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de salle</h4>
                  {(!shift.personnel?.salle || shift.personnel.salle.length === 0) ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800">
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Nom</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Entrée</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Sortie</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.salle.map(person => (
                            <tr key={`salle-${person.user_id}-${shift.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{person.username}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_in)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_out)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1">
                                <div className="flex items-center gap-2">
                                  {person.validated ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                  ) : person.clock_in && person.clock_out ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
                                  )}
                                  
                                  {/* Bouton d'ajout d'heures pour responsables/managers */}
                                  {hasRole(['responsable', 'manager']) && (!person.clock_in || !person.clock_out) && (
                                    <button
                                      onClick={() => openManualHoursModal(person, 'salle', shift)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                      title="Ajouter les heures manuellement"
                                    >
                                      <ClockIcon className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
                {/* Personnel de bar */}
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de bar</h4>
                  {(!shift.personnel?.bar || shift.personnel.bar.length === 0) ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800">
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Nom</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Entrée</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Sortie</th>
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-left text-xs font-medium text-slate-900 dark:text-slate-100">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shift.personnel.bar.map(person => (
                            <tr key={`bar-${person.user_id}-${shift.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{person.username}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_in)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">{formatTimeStamp(person.clock_out)}</td>
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-1">
                                <div className="flex items-center gap-2">
                                  {person.validated ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                  ) : person.clock_in && person.clock_out ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
                                  )}
                                  
                                  {/* Bouton d'ajout d'heures pour responsables/managers */}
                                  {hasRole(['responsable', 'manager']) && (!person.clock_in || !person.clock_out) && (
                                    <button
                                      onClick={() => openManualHoursModal(person, 'bar', shift)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                      title="Ajouter les heures manuellement"
                                    >
                                      <ClockIcon className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
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
                <div className="flex flex-wrap gap-2 pt-4">
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
          
          <div className="flex gap-2">
            {selectedShift.validationStatus === 'pending' && hasRole(['responsable', 'manager']) && (
              <Button variant="warning" onClick={() => navigate('/validate')}>
                Validation en attente
              </Button>
            )}
            {hasRole(['responsable', 'manager']) && (
              <Button variant="primary" onClick={() => navigate(`/validate?shift_id=${selectedShift.shift_id}&date=${selectedShift.date}`)}>
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
    // Fermer les autres modals d'abord
    setShowDetails(false);
    setShowManualHoursModal(false);
    setSelectedUserShift(null);
    
    setEditingShift({
      ...shift,
      personnel: {
        cuisine: [...(shift.personnel?.cuisine || [])],
        salle: [...(shift.personnel?.salle || [])],
        bar: [...(shift.personnel?.bar || [])]
      }
    });
    setShowEditModal(true);
  };

  // Ajouter un utilisateur à une position
  const addUserToPosition = (position, userId) => {
    const user = allUsers.find(u => u.id === parseInt(userId));
    if (!user) return;

    // Vérifier que l'utilisateur n'est pas déjà assigné à ce shift
    const isAlreadyAssigned = ['cuisine', 'salle', 'bar'].some(pos => 
      (editingShift.personnel?.[pos] || []).some(p => p.user_id === user.id)
    );

    if (isAlreadyAssigned) {
      alert('Cet utilisateur est déjà assigné à ce shift');
      return;
    }

    // Ajouter l'utilisateur à la position sans supprimer les autres
    setEditingShift({
      ...editingShift,
      personnel: {
        ...editingShift.personnel,
        [position]: [...(editingShift.personnel?.[position] || []), { user_id: user.id, username: user.username }]
      }
    });
  };

  // Retirer un utilisateur d'une position
  const removeUserFromPosition = (position, userId) => {
    setEditingShift({
      ...editingShift,
      personnel: {
        ...editingShift.personnel,
        [position]: (editingShift.personnel?.[position] || []).filter(p => p.user_id !== userId)
      }
    });
  };

  // Sauvegarder les modifications du shift
  const saveShiftChanges = async () => {
    if (!editingShift) {
      setError('Aucun shift en cours d\'édition');
      return;
    }

    try {
      setEditLoading(true);
      setError(''); // Clear any previous errors
      
      console.log('Sauvegarde du shift:', editingShift.id);
      console.log('Personnel à sauvegarder:', editingShift.personnel);
      
      // S'assurer que les données sont dans le bon format
      const personnelData = {
        cuisine: editingShift.personnel?.cuisine || [],
        salle: editingShift.personnel?.salle || [],
        bar: editingShift.personnel?.bar || []
      };
      
      // L'API attend { personnel: {...} }
      await shiftService.updateShiftPersonnel(editingShift.id, { personnel: personnelData });
      
      console.log('Sauvegarde réussie');
      
      // Fermer la modal
      setShowEditModal(false);
      setEditingShift(null);
      
      // Recharger les shifts
      await loadAllShifts();
      
      // Message de succès temporaire
      setError(''); // Clear errors
      
    } catch (err) {
      console.error('Erreur lors de la sauvegarde:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la sauvegarde des modifications';
      setError(errorMessage);
      // Ne pas fermer la modal en cas d'erreur pour que l'utilisateur puisse réessayer
    } finally {
      setEditLoading(false);
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

  // Ouvrir la modal d'ajout manuel des heures
  const openManualHoursModal = (person, position, shiftData) => {
    // Fermer les autres modals d'abord
    setShowDetails(false);
    setShowEditModal(false);
    setEditingShift(null);
    
    // Trouver le user_shift correspondant pour obtenir l'ID
    const userShift = shiftData.userShifts.find(us => us.user_id === person.user_id);
    
    if (!userShift) {
      setError('Erreur : Impossible de trouver les données de l\'affectation');
      return;
    }
    
    setSelectedUserShift({
      ...person,
      id: userShift.id, // ID du user_shift nécessaire pour l'API
      position,
      shift: shiftData,
      user_shift_id: userShift.id
    });
    
    // Pré-remplir avec les heures existantes si disponibles
    if (person.clock_in) {
      const clockIn = new Date(person.clock_in);
      setManualClockIn(clockIn.toTimeString().slice(0, 5));
    } else {
      setManualClockIn('');
    }
    
    if (person.clock_out) {
      const clockOut = new Date(person.clock_out);
      setManualClockOut(clockOut.toTimeString().slice(0, 5));
    } else {
      setManualClockOut('');
    }
    
    setShowManualHoursModal(true);
  };

  // Sauvegarder les heures manuelles
  const saveManualHours = async () => {
    if (!selectedUserShift) return;
    
    if (!manualClockIn || !manualClockOut) {
      setError('Veuillez saisir les heures d\'entrée et de sortie');
      return;
    }
    
    try {
      setManualHoursLoading(true);
      setError('');
      
      const shiftDate = selectedUserShift.shift.date;
      
      // Construire les timestamps complets
      const clockInDateTime = new Date(`${shiftDate}T${manualClockIn}:00`);
      const clockOutDateTime = new Date(`${shiftDate}T${manualClockOut}:00`);
      
      // Si l'heure de sortie est inférieure à l'heure d'entrée, c'est le lendemain
      if (clockOutDateTime <= clockInDateTime) {
        clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
      }
      
      // Appeler l'API pour mettre à jour les heures
      await timeclockService.updateUserShiftHours({
        user_shift_id: selectedUserShift.id,
        clock_in: clockInDateTime.toISOString(),
        clock_out: clockOutDateTime.toISOString()
      });
      
      // Fermer la modal
      setShowManualHoursModal(false);
      setSelectedUserShift(null);
      setManualClockIn('');
      setManualClockOut('');
      
      // Recharger les shifts
      await loadAllShifts();
      
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des heures:', err);
      setError('Erreur lors de la sauvegarde des heures manuelles');
    } finally {
      setManualHoursLoading(false);
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Calendrier des shifts</h1>
      </div>
      
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <div className="alert-hero-title">Erreur</div>
          <div className="alert-hero-description">{error}</div>
        </div>
      )}

      {/* Calendrier */}
      <div className="card-hero">
        <div className="card-hero-header">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="card-hero-title">Planning des shifts</h3>
            
            {/* Sélecteur de vue */}
            <div className="flex items-center gap-2">
              <button
                className={`btn-hero-sm ${viewMode === 'list' ? 'btn-hero-primary' : 'btn-hero-outline'}`}
                onClick={() => setViewMode('list')}
              >
                <ListBulletIcon className="h-4 w-4 mr-2" />
                Liste
              </button>
              <button
                className={`btn-hero-sm ${viewMode === 'calendar' ? 'btn-hero-primary' : 'btn-hero-outline'}`}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Calendrier
              </button>
            </div>
          </div>
        </div>
        
        <div className="card-hero-content">
          {viewMode === 'list' ? (
            // Vue liste - Mobile friendly
            <div className="space-y-4">
              {/* Navigation par mois pour la vue liste */}
              <div className="flex items-center justify-between">
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateWeek(-1)}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Précédent
                </button>
                
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {(() => {
                    const weekDays = getDaysInWeek(currentWeek);
                    const startDate = weekDays[0];
                    const endDate = weekDays[6];
                    return `${format(startDate, 'd MMM', { locale: fr })} - ${format(endDate, 'd MMM yyyy', { locale: fr })}`;
                  })()}
                </h4>
                
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateWeek(1)}
                >
                  Suivant
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Liste des shifts du mois */}
              {(() => {
                const weekDays = getDaysInWeek(currentWeek);
                const startOfWeek = weekDays[0];
                const endOfWeek = weekDays[6];
                
                const weekShifts = shifts.filter(shift => {
                  const shiftDate = new Date(shift.date);
                  return shiftDate >= startOfWeek && shiftDate <= endOfWeek;
                }).sort((a, b) => new Date(a.date) - new Date(b.date));

                if (weekShifts.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun shift planifié cette semaine.</p>
                    </div>
                  );
                }

                // Grouper par date et initialiser les jours réduits par défaut
                const groupedByDate = weekShifts.reduce((acc, shift) => {
                  const date = shift.date;
                  if (!acc[date]) {
                    acc[date] = [];
                  }
                  acc[date].push(shift);
                  return acc;
                }, {});

                // Initialiser tous les jours en mode réduit par défaut
                const allDates = Object.keys(groupedByDate);
                if (collapsedDays.size === 0 && allDates.length > 0) {
                  setCollapsedDays(new Set(allDates));
                }

                return Object.keys(groupedByDate).map(date => {
                  const isCollapsed = collapsedDays.has(date);
                  const dayShifts = groupedByDate[date];
                  const totalShifts = dayShifts.length;
                  const validatedShifts = dayShifts.filter(s => s.validationStatus === 'validated').length;
                  const pendingShifts = dayShifts.filter(s => s.validationStatus === 'pending').length;

                  return (
                    <div key={date} className="space-y-3">
                      {/* Header du jour cliquable avec stats */}
                      <div 
                        className="bg-slate-50 dark:bg-slate-800 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        onClick={() => toggleDayVisibility(date)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isCollapsed ? (
                              <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-slate-400" />
                            )}
                            <div>
                              <h5 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {formatDateWithDay(date)}
                              </h5>
                              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                  {validatedShifts} validé{validatedShifts > 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                  {pendingShifts} en attente
                                </span>
                                <span className="text-slate-400">
                                  Total: {totalShifts} shift{totalShifts > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {validatedShifts === totalShifts && totalShifts > 0 && (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircleIcon className="h-4 w-4 mr-2" />
                              Jour validé
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Contenu du jour (shifts) - affiché seulement si pas réduit */}
                      {!isCollapsed && (
                        <div className="space-y-3">
                          {dayShifts.map(shift => {
                            const totalPersonnel = (shift.personnel?.cuisine?.length || 0) + 
                                                 (shift.personnel?.salle?.length || 0) + 
                                                 (shift.personnel?.bar?.length || 0);
                            const isToday = shift.date === new Date().toISOString().split('T')[0];
                            const isTomorrow = shift.date === new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            
                            return (
                              <div 
                                key={shift.id} 
                                className={`rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer active:scale-95 ${
                                  isToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700' :
                                  'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                                onClick={() => handleEventClick({
                                  ...shift,
                                  shifts: [shift],
                                  validationStatus: shift.validationStatus,
                                  date: shift.date
                                })}
                              >
                                {/* Header avec indicateur visuel */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${isToday ? 'bg-blue-500' : isTomorrow ? 'bg-orange-400' : 'bg-slate-400'} ${isToday ? 'animate-pulse' : ''}`}></div>
                                    <div>
                                      <div className={`font-bold text-lg ${isToday ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {shift.title}
                                      </div>
                                      <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                                        {shift.start_time} - {shift.end_time}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Actions pour les managers */}
                                  {hasRole(['manager']) && (
                                    <button
                                      className="btn-hero-outline btn-hero-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditingShift(shift);
                                      }}
                                    >
                                      Modifier
                                    </button>
                                  )}
                                </div>

                                {/* Contenu principal */}
                                <div className="space-y-3">
                                  {/* Équipe par position */}
                                  {totalPersonnel > 0 && (
                                    <div>
                                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">👥 Équipe ({totalPersonnel})</div>
                                      <div className="flex flex-wrap gap-2">
                                        {/* Cuisine */}
                                        {shift.personnel?.cuisine?.length > 0 && (
                                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                            👨‍🍳 {shift.personnel.cuisine.length} Cuisine
                                          </span>
                                        )}
                                        {/* Salle */}
                                        {shift.personnel?.salle?.length > 0 && (
                                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                            🍽️ {shift.personnel.salle.length} Salle
                                          </span>
                                        )}
                                        {/* Bar */}
                                        {shift.personnel?.bar?.length > 0 && (
                                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                            🍸 {shift.personnel.bar.length} Bar
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Statut */}
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Statut</span>
                                    <div>
                                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                        shift.validationStatus === 'validated' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                        shift.validationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        shift.validationStatus === 'in_progress' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                      }`}>
                                        {shift.validationStatus === 'validated' ? (
                                          <>
                                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                                            Validé
                                          </>
                                        ) : shift.validationStatus === 'pending' ? (
                                          <>
                                            <ClockIcon className="h-4 w-4 mr-1" />
                                            En attente
                                          </>
                                        ) : shift.validationStatus === 'in_progress' ? (
                                          <>
                                            <ClockIcon className="h-4 w-4 mr-1" />
                                            En cours
                                          </>
                                        ) : (
                                          <>
                                            <CalendarIcon className="h-4 w-4 mr-1" />
                                            À venir
                                          </>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )
                });
              })()}
            </div>
          ) : (
            // Vue calendrier - Simplified grid
            <div className="space-y-4">
              {/* Navigation par mois */}
              <div className="flex items-center justify-between">
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateWeek(-1)}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Précédent
                </button>
                
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {(() => {
                    const weekDays = getDaysInWeek(currentWeek);
                    const startDate = weekDays[0];
                    const endDate = weekDays[6];
                    return `${format(startDate, 'd MMM', { locale: fr })} - ${format(endDate, 'd MMM yyyy', { locale: fr })}`;
                  })()}
                </h4>
                
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateWeek(1)}
                >
                  Suivant
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Grille du calendrier */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* En-têtes des jours */}
                <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-900">
                  {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(day => (
                    <div key={day} className="p-3 text-center text-sm font-medium text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Grille des jours */}
                <div className="grid grid-cols-7">
                  {getDaysInWeek(currentWeek).map((date, index) => {
                    const dayShifts = date ? getShiftsForDate(date) : [];
                    const isToday = date && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    
                    return (
                      <div 
                        key={index} 
                        className={`min-h-[100px] p-2 border-r border-b border-slate-200 dark:border-slate-700 last:border-r-0 ${
                          !date ? 'bg-slate-50 dark:bg-slate-900' : 
                          isToday ? 'bg-blue-50 dark:bg-blue-900/20' :
                          'bg-white dark:bg-slate-800'
                        }`}
                      >
                        {date && (
                          <>
                            <div className={`text-sm font-medium mb-2 ${
                              isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {date.getDate()}
                            </div>
                            
                            <div className="space-y-1">
                              {dayShifts.slice(0, 3).map(shift => (
                                <div
                                  key={shift.id}
                                  className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                                    shift.validationStatus === 'validated' ? 'bg-green-500 text-white' : 
                                    shift.validationStatus === 'pending' ? 'bg-orange-500 text-white' :
                                    shift.validationStatus === 'in_progress' ? 'bg-yellow-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}
                                  onClick={() => handleEventClick({
                                    ...shift,
                                    shifts: [shift],
                                    validationStatus: shift.validationStatus,
                                    date: shift.date
                                  })}
                                  title={`${shift.title} (${shift.start_time}-${shift.end_time})`}
                                >
                                  {/* Affichage différent selon la taille d'écran */}
                                  <div className="hidden md:block font-medium">
                                    {shift.title.length > 8 ? shift.title.substring(0, 8) + '...' : shift.title}
                                  </div>
                                  <div className="md:hidden text-center font-medium">
                                    <div className="text-xs font-bold">
                                      {shift.start_time}-{shift.end_time}
                                    </div>
                                    <div className="text-xs">
                                      {(shift.personnel?.cuisine?.length || 0) + (shift.personnel?.salle?.length || 0) + (shift.personnel?.bar?.length || 0)}p
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {dayShifts.length > 3 && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                  +{dayShifts.length - 3} autres
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Outils - uniquement pour les managers */}
      {hasRole(['manager']) && (
        <div className="card-hero">
          <div className="card-hero-header">
            <h3 className="card-hero-title">Outils</h3>
          </div>
          <div className="card-hero-content">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
              {/* Filtre de période pour l'export */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-hero">Date de début</label>
                    <input 
                      type="date"
                      className="input-hero mt-1"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-hero">Date de fin</label>
                    <input 
                      type="date"
                      className="input-hero mt-1"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              {/* Bouton d'export */}
              <div>
                <button 
                  className="btn-hero-primary w-full"
                  onClick={exportToExcel}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Exporter en Excel
                </button>
              </div>
            </div>
            
            {/* Création rapide de shifts */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Création de shifts</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Créez rapidement plusieurs shifts avec leur équipe ou utilisez la journée type
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    className="btn-hero-primary"
                    onClick={() => navigate('/shifts')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Créateur de shifts
                  </button>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de détails */}
      <ShiftDetailsModal />
      
      {/* Modal d'édition du personnel (managers seulement) - INTERFACE SIMPLIFIÉE */}
      {showEditModal && editingShift && hasRole(['manager']) && (
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

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="alert-hero alert-hero-destructive mb-4">
                  <div className="alert-hero-title">Erreur</div>
                  <div className="alert-hero-description">{error}</div>
                </div>
              )}

              {/* Résumé de l'équipe actuelle */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  📊 Équipe actuelle
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Cuisine: <span className="font-bold text-slate-900 dark:text-slate-100">{editingShift.personnel?.cuisine?.length || 0}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Salle: <span className="font-bold text-slate-900 dark:text-slate-100">{editingShift.personnel?.salle?.length || 0}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      Bar: <span className="font-bold text-slate-900 dark:text-slate-100">{editingShift.personnel?.bar?.length || 0}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Interface de sélection des utilisateurs */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    👨‍💼 Sélectionner les employés
                  </h4>
                  
                  {/* Barre de recherche */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher un employé..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allUsers
                    .filter(user => 
                      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      user.role.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(user => {
                      const isInCuisine = editingShift.personnel?.cuisine?.some(p => p.user_id === user.id);
                      const isInSalle = editingShift.personnel?.salle?.some(p => p.user_id === user.id);
                      const isInBar = editingShift.personnel?.bar?.some(p => p.user_id === user.id);
                      const isAssigned = isInCuisine || isInSalle || isInBar;
                      
                      return (
                        <div 
                          key={user.id} 
                          className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                            isAssigned 
                              ? 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' 
                              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          {/* Info utilisateur */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {user.username}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {user.role}
                              </div>
                            </div>
                          </div>

                          {/* Positions disponibles */}
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            Peut travailler en:
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.positions && user.positions.includes('cuisine') && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                  👨‍🍳 Cuisine
                                </span>
                              )}
                              {user.positions && user.positions.includes('salle') && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                                  🍽️ Salle
                                </span>
                              )}
                              {user.positions && user.positions.includes('bar') && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                  🍸 Bar
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Boutons d'assignation */}
                          <div className="space-y-2">
                            {user.positions && user.positions.includes('cuisine') && (
                              <button
                                onClick={() => {
                                  if (isInCuisine) {
                                    removeUserFromPosition('cuisine', user.id);
                                  } else {
                                    addUserToPosition('cuisine', user.id);
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  isInCuisine
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40'
                                }`}
                              >
                                {isInCuisine ? '✅ Assigné en Cuisine' : '👨‍🍳 Assigner en Cuisine'}
                              </button>
                            )}
                            
                            {user.positions && user.positions.includes('salle') && (
                              <button
                                onClick={() => {
                                  if (isInSalle) {
                                    removeUserFromPosition('salle', user.id);
                                  } else {
                                    addUserToPosition('salle', user.id);
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  isInSalle
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
                                }`}
                              >
                                {isInSalle ? '✅ Assigné en Salle' : '🍽️ Assigner en Salle'}
                              </button>
                            )}
                            
                            {user.positions && user.positions.includes('bar') && (
                              <button
                                onClick={() => {
                                  if (isInBar) {
                                    removeUserFromPosition('bar', user.id);
                                  } else {
                                    addUserToPosition('bar', user.id);
                                  }
                                }}
                                className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  isInBar
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40'
                                }`}
                              >
                                {isInBar ? '✅ Assigné au Bar' : '🍸 Assigner au Bar'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingShift(null);
                    setError('');
                    setSearchTerm(''); // Réinitialiser la recherche
                  }}
                  className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={saveShiftChanges}
                  disabled={editLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center min-w-[120px]"
                >
                  {editLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal des salaires */}
      {showSalaries && (
        <Modal show={showSalaries} onHide={() => setShowSalaries(false)} size="lg">
          <Modal.Header closeButton onClose={() => setShowSalaries(false)}>
            <Modal.Title>Calcul des salaires</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {shiftSalaries.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400">Aucune donnée de salaire disponible pour ce shift.</p>
            ) : (
              <>
                {/* Vue desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Employé</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Position</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Heures travaillées</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Taux horaire</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Salaire</th>
                        <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-slate-100">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftSalaries.map((salary, index) => (
                        <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                            {salary.first_name || salary.last_name 
                              ? `${salary.first_name || ''} ${salary.last_name || ''}`.trim()
                              : salary.username
                            }
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              salary.position === 'cuisine' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                              salary.position === 'salle' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {salary.position}
                            </span>
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{salary.hours_worked}h</td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                            {salary.hourly_rate !== undefined ? `${salary.hourly_rate}€/h` : 'Non visible'}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            {salary.salary !== undefined ? `${salary.salary}€` : 'Non visible'}
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              salary.validated ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                              {salary.validated ? 'Validé' : 'En attente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {shiftSalaries.some(s => s.salary !== undefined) && (
                      <tfoot>
                        <tr className="bg-blue-50 dark:bg-blue-900/20">
                          <td colSpan="4" className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">Total</td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                            {shiftSalaries
                              .filter(s => s.salary !== undefined)
                              .reduce((total, s) => total + s.salary, 0)
                              .toFixed(2)}€
                          </td>
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Vue mobile */}
                <div className="md:hidden space-y-4">
                  {shiftSalaries.map((salary, index) => (
                    <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-base font-medium text-slate-900 dark:text-slate-100">
                            {salary.first_name || salary.last_name 
                              ? `${salary.first_name || ''} ${salary.last_name || ''}`.trim()
                              : salary.username
                            }
                          </h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mt-1 ${
                            salary.position === 'cuisine' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                            salary.position === 'salle' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            {salary.position}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          salary.validated ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}>
                          {salary.validated ? 'Validé' : 'En attente'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Heures travaillées:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{salary.hours_worked}h</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Taux horaire:</span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {salary.hourly_rate !== undefined ? `${salary.hourly_rate}€/h` : 'Non visible'}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">Salaire:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {salary.salary !== undefined ? `${salary.salary}€` : 'Non visible'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total mobile */}
                  {shiftSalaries.some(s => s.salary !== undefined) && (
                    <div className="border-t-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-medium text-slate-900 dark:text-slate-100">Total</span>
                        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {shiftSalaries
                            .filter(s => s.salary !== undefined)
                            .reduce((total, s) => total + s.salary, 0)
                            .toFixed(2)}€
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowSalaries(false)}>
              Fermer
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      
      {/* Modal de création rapide */}
      {showQuickCreateModal && hasRole(['manager']) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Créer une journée type
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    3 shifts standards seront créés
                  </p>
                </div>
                <button
                  onClick={() => setShowQuickCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Sélection de date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Date pour la journée type
                </label>
                <input 
                  type="date"
                  className="w-full p-3 text-lg border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={quickCreateDate}
                  onChange={(e) => setQuickCreateDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // Empêcher les dates passées
                />
              </div>

              {/* Aperçu des shifts qui seront créés */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Shifts qui seront créés :
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <span className="font-medium text-blue-900 dark:text-blue-100">🍽️ Service Midi</span>
                    <span className="text-blue-700 dark:text-blue-300">11:00 - 15:00</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <span className="font-medium text-orange-900 dark:text-orange-100">🌆 Service Après-Midi</span>
                    <span className="text-orange-700 dark:text-orange-300">15:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-medium text-green-900 dark:text-green-100">🌙 Service Soir</span>
                    <span className="text-green-700 dark:text-green-300">18:00 - 23:00</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  💡 Vous pourrez assigner le personnel après la création
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowQuickCreateModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 py-3 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={createTypicalDay}
                  disabled={quickCreateLoading || !quickCreateDate}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  {quickCreateLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Création...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Créer les shifts
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal d'ajout manuel des heures */}
      {showManualHoursModal && selectedUserShift && hasRole(['responsable', 'manager']) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    ⏰ Ajout manuel des heures
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {selectedUserShift.username} - {selectedUserShift.position}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowManualHoursModal(false);
                    setSelectedUserShift(null);
                    setManualClockIn('');
                    setManualClockOut('');
                    setError('');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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

              {/* Informations du shift */}
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Shift: {selectedUserShift.shift.title}
                </h4>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  <div>📅 {new Date(selectedUserShift.shift.date).toLocaleDateString('fr-FR')}</div>
                  <div>⏱️ {selectedUserShift.shift.start_time} - {selectedUserShift.shift.end_time}</div>
                  <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    selectedUserShift.position === 'cuisine' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                    selectedUserShift.position === 'salle' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                  }`}>
                    👨‍💼 {selectedUserShift.position}
                  </div>
                </div>
              </div>

              {/* Saisie des heures */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    🕐 Heure d'arrivée
                  </label>
                  <input 
                    type="time"
                    className="w-full p-3 text-lg border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualClockIn}
                    onChange={(e) => setManualClockIn(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    🕐 Heure de départ
                  </label>
                  <input 
                    type="time"
                    className="w-full p-3 text-lg border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={manualClockOut}
                    onChange={(e) => setManualClockOut(e.target.value)}
                  />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  💡 <strong>Note:</strong> Si l'heure de départ est inférieure à l'heure d'arrivée, le système considérera automatiquement que c'est le lendemain.
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowManualHoursModal(false);
                    setSelectedUserShift(null);
                    setManualClockIn('');
                    setManualClockOut('');
                    setError('');
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 py-3 px-4 rounded-lg font-medium transition-colors duration-200"
                >
                  Annuler
                </button>
                <button
                  onClick={saveManualHours}
                  disabled={manualHoursLoading || !manualClockIn || !manualClockOut}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  {manualHoursLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <ClockIcon className="w-4 h-4 mr-2" />
                      Sauvegarder les heures
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftCalendar; 