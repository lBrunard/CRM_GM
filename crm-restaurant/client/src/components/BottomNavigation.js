import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  HomeIcon,
  CalendarIcon,
  CheckCircleIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CalendarIcon as CalendarIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  UsersIcon as UsersIconSolid
} from '@heroicons/react/24/solid';

const BottomNavigation = () => {
  const { isAuthenticated, hasRole } = useContext(AuthContext);
  const location = useLocation();

  // Ne pas afficher la navigation en bas si l'utilisateur n'est pas connecté
  if (!isAuthenticated) {
    return null;
  }

  const isActive = (path) => location.pathname === path;

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: HomeIcon,
      iconSolid: HomeIconSolid,
      show: true
    },
    {
      path: '/calendar',
      label: 'Calendrier',
      icon: CalendarIcon,
      iconSolid: CalendarIconSolid,
      show: true
    },
    {
      path: '/validate',
      label: 'Validation',
      icon: CheckCircleIcon,
      iconSolid: CheckCircleIconSolid,
      show: hasRole(['responsable', 'manager'])
    },
    {
      path: '/personnel',
      label: 'Personnel',
      icon: UsersIcon,
      iconSolid: UsersIconSolid,
      show: hasRole(['manager'])
    }
  ].filter(item => item.show);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-secondary-900 border-t border-secondary-200 dark:border-secondary-800 safe-area-bottom">
      <div className="grid grid-cols-4 h-16">
        {navigationItems.map((item) => {
          const active = isActive(item.path);
          const Icon = active ? item.iconSolid : item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center h-full transition-colors duration-200
                ${active 
                  ? 'text-primary-600 dark:text-primary-400' 
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'
                }
              `}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation; 