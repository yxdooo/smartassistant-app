import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Activity, User, Target, DollarSign, Ruler, Scale } from 'lucide-react';
import api from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '', password: '', age: '', gender: 'MALE', heightCm: '', weightKg: '', activityLevel: 'SEDENTARY', weightGoal: 'MAINTAIN_WEIGHT', monthlyBudgetLimit: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        profile: {
          age: parseInt(formData.age),
          gender: formData.gender,
          heightCm: parseFloat(formData.heightCm),
          weightKg: parseFloat(formData.weightKg),
          activityLevel: formData.activityLevel,
          weightGoal: formData.weightGoal,
          monthlyBudgetLimit: parseFloat(formData.monthlyBudgetLimit)
        }
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 dark:text-white outline-none font-medium shadow-sm text-sm";
  const selectClass = "w-full pl-3 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 dark:text-white outline-none font-medium shadow-sm text-sm";

  return (
    <div className="min-h-screen flex text-gray-900 bg-white dark:bg-gray-900 transition-colors">
      
      {/* Left Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative py-12">
        {/* Logo */}
        <Link to="/" className="absolute top-8 left-8 sm:left-16 md:left-24 xl:left-32 flex items-center gap-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
          <Activity size={28} />
          <span>SmartAssistant</span>
        </Link>

        <div className="max-w-md w-full mx-auto mt-16 lg:mt-0">
          <h2 className="text-3xl font-extrabold mb-2 dark:text-white tracking-tight">Create your account</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">Set up your profile to personalize your experience.</p>
          
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
               <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium border border-red-100 dark:border-red-800">
                 {error}
               </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Mail size={16} /></div>
                    <input name="email" type="email" required className={inputClass} placeholder="Email address" value={formData.email} onChange={handleChange} />
                </div>
                
                <div className="col-span-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Lock size={16} /></div>
                    <input name="password" type="password" required className={inputClass} placeholder="Create password" value={formData.password} onChange={handleChange} />
                </div>
                
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><User size={16} /></div>
                    <input name="age" type="number" required className={inputClass} placeholder="Age" value={formData.age} onChange={handleChange} />
                </div>
                
                <div>
                    <select name="gender" className={selectClass} value={formData.gender} onChange={handleChange}>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                    </select>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Ruler size={16} /></div>
                    <input name="heightCm" type="number" step="0.1" required className={inputClass} placeholder="Height (cm)" value={formData.heightCm} onChange={handleChange} />
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Scale size={16} /></div>
                    <input name="weightKg" type="number" step="0.1" required className={inputClass} placeholder="Weight (kg)" value={formData.weightKg} onChange={handleChange} />
                </div>

                <div className="col-span-2">
                    <select name="activityLevel" className={selectClass} value={formData.activityLevel} onChange={handleChange}>
                        <option value="SEDENTARY">Sedentary (Little to no exercise)</option>
                        <option value="LIGHTLY_ACTIVE">Lightly Active (Light exercise 1-3 days/week)</option>
                        <option value="MODERATELY_ACTIVE">Moderately Active (Moderate exercise 3-5 days/week)</option>
                        <option value="VERY_ACTIVE">Very Active (Hard exercise 6-7 days/week)</option>
                        <option value="EXTRA_ACTIVE">Extra Active (Very hard exercise/physical job)</option>
                    </select>
                </div>

                <div className="col-span-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Target size={16} /></div>
                    <select name="weightGoal" className={inputClass} value={formData.weightGoal} onChange={handleChange}>
                        <option value="LOSE_WEIGHT">Goal: Lose Weight</option>
                        <option value="MAINTAIN_WEIGHT">Goal: Maintain Weight</option>
                        <option value="GAIN_WEIGHT">Goal: Gain Weight</option>
                    </select>
                </div>

                <div className="col-span-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><DollarSign size={16} /></div>
                    <input name="monthlyBudgetLimit" type="number" step="0.01" required className={inputClass} placeholder="Monthly Budget Limit ($)" value={formData.monthlyBudgetLimit} onChange={handleChange} />
                </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:-translate-y-0.5 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-70 disabled:transform-none mt-6"
            >
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Graphic Section */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 relative items-center justify-center overflow-hidden">
         {/* Decorative Gradients */}
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-gray-900 to-black opacity-90"></div>
         <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/30 rounded-full mix-blend-screen filter blur-[80px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full mix-blend-screen filter blur-[80px]"></div>
         
         <div className="relative z-10 p-12 max-w-lg text-center">
            <div className="inline-flex p-5 rounded-3xl bg-white/5 backdrop-blur-xl mb-10 border border-white/10 shadow-2xl">
               <Activity size={56} className="text-indigo-400" />
            </div>
            <h3 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight tracking-tight">Your wealth & health,<br/>perfectly synced.</h3>
            <p className="text-indigo-100/70 text-lg font-medium leading-relaxed">
              Join thousands using SmartAssistant to master their budget, track nutrition, and scan receipts effortlessly.
            </p>
         </div>
      </div>

    </div>
  );
};

export default Register;
