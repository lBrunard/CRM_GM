import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import BottomNavigation from './components/BottomNavigation';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ShiftManager from './pages/ShiftManager';
import ValidateHours from './pages/ValidateHours';
import ShiftCalendar from './pages/ShiftCalendar';
import PersonnelManagement from './pages/PersonnelManagement';
import { useContext, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';
import './styles/heroui.css'; // Hero UI styles only

function AppContent() {
  const { isAuthenticated } = useContext(AuthContext);

  // Ajouter/supprimer la classe CSS pour la navigation en bas
  useEffect(() => {
    if (isAuthenticated) {
      document.body.classList.add('has-bottom-nav');
    } else {
      document.body.classList.remove('has-bottom-nav');
    }

    // Cleanup au démontage
    return () => {
      document.body.classList.remove('has-bottom-nav');
    };
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 dark-mode-transition">
      <Navbar />
      <main className="px-4 sm:px-6 lg:px-8">
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
              <div className="mx-auto max-w-md">
                <div className="alert-hero alert-hero-destructive">
                  <h4 className="alert-hero-title">Accès refusé</h4>
                  <p className="alert-hero-description">
                    Vous n'avez pas les permissions nécessaires pour accéder à cette page.
                  </p>
                </div>
              </div>
            } 
          />
          
          {/* Route 404 */}
          <Route 
            path="*" 
            element={
              <div className="mx-auto max-w-md">
                <div className="alert-hero border-warning-200 text-warning-800 dark:border-warning-800 dark:text-warning-200">
                  <h4 className="alert-hero-title">Page non trouvée</h4>
                  <p className="alert-hero-description">
                    La page que vous recherchez n'existe pas.
                  </p>
                </div>
              </div>
            } 
          />
        </Routes>
      </main>
      <BottomNavigation />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
