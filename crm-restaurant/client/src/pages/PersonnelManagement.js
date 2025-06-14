import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { userService } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
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
      loadCurrentUserProfile();
    } else {
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
      const response = await userService.getCurrentUser();
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
      
      if (!editingUser.username || !editingUser.email) {
        setError('Le nom d\'utilisateur et l\'email sont obligatoires');
        return;
      }

      if (isProfilePage) {
        await userService.updateUserProfile(editingUser.id, editingUser);
        setSuccess('Profil mis à jour');
      } else {
        await userService.updateUser(editingUser.id, editingUser);
        setSuccess('Utilisateur mis à jour');
        loadUsers();
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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Page profil (version simplifiée)
  if (isProfilePage) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Mon Profil</h1>
          <button onClick={() => navigate('/calendar')} className="btn-hero-outline">
            Retour
          </button>
        </div>
        
        {error && <div className="alert-hero alert-hero-destructive">{error}</div>}
        {success && <div className="alert-hero alert-hero-success">{success}</div>}

        <div className="card-hero">
          <div className="card-hero-content space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="label-hero">Nom</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser?.last_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, last_name: e.target.value})}
                />
              </div>
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
                <label className="label-hero">Rôle</label>
                <input
                  type="text"
                  className="input-hero mt-1"
                  value={editingUser?.role || ''}
                  disabled
                />
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={handleLogout}
                className="btn-hero-outline text-red-600 border-red-300"
              >
                Déconnexion
              </button>
              <button onClick={handleSaveUser} className="btn-hero-primary">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Page personnel (version simplifiée)
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Personnel ({filteredUsers.length})</h1>
          <p className="text-slate-600 dark:text-slate-400">Gérez votre équipe</p>
        </div>
        <button onClick={() => navigate('/calendar')} className="btn-hero-outline">
          Retour
        </button>
      </div>
      
      {error && <div className="alert-hero alert-hero-destructive">{error}</div>}
      {success && <div className="alert-hero alert-hero-success">{success}</div>}
      
      {/* Barre de recherche */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Rechercher par nom, email, rôle ou position..."
          className="input-hero pl-10 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon className="h-5 w-5 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>
      
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <UserGroupIcon className="h-12 w-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            {searchTerm ? `Aucun utilisateur trouvé pour "${searchTerm}"` : 'Aucun utilisateur trouvé'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(userData => (
            <UserCard key={userData.id} userData={userData} onEdit={handleEditUser} />
          ))}
        </div>
      )}
      
      {/* Modal d'édition simplifié */}
      {showModal && editingUser && (
        <Modal show={showModal} onHide={handleCancel}>
          <Modal.Header closeButton onClose={handleCancel}>
            <Modal.Title>Modifier {editingUser.username}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <label className="label-hero">Téléphone</label>
                  <input
                    type="tel"
                    className="input-hero mt-1"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  />
                </div>
              </div>
              
              {/* Positions simplifiées */}
              <div>
                <label className="label-hero">Positions</label>
                <div className="mt-2 flex gap-4">
                  {['cuisine', 'salle', 'bar'].map(position => (
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
                      <span className="capitalize">{position}</span>
                    </label>
                  ))}
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

  const getPositionIcons = (positions) => {
    if (!positions || positions.length === 0) return '';
    return positions.map(pos => {
      switch(pos) {
        case 'cuisine': return '🍳';
        case 'salle': return '🍽️';
        case 'bar': return '🍸';
        default: return '';
      }
    }).join(' ');
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
        {getPositionIcons(userData.positions) && (
          <div className="text-base">{getPositionIcons(userData.positions)}</div>
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