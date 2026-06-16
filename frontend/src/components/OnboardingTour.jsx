import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';

const CustomTooltip = ({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  isLastStep,
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    {...tooltipProps} 
    className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-800 w-80 sm:w-96 text-left relative overflow-hidden"
  >
    {/* Decorative blur */}
    <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-indigo-500/20 rounded-full blur-[40px] pointer-events-none" />

    <div className="flex items-center gap-3 mb-4 relative z-10">
      <div className="p-2.5 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm border border-white dark:border-gray-700">
        <Sparkles size={20} className="animate-pulse" />
      </div>
      <div>
        <h3 className="font-black text-lg text-gray-900 dark:text-white tracking-tight">Quick Tour</h3>
        <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-0.5">Step {index + 1} of 4</p>
      </div>
    </div>
    
    <p className="text-gray-600 dark:text-gray-300 font-medium text-sm mb-6 leading-relaxed relative z-10">
      {step.content}
    </p>

    <div className="flex items-center justify-between mt-6 relative z-10">
      <button 
        {...closeProps}
        className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors uppercase tracking-wider"
      >
        Skip Tour
      </button>
      <div className="flex gap-2">
        {index > 0 && (
          <button 
            {...backProps}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        )}
        <button 
          {...primaryProps}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all hover:-translate-y-0.5"
        >
          {isLastStep ? 'Get Started!' : 'Next'}
        </button>
      </div>
    </div>
    
    <button 
      {...closeProps}
      className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-50 dark:bg-gray-800 p-1.5 rounded-full z-20"
    >
      <X size={14} />
    </button>
  </motion.div>
);

const OnboardingTour = () => {
  const { t } = useTranslation();
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      // Mark as seen immediately so it doesn't pop up again if they refresh mid-tour
      localStorage.setItem('hasSeenTour', 'true');
      setTimeout(() => setRun(true), 1500);
    }
  }, []);

  const steps = [
    {
      target: 'body',
      content: 'Welcome to your new Super App! Let us give you a quick tour of our next-gen features so you can make the most out of it.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-step-1-budget',
      content: 'Here is your intelligent Budget Tracker. Scan your receipts with our OCR camera, or log expenses manually to see your AI forecast update in real-time!',
      placement: 'right',
    },
    {
      target: '.tour-step-2-health',
      content: 'Track your daily health habits here. Click the water drops to stay hydrated, and use the 16-hour fasting timer to track your intermittent fasting.',
      placement: 'left',
    },
    {
      target: '.tour-step-3-bot',
      content: 'Have questions about your budget or calories? Click the SmartAssistant bot anytime. It analyzes your live data to give you personalized, actionable advice!',
      placement: 'top-end',
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      tooltipComponent={CustomTooltip}
      floaterProps={{
        disableAnimation: true, // We handle animation in CustomTooltip
      }}
      styles={{
        options: {
          zIndex: 10000,
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }
      }}
    />
  );
};

export default OnboardingTour;
