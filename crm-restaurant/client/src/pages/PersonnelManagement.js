import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { userService } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  POSITION_CONFIGS, 
  SERVICE_POSITIONS, 
  CUISINE_POSITIONS, 
  getPositionConfig,
  getPositionColor
} from '../constants/positions';
import { 
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import Button from '../components/Button';
import Modal from '../components/Modal';

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
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isProfilePage) {
      // Page profile - charger les données complètes de l'utilisateur
      loadCurrentUserProfile();
    } else {
      // Page personnel - uniquement pour les managers
      if (!hasRole(['manager'])) {
        navigate('/unauthorized');
        return;
      }
      loadUsers();
    }
  }, [hasRole, navigate, isProfilePage, user]);

  // Filtrer les utilisateurs quand le terme de recherche change
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.first_name && user.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.last_name && user.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.positions && user.positions.some(pos => pos.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers();
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (err) {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUserProfile = async () => {
    try {
      setLoading(true);
      const response = await userService.getUserById(user.id);
      setEditingUser(response.data);
    } catch (err) {
      setError('Impossible de charger les données du profil');
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

  const handleLogout = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 text-blue-600 mx-auto" role="status">
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Rendu pour la page profile
  if (isProfilePage) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Mon Profil</h1>
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

        <div className="card-hero">
          <div className="card-hero-header">
            <h3 className="card-hero-title">Informations personnelles</h3>
          </div>
          <div className="card-hero-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="label-hero">Nom d'utilisateur</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.username || ''}
                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">Email</label>
                  <input
                    type="email"
                    className="input-hero mt-1"
                    value={editingUser?.email || ''}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">Prénom</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.first_name || ''}
                    onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">Nom de famille</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.last_name || ''}
                    onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label-hero">Téléphone</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">Numéro national</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.national_number || ''}
                    onChange={(e) => setEditingUser({...editingUser, national_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">Adresse</label>
                  <textarea
                    className="input-hero mt-1"
                    rows="3"
                    value={editingUser?.address || ''}
                    onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label-hero">IBAN</label>
                  <input
                    type="text"
                    className="input-hero mt-1"
                    value={editingUser?.iban || ''}
                    onChange={(e) => setEditingUser({...editingUser, iban: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="label-hero">Rôle</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser?.role || ''}
                  disabled
                />
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Le rôle ne peut pas être modifié</p>
              </div>
              <div>
                <label className="label-hero">Taux horaire</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser?.hourly_rate ? `${editingUser.hourly_rate}€/h` : 'Non défini'}
                  disabled
                />
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Le taux horaire ne peut pas être modifié</p>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button variant="primary" onClick={handleSaveUser}>
                Sauvegarder les modifications
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rendu pour la page personnel (managers uniquement)
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {hasRole(['manager']) ? 'Gestion du personnel' : 'Mon profil'}
        </h1>
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
      
      {users.length === 0 ? (
        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="card-hero">
            <div className="overflow-x-auto">
              {/* Vue desktop - Table */}
              <div className="hidden md:block">
                <table className="w-full border-collapse border border-slate-200 dark:border-slate-700">
                  <thead>
                    <tr className="bg-slate-900 dark:bg-slate-800">
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Username</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Nom complet</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Email</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Rôle</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Téléphone</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Poste</th>
                      {hasRole(['manager']) && <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Taux horaire</th>}
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Créé le</th>
                      <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm font-medium text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(userData => (
                      <tr key={userData.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100">{userData.username}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                          {userData.first_name || userData.last_name 
                            ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
                            : '-'
                          }
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{userData.email}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            userData.role === 'manager' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                            userData.role === 'responsable' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {userData.role}
                          </span>
                        </td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{userData.phone || '-'}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                          {userData.positions && userData.positions.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {userData.positions.map(pos => {
                                const config = getPositionConfig(pos);
                                return (
                                  <span key={pos} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                                    {config.label}
                                  </span>
                                );
                              })}
                            </div>
                          ) : '-'}
                        </td>
                        {hasRole(['manager']) && (
                          <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{userData.hourly_rate ? `${userData.hourly_rate}€/h` : '-'}</td>
                        )}
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{formatDate(userData.created_at)}</td>
                        <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                          <Button 
                            variant="primary"
                            size="sm"
                            onClick={() => handleEditUser(userData)}
                          >
                            {hasRole(['manager']) ? 'Modifier' : 'Éditer profil'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vue mobile - Cartes */}
              <div className="md:hidden space-y-4">
                {users.map(userData => (
                  <div key={userData.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h6 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                          {userData.username}
                        </h6>
                        {(userData.first_name || userData.last_name) && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {`${userData.first_name || ''} ${userData.last_name || ''}`.trim()}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        userData.role === 'manager' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 
                        userData.role === 'responsable' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {userData.role}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Email:</span>
                        <span className="text-slate-900 dark:text-slate-100">{userData.email}</span>
                      </div>
                      
                      {userData.phone && (
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Téléphone:</span>
                          <span className="text-slate-900 dark:text-slate-100">{userData.phone}</span>
                        </div>
                      )}
                      
                      {userData.positions && userData.positions.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Positions:</span>
                          <div className="flex gap-1 flex-wrap">
                            {userData.positions.map(pos => {
                              const config = getPositionConfig(pos);
                              return (
                                <span key={pos} className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-medium ${config.color}`} title={config.description}>
                                  {config.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {hasRole(['manager']) && userData.hourly_rate && (
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Taux horaire:</span>
                          <span className="text-slate-900 dark:text-slate-100 font-medium">{userData.hourly_rate}€/h</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Membre depuis:</span>
                        <span className="text-slate-900 dark:text-slate-100">{formatDate(userData.created_at)}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <Button 
                        variant="primary"
                        size="sm"
                        onClick={() => handleEditUser(userData)}
                        className="w-full"
                      >
                        {hasRole(['manager']) ? 'Modifier' : 'Éditer profil'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        </div>
      )}
      
      {/* Modal d'édition */}
      {showModal && editingUser && (
        <Modal show={showModal} onHide={handleCancel} size="lg">
          <Modal.Header closeButton onClose={handleCancel}>
            <Modal.Title>
              {hasRole(['manager']) ? 'Modifier l\'utilisateur' : 'Modifier mon profil'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Informations de base */}
              <div>
                <label className="label-hero">Username</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser.username || ''}
                  onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                />
              </div>
              <div>
                <label className="label-hero">Email</label>
                <input
                  type="email"
                  className="input-hero mt-1"
                  value={editingUser.email || ''}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                />
              </div>
              
              {/* Nom et prénom */}
              <div>
                <label className="label-hero">Prénom</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser.first_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, first_name: e.target.value})}
                />
              </div>
              <div>
                <label className="label-hero">Nom</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser.last_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                />
              </div>
              
              {/* Champs réservés aux managers */}
              {hasRole(['manager']) && (
                <>
                  <div>
                    <label className="label-hero">Rôle</label>
                    <select
                      className="input-hero mt-1"
                      value={editingUser.role || ''}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                    >
                      <option value="personnel">Personnel</option>
                      <option value="responsable">Responsable</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-hero">Taux horaire (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input-hero mt-1"
                      value={editingUser.hourly_rate || ''}
                      onChange={(e) => setEditingUser({...editingUser, hourly_rate: e.target.value})}
                    />
                  </div>
                </>
              )}
              
              {/* Contact */}
              <div>
                <label className="label-hero">Téléphone</label>
                <input
                  type="tel"
                  className="input-hero mt-1"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="label-hero">Numéro national</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser.national_number || ''}
                  onChange={(e) => setEditingUser({...editingUser, national_number: e.target.value})}
                />
              </div>
              
              {/* Adresse - span across both columns */}
              <div className="md:col-span-2">
                <label className="label-hero">Adresse</label>
                <textarea
                  className="input-hero mt-1"
                  rows="2"
                  value={editingUser.address || ''}
                  onChange={(e) => setEditingUser({...editingUser, address: e.target.value})}
                />
              </div>
              
              {/* IBAN - span across both columns */}
              <div className="md:col-span-2">
                <label className="label-hero">IBAN</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser.iban || ''}
                  onChange={(e) => setEditingUser({...editingUser, iban: e.target.value})}
                />
              </div>
              
              {/* Positions - span across both columns */}
              <div className="md:col-span-2">
                <label className="label-hero">Positions de travail</label>
                
                {/* Positions de salle */}
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">🍽️ Service</h4>
                  <div className="flex gap-4">
                    {SERVICE_POSITIONS.map(position => (
                      <label key={position} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded mr-2"
                          checked={editingUser.positions && editingUser.positions.includes(position)}
                          onChange={(e) => {
                            const currentPositions = editingUser.positions || [];
                            let newPositions;
                            
                            if (e.target.checked) {
                              newPositions = [...currentPositions, position];
                            } else {
                              newPositions = currentPositions.filter(p => p !== position);
                            }
                            
                            setEditingUser({...editingUser, positions: newPositions});
                          }}
                        />
                        <span className="capitalize">
                          {getPositionConfig(position).label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Positions de cuisine */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">👨‍🍳 Cuisine</h4>
                  <div className="flex gap-4 flex-wrap">
                    {CUISINE_POSITIONS.map(position => (
                      <label key={position} className="flex items-center">
                        <input
                          type="checkbox"
                          className="rounded mr-2"
                          checked={editingUser.positions && editingUser.positions.includes(position)}
                          onChange={(e) => {
                            const currentPositions = editingUser.positions || [];
                            let newPositions;
                            
                            if (e.target.checked) {
                              newPositions = [...currentPositions, position];
                            } else {
                              newPositions = currentPositions.filter(p => p !== position);
                            }
                            
                            setEditingUser({...editingUser, positions: newPositions});
                          }}
                        />
                        <span title={getPositionConfig(position).description}>{getPositionConfig(position).label}</span>
                      </label>
                    ))}
                  </div>
                  
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCancel}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleSaveUser}>
              Sauvegarder
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

// Composant UserCard simplifié
const UserCard = ({ userData, onEdit }) => {
  const getRoleIcon = (role) => {
    switch(role) {
      case 'manager': return '👑';
      case 'responsable': return '🔰';
      default: return '👤';
    }
  };

  const getPositionLabels = (positions) => {
    if (!positions || positions.length === 0) return '';
    return positions.map(pos => getPositionConfig(pos).label).join(', ');
  };

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-slate-900 dark:text-slate-100">
            {userData.username}
          </h3>
          <p className="text-sm text-slate-500">
            {userData.first_name || userData.last_name 
              ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
              : userData.email
            }
          </p>
        </div>
        <span className="text-lg">{getRoleIcon(userData.role)}</span>
      </div>

      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400 mb-4">
        {userData.phone && (
          <div className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4" />
            {userData.phone}
          </div>
        )}
        {userData.hourly_rate && (
          <div>{userData.hourly_rate}€/h</div>
        )}
        {getPositionLabels(userData.positions) && (
          <div className="text-sm text-slate-600 dark:text-slate-400">{getPositionLabels(userData.positions)}</div>
        )}
      </div>

      <button
        onClick={() => onEdit(userData)}
        className="w-full btn-hero-primary text-sm"
      >
        <PencilIcon className="h-4 w-4 mr-1" />
        Modifier
      </button>
    </div>
  );
};

export default PersonnelManagement; 