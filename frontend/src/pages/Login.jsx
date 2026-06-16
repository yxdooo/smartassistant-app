import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Activity } from 'lucide-react';
import api from '../services/api';
import { startAuthentication } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!email) return setError('Please enter your email first to use FaceID/TouchID');
    setLoading(true);
    try {
      // 1. Get auth options from server
      const resp = await api.post('/auth/webauthn/generate-authentication', { email });
      const options = resp.data;

      // 2. Pass options to the browser to interact with authenticator
      const authResp = await startAuthentication(options);

      // 3. Verify the response with the server
      const verificationResp = await api.post('/auth/webauthn/verify-authentication', {
        email,
        credential: authResp
      });
      
      if (verificationResp.data?.verified) {
        localStorage.setItem('token', verificationResp.data.token);
        toast.success('Biometric Login Successful!');
        navigate('/dashboard');
      } else {
        setError('Verification failed.');
      }
    } catch (error) {
      console.error(error);
      setError(error.response?.data?.error || 'Biometric login failed. Have you set it up?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-gray-900 bg-white dark:bg-gray-900 transition-colors">
      
      {/* Left Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative">
        {/* Logo */}
        <Link to="/" className="absolute top-8 left-8 sm:left-16 md:left-24 xl:left-32 flex items-center gap-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-opacity">
          <Activity size={28} />
          <span>SmartAssistant</span>
        </Link>

        <div className="max-w-sm w-full mx-auto mt-24 lg:mt-0">
          <h2 className="text-4xl font-extrabold mb-2 dark:text-white tracking-tight">Welcome back</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">Please enter your details to sign in.</p>
          
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
               <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium border border-red-100 dark:border-red-800">
                 {error}
               </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 dark:text-white outline-none font-medium shadow-sm"
                  placeholder="name@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-900 dark:text-white outline-none font-medium shadow-sm"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:-translate-y-0.5 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 disabled:opacity-70 disabled:transform-none mt-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>
            
            <button 
              type="button" onClick={handleBiometricLogin} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:-translate-y-0.5 shadow-lg disabled:opacity-70 disabled:transform-none mt-2"
            >
              🧬 Sign in with FaceID / TouchID
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              Sign up for free
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

export default Login;
