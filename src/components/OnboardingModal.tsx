'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Shield, Zap, Sparkles, CheckCircle2 } from 'lucide-react';

interface OnboardingModalProps {
  id: string;
}

export function OnboardingModal({ id }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Show modal automatically to first-time users
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsOpen(false);
  };

  const steps = [
    {
      title: 'Welcome to EscrowX 🛡️',
      description: 'The world\'s first zero-gas freelance escrow platform powered by the Universal Gas Framework (UGF).',
      icon: <Shield className="h-10 w-10 text-primary animate-pulse" />,
      features: ['Client locks budget securely', 'Freelancer works with 100% safety', 'No friction, completely gasless']
    },
    {
      title: 'Zero ETH Required ⚡',
      description: 'Normally, actions like lockups or payment releases cost network gas fees. UGF completely removes this barrier!',
      icon: <Zap className="h-10 w-10 text-success animate-bounce" />,
      features: ['Sponsor pays gas in background', 'Settle transaction fees in MockUSD', 'No ETH needed in your wallet']
    },
    {
      title: 'Under the Hood ⚙️',
      description: 'Our real-time progress tracker maps the four steps of the remote execution gateway.',
      icon: <Sparkles className="h-10 w-10 text-primary animate-spin-slow" />,
      features: ['Quote: sponsored gas cost estimate', 'Settle: authorization payload permit', 'Execute: remote on-chain broadcast', 'Confirm: mined block verification']
    }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/45 transition-all duration-150 focus:outline-none"
        title="Help & Onboarding"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div id={id} className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-8 rounded-xl glass-panel border border-secondary/50 space-y-6 relative animate-scale-in">
        {/* CLOSE BUTTON */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>

        {/* STEP HEADER */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 rounded-full bg-secondary/30 border border-secondary/50">
            {steps[currentStep].icon}
          </div>
          <h2 className="text-xl font-extrabold text-white">{steps[currentStep].title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{steps[currentStep].description}</p>
        </div>

        {/* FEATURES CHECKLIST */}
        <div className="space-y-2.5 p-4 rounded-lg bg-[#060608] border border-secondary/40">
          {steps[currentStep].features.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* STEP DOTS & CONTROLS */}
        <div className="flex items-center justify-between pt-2">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all duration-150 ${
                  currentStep === idx ? 'w-5 bg-primary' : 'w-2 bg-secondary'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="h-9 px-4 rounded-lg border border-secondary hover:bg-secondary/40 text-white text-xs font-bold transition-all duration-150"
              >
                Back
              </button>
            )}
            {currentStep < steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/95 text-white text-xs font-bold transition-all duration-150 shadow-md shadow-primary/10"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="h-9 px-4 rounded-lg bg-success hover:bg-success/95 text-white text-xs font-bold transition-all duration-150 shadow-md shadow-success/10"
              >
                Launch EscrowX
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
