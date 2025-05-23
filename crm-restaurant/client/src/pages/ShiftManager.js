import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { shiftService, userService } from '../services/api';
import { useNavigate } from 'react-router-dom';

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
          ...assignments[index].cuisine.map(user => ({ userId: user.id, position: 'cuisine' })),
          ...assignments[index].salle.map(user => ({ userId: user.id, position: 'salle' })),
          ...assignments[index].bar.map(user => ({ userId: user.id, position: 'bar' }))
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
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-2">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      <h1 className="mb-4">Création des shifts quotidiens</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      )}

      {/* Sélection de la date */}
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">Configuration de la journée</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-4">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={shiftTemplate.date}
                onChange={(e) => setShiftTemplate({ ...shiftTemplate, date: e.target.value })}
              />
            </div>
            <div className="col-md-8 d-flex align-items-end gap-2">
              <button
                className="btn btn-outline-secondary"
                onClick={addShiftToTemplate}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Ajouter un service
              </button>
              <button
                className="btn btn-info"
                onClick={() => setShowTemplateModal(true)}
              >
                <i className="bi bi-save me-2"></i>
                Sauvegarder template
              </button>
              <button
                className="btn btn-success btn-lg"
                onClick={createDayShifts}
                disabled={creating || !shiftTemplate.date}
              >
                {creating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Création en cours...
                  </>
                ) : (
                  <>
                    <i className="bi bi-calendar-plus me-2"></i>
                    Créer tous les shifts
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gestion des templates */}
      {savedTemplates.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">Templates sauvegardés</h5>
          </div>
          <div className="card-body">
            <div className="row">
              {savedTemplates.map(template => (
                <div key={template.name} className="col-md-4 mb-3">
                  <div className="card border">
                    <div className="card-body">
                      <h6 className="card-title">{template.name}</h6>
                      <p className="card-text small text-muted">
                        {template.shifts.length} service(s)
                        <br />
                        Sauvegardé: {new Date(template.savedAt).toLocaleDateString()}
                      </p>
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => loadTemplate(template)}
                        >
                          Charger
                        </button>
                        <button 
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => deleteTemplate(template)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration des shifts */}
      {shiftTemplate.shifts.map((shift, shiftIndex) => (
        <div key={shiftIndex} className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <div className="d-flex gap-3 align-items-center">
              <input
                type="text"
                className="form-control fw-bold"
                value={shift.name}
                onChange={(e) => updateShiftTemplate(shiftIndex, 'name', e.target.value)}
                style={{ width: '200px' }}
              />
              <div className="d-flex gap-2 align-items-center">
                <input
                  type="time"
                  className="form-control"
                  value={shift.start}
                  onChange={(e) => updateShiftTemplate(shiftIndex, 'start', e.target.value)}
                />
                <span>à</span>
                <input
                  type="time"
                  className="form-control"
                  value={shift.end}
                  onChange={(e) => updateShiftTemplate(shiftIndex, 'end', e.target.value)}
                />
              </div>
            </div>
            {shiftTemplate.shifts.length > 1 && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => removeShiftFromTemplate(shiftIndex)}
              >
                <i className="bi bi-trash"></i>
              </button>
            )}
          </div>
          <div className="card-body">
            <div className="row">
              {['cuisine', 'salle', 'bar'].map(position => (
                <div key={position} className="col-md-4">
                  <h6 className="text-capitalize">
                    {position}
                    <span className="badge bg-secondary ms-2">
                      {assignments[shiftIndex]?.[position]?.length || 0}
                    </span>
                  </h6>
                  
                  {/* Sélecteur pour ajouter du personnel */}
                  <select
                    className="form-select form-select-sm mb-3"
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
                  <div className="border rounded p-2" style={{ minHeight: '100px', maxHeight: '200px', overflowY: 'auto' }}>
                    {assignments[shiftIndex]?.[position]?.length === 0 ? (
                      <small className="text-muted">Aucun personnel assigné</small>
                    ) : (
                      assignments[shiftIndex][position].map(user => (
                        <div key={user.id} className="d-flex justify-content-between align-items-center mb-1 p-1 bg-light rounded">
                          <span className="small">
                            <strong>{user.username}</strong>
                            <br />
                            <small className="text-muted">{user.role}</small>
                          </span>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => removeUserFromShift(shiftIndex, position, user.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Sauvegarder le template</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowTemplateModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Nom du template</label>
                  <input
                    type="text"
                    className="form-control"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Service Weekend, Service Semaine..."
                  />
                </div>
                <p className="text-muted small">
                  Ce template sauvegardera la configuration actuelle des services et des assignations de personnel.
                </p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTemplateModal(false)}
                >
                  Annuler
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={saveTemplate}
                >
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManager; 