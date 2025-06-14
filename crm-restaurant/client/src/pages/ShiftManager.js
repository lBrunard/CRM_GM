import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, userService } from '../services/api';
import { useNavigate } from 'react-router-dom';
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

const ShiftManager = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // États principaux
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allUsers, setAllUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modèles de shifts prédéfinis
  const shiftTemplates = [
    { title: 'Service Midi', start_time: '11:45', end_time: '15:00', color: 'blue' },
    { title: 'Service Après-Midi', start_time: '15:00', end_time: '18:00', color: 'orange' },
    { title: 'Service Soir', start_time: '18:00', end_time: '23:00', color: 'green' },
    { title: 'Longue Midi', start_time: '11:45', end_time: '18:00', color: 'purple' },
    { title: 'Longue Soir', start_time: '15:00', end_time: '13:00', color: 'red' },
  ];

  useEffect(() => {
    if (!hasRole(['manager'])) {
      navigate('/unauthorized');
      return;
    }
    loadUsers();
    // Initialiser avec un shift par défaut
    addShift(shiftTemplates[0]);
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

  const addShift = (template = null) => {
    const defaultShift = template || { title: '', start_time: '', end_time: '', color: 'blue' };
    
    const newShift = {
      id: Date.now(), // ID temporaire
      title: defaultShift.title,
      start_time: defaultShift.start_time,
      end_time: defaultShift.end_time,
      color: defaultShift.color,
      personnel: {
        cuisine: [],
        salle: [],
        bar: []
      }
    };
    
    setShifts([...shifts, newShift]);
  };

  const removeShift = (shiftId) => {
    setShifts(shifts.filter(s => s.id !== shiftId));
  };

  const updateShift = (shiftId, field, value) => {
    setShifts(shifts.map(shift => 
      shift.id === shiftId ? { ...shift, [field]: value } : shift
    ));
  };

  const addUserToShift = (shiftId, position, userId) => {
    const user = allUsers.find(u => u.id === parseInt(userId));
    if (!user) return;

    setShifts(shifts.map(shift => {
      if (shift.id === shiftId) {
        // Retirer l'utilisateur de toutes les autres positions d'abord
        const newPersonnel = {
          cuisine: shift.personnel.cuisine.filter(p => p.user_id !== user.id),
          salle: shift.personnel.salle.filter(p => p.user_id !== user.id),
          bar: shift.personnel.bar.filter(p => p.user_id !== user.id)
        };
        
        // Ajouter à la nouvelle position
        newPersonnel[position] = [...newPersonnel[position], { user_id: user.id, username: user.username }];
        
        return { ...shift, personnel: newPersonnel };
      }
      return shift;
    }));
  };

  const removeUserFromShift = (shiftId, position, userId) => {
    setShifts(shifts.map(shift => {
      if (shift.id === shiftId) {
        return {
          ...shift,
          personnel: {
            ...shift.personnel,
            [position]: shift.personnel[position].filter(p => p.user_id !== userId)
          }
        };
      }
      return shift;
    }));
  };

  const duplicateShift = (shiftIndex) => {
    const shiftToCopy = shifts[shiftIndex];
    const newShift = {
      ...shiftToCopy,
      id: Date.now(),
      title: shiftToCopy.title + ' (Copie)'
    };
    setShifts([...shifts, newShift]);
  };

  const saveAllShifts = async () => {
    if (shifts.length === 0) {
      setError('Aucun shift à sauvegarder');
      return;
    }

    // Validation
    const invalidShifts = shifts.filter(s => !s.title || !s.start_time || !s.end_time);
    if (invalidShifts.length > 0) {
      setError('Tous les shifts doivent avoir un titre et des heures');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const shiftsToCreate = shifts.map(shift => ({
        title: shift.title,
        date: selectedDate,
        start_time: shift.start_time,
        end_time: shift.end_time,
        assigned_users: [
          ...shift.personnel.cuisine.map(p => ({ userId: p.user_id, position: 'cuisine' })),
          ...shift.personnel.salle.map(p => ({ userId: p.user_id, position: 'salle' })),
          ...shift.personnel.bar.map(p => ({ userId: p.user_id, position: 'bar' }))
        ]
      }));

      await shiftService.createMultipleShifts({ shifts: shiftsToCreate });
      
      setSuccess(`✅ ${shifts.length} shift(s) créé(s) avec succès pour le ${new Date(selectedDate).toLocaleDateString('fr-FR')}`);
      
      // Réinitialiser seulement le personnel (garder la structure des shifts)
      const resetShifts = shifts.map(shift => ({
        ...shift,
        id: Date.now() + Math.random(),
        personnel: { cuisine: [], salle: [], bar: [] }
      }));
      setShifts(resetShifts);

    } catch (err) {
      console.error('Erreur lors de la création des shifts:', err);
      setError('Erreur lors de la création des shifts');
    } finally {
      setLoading(false);
    }
  };

  // Fonction helper pour naviguer entre les jours
  const navigateToDay = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate.toISOString().split('T')[0]);
    
    // Préserver la structure des shifts mais vider le personnel
    if (shifts.length > 0) {
      const resetShifts = shifts.map(shift => ({
        ...shift,
        id: Date.now() + Math.random(),
        personnel: { cuisine: [], salle: [], bar: [] }
      }));
      setShifts(resetShifts);
    }
    
    setError('');
    setSuccess('');
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
      orange: 'border-orange-200 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20',
      green: 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20',
      purple: 'border-purple-200 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20',
      red: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
    };
    return colors[color] || colors.blue;
  };

  const getAvailableUsers = (shiftId, position) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return [];

    // Utilisateurs déjà assignés à ce shift
    const assignedUsers = [
      ...shift.personnel.cuisine.map(p => p.user_id),
      ...shift.personnel.salle.map(p => p.user_id),
      ...shift.personnel.bar.map(p => p.user_id)
    ];

    // Retourner les utilisateurs non assignés qui peuvent occuper cette position
    return allUsers.filter(user => 
      !assignedUsers.includes(user.id) &&
      user.positions && 
      user.positions.includes(position)
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">🚀 Créateur de Shifts</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Créez rapidement plusieurs shifts avec leur équipe pour une journée
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar avec outils */}
        <div className="lg:col-span-1 space-y-6">
          {/* Actions */}
          <div className="card-hero">
            <div className="card-hero-header">
              <h3 className="card-hero-title">⚡ Actions</h3>
            </div>
            <div className="card-hero-content space-y-3">
              <button
                onClick={() => addShift()}
                className="btn-hero-outline w-full"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Ajouter un shift
              </button>
              
              <button
                onClick={saveAllShifts}
                disabled={loading || shifts.length === 0}
                className="btn-hero-primary w-full"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Créer les shifts
                    {(() => {
                      const hasPersonnel = shifts.some(shift => 
                        shift.personnel.cuisine.length > 0 || 
                        shift.personnel.salle.length > 0 || 
                        shift.personnel.bar.length > 0
                      );
                      return hasPersonnel ? (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                          {shifts.reduce((total, shift) => 
                            total + shift.personnel.cuisine.length + shift.personnel.salle.length + shift.personnel.bar.length, 0
                          )} pers.
                        </span>
                      ) : null;
                    })()}
                  </>
                )}
              </button>
            </div>
          </div>
          {/* Sélection de date */}
          <div className="card-hero">
            <div className="card-hero-header">
              <h3 className="card-hero-title">📅 Date du shift</h3>
            </div>
            <div className="card-hero-content">
              {/* Navigation par jour avec flèches */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => navigateToDay(-1)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Jour précédent"
                >
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-center flex-1 mx-3">
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {new Date(selectedDate).toLocaleDateString('fr-FR', { 
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(selectedDate).getFullYear()}
                  </div>
                </div>
                
                <button
                  onClick={() => navigateToDay(1)}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Jour suivant"
                >
                  <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Sélecteur de date traditionnel (moins visible) */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center">
                  <span>Choisir une autre date</span>
                  <svg className="w-4 h-4 ml-1 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-3">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      // Préserver la structure des shifts mais vider le personnel
                      if (shifts.length > 0) {
                        const resetShifts = shifts.map(shift => ({
                          ...shift,
                          id: Date.now() + Math.random(),
                          personnel: { cuisine: [], salle: [], bar: [] }
                        }));
                        setShifts(resetShifts);
                      }
                      setError('');
                      setSuccess('');
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </details>
            </div>
          </div>

          {/* Modèles de shifts */}
          <div className="card-hero">
            <div className="card-hero-header">
              <h3 className="card-hero-title">📋 Modèles rapides</h3>
            </div>
            <div className="card-hero-content space-y-2">
              {shiftTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => addShift(template)}
                  className="w-full p-3 text-left border border-slate-200 dark:border-slate-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 transition-colors bg-white dark:bg-slate-700"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{template.title}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{template.start_time} - {template.end_time}</div>
                </button>
              ))}
            </div>
          </div>

          
        </div>

        {/* Zone principale des shifts */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            {shifts.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600">
                <CalendarIcon className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Aucun shift</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">Commencez par ajouter un modèle de shift ou créer un shift vide</p>
              </div>
            ) : (
              shifts.map((shift, index) => (
                <div key={shift.id} className={`border-2 rounded-xl p-6 ${getColorClasses(shift.color)}`}>
                  {/* Header du shift */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Nom du shift..."
                          value={shift.title}
                          onChange={(e) => updateShift(shift.id, 'title', e.target.value)}
                          className="text-xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 w-full"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-slate-500" />
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => updateShift(shift.id, 'start_time', e.target.value)}
                          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-slate-500">→</span>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => updateShift(shift.id, 'end_time', e.target.value)}
                          className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => duplicateShift(index)}
                        className="text-slate-500 hover:text-blue-600 transition-colors"
                        title="Dupliquer ce shift"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => removeShift(shift.id)}
                        className="text-slate-500 hover:text-red-600 transition-colors"
                        title="Supprimer ce shift"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Assignation du personnel */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cuisine */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">👨‍🍳 Cuisine</h4>
                        <span className="text-xs text-slate-500">({shift.personnel.cuisine.length})</span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {shift.personnel.cuisine.map(person => (
                          <div key={person.user_id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{person.username}</span>
                            <button
                              onClick={() => removeUserFromShift(shift.id, 'cuisine', person.user_id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addUserToShift(shift.id, 'cuisine', e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full p-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">+ Ajouter</option>
                        {getAvailableUsers(shift.id, 'cuisine').map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                      </select>
                    </div>

                    {/* Salle */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">🍽️ Salle</h4>
                        <span className="text-xs text-slate-500">({shift.personnel.salle.length})</span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {shift.personnel.salle.map(person => (
                          <div key={person.user_id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{person.username}</span>
                            <button
                              onClick={() => removeUserFromShift(shift.id, 'salle', person.user_id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addUserToShift(shift.id, 'salle', e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full p-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">+ Ajouter</option>
                        {getAvailableUsers(shift.id, 'salle').map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bar */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">🍸 Bar</h4>
                        <span className="text-xs text-slate-500">({shift.personnel.bar.length})</span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {shift.personnel.bar.map(person => (
                          <div key={person.user_id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{person.username}</span>
                            <button
                              onClick={() => removeUserFromShift(shift.id, 'bar', person.user_id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            addUserToShift(shift.id, 'bar', e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="w-full p-2 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">+ Ajouter</option>
                        {getAvailableUsers(shift.id, 'bar').map(user => (
                          <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Résumé du shift */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span>👥 Total: {shift.personnel.cuisine.length + shift.personnel.salle.length + shift.personnel.bar.length} personnes</span>
                      {shift.start_time && shift.end_time && (
                        <span>⏱️ Durée: {
                          (() => {
                            const start = new Date(`2000-01-01T${shift.start_time}`);
                            const end = new Date(`2000-01-01T${shift.end_time}`);
                            if (end < start) end.setDate(end.getDate() + 1); // Shift overnight
                            const diff = (end - start) / (1000 * 60 * 60);
                            return `${diff}h`;
                          })()
                        }</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftManager; 