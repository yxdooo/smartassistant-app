import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const Analytics = () => {
  const { t } = useTranslation();
  const [data, setData] = useState({ spendingTrends: [], badges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse mt-8">
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-8"></div>
        <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-3xl mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors pb-12 font-sans selection:bg-indigo-500 selection:text-white relative">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-yellow-100/30 via-orange-50/20 to-rose-50/30 dark:from-yellow-900/10 dark:via-orange-900/10 dark:to-rose-900/10 pointer-events-none -z-10" />
      <Navbar />
      <motion.div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8" variants={containerVariants} initial="hidden" animate="show">
        
        <motion.div variants={itemVariants} className="pt-4">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">{t('analytics.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">{t('analytics.subtitle')}</p>
        </motion.div>

        {/* SPENDING TRENDS */}
        <motion.div variants={itemVariants} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-black/20 border border-white/60 dark:border-gray-700/50 hover:shadow-2xl transition-all">
           <h2 className="text-xl font-black mb-6 text-gray-900 dark:text-white flex items-center gap-3">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl"><TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" /></div>
             {t('analytics.spendingTrends')}
           </h2>
           <div className="h-80 w-full">
             {data.spendingTrends.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={data.spendingTrends} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                   <XAxis dataKey="month" stroke="#9CA3AF" tick={{fontSize: 12, fontWeight: 700}} axisLine={false} tickLine={false} />
                   <YAxis stroke="#9CA3AF" tick={{fontSize: 12, fontWeight: 600}} axisLine={false} tickLine={false} />
                   <Tooltip 
                     contentStyle={{backgroundColor: 'rgba(31, 41, 55, 0.9)', color: '#f3f4f6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(8px)'}} 
                     formatter={(value) => [`$${value}`, t('analytics.spent')]}
                   />
                   <Line type="monotone" dataKey="spent" stroke="#4F46E5" strokeWidth={5} dot={{r: 6, fill: '#4F46E5', strokeWidth: 3, stroke: '#fff'}} activeDot={{r: 8, stroke: '#4F46E5', strokeWidth: 4, fill: '#fff'}} />
                 </LineChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400 font-bold">{t('analytics.noData')}</div>
             )}
           </div>
        </motion.div>

        {/* TROPHY CABINET */}
        <motion.div variants={itemVariants} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-black/20 border border-white/60 dark:border-gray-700/50 hover:shadow-2xl transition-all">
           <h2 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-3">
             <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-xl"><Trophy size={20} className="text-yellow-600 dark:text-yellow-400" /></div>
             {t('analytics.trophyCabinet')}
           </h2>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {data.badges.map(badge => (
                <div key={badge.id} className={`relative overflow-hidden rounded-3xl p-6 border transition-all duration-300 ${badge.unlocked ? 'bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/20 dark:to-orange-900/10 border-yellow-200 dark:border-yellow-800/30 hover:scale-[1.03] hover:shadow-xl shadow-yellow-500/10' : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60 grayscale hover:grayscale-0'}`}>
                   
                   {!badge.unlocked && <Lock size={48} className="absolute right-[-10px] top-[-10px] text-gray-300 dark:text-gray-800 opacity-50" />}
                   
                   <div className="text-5xl mb-4 drop-shadow-md">{badge.icon}</div>
                   <h3 className={`font-black text-lg mb-1.5 ${badge.unlocked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{badge.title}</h3>
                   <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-snug">{badge.description}</p>
                   
                   <div className="mt-5 flex items-center gap-2">
                      <span className={`text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-full ${badge.unlocked ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500'}`}>
                        {badge.unlocked ? t('analytics.unlocked') : t('analytics.locked')}
                      </span>
                   </div>
                </div>
              ))}
           </div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default Analytics;
