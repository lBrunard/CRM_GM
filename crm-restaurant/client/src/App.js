import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ShiftManager from './pages/ShiftManager';
import ValidateHours from './pages/ValidateHours';
import ShiftCalendar from './pages/ShiftCalendar';
import PersonnelManagement from './pages/PersonnelManagement';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          {/* Route d'accueil */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Routes publiques */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Routes protégées */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/shifts" 
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <ShiftManager />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/validate" 
            element={
              <ProtectedRoute allowedRoles={['responsable', 'manager']}>
                <ValidateHours />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/calendar" 
            element={
              <ProtectedRoute allowedRoles={['responsable', 'manager', 'personnel']}>
                <ShiftCalendar />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/personnel" 
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <PersonnelManagement />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <PersonnelManagement />
              </ProtectedRoute>
            } 
          />
          
          {/* Route pour page non autorisée */}
          <Route 
            path="/unauthorized" 
            element={
              <div className="container mt-5">
                <div className="alert alert-danger">
                  <h4>Accès refusé</h4>
                  <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
                </div>
              </div>
            } 
          />
          
          {/* Route 404 */}
          <Route 
            path="*" 
            element={
              <div className="container mt-5">
                <div className="alert alert-warning">
                  <h4>Page non trouvée</h4>
                  <p>La page que vous recherchez n'existe pas.</p>
                </div>
              </div>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
