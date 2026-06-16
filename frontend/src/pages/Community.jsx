import React, { useEffect, useState } from 'react';
import { Trophy, Flame, Crown, Activity } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const Community = () => {
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get('/community/leaderboard');
        setLeaderboard(res.data);
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 transition-colors pb-12 font-sans relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-orange-400/20 dark:bg-orange-600/10 rounded-full mix-blend-multiply filter blur-[100px] animate-blob pointer-events-none -z-10" />
      <div className="absolute top-[30%] left-[-10%] w-96 h-96 bg-yellow-400/20 dark:bg-yellow-600/10 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000 pointer-events-none -z-10" />

      <Navbar />

      <div className="max-w-4xl mx-auto px-6 pt-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
           <div className="inline-flex p-4 rounded-3xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 mb-6 shadow-sm">
             <Trophy size={40} />
           </div>
           <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4">Global Leaderboard</h1>
           <p className="text-gray-500 dark:text-gray-400 text-lg font-medium max-w-xl mx-auto">See how you stack up against thousands of SmartAssistant users. Consistency is key.</p>
        </motion.div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl w-full" />)}
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
            {leaderboard.map((user, index) => (
              <motion.div 
                key={user.id} 
                variants={itemVariants}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 rounded-[1.5rem] shadow-xl shadow-gray-200/40 dark:shadow-black/20 border border-white/60 dark:border-gray-700/50 flex items-center justify-between transition-transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-amber-500/50' : 
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-gray-500/50' : 
                    index === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-amber-900/50' : 
                    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {index === 0 ? <Crown size={24} className="animate-pulse" /> : `#${user.rank}`}
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-gray-900 dark:text-white">{user.username}</h3>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Rank {user.rank}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                   <div className="text-center">
                     <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Current Streak</p>
                     <div className="flex items-center justify-center gap-1.5 text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full font-black shadow-sm">
                       <Flame size={16} /> {user.currentStreak} Days
                     </div>
                   </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Community;
