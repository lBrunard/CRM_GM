import { useTheme } from '../context/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

const DarkModeToggle = ({ className = '', size = 'md' }) => {
  const { isDarkMode, toggleDarkMode } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <button
      onClick={toggleDarkMode}
      className={`
        dark-mode-toggle ${sizeClasses[size]} 
        transition-all duration-200 ease-in-out
        ${className}
      `}
      title={isDarkMode ? 'Basculer en mode clair' : 'Basculer en mode sombre'}
      aria-label={isDarkMode ? 'Basculer en mode clair' : 'Basculer en mode sombre'}
    >
      {isDarkMode ? (
        <SunIcon className={`${iconSizeClasses[size]} text-yellow-500`} />
      ) : (
        <MoonIcon className={`${iconSizeClasses[size]} text-slate-600`} />
      )}
    </button>
  );
};

export default DarkModeToggle; 