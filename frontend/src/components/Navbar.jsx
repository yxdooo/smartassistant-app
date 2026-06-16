import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, Sun, Flame, Globe, LayoutDashboard, LineChart, Users } from 'lucide-react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [isDark, setIsDark] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/auth/profile').then(res => setProfile(res.data)).catch(console.error);

    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true);
    } else {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      }
    }
  }, []);

  const toggleDarkMode = async () => {
    soundFX.playPop();
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    try {
      await api.put('/auth/profile', { isDarkMode: newIsDark });
    } catch (err) {
      console.error('Failed to sync dark mode', err);
    }
  };

  const handleLogout = () => {
    soundFX.playPop();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleLanguage = () => {
    soundFX.playPop();
    const newLang = i18n.language === 'en' ? 'tr' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tight cursor-default mr-6">SmartAssistant</span>
              {profile && (
                 <div className="hidden sm:flex gap-4">
                    <button onClick={() => navigate('/dashboard')} className={`text-sm font-bold transition-colors ${isActive('/dashboard') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600'}`}>{t('navbar.dashboard')}</button>
                    <button onClick={() => navigate('/analytics')} className={`text-sm font-bold transition-colors ${isActive('/analytics') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600'}`}>{t('navbar.analytics')}</button>
                    <button onClick={() => navigate('/community')} className={`text-sm font-bold transition-colors ${isActive('/community') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600'}`}>Community</button>
                 </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {profile && (
                 <div className="flex items-center gap-1 bg-orange-50/80 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm backdrop-blur-sm border border-orange-100 dark:border-orange-800/50 cursor-default hover:scale-105 transition-transform" title={`Longest streak: ${profile.longestStreak}`}>
                    <Flame size={16} className={profile.currentStreak > 0 ? "animate-pulse text-orange-500" : ""} />
                    {profile.currentStreak}
                 </div>
              )}
              <button onClick={toggleLanguage} className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded-full transition-colors text-xs font-bold uppercase tracking-wider">
                <Globe size={16} /> {i18n.language}
              </button>
              <button onClick={toggleDarkMode} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-full transition-colors">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={handleLogout} 
                className="hidden sm:block text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              >
                {t('navbar.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sticky Bottom Tab Bar */}
      {profile && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="flex justify-around items-center h-16 px-4">
            <button onClick={() => navigate('/dashboard')} className={`flex flex-col items-center gap-1 p-2 ${isActive('/dashboard') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}>
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-bold">Dash</span>
            </button>
            <button onClick={() => navigate('/community')} className={`flex flex-col items-center gap-1 p-2 ${isActive('/community') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}>
              <Users size={20} />
              <span className="text-[10px] font-bold">Social</span>
            </button>
            <button onClick={() => navigate('/analytics')} className={`flex flex-col items-center gap-1 p-2 ${isActive('/analytics') ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}>
              <LineChart size={20} />
              <span className="text-[10px] font-bold">Data</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
