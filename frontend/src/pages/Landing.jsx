import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Shield, Zap, TrendingUp, Camera, Bot, Globe, CheckCircle2 } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';

const Landing = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const controls = useAnimation();

  useEffect(() => {
    controls.start('visible');
    // Preload pop sound on interaction
    const handleFirstInteraction = () => {
      soundFX.init();
      window.removeEventListener('click', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, [controls]);

  const toggleLanguage = () => {
    soundFX.playPop();
    const newLang = i18n.language === 'en' ? 'tr' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  const handleNav = (path) => {
    soundFX.playPop();
    navigate(path);
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-400/30 dark:bg-indigo-600/20 rounded-full mix-blend-multiply filter blur-[100px] animate-blob" />
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-emerald-400/30 dark:bg-emerald-600/20 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000" />
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-purple-400/30 dark:bg-purple-600/20 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000" />

      {/* Navigation */}
      <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="fixed w-full z-50 top-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-tighter">
            <Activity size={28} className="text-indigo-600 dark:text-indigo-400" />
            SmartAssistant
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-indigo-600 text-xs font-bold uppercase tracking-widest transition-colors">
              <Globe size={16} /> {i18n.language}
            </button>
            <button onClick={() => handleNav('/login')} className="hidden sm:block text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {t('navbar.login')}
            </button>
            <button onClick={() => handleNav('/register')} className="text-sm font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
              {t('navbar.register')}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="relative max-w-7xl mx-auto px-6 pt-40 pb-32 flex flex-col lg:flex-row items-center gap-16 z-10">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex-1 text-center lg:text-left">
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-black tracking-widest uppercase mb-8 shadow-sm backdrop-blur-md border border-indigo-100 dark:border-indigo-800/50">
            <Zap size={14} className="animate-pulse" />
            Personal Life OS • v2.0
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-6xl md:text-8xl font-black tracking-tight mb-8 leading-[1.1]">
            {t('landing.heroTitle').split(' ').map((word, i) => (
              <React.Fragment key={i}>
                {word === 'Wealth' || word === 'Bütçe' ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">{word}</span> : 
                 word === 'Health' || word === 'Sağlık' ? <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">{word}</span> : 
                 word}
                {' '}
              </React.Fragment>
            ))}
          </motion.h1>
          
          <motion.p variants={fadeUp} className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
            {t('landing.heroSub')}
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4">
            <button onClick={() => handleNav('/register')} className="text-base font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all transform hover:-translate-y-1">
              {t('landing.getStarted')}
            </button>
            <a href="#features" onClick={() => soundFX.playPop()} className="text-base font-bold bg-white/50 dark:bg-gray-800/50 backdrop-blur-md text-gray-900 dark:text-white border border-gray-200/50 dark:border-gray-700/50 px-8 py-4 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-800 transition-all text-center">
              {t('landing.features')}
            </a>
          </motion.div>
        </motion.div>

        {/* 3D Mockup Visual */}
        <motion.div 
          initial={{ opacity: 0, x: 100, rotateY: -20 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 1, type: "spring" }}
          className="flex-1 w-full relative perspective-1000 hidden lg:block"
        >
          <div className="relative w-full aspect-[4/3] transform rotate-y-[-10deg] rotate-x-[5deg] hover:rotate-y-0 hover:rotate-x-0 transition-all duration-700 ease-out">
            <div className="absolute inset-0 bg-white/40 dark:bg-gray-800/40 backdrop-blur-2xl rounded-[3rem] border border-white/60 dark:border-gray-700/50 shadow-2xl p-6 flex flex-col gap-4">
               {/* Faux Dashboard UI */}
               <div className="flex justify-between items-center pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50"></div>
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  </div>
               </div>
               <div className="flex gap-4 h-32">
                 <div className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl opacity-80 shadow-inner"></div>
                 <div className="flex-1 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl opacity-80 shadow-inner"></div>
               </div>
               <div className="flex-1 bg-white/50 dark:bg-gray-900/50 rounded-2xl border border-white/40 dark:border-gray-700/30 p-4">
                 <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 w-1/3"></div>
                 <div className="space-y-2">
                   {[...Array(3)].map((_,i) => <div key={i} className="w-full h-12 bg-gray-100/50 dark:bg-gray-800/50 rounded-xl"></div>)}
                 </div>
               </div>
            </div>
            
            {/* Floating Chat Widget */}
            <motion.div 
              animate={{ y: [0, -10, 0] }} 
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -bottom-6 -right-6 w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center border-4 border-white dark:border-gray-800"
            >
               <Bot size={32} className="text-white" />
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-32 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">{t('landing.features')}</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto">Everything you need to master your daily routines.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Camera size={28} />, title: t('landing.f1Title'), sub: t('landing.f1Sub'), color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
              { icon: <Activity size={28} />, title: t('landing.f2Title'), sub: t('landing.f2Sub'), color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
              { icon: <TrendingUp size={28} />, title: t('landing.f3Title'), sub: t('landing.f3Sub'), color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' }
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                whileHover={{ y: -10 }}
                className="p-10 rounded-[2rem] bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 shadow-xl shadow-gray-200/50 dark:shadow-none hover:shadow-2xl transition-all"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-8 ${f.bg} ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-2xl font-black mb-4">{f.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                  {f.sub}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section className="relative z-10 py-32 px-6">
         <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           whileInView={{ opacity: 1, scale: 1 }}
           viewport={{ once: true }}
           className="max-w-5xl mx-auto bg-gray-900 dark:bg-gray-800 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl"
         >
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-screen filter blur-[80px] opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-screen filter blur-[80px] opacity-50"></div>
            
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight relative z-10">Start Tracking Today.</h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto relative z-10">Join thousands of users who have mastered their finances and health using SmartAssistant.</p>
            
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6 relative z-10">
               <button onClick={() => handleNav('/register')} className="text-lg font-black bg-white text-gray-900 px-10 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105">
                 {t('landing.getStarted')}
               </button>
               <span className="flex items-center gap-2 text-gray-400 font-bold"><CheckCircle2 size={20} className="text-emerald-400" /> 100% Free Forever</span>
            </div>
         </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-white dark:bg-gray-900 py-12 text-center text-gray-400 border-t border-gray-200 dark:border-gray-800">
        <p className="font-bold flex items-center justify-center gap-2 text-sm">
          <Shield size={16} /> Engineered with Privacy-First Architecture. MIT Licensed.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
