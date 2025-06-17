import React from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon, SystemIcon } from './IconComponents';

interface ThemeSwitcherProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange }) => {
  const themes = [
    { name: Theme.LIGHT, label: 'Light', Icon: SunIcon },
    { name: Theme.DARK, label: 'Dark', Icon: MoonIcon },
    { name: Theme.SYSTEM, label: 'System', Icon: SystemIcon },
  ];

  return (
    <div className="flex justify-center items-center space-x-1 p-2 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
      {themes.map(({ name, label, Icon }) => (
        <button
          key={name}
          onClick={() => onThemeChange(name)}
          className={`flex-1 p-2 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500
            ${
              currentTheme === name
                ? 'bg-sky-500 text-white dark:bg-sky-600'
                : 'text-slate-600 hover:bg-slate-300 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          aria-pressed={currentTheme === name}
          title={`Switch to ${label} mode`}
        >
          <Icon className="w-5 h-5 mx-auto" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ThemeSwitcher;
