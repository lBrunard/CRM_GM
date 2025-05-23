import { useContext, useState, Fragment } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DarkModeToggle from './DarkModeToggle';
import { Menu, Transition } from '@headlessui/react';
import { 
  Bars3Icon, 
  XMarkIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  HomeIcon,
  CalendarIcon,
  CheckCircleIcon,
  UsersIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  CalendarIcon as CalendarIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  UsersIcon as UsersIconSolid,
  ClockIcon as ClockIconSolid,
  UserIcon as UserIconSolid
} from '@heroicons/react/24/solid';

const Navbar = () => {
  const { user, isAuthenticated, logout, hasRole } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsNavOpen(false);
  };

  const handleNavClick = () => {
    setIsNavOpen(false);
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      show: isAuthenticated
    },
    {
      name: 'Calendrier',
      href: '/calendar',
      icon: CalendarIcon,
      show: isAuthenticated
    },
    {
      name: 'Validation',
      href: '/validate',
      icon: CheckCircleIcon,
      show: isAuthenticated && hasRole(['responsable', 'manager'])
    },
    {
      name: 'Personnel',
      href: '/personnel',
      icon: UsersIcon,
      show: isAuthenticated && hasRole(['manager'])
    },
    {
      name: 'Shifts',
      href: '/shifts',
      icon: ClockIcon,
      show: isAuthenticated && hasRole(['manager'])
    }
  ];

  return (
    <nav className="bg-white dark:bg-secondary-900 shadow-sm border-b border-secondary-200 dark:border-secondary-800 mb-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Logo et titre */}
          <div className="flex items-center">
            <Link 
              to="/" 
              onClick={handleNavClick}
              className="flex items-center space-x-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                <span className="text-sm font-bold">R</span>
              </div>
              <span className="hidden font-semibold text-secondary-900 dark:text-white sm:block">
                Restaurant Staff Manager
              </span>
              <span className="font-semibold text-secondary-900 dark:text-white sm:hidden">
                RSM
              </span>
            </Link>
          </div>

          {/* Navigation desktop */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {navigation.map((item) => 
              item.show ? (
                <Link
                  key={item.name}
                  to={item.href}
                  className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 dark:text-secondary-300 dark:hover:bg-secondary-800 dark:hover:text-white"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              ) : null
            )}
          </div>

          {/* Actions droite */}
          <div className="flex items-center space-x-3">
            {/* Dark mode toggle */}
            <DarkModeToggle size="sm" />

            {!isAuthenticated ? (
              <div className="hidden md:flex md:items-center md:space-x-2">
                <Link
                  to="/login"
                  className="btn-hero-outline btn-hero-sm"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="btn-hero-primary btn-hero-sm"
                >
                  Inscription
                </Link>
              </div>
            ) : (
              <>
                {/* Profile menu desktop */}
                <div className="hidden md:block">
                  <Menu as="div" className="relative">
                    <Menu.Button className="flex items-center space-x-2 rounded-md bg-white dark:bg-secondary-800 p-2 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-700">
                      <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                        <UserIcon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-secondary-700 dark:text-secondary-300">{user?.username}</span>
                    </Menu.Button>

                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-48 rounded-md bg-white dark:bg-secondary-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/profile"
                              className={`flex items-center space-x-2 px-4 py-2 text-sm ${
                                active 
                                  ? 'bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-white' 
                                  : 'text-secondary-700 dark:text-secondary-300'
                              }`}
                            >
                              <Cog6ToothIcon className="h-4 w-4" />
                              <span>Profil</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleLogout}
                              className={`flex w-full items-center space-x-2 px-4 py-2 text-sm ${
                                active 
                                  ? 'bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-white' 
                                  : 'text-secondary-700 dark:text-secondary-300'
                              }`}
                            >
                              <ArrowRightOnRectangleIcon className="h-4 w-4" />
                              <span>Déconnexion</span>
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                </div>

                {/* Profile mobile - Bouton simple */}
                <div className="md:hidden">
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 rounded-md bg-primary-600 p-2 text-white hover:bg-primary-700"
                  >
                    <UserIcon className="h-5 w-5" />
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation mobile fixe en bas */}
      {isAuthenticated && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-secondary-900 border-t border-secondary-200 dark:border-secondary-800 z-50">
          <div className="flex justify-center">
            <div className="flex justify-around max-w-md w-full">
              {navigation.filter(item => item.show).map((item) => {
                const isActive = location.pathname === item.href;
                const IconComponent = isActive ? 
                  (item.icon === HomeIcon ? HomeIconSolid :
                   item.icon === CalendarIcon ? CalendarIconSolid :
                   item.icon === CheckCircleIcon ? CheckCircleIconSolid :
                   item.icon === UsersIcon ? UsersIconSolid :
                   item.icon === ClockIcon ? ClockIconSolid :
                   item.icon) : item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex flex-col items-center justify-center py-2 px-3 min-w-0 flex-1 text-xs ${
                      isActive 
                        ? 'text-primary-600 dark:text-primary-400' 
                        : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300'
                    }`}
                    onClick={handleNavClick}
                  >
                    <IconComponent className="h-6 w-6 mb-1" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 