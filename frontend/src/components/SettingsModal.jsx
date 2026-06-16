import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { startRegistration } from '@simplewebauthn/browser';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { soundFX } from '../utils/soundFX';

const SettingsModal = ({ isOpen, onClose, onUpdated }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/auth/profile').then(res => setFormData(res.data)).catch(() => toast.error('Failed to load profile'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    soundFX.playPop();
    setLoading(true);
    try {
      await api.put('/auth/profile', formData);
      toast.success(t('common.save') + ' successful!');
      soundFX.playSuccess();
      onUpdated();
      onClose();
    } catch (err) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupBiometrics = async () => {
    soundFX.playPop();
    try {
      // 1. Get registration options from server
      const resp = await api.get('/auth/webauthn/generate-registration');
      const options = resp.data;

      // 2. Pass options to the browser to interact with authenticator
      const authResp = await startRegistration(options);

      // 3. Verify the response with the server
      const verificationResp = await api.post('/auth/webauthn/verify-registration', authResp);
      
      if (verificationResp.data?.verified) {
        toast.success('Biometric Login Setup Complete! 🧬');
        soundFX.playSuccess();
      } else {
        toast.error('Verification failed.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to setup Biometrics. Make sure your device supports it.');
    }
  };

  const inputClass = "w-full px-4 py-3.5 rounded-2xl border-0 bg-gray-100/80 dark:bg-gray-800/80 dark:text-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-700 outline-none transition-all shadow-inner";
  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1.5 ml-1";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          onClick={() => { soundFX.playPop(); onClose(); }}
        />
        
        {formData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/50 dark:border-gray-700/50 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-6 sm:p-8 border-b border-gray-100/50 dark:border-gray-800/50 shrink-0">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400"><Settings size={20} /></div>
                 <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{t('settings.title')}</h2>
              </div>
              <button onClick={() => { soundFX.playPop(); onClose(); }} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full transition-all hover:rotate-90"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-x-5 gap-y-6">
                <div>
                  <label className={labelClass}>{t('settings.age')}</label>
                  <input name="age" type="number" required className={inputClass} value={formData.age} onChange={handleChange} />
                </div>
                <div>
                  <label className={labelClass}>{t('settings.gender')}</label>
                  <select name="gender" className={inputClass} value={formData.gender} onChange={handleChange}>
                    <option value="MALE">{t('settings.male')}</option>
                    <option value="FEMALE">{t('settings.female')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('settings.height')}</label>
                  <input name="heightCm" type="number" step="0.1" required className={inputClass} value={formData.heightCm} onChange={handleChange} />
                </div>
                <div>
                  <label className={labelClass}>{t('settings.weight')}</label>
                  <input name="weightKg" type="number" step="0.1" required className={inputClass} value={formData.weightKg} onChange={handleChange} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t('settings.activity')}</label>
                  <select name="activityLevel" className={inputClass} value={formData.activityLevel} onChange={handleChange}>
                    <option value="SEDENTARY">{t('settings.sedentary')}</option>
                    <option value="LIGHTLY_ACTIVE">{t('settings.light')}</option>
                    <option value="MODERATELY_ACTIVE">{t('settings.moderate')}</option>
                    <option value="VERY_ACTIVE">{t('settings.very')}</option>
                    <option value="EXTRA_ACTIVE">{t('settings.extra')}</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t('settings.weightGoal')}</label>
                  <select name="weightGoal" className={inputClass} value={formData.weightGoal} onChange={handleChange}>
                    <option value="LOSE_WEIGHT">{t('settings.lose')}</option>
                    <option value="MAINTAIN_WEIGHT">{t('settings.maintain')}</option>
                    <option value="GAIN_WEIGHT">{t('settings.gain')}</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>{t('settings.budgetLimit')}</label>
                  <input name="monthlyBudgetLimit" type="number" step="0.01" required className={inputClass} value={formData.monthlyBudgetLimit} onChange={handleChange} />
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-100/50 dark:border-gray-800/50">
                 <button type="button" onClick={handleSetupBiometrics} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-2xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
                   🧬 Setup FaceID / TouchID
                 </button>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => { soundFX.playPop(); onClose(); }} className="px-6 py-3.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={loading} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3.5 rounded-2xl text-sm font-black transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70">
                  <Save size={18} /> {loading ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
};

export default SettingsModal;
