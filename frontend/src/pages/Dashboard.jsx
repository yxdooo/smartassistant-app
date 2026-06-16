import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SettingsModal from '../components/SettingsModal';
import OnboardingTour from '../components/OnboardingTour';
import api from '../services/api';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { exportToCSV, exportToPDF } from '../utils/export';
import { Download, FileText, Camera, Droplets, Clock, Loader2, Play, Square, PlusCircle, Settings, Wallet, Coffee, Activity, Search, Flame } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';
import { requestNotificationPermission, sendPushNotification } from '../utils/notifications';
import Tilt from 'react-parallax-tilt';
import Budget3DChart from '../components/Budget3DChart';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);

  // States
  const [budgetForecast, setBudgetForecast] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  
  const [calorieSummary, setCalorieSummary] = useState(null);
  const [foodItems, setFoodItems] = useState([]);
  const [exerciseTypes, setExerciseTypes] = useState([]);
  const [dailyLog, setDailyLog] = useState(null);

  // Forms State
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', amount: '', description: '' });
  const [foodForm, setFoodForm] = useState({ foodItemId: '', amountGrams: '', mealType: 'BREAKFAST' });
  const [exerciseForm, setExerciseForm] = useState({ exerciseId: '', durationMin: '' });
  const [subForm, setSubForm] = useState({ name: '', amount: '', billingCycle: 'MONTHLY', nextBillingDate: '' });
  
  // OCR & UI States
  const [foodQuery, setFoodQuery] = useState('');
  const [externalFoods, setExternalFoods] = useState([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  
  const [fastingElapsedMs, setFastingElapsedMs] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const triggerConfetti = () => {
    soundFX.playSuccess();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#4F46E5', '#10B981', '#F59E0B'] });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        forecastRes, expRes, catRes, calRes, itemsRes, exTypesRes, subsRes, logRes
      ] = await Promise.all([
        api.get('/budget/forecast'),
        api.get('/budget'),
        api.get('/budget/categories'),
        api.get('/calorie/summary'),
        api.get('/calorie/items'),
        api.get('/exercise/types'),
        api.get('/subscription'),
        api.get('/tracker/daily')
      ]);

      setBudgetForecast(forecastRes.data);
      setExpenses(expRes.data);
      setCategories(catRes.data);
      setCalorieSummary(calRes.data);
      setFoodItems(itemsRes.data);
      setExerciseTypes(exTypesRes.data);
      setSubscriptions(subsRes.data);
      setDailyLog(logRes.data);

      if (catRes.data.length > 0) setExpenseForm(prev => ({ ...prev, categoryId: catRes.data[0].id }));
      if (exTypesRes.data.length > 0) setExerciseForm(prev => ({ ...prev, exerciseId: exTypesRes.data[0].id }));
      
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
         localStorage.removeItem('token');
         navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    let interval;
    if (dailyLog?.fastingStartTime && !dailyLog?.fastingEndTime) {
      const start = new Date(dailyLog.fastingStartTime).getTime();
      interval = setInterval(() => {
        const elapsed = Date.now() - start;
        setFastingElapsedMs(elapsed);
        
        // Notify if exact 16 hours is reached
        if (elapsed > 16 * 60 * 60 * 1000 && elapsed < 16 * 60 * 60 * 1000 + 2000) {
           sendPushNotification("Fasting Goal Complete! 🏆", { body: "You have reached your 16-hour fasting goal." });
           triggerConfetti();
        }
      }, 1000);
    } else if (dailyLog?.fastingEndTime) {
      const start = new Date(dailyLog.fastingStartTime).getTime();
      const end = new Date(dailyLog.fastingEndTime).getTime();
      setFastingElapsedMs(end - start);
    } else {
      setFastingElapsedMs(0);
    }
    return () => clearInterval(interval);
  }, [dailyLog]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.categoryId) return;
    soundFX.playPop();
    try {
      await api.post('/budget', { ...expenseForm, date: new Date().toISOString() });
      setExpenseForm(prev => ({ ...prev, amount: '', description: '' }));
      toast.success('Expense added successfully!');
      triggerConfetti();
      fetchData();
    } catch (err) { toast.error('Failed to add expense.'); }
  };

  const handleReceiptScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    soundFX.playPop();
    setScanning(true);
    const formData = new FormData();
    formData.append('receipt', file);
    try {
       const res = await api.post('/budget/scan-receipt', formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
       });
       if (res.data.amount) {
         setExpenseForm(prev => ({ ...prev, amount: res.data.amount }));
         toast.success(`Receipt scanned! Extracted Amount: $${res.data.amount}`);
       } else {
         toast.error("Could not detect a total amount from the receipt image.");
       }
    } catch (error) {
       toast.error("Error processing receipt image.");
    } finally {
       setScanning(false);
       if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSubscription = async (e) => {
    e.preventDefault();
    if (!subForm.name || !subForm.amount || !subForm.nextBillingDate) return;
    soundFX.playPop();
    try {
      await api.post('/subscription', subForm);
      setSubForm({ name: '', amount: '', billingCycle: 'MONTHLY', nextBillingDate: '' });
      toast.success('Subscription added!');
      fetchData();
    } catch (err) { toast.error('Failed to add subscription.'); }
  };

  const handleWaterClick = async (index) => {
    soundFX.playWaterDrop();
    const newGlasses = index + 1;
    setDailyLog(prev => ({ ...prev, waterGlasses: newGlasses }));
    try {
      await api.post('/tracker/water', { glasses: newGlasses });
      if (newGlasses === 8) {
         triggerConfetti();
         sendPushNotification("Hydration Goal Reached! 💧", { body: "Great job drinking 8 glasses of water today!" });
         toast.success("Hydration goal reached! 💧");
      }
    } catch (err) { console.error(err); }
  };

  const toggleFasting = async () => {
    soundFX.playPop();
    const action = dailyLog?.fastingStartTime && !dailyLog?.fastingEndTime ? 'stop' : 'start';
    try {
      const res = await api.post('/tracker/fasting', { action });
      setDailyLog(res.data);
      if (action === 'start') {
         toast.success('Fasting started!');
         triggerConfetti();
      } else toast.success('Fasting stopped.');
    } catch (err) { toast.error('Failed to update fasting status.'); }
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    if (!foodForm.amountGrams || !foodForm.foodItemId) return;
    soundFX.playPop();
    try {
      await api.post('/calorie', { ...foodForm, date: new Date().toISOString() });
      setFoodForm(prev => ({ ...prev, amountGrams: '' }));
      toast.success('Food logged!');
      triggerConfetti();
      fetchData();
    } catch (err) { toast.error('Failed to log food.'); }
  };

  const handleAddExercise = async (e) => {
    e.preventDefault();
    if (!exerciseForm.durationMin || !exerciseForm.exerciseId) return;
    soundFX.playPop();
    try {
      await api.post('/exercise', { ...exerciseForm, date: new Date().toISOString() });
      setExerciseForm(prev => ({ ...prev, durationMin: '' }));
      toast.success('Exercise logged!');
      triggerConfetti();
      fetchData();
    } catch (err) { toast.error('Failed to log exercise.'); }
  };

  const searchExternalFood = async (e) => {
    e.preventDefault();
    if (!foodQuery) return;
    soundFX.playPop();
    setSearching(true);
    try {
      const res = await api.get(`/calorie/search-external?q=${encodeURIComponent(foodQuery)}`);
      setExternalFoods(res.data);
    } catch (err) { toast.error('Search failed.'); }
    finally { setSearching(false); }
  };

  const importAndSelectFood = async (externalFood) => {
    soundFX.playPop();
    try {
      const res = await api.post('/calorie/items', {
        name: externalFood.name,
        caloriesPer100g: externalFood.caloriesPer100g,
        proteinPer100g: externalFood.proteinPer100g,
        carbsPer100g: externalFood.carbsPer100g,
        fatPer100g: externalFood.fatPer100g
      });
      setFoodItems([...foodItems, res.data]);
      setFoodForm(prev => ({ ...prev, foodItemId: res.data.id }));
      setExternalFoods([]);
      setFoodQuery('');
      toast.success('Food imported successfully!');
    } catch (err) { toast.error('Failed to import food.'); }
  };

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const fastingGoalMs = 16 * 60 * 60 * 1000;
  const fastingProgress = Math.min((fastingElapsedMs / fastingGoalMs) * 100, 100);
  const circumference = 2 * Math.PI * 40;

  const exportData = () => {
    soundFX.playPop();
    const csvData = [
       { Type: 'Budget Forecast', Value: budgetForecast?.forecastAmount },
       { Type: 'Monthly Limit', Value: budgetForecast?.monthlyBudgetLimit },
       { Type: 'Total Spent', Value: budgetForecast?.totalSpentSoFar },
       { Type: 'Calorie Goal', Value: calorieSummary?.goals.dailyCalorieGoal },
       { Type: 'Calories Consumed', Value: calorieSummary?.consumed.calories },
       { Type: 'Calories Burned', Value: calorieSummary?.burnedCalories },
       { Type: 'Net Calories', Value: calorieSummary?.netCalories }
    ];
    exportToCSV(csvData, 'dashboard_data.csv');
  };

  const pieData = categories.map(cat => {
    const total = expenses.filter(e => e.categoryId === cat.id).reduce((sum, e) => sum + e.amount, 0);
    return { name: cat.name, value: total };
  }).filter(item => item.value > 0);

  const calorieBarData = calorieSummary ? [
    {
      name: t('dashboard.netCalories'),
      [t('dashboard.consumed')]: calorieSummary.consumed.calories,
      [t('dashboard.burned')]: calorieSummary.burnedCalories,
      [t('dashboard.net')]: calorieSummary.netCalories,
      [t('dashboard.goal')]: calorieSummary.goals.dailyCalorieGoal
    }
  ] : [];

  const cardClass = "bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/40 dark:shadow-black/20 border border-white/60 dark:border-gray-700/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300";

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 pb-12 transition-colors">
      <Navbar />
      <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse mt-8">
        <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-3xl"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[400px] bg-gray-200 dark:bg-gray-800 rounded-[2rem]"></div>
          <div className="h-[400px] bg-gray-200 dark:bg-gray-800 rounded-[2rem]"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-900 transition-colors pb-12 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      <OnboardingTour />
      
      {/* Animated Aurora Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob pointer-events-none -z-10" />
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-emerald-400/20 dark:bg-emerald-600/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000 pointer-events-none -z-10" />
      <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-purple-400/20 dark:bg-purple-600/10 rounded-full mix-blend-multiply filter blur-[120px] animate-blob animation-delay-4000 pointer-events-none -z-10" />

      <Navbar />
      <motion.div id="dashboard-content" className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8" variants={containerVariants} initial="hidden" animate="show">
        
        <motion.div variants={itemVariants} className="flex justify-between items-center flex-wrap gap-4 pt-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">{t('dashboard.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
             <button onClick={() => { soundFX.playPop(); setIsSettingsOpen(true); }} className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md font-bold text-sm">
               <Settings size={16} /> {t('common.settings')}
             </button>
             <button onClick={exportData} className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md font-bold text-sm">
               <Download size={16} /> {t('common.exportCsv')}
             </button>
             <button onClick={() => { soundFX.playPop(); exportToPDF('dashboard-content', 'dashboard_report.pdf'); }} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 font-bold text-sm">
               <FileText size={16} /> {t('common.exportPdf')}
             </button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {budgetForecast && (
            <div className={`relative overflow-hidden p-8 rounded-3xl shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${budgetForecast.isOverBudgetRisk ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-red-500/20' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-indigo-500/20'}`}>
                <div className="absolute top-0 right-0 p-6 opacity-10"><Wallet size={100} /></div>
                <p className="text-xs uppercase tracking-widest font-black opacity-70 mb-2">{t('dashboard.budgetForecast')}</p>
                <p className="text-2xl font-extrabold mb-6 max-w-[80%] leading-tight">{budgetForecast.message}</p>
                <div className="flex justify-between items-end">
                   <div>
                     <p className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1">{t('dashboard.spentSoFar')}</p>
                     <p className="text-lg font-black">${budgetForecast.totalSpentSoFar.toFixed(2)}</p>
                   </div>
                   <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10 text-right">
                     <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-0.5">{t('dashboard.monthlyLimit')}</p>
                     <p className="text-sm font-black">${budgetForecast.monthlyBudgetLimit.toFixed(2)}</p>
                   </div>
                </div>
            </div>
            )}
            {calorieSummary && (
            <div className="relative overflow-hidden p-8 rounded-3xl shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20">
                <div className="absolute top-0 right-0 p-6 opacity-10"><Activity size={100} /></div>
                <p className="text-xs uppercase tracking-widest font-black opacity-70 mb-2">{t('dashboard.calorieStatus')}</p>
                <p className="text-2xl font-extrabold mb-6 max-w-[80%] leading-tight">{calorieSummary.insightMessage}</p>
                <div className="flex justify-between items-end">
                   <div>
                     <p className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1">{t('dashboard.netCalories')}</p>
                     <p className="text-lg font-black">{calorieSummary.netCalories} kcal</p>
                   </div>
                   <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10 text-right">
                     <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider mb-0.5">{t('dashboard.dailyGoal')}</p>
                     <p className="text-sm font-black">{calorieSummary.goals.dailyCalorieGoal} kcal</p>
                   </div>
                </div>
            </div>
            )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          
          <div className="space-y-8 tour-step-1-budget">
            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000} scale={1.02} transitionSpeed={2000} className="transform-gpu">
            <motion.div variants={itemVariants} className={cardClass}>
              <h2 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-3">
                 <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl"><Wallet size={20} className="text-indigo-600 dark:text-indigo-400" /></div>
                 {t('dashboard.expensesCategory')}
              </h2>
              <div className="relative">
                {pieData.length > 0 ? (
                  <Budget3DChart data={pieData} />
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                     <Wallet size={48} className="mb-3 opacity-30" />
                     <span className="font-bold text-sm tracking-wide">{t('dashboard.noExpenses')}</span>
                  </div>
                )}
              </div>
            </motion.div>
            </Tilt>

            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000} scale={1.02} transitionSpeed={2000} className="transform-gpu">
            <motion.div variants={itemVariants} className={cardClass}>
              <div className="flex justify-between items-center mb-8">
                 <h3 className="font-black text-gray-900 dark:text-white text-xl">{t('dashboard.quickAdd')}</h3>
                 <div className="relative">
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleReceiptScan} />
                    <button type="button" onClick={() => { soundFX.playPop(); fileInputRef.current?.click(); }} disabled={scanning} className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-2.5 px-5 rounded-full transition-all font-bold shadow-sm hover:shadow-md">
                       {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                       {scanning ? t('dashboard.scanning') : t('dashboard.scanReceipt')}
                    </button>
                 </div>
              </div>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="flex gap-3">
                  <select 
                    required className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={expenseForm.categoryId} onChange={e => setExpenseForm({...expenseForm, categoryId: e.target.value})}
                  >
                    <option value="" disabled>{t('dashboard.category')}</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input 
                    type="number" step="0.01" required placeholder={t('dashboard.amount')}
                    className="w-32 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                  />
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" placeholder={t('dashboard.description')}
                    className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                  />
                  <button type="submit" className="bg-gray-900 dark:bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-sm font-black hover:bg-black dark:hover:bg-indigo-500 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5">{t('dashboard.add')}</button>
                </div>
              </form>
            </motion.div>

            <motion.div variants={itemVariants} className={cardClass}>
              <h3 className="font-black text-gray-900 dark:text-white mb-6 text-xl">{t('dashboard.subscriptions')}</h3>
              {subscriptions.length > 0 ? (
                <ul className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                   {subscriptions.map(s => (
                     <li key={s.id} className="flex justify-between items-center text-sm p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
                        <span className="font-bold flex items-center gap-3"><div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm"><Coffee size={14} className="text-gray-500" /></div> {s.name} <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider ml-1">{s.billingCycle}</span></span>
                        <span className="font-black text-base">${s.amount.toFixed(2)}</span>
                     </li>
                   ))}
                </ul>
              ) : (
                <div className="text-center py-8 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 mb-6">
                   <p className="text-sm font-bold text-gray-400">{t('dashboard.noSubscriptions')}</p>
                </div>
              )}
              
              <form onSubmit={handleAddSubscription} className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                 <input type="text" required placeholder={t('dashboard.name')} className="flex-1 min-w-[100px] mt-4 rounded-xl border-0 bg-gray-100/80 px-4 py-3 text-sm dark:bg-gray-800/80 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} />
                 <input type="number" step="0.01" required placeholder="$0.00" className="w-24 mt-4 rounded-xl border-0 bg-gray-100/80 px-4 py-3 text-sm dark:bg-gray-800/80 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all shadow-inner" value={subForm.amount} onChange={e => setSubForm({...subForm, amount: e.target.value})} />
                 <input type="date" required className="w-36 mt-4 rounded-xl border-0 bg-gray-100/80 px-4 py-3 text-sm dark:bg-gray-800/80 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-all text-gray-500 dark:text-gray-400 shadow-inner" value={subForm.nextBillingDate} onChange={e => setSubForm({...subForm, nextBillingDate: e.target.value})} />
                  <button type="submit" className="bg-gray-900 mt-4 dark:bg-gray-700 text-white px-5 py-3 rounded-xl hover:bg-black dark:hover:bg-gray-600 transition-all shadow-md hover:shadow-lg"><PlusCircle size={18} /></button>
              </form>
            </motion.div>
            </Tilt>

          </div>

          <div className="space-y-8 tour-step-2-health">
            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000} scale={1.02} transitionSpeed={2000} className="transform-gpu">
            <motion.div variants={itemVariants} className={cardClass}>
              <h2 className="text-xl font-black mb-8 text-gray-900 dark:text-white flex items-center gap-3">
                 <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl"><Activity size={20} className="text-emerald-600 dark:text-emerald-400" /></div>
                 {t('dashboard.calorieGoals')}
              </h2>
              <div className="h-48 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calorieBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{fontSize: 12, fontWeight: 700}} axisLine={false} tickLine={false} />
                    <YAxis stroke="#9CA3AF" tick={{fontSize: 12, fontWeight: 600}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{backgroundColor: 'rgba(31, 41, 55, 0.9)', color: '#f3f4f6', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(8px)'}} cursor={{fill: 'transparent'}} />
                    <Legend wrapperStyle={{fontWeight: 700, fontSize: 12, marginTop: '10px'}} />
                    <Bar dataKey={t('dashboard.consumed')} fill="#F59E0B" radius={[8, 8, 8, 8]} barSize={24} />
                    <Bar dataKey={t('dashboard.burned')} fill="#10B981" radius={[8, 8, 8, 8]} barSize={24} />
                    <Bar dataKey={t('dashboard.net')} fill="#4F46E5" radius={[8, 8, 8, 8]} barSize={24} />
                    <Bar dataKey={t('dashboard.goal')} fill="#9CA3AF" radius={[8, 8, 8, 8]} barSize={24} opacity={0.3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
            </Tilt>

            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000} scale={1.02} transitionSpeed={2000} className="transform-gpu">
            <motion.div variants={itemVariants} className={cardClass}>
               <h3 className="font-black text-gray-900 dark:text-white mb-8 text-xl">{t('dashboard.healthTracker')}</h3>
               
               <div className="flex flex-col sm:flex-row justify-between gap-8">
                  <div className="flex-1 bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                     <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                           <Droplets size={18} className="text-blue-500" />
                           <span className="text-sm font-black text-gray-900 dark:text-gray-100">{t('dashboard.hydration')}</span>
                        </div>
                        <span className="text-[10px] uppercase font-black tracking-widest text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-3 py-1.5 rounded-full">{dailyLog?.waterGlasses || 0}/8 {t('dashboard.glasses')}</span>
                     </div>
                     <div className="flex flex-wrap gap-2.5">
                        {[...Array(8)].map((_, i) => (
                           <div 
                             key={i} 
                             onClick={() => handleWaterClick(i)}
                             className={`w-10 h-12 rounded-xl border-2 cursor-pointer transition-all duration-300 transform hover:scale-110 hover:-rotate-3 ${i < (dailyLog?.waterGlasses || 0) ? 'bg-blue-400 border-blue-400 shadow-lg shadow-blue-400/40 dark:shadow-blue-900/40' : 'bg-transparent border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                           />
                        ))}
                     </div>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-800/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                     <div className="relative w-32 h-32 flex items-center justify-center mb-5 drop-shadow-xl">
                        <svg className="w-full h-full transform -rotate-90">
                           <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                           <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeLinecap="round" className="text-emerald-500 transition-all duration-1000 ease-out"
                             strokeDasharray={2 * Math.PI * 56}
                             strokeDashoffset={2 * Math.PI * 56 - (fastingProgress / 100) * (2 * Math.PI * 56)}
                           />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                           <span className="text-lg font-black text-gray-900 dark:text-white tracking-tight">{formatTime(fastingElapsedMs)}</span>
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{t('dashboard.goal16h')}</span>
                        </div>
                     </div>
                     <button onClick={toggleFasting} className={`flex items-center gap-2 text-xs px-6 py-3 rounded-full font-black uppercase tracking-wider transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 ${dailyLog?.fastingStartTime && !dailyLog?.fastingEndTime ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {dailyLog?.fastingStartTime && !dailyLog?.fastingEndTime ? <><Square size={14} className="fill-current"/> {t('dashboard.stopFast')}</> : <><Play size={14} className="fill-current"/> {t('dashboard.startFast')}</>}
                     </button>
                  </div>
               </div>
            </motion.div>
            </Tilt>

            <Tilt tiltMaxAngleX={5} tiltMaxAngleY={5} perspective={1000} scale={1.02} transitionSpeed={2000} className="transform-gpu">
            <motion.div variants={itemVariants} className={cardClass}>
              
              <form onSubmit={handleAddExercise} className="space-y-4 mb-8 pb-8 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-4"><Flame size={16} className="text-orange-500" /> {t('dashboard.activityLog')}</p>
                <div className="flex gap-3">
                  <select 
                    required className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={exerciseForm.exerciseId} onChange={e => setExerciseForm({...exerciseForm, exerciseId: e.target.value})}
                  >
                    <option value="" disabled>{t('dashboard.exerciseType')}</option>
                    {exerciseTypes.map(e => <option key={e.id} value={e.id}>{e.name} (~{e.caloriesBurnedPerMin} kcal)</option>)}
                  </select>
                  <input 
                    type="number" required placeholder={t('dashboard.mins')}
                    className="w-24 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={exerciseForm.durationMin} onChange={e => setExerciseForm({...exerciseForm, durationMin: e.target.value})}
                  />
                  <button type="submit" className="bg-orange-500 text-white px-6 py-3.5 rounded-2xl text-sm font-black hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5">{t('dashboard.add')}</button>
                </div>
              </form>

              <form onSubmit={searchExternalFood} className="space-y-4 mb-6">
                 <p className="text-sm font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2 mb-4"><Search size={16} className="text-indigo-500" /> {t('dashboard.foodDatabase')}</p>
                 <div className="flex gap-3">
                   <input type="text" placeholder={t('dashboard.searchPlaceholder')} className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner" value={foodQuery} onChange={e => setFoodQuery(e.target.value)} />
                   <button type="submit" disabled={searching} className="bg-gray-900 dark:bg-gray-700 text-white px-6 py-3.5 rounded-2xl text-sm font-black hover:bg-black dark:hover:bg-gray-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5">{searching ? <Loader2 size={16} className="animate-spin" /> : t('dashboard.search')}</button>
                 </div>
              </form>

              {externalFoods.length > 0 && (
                <div className="mb-6 max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-2 space-y-1 custom-scrollbar">
                  {externalFoods.map((ef, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-3 hover:bg-white dark:hover:bg-gray-700 rounded-xl cursor-pointer transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm group" onClick={() => importAndSelectFood(ef)}>
                      <span className="font-bold dark:text-white">{ef.name} <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 ml-2 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">{ef.caloriesPer100g} kcal</span></span>
                      <button className="text-xs text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-105">{t('dashboard.import')}</button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFood} className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-3">
                  <select 
                    required className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={foodForm.foodItemId} onChange={e => setFoodForm({...foodForm, foodItemId: e.target.value})}
                  >
                    <option value="" disabled>{t('dashboard.mySavedFoods')}</option>
                    {foodItems.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input 
                    type="number" step="0.1" required placeholder={t('dashboard.grams')}
                    className="w-24 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={foodForm.amountGrams} onChange={e => setFoodForm({...foodForm, amountGrams: e.target.value})}
                  />
                </div>
                <div className="flex gap-3">
                  <select 
                    required className="flex-1 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white px-5 py-3.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold outline-none transition-all shadow-inner"
                    value={foodForm.mealType} onChange={e => setFoodForm({...foodForm, mealType: e.target.value})}
                  >
                    <option value="BREAKFAST">{t('dashboard.breakfast')}</option>
                    <option value="LUNCH">{t('dashboard.lunch')}</option>
                    <option value="DINNER">{t('dashboard.dinner')}</option>
                    <option value="SNACK">{t('dashboard.snack')}</option>
                  </select>
                  <button type="submit" className="bg-emerald-500 text-white px-8 py-3.5 rounded-2xl text-sm font-black hover:bg-emerald-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5">{t('dashboard.logFood')}</button>
                </div>
              </form>
            </motion.div>
            </Tilt>
          </div>
          
        </div>
      </motion.div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onUpdated={fetchData} />

    </div>
  );
};

export default Dashboard;
