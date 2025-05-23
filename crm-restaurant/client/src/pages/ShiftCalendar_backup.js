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
  ChevronRightIcon
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

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

  // Utilitaires pour la nouvelle interface
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Ajouter les jours vides du début du mois
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Ajouter tous les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getShiftsForDate = (date) => {
    if (!date) return [];
    const dateString = format(date, 'yyyy-MM-dd');
    return shifts.filter(shift => shift.date === dateString);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setCurrentMonth(newMonth);
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
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}>
                    {shift.validationStatus === 'validated' ? 'Validé' : 
                     shift.validationStatus === 'pending' ? 'En attente' : 
                     'À venir'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Personnel de cuisine */}
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de cuisine</h4>
                  {shift.personnel.cuisine.length === 0 ? (
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
                                {person.validated ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
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
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de salle</h4>
                  {shift.personnel.salle.length === 0 ? (
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
                                {person.validated ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
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
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mb-3">Personnel de bar</h4>
                  {shift.personnel.bar.length === 0 ? (
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
                                {person.validated ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Validé</span>
                                ) : person.clock_in && person.clock_out ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">En attente</span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">Non pointé</span>
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
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Précédent
                </button>
                
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </h4>
                
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateMonth(1)}
                >
                  Suivant
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </button>
              </div>

              {/* Liste des shifts du mois */}
              {(() => {
                const monthShifts = shifts.filter(shift => {
                  const shiftDate = new Date(shift.date);
                  return shiftDate.getMonth() === currentMonth.getMonth() && 
                         shiftDate.getFullYear() === currentMonth.getFullYear();
                }).sort((a, b) => new Date(a.date) - new Date(b.date));

                if (monthShifts.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun shift planifié ce mois-ci.</p>
                    </div>
                  );
                }

                // Grouper par date
                const groupedByDate = monthShifts.reduce((acc, shift) => {
                  const date = shift.date;
                  if (!acc[date]) {
                    acc[date] = [];
                  }
                  acc[date].push(shift);
                  return acc;
                }, {});

                return Object.keys(groupedByDate).map(date => (
                  <div key={date} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                      <h5 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {formatDateWithDay(date)}
                      </h5>
                    </div>
                    
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {groupedByDate[date].map(shift => (
                        <div 
                          key={shift.id} 
                          className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          onClick={() => handleEventClick({
                            ...shift,
                            shifts: [shift],
                            validationStatus: shift.validationStatus,
                            date: shift.date
                          })}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h6 className="text-base font-medium text-slate-900 dark:text-slate-100">
                                  {shift.title}
                                </h6>
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  shift.validationStatus === 'validated' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                                  shift.validationStatus === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                }`}>
                                  {shift.validationStatus === 'validated' ? 'Validé' : 
                                   shift.validationStatus === 'pending' ? 'En attente' : 
                                   'À venir'}
                                </span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                <span>🕐 {shift.start_time} - {shift.end_time}</span>
                                <span>👥 {(shift.personnel?.cuisine?.length || 0) + (shift.personnel?.salle?.length || 0) + (shift.personnel?.bar?.length || 0)} pers.</span>
                                {shift.personnel?.cuisine?.length > 0 && (
                                  <span>🍳 {shift.personnel.cuisine.length} cuisine</span>
                                )}
                                {shift.personnel?.salle?.length > 0 && (
                                  <span>🍽️ {shift.personnel.salle.length} salle</span>
                                )}
                                {shift.personnel?.bar?.length > 0 && (
                                  <span>🍸 {shift.personnel.bar.length} bar</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
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
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            // Vue calendrier - Simplified grid
            <div className="space-y-4">
              {/* Navigation par mois */}
              <div className="flex items-center justify-between">
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Précédent
                </button>
                
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </h4>
                
                <button
                  className="btn-hero-outline btn-hero-sm"
                  onClick={() => navigateMonth(1)}
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
                  {getDaysInMonth(currentMonth).map((date, index) => {
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
                                  {shift.title.length > 8 ? shift.title.substring(0, 8) + '...' : shift.title}
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

      {/* Légende */}
      <div className="card-hero">
        <div className="card-hero-content">
          <h3 className="card-hero-title text-lg mb-4">Légende des couleurs</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Heures validées</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Heures en attente de validation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Shift à venir</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-500 rounded"></div>
              <span className="text-sm text-slate-700 dark:text-slate-300">Erreur/Non défini</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cliquez sur un shift pour voir les détails du personnel</p>
        </div>
      </div>
      
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
            
            {/* Bouton d'export (uniquement pour les managers) */}
            <div>
              {hasRole(['manager']) && (
                <button 
                  className="btn-hero-primary w-full"
                  onClick={exportToExcel}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
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
          <Modal.Header closeButton onClose={() => setShowEditModal(false)}>
            <Modal.Title>Modifier le personnel - {editingShift.title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Personnel de cuisine */}
              <div>
                <h6 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-3">Cuisine</h6>
                <div className="mb-3">
                  <select 
                    className="input-hero"
                    onChange={(e) => e.target.value && addUserToPosition('cuisine', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 min-h-[100px] bg-slate-50 dark:bg-slate-800">
                  {editingShift.personnel.cuisine.map(person => (
                    <div key={person.user_id} className="flex justify-between items-center mb-2 last:mb-0">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{person.username}</span>
                      <Button 
                        variant="danger"
                        size="sm"
                        onClick={() => removeUserFromPosition('cuisine', person.user_id)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Personnel de salle */}
              <div>
                <h6 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-3">Salle</h6>
                <div className="mb-3">
                  <select 
                    className="input-hero"
                    onChange={(e) => e.target.value && addUserToPosition('salle', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 min-h-[100px] bg-slate-50 dark:bg-slate-800">
                  {editingShift.personnel.salle.map(person => (
                    <div key={person.user_id} className="flex justify-between items-center mb-2 last:mb-0">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{person.username}</span>
                      <Button 
                        variant="danger"
                        size="sm"
                        onClick={() => removeUserFromPosition('salle', person.user_id)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Personnel de bar */}
              <div>
                <h6 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-3">Bar</h6>
                <div className="mb-3">
                  <select 
                    className="input-hero"
                    onChange={(e) => e.target.value && addUserToPosition('bar', e.target.value)}
                    value=""
                  >
                    <option value="">Ajouter un employé...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>
                <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 min-h-[100px] bg-slate-50 dark:bg-slate-800">
                  {editingShift.personnel.bar.map(person => (
                    <div key={person.user_id} className="flex justify-between items-center mb-2 last:mb-0">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{person.username}</span>
                      <Button 
                        variant="danger"
                        size="sm"
                        onClick={() => removeUserFromPosition('bar', person.user_id)}
                      >
                        ×
                      </Button>
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
    </div>
  );
};

export default ShiftCalendar; 