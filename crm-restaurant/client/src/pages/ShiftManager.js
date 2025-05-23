import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, userService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import Modal from '../components/Modal';

const ShiftManager = () => {
  const { hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  // Configuration des shifts par défaut
  const [shiftTemplate, setShiftTemplate] = useState({
    date: '',
    shifts: [
      { name: 'Service Midi', start: '11:00', end: '15:00' },
      { name: 'Service Soir', start: '18:00', end: '23:00' },
      { name: 'Ouverture/Fermeture', start: '09:00', end: '24:00' }
    ]
  });

  const [assignments, setAssignments] = useState({});
  
  // Gestion des templates
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    if (!hasRole(['manager'])) {
      navigate('/unauthorized');
      return;
    }
    loadUsers();
    loadSavedTemplates();
  }, [hasRole, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers();
      setUsers(response.data);
      
      // Initialiser les assignments
      const initialAssignments = {};
      shiftTemplate.shifts.forEach((_, shiftIndex) => {
        initialAssignments[shiftIndex] = {
          cuisine: [],
          salle: [],
          bar: []
        };
      });
      setAssignments(initialAssignments);
    } catch (err) {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  // Charger les templates sauvegardés depuis le localStorage
  const loadSavedTemplates = () => {
    const saved = localStorage.getItem('shiftTemplates');
    if (saved) {
      setSavedTemplates(JSON.parse(saved));
    }
  };

  // Sauvegarder un template
  const saveTemplate = () => {
    if (!templateName.trim()) {
      setError('Veuillez donner un nom au template');
      return;
    }

    const template = {
      name: templateName,
      shifts: shiftTemplate.shifts,
      assignments: assignments,
      savedAt: new Date().toISOString()
    };

    const templates = [...savedTemplates.filter(t => t.name !== templateName), template];
    setSavedTemplates(templates);
    localStorage.setItem('shiftTemplates', JSON.stringify(templates));
    
    setSuccess(`Template "${templateName}" sauvegardé avec succès`);
    setTemplateName('');
    setShowTemplateModal(false);
  };

  // Charger un template
  const loadTemplate = (template) => {
    setShiftTemplate({
      ...shiftTemplate,
      shifts: template.shifts
    });
    setAssignments(template.assignments);
    setSuccess(`Template "${template.name}" chargé avec succès`);
  };

  // Supprimer un template
  const deleteTemplate = (templateToDelete) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le template "${templateToDelete.name}" ?`)) {
      const templates = savedTemplates.filter(t => t.name !== templateToDelete.name);
      setSavedTemplates(templates);
      localStorage.setItem('shiftTemplates', JSON.stringify(templates));
      setSuccess(`Template "${templateToDelete.name}" supprimé`);
    }
  };

  // Mettre à jour un shift du template
  const updateShiftTemplate = (index, field, value) => {
    const newShifts = [...shiftTemplate.shifts];
    newShifts[index][field] = value;
    setShiftTemplate({
      ...shiftTemplate,
      shifts: newShifts
    });
  };

  // Ajouter un utilisateur à un poste d'un shift
  const addUserToShift = (shiftIndex, position, userId) => {
    const user = users.find(u => u.id === parseInt(userId));
    if (!user) return;

    // Vérifier que l'utilisateur n'est pas déjà assigné dans ce shift
    const currentShiftAssignments = assignments[shiftIndex];
    const isAlreadyAssigned = ['cuisine', 'salle', 'bar'].some(pos => 
      currentShiftAssignments[pos].some(u => u.id === user.id)
    );

    if (isAlreadyAssigned) {
      alert('Cet utilisateur est déjà assigné à ce shift');
      return;
    }

    setAssignments({
      ...assignments,
      [shiftIndex]: {
        ...assignments[shiftIndex],
        [position]: [...assignments[shiftIndex][position], user]
      }
    });
  };

  // Retirer un utilisateur d'un poste
  const removeUserFromShift = (shiftIndex, position, userId) => {
    setAssignments({
      ...assignments,
      [shiftIndex]: {
        ...assignments[shiftIndex],
        [position]: assignments[shiftIndex][position].filter(u => u.id !== userId)
      }
    });
  };

  // Créer tous les shifts de la journée
  const createDayShifts = async () => {
    if (!shiftTemplate.date) {
      setError('Veuillez sélectionner une date');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      const shiftsToCreate = shiftTemplate.shifts.map((shift, index) => ({
        title: shift.name,
        date: shiftTemplate.date,
        start_time: shift.start,
        end_time: shift.end,
        assigned_users: [
          ...(assignments[index]?.cuisine || []).map(user => ({ userId: user.id, position: 'cuisine' })),
          ...(assignments[index]?.salle || []).map(user => ({ userId: user.id, position: 'salle' })),
          ...(assignments[index]?.bar || []).map(user => ({ userId: user.id, position: 'bar' }))
        ]
      }));

      await shiftService.createMultipleShifts({ shifts: shiftsToCreate });
      
      setSuccess(`${shiftsToCreate.length} shifts créés avec succès pour le ${new Date(shiftTemplate.date).toLocaleDateString()}`);
      
      // Réinitialiser les assignments
      const resetAssignments = {};
      shiftTemplate.shifts.forEach((_, shiftIndex) => {
        resetAssignments[shiftIndex] = {
          cuisine: [],
          salle: [],
          bar: []
        };
      });
      setAssignments(resetAssignments);
      
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création des shifts');
    } finally {
      setCreating(false);
    }
  };

  // Ajouter un nouveau shift au template
  const addShiftToTemplate = () => {
    const newShifts = [...shiftTemplate.shifts, { name: 'Nouveau Service', start: '12:00', end: '18:00' }];
    setShiftTemplate({
      ...shiftTemplate,
      shifts: newShifts
    });
    
    // Ajouter les assignments pour ce nouveau shift
    setAssignments({
      ...assignments,
      [newShifts.length - 1]: {
        cuisine: [],
        salle: [],
        bar: []
      }
    });
  };

  // Supprimer un shift du template
  const removeShiftFromTemplate = (index) => {
    const newShifts = shiftTemplate.shifts.filter((_, i) => i !== index);
    setShiftTemplate({
      ...shiftTemplate,
      shifts: newShifts
    });
    
    // Réorganiser les assignments
    const newAssignments = {};
    newShifts.forEach((_, shiftIndex) => {
      newAssignments[shiftIndex] = assignments[shiftIndex < index ? shiftIndex : shiftIndex + 1] || {
        cuisine: [],
        salle: [],
        bar: []
      };
    });
    setAssignments(newAssignments);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 text-blue-600 mx-auto" role="status">
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Création des shifts quotidiens</h1>
      </div>
      
      {error && (
        <div className="alert-hero alert-hero-destructive">
          <div className="alert-hero-title">Erreur</div>
          <div className="alert-hero-description">{error}</div>
        </div>
      )}
      
      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-800 dark:text-green-200">{success}</div>
        </div>
      )}

      {/* Sélection de la date */}
      <div className="card-hero">
        <div className="card-hero-header bg-blue-600 text-white">
          <h3 className="text-lg font-medium text-white">Configuration de la journée</h3>
        </div>
        <div className="card-hero-content">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-3">
              <label className="label-hero">Date</label>
              <input
                type="date"
                className="input-hero mt-1"
                value={shiftTemplate.date}
                onChange={(e) => setShiftTemplate({ ...shiftTemplate, date: e.target.value })}
              />
            </div>
            <div className="lg:col-span-9 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={addShiftToTemplate}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Ajouter un service
              </Button>
              <Button
                variant="info"
                onClick={() => setShowTemplateModal(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                </svg>
                Sauvegarder template
              </Button>
              <Button
                variant="success"
                onClick={createDayShifts}
                disabled={creating || !shiftTemplate.date}
              >
                {creating ? (
                  <>
                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                    Création en cours...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    Créer tous les shifts
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Gestion des templates */}
      {savedTemplates.length > 0 && (
        <div className="card-hero">
          <div className="card-hero-header">
            <h3 className="card-hero-title">Templates sauvegardés</h3>
          </div>
          <div className="card-hero-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedTemplates.map(template => (
                <div key={template.name} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">{template.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {template.shifts.length} service(s)
                    <br />
                    Sauvegardé: {new Date(template.savedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="primary"
                      size="sm"
                      onClick={() => loadTemplate(template)}
                    >
                      Charger
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTemplate(template)}
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration des shifts */}
      {shiftTemplate.shifts.map((shift, shiftIndex) => (
        <div key={shiftIndex} className="card-hero">
          <div className="card-hero-header">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="text"
                  className="input-hero font-semibold w-full sm:w-48"
                  value={shift.name}
                  onChange={(e) => updateShiftTemplate(shiftIndex, 'name', e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="input-hero w-24"
                    value={shift.start}
                    onChange={(e) => updateShiftTemplate(shiftIndex, 'start', e.target.value)}
                  />
                  <span className="text-slate-500 dark:text-slate-400">à</span>
                  <input
                    type="time"
                    className="input-hero w-24"
                    value={shift.end}
                    onChange={(e) => updateShiftTemplate(shiftIndex, 'end', e.target.value)}
                  />
                </div>
              </div>
              {shiftTemplate.shifts.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeShiftFromTemplate(shiftIndex)}
                  className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
          <div className="card-hero-content">
            {/* Vue desktop */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
              {['cuisine', 'salle', 'bar'].map(position => (
                <div key={position}>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-base font-medium text-slate-900 dark:text-slate-100 capitalize">
                      {position}
                    </h4>
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                      {assignments[shiftIndex]?.[position]?.length || 0}
                    </span>
                  </div>
                  
                  {/* Sélecteur pour ajouter du personnel */}
                  <select
                    className="input-hero mb-3 text-sm"
                    onChange={(e) => {
                      if (e.target.value) {
                        addUserToShift(shiftIndex, position, e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Ajouter personnel...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.role})
                      </option>
                    ))}
                  </select>
                  
                  {/* Liste du personnel assigné */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 bg-slate-50 dark:bg-slate-800 min-h-[100px] max-h-[200px] overflow-y-auto">
                    {assignments[shiftIndex]?.[position]?.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Aucun personnel assigné</p>
                    ) : (
                      assignments[shiftIndex][position].map(user => (
                        <div key={user.id} className="flex justify-between items-center mb-2 last:mb-0 p-2 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                          <div className="text-sm">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{user.username}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{user.role}</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeUserFromShift(shiftIndex, position, user.id)}
                            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20 px-2 py-1"
                          >
                            ×
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vue mobile */}
            <div className="md:hidden space-y-6">
              {['cuisine', 'salle', 'bar'].map(position => (
                <div key={position} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 capitalize flex items-center gap-2">
                      {position === 'cuisine' && '🍳'}
                      {position === 'salle' && '🍽️'}
                      {position === 'bar' && '🍸'}
                      {position}
                    </h4>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                      {assignments[shiftIndex]?.[position]?.length || 0} pers.
                    </span>
                  </div>
                  
                  {/* Sélecteur pour ajouter du personnel */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Ajouter du personnel
                    </label>
                    <select
                      className="input-hero text-sm"
                      onChange={(e) => {
                        if (e.target.value) {
                          addUserToShift(shiftIndex, position, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Sélectionner un employé...</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.username} ({user.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Liste du personnel assigné */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Personnel assigné
                    </label>
                    {assignments[shiftIndex]?.[position]?.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                        Aucun personnel assigné
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {assignments[shiftIndex][position].map(user => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100">{user.username}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{user.role}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeUserFromShift(shiftIndex, position, user.id)}
                              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                            >
                              Retirer
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      
      {/* Modal pour sauvegarder un template */}
      {showTemplateModal && (
        <Modal show={showTemplateModal} onHide={() => setShowTemplateModal(false)}>
          <Modal.Header closeButton onClose={() => setShowTemplateModal(false)}>
            <Modal.Title>Sauvegarder le template</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label className="label-hero">Nom du template</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ex: Service Weekend, Service Semaine..."
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ce template sauvegardera la configuration actuelle des services et des assignations de personnel.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button 
              variant="secondary"
              onClick={() => setShowTemplateModal(false)}
            >
              Annuler
            </Button>
            <Button 
              variant="primary"
              onClick={saveTemplate}
            >
              Sauvegarder
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default ShiftManager; 