import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Community from './pages/Community';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Analytics from './pages/Analytics';
import OfflineIndicator from './components/OfflineIndicator';
import ProtectedRoute from './components/ProtectedRoute';
import SmartBot from './components/SmartBot';

function App() {
  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white border dark:border-gray-700' }} />
      <BrowserRouter>
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <Analytics />
              <SmartBot />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default App;
