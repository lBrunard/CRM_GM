import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { userService } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

// Fonction utilitaire pour formater une date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

const PersonnelManagement = () => {
  const { user, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Déterminer si on est sur la page profile ou personnel
  const isProfilePage = location.pathname === '/profile';
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isProfilePage) {
      // Page profile - accessible à tous les utilisateurs connectés
      setEditingUser(user);
      setLoading(false);
    } else {
      // Page personnel - uniquement pour les managers
      if (!hasRole(['manager'])) {
        navigate('/unauthorized');
        return;
      }
      loadUsers();
    }
  }, [hasRole, navigate, isProfilePage, user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers();
      setUsers(response.data);
    } catch (err) {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser({ ...userToEdit });
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    try {
      setError('');
      setSuccess('');
      
      // Validation
      if (!editingUser.username || !editingUser.email) {
        setError('Le nom d\'utilisateur et l\'email sont obligatoires');
        return;
      }

      if (isProfilePage) {
        // Sur la page profile, utiliser l'endpoint de mise à jour du profil
        await userService.updateUserProfile(editingUser.id, editingUser);
        setSuccess('Profil mis à jour avec succès');
      } else {
        // Sur la page personnel, utiliser l'endpoint de gestion des utilisateurs
        await userService.updateUser(editingUser.id, editingUser);
        setSuccess('Utilisateur mis à jour avec succès');
        loadUsers(); // Recharger la liste
      }
      
      setShowModal(false);
      setEditingUser(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Chargement...</span>
          </div>
          <p className="mt-2">Chargement...</p>
        </div>
      </div>
    );
  }

  // Rendu pour la page profile
  if (isProfilePage) {
    return (
      <div className="container mt-4">
        <h1 className="mb-4">Mon Profil</h1>
        
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

        <div className="card">
          <div className="card-header">
            <h5 className="mb-0">Informations personnelles</h5>
          </div>
          <div className="card-body">
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Nom d'utilisateur</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.username || ''}
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editingUser?.email || ''}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Prénom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.first_name || ''}
                    onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Nom de famille</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.last_name || ''}
                    onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Numéro national</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.national_number || ''}
                    onChange={(e) => setEditingUser({...editingUser, national_number: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Adresse</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={editingUser?.address || ''}
                    onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">IBAN</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.iban || ''}
                    onChange={(e) => setEditingUser({...editingUser, iban: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Rôle</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.role || ''}
                    disabled
                  />
                  <small className="text-muted">Le rôle ne peut pas être modifié</small>
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label">Taux horaire</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingUser?.hourly_rate ? `${editingUser.hourly_rate}€/h` : 'Non visible'}
                    disabled
                  />
                  <small className="text-muted">Seuls les managers peuvent voir et modifier le taux horaire</small>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end">
              <button className="btn btn-primary" onClick={handleSaveUser}>
                Sauvegarder les modifications
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rendu pour la page personnel (managers uniquement)
  return (
    <div className="container mt-4 mb-5">
      <h1 className="mb-4">
        {hasRole(['manager']) ? 'Gestion du personnel' : 'Mon profil'}
      </h1>
      
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
      
      {users.length === 0 ? (
        <div className="alert alert-info">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>Username</th>
                <th>Nom complet</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                {hasRole(['manager']) && <th>Taux horaire</th>}
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(userData => (
                <tr key={userData.id}>
                  <td>{userData.username}</td>
                  <td>
                    {userData.first_name || userData.last_name 
                      ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
                      : '-'
                    }
                  </td>
                  <td>{userData.email}</td>
                  <td>
                    <span className={`badge ${
                      userData.role === 'manager' ? 'bg-danger' : 
                      userData.role === 'responsable' ? 'bg-warning' : 'bg-info'
                    }`}>
                      {userData.role}
                    </span>
                  </td>
                  <td>{userData.phone || '-'}</td>
                  {hasRole(['manager']) && (
                    <td>{userData.hourly_rate ? `${userData.hourly_rate}€/h` : '-'}</td>
                  )}
                  <td>{formatDate(userData.created_at)}</td>
                  <td>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleEditUser(userData)}
                    >
                      {hasRole(['manager']) ? 'Modifier' : 'Éditer profil'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal d'édition */}
      {showModal && editingUser && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {hasRole(['manager']) ? 'Modifier l\'utilisateur' : 'Modifier mon profil'}
                </h5>
                <button type="button" className="btn-close" onClick={handleCancel}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  {/* Informations de base */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.username || ''}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editingUser.email || ''}
                      onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                    />
                  </div>
                  
                  {/* Nom et prénom */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Prénom</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.first_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Nom</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.last_name || ''}
                      onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                    />
                  </div>
                  
                  {/* Champs réservés aux managers */}
                  {hasRole(['manager']) && (
                    <>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Rôle</label>
                        <select
                          className="form-control"
                          value={editingUser.role || ''}
                          onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                        >
                          <option value="personnel">Personnel</option>
                          <option value="responsable">Responsable</option>
                          <option value="manager">Manager</option>
                        </select>
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Taux horaire (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={editingUser.hourly_rate || ''}
                          onChange={(e) => setEditingUser({...editingUser, hourly_rate: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                  
                  {/* Contact */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Téléphone</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={editingUser.phone || ''}
                      onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Numéro national</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.national_number || ''}
                      onChange={(e) => setEditingUser({...editingUser, national_number: e.target.value})}
                    />
                  </div>
                  
                  {/* Adresse */}
                  <div className="col-12 mb-3">
                    <label className="form-label">Adresse</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={editingUser.address || ''}
                      onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                    />
                  </div>
                  
                  {/* IBAN */}
                  <div className="col-12 mb-3">
                    <label className="form-label">IBAN</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingUser.iban || ''}
                      onChange={(e) => setEditingUser({...editingUser, iban: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Annuler
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveUser}>
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

export default PersonnelManagement; 