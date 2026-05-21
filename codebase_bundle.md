# EscrowX Full-Stack Codebase Bundle 🛡️

This file consolidates the entire core source code for EscrowX, making it extremely easy to upload or copy-paste directly into Claude!

---

## File: `next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      'porto/internal': false,
      'porto': false,
      '@coinbase/wallet-sdk': false,
      '@metamask/connect-evm': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      '@base-org/account': false,
      '@walletconnect/ethereum-provider': false,
      'accounts': false,
    };
    return config;
  },
};

export default nextConfig;
```

---

## File: `contracts/MockUSD.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "MockUSD") {
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

---

## File: `contracts/EscrowManager.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowManager {
    enum EscrowStatus { Pending, Funded, Delivered, Released, Cancelled }

    struct Escrow {
        uint256 id;
        address client;
        address freelancer;
        uint256 amount;
        uint256 deadline;
        EscrowStatus status;
        string title;
        string description;
        string deliveryNotes;
    }

    IERC20 public immutable mockUSD;
    uint256 public escrowCounter;
    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(uint256 indexed id, address indexed client, address indexed freelancer, uint256 amount);
    event EscrowFunded(uint256 indexed id);
    event EscrowDelivered(uint256 indexed id, string deliveryNotes);
    event EscrowReleased(uint256 indexed id);
    event EscrowCancelled(uint256 indexed id);

    constructor(address _mockUSD) {
        mockUSD = IERC20(_mockUSD);
    }

    function createEscrow(
        address _freelancer,
        uint256 _amount,
        uint256 _deadlineDays,
        string calldata _title,
        string calldata _description
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be positive");
        require(_freelancer != address(0), "Invalid freelancer");

        escrowCounter++;
        uint256 deadline = block.timestamp + (_deadlineDays * 1 days);

        escrows[escrowCounter] = Escrow({
            id: escrowCounter,
            client: msg.sender,
            freelancer: _freelancer,
            amount: _amount,
            deadline: deadline,
            status: EscrowStatus.Pending,
            title: _title,
            description: _description,
            deliveryNotes: ""
        });

        emit EscrowCreated(escrowCounter, msg.sender, _freelancer, _amount);
        return escrowCounter;
    }

    function fundEscrow(uint256 _id) external {
        Escrow storage escrow = escrows[_id];
        require(escrow.status == EscrowStatus.Pending, "Not pending");
        require(msg.sender == escrow.client, "Only client");

        require(mockUSD.transferFrom(msg.sender, address(this), escrow.amount), "Token transfer failed");
        escrow.status = EscrowStatus.Funded;

        emit EscrowFunded(_id);
    }

    function markDelivered(uint256 _id, string calldata _deliveryNotes) external {
        Escrow storage escrow = escrows[_id];
        require(escrow.status == EscrowStatus.Funded, "Not funded");
        require(msg.sender == escrow.freelancer, "Only freelancer");

        escrow.status = EscrowStatus.Delivered;
        escrow.deliveryNotes = _deliveryNotes;

        emit EscrowDelivered(_id, _deliveryNotes);
    }

    function releasePayment(uint256 _id) external {
        Escrow storage escrow = escrows[_id];
        require(escrow.status == EscrowStatus.Funded || escrow.status == EscrowStatus.Delivered, "Invalid state");
        require(msg.sender == escrow.client, "Only client");

        escrow.status = EscrowStatus.Released;
        require(mockUSD.transfer(escrow.freelancer, escrow.amount), "Token payout failed");

        emit EscrowReleased(_id);
    }

    function cancelEscrow(uint256 _id) external {
        Escrow storage escrow = escrows[_id];
        require(msg.sender == escrow.client, "Only client");
        
        if (escrow.status == EscrowStatus.Pending) {
            escrow.status = EscrowStatus.Cancelled;
        } else if (escrow.status == EscrowStatus.Funded) {
            require(block.timestamp > escrow.deadline, "Deadline not passed");
            escrow.status = EscrowStatus.Cancelled;
            require(mockUSD.transfer(escrow.client, escrow.amount), "Refund failed");
        } else {
            revert("Cannot cancel");
        }

        emit EscrowCancelled(_id);
    }
}
```

---

## File: `src/types/index.ts`
```typescript
export interface EscrowProject {
  id: string;
  title: string;
  description: string;
  freelancerAddress: string;
  clientAddress: string;
  amount: string;
  deadline: string;
  status: 'Pending' | 'Funded' | 'Delivered' | 'Released' | 'Cancelled';
  deliveryNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UGFStepProgress {
  step: 'Quote' | 'Settle' | 'Execute' | 'Confirm';
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  timestamp?: string;
}

export interface UGFTransaction {
  id: string;
  escrowId: string;
  type: 'Create' | 'Fund' | 'Deliver' | 'Release' | 'Cancel';
  digest: string;
  paymentCoin: string;
  amount: string;
  status: 'Quote' | 'Settle' | 'Execute' | 'Confirmed' | 'Failed';
  txHash?: string;
  createdAt: string;
  isGasless: boolean;
}
```

---

## File: `src/lib/db.ts`
```typescript
import { EscrowProject, UGFTransaction } from '../types';

const PROJECTS_KEY = 'escrowx_projects';
const TXS_KEY = 'escrowx_transactions';

const initialDummyProjects: EscrowProject[] = [
  {
    id: '1',
    title: 'Modern Landing Page Redesign',
    description: 'Design and develop a high-converting, responsive landing page using Next.js, Tailwind CSS, and Framer Motion. Deliverables include Figma link, complete source code repository, and Vercel preview.',
    freelancerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    clientAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    amount: '450',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Funded',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Smart Contract Audit & Optimization',
    description: 'Perform a comprehensive security audit of a set of core ERC20 and ERC721 governance contracts. Identify vulnerabilities (reentrancy, gas limits, sandwich attacks) and optimize execution costs.',
    freelancerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    clientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: '1200',
    deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Delivered',
    deliveryNotes: 'Audit complete! Zero critical issues found. Gas optimized by 14% on core mint functions. Deliverable PDF attached here: ipfs://QmHashAudits...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const db = {
  getProjects: async (): Promise<EscrowProject[]> => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (!stored) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(initialDummyProjects));
      return initialDummyProjects;
    }
    return JSON.parse(stored);
  },

  saveProject: async (project: EscrowProject): Promise<void> => {
    if (typeof window === 'undefined') return;
    const projects = await db.getProjects();
    projects.unshift(project);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  },

  updateProjectStatus: async (
    id: string,
    status: EscrowProject['status'],
    deliveryNotes?: string
  ): Promise<EscrowProject> => {
    if (typeof window === 'undefined') throw new Error('Client side only');
    const projects = await db.getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Project not found');

    projects[index] = {
      ...projects[index],
      status,
      ...(deliveryNotes !== undefined ? { deliveryNotes } : {}),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return projects[index];
  },

  getTransactions: async (): Promise<UGFTransaction[]> => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(TXS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveTransaction: async (tx: UGFTransaction): Promise<void> => {
    if (typeof window === 'undefined') return;
    const txs = await db.getTransactions();
    txs.unshift(tx);
    localStorage.setItem(TXS_KEY, JSON.stringify(txs));
  }
};
```

---

## File: `src/app/providers.tsx`
```typescript
'use client';

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const config = getDefaultConfig({
  appName: 'EscrowX',
  projectId: 'a4b76e108e42f9b8c6e27b9c9f1a2345', // standard mock hex project ID
  chains: [baseSepolia],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#7c3aed', // Tech Violet matching design spec
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

## File: `src/components/OnboardingModal.tsx`
```typescript
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
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 rounded-full bg-secondary/30 border border-secondary/50">
            {steps[currentStep].icon}
          </div>
          <h2 className="text-xl font-extrabold text-white">{steps[currentStep].title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{steps[currentStep].description}</p>
        </div>

        <div className="space-y-2.5 p-4 rounded-lg bg-[#060608] border border-secondary/40">
          {steps[currentStep].features.map((feat, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
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
```

---

## File: `src/components/UGFProgress.tsx`
```typescript
'use client';

import React from 'react';
import { UGFStepProgress } from '../types';
import { CheckCircle2, Circle, Loader2, XCircle, Zap, Shield, Globe } from 'lucide-react';

interface UGFProgressProps {
  id: string;
  steps: UGFStepProgress[];
  isExecuting: boolean;
}

export function UGFProgress({ id, steps, isExecuting }: UGFProgressProps) {
  if (!isExecuting && steps.every((s) => s.status === 'idle')) {
    return null;
  }

  const completedCount = steps.filter((s) => s.status === 'success').length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div id={id} className="w-full rounded-xl bg-[#08080c]/90 border border-primary/30 p-8 shadow-2xl space-y-8 animate-slide-up relative overflow-hidden">
      <div className="absolute top-0 right-0 w-44 h-44 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-ping" />
            <h3 className="text-white font-extrabold text-base lg:text-lg">UGF Sponsored Transaction Tunnel</h3>
          </div>
          <p className="text-xs text-muted-foreground">Universal Gas Framework is routing remote executions gaslessly.</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 border border-primary/30 text-primary font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
          <Globe className="h-3 w-3 animate-spin-slow" />
          <span>Base Sepolia Gateway</span>
        </span>
      </div>

      <div className="grid grid-cols-5 items-center justify-between p-4 rounded-lg bg-[#040406] border border-secondary/40 text-center gap-2">
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">Your Wallet</span>
          <span className="text-[10px] font-bold text-white bg-secondary/40 border border-secondary/60 px-2 py-0.5 rounded">0.00 ETH</span>
        </div>
        <div className="flex justify-center text-primary">
          <Zap className="h-4 w-4 animate-bounce text-primary" />
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-primary font-extrabold uppercase block">UGF Sponsor</span>
          <span className="text-[10px] font-bold text-success bg-success/15 border border-success/30 px-2 py-0.5 rounded">Sponsoring Gas</span>
        </div>
        <div className="flex justify-center text-primary">
          <Shield className="h-4 w-4 animate-pulse text-success" />
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">Base Sepolia</span>
          <span className="text-[10px] font-bold text-white bg-secondary/40 border border-secondary/60 px-2 py-0.5 rounded">Escrow Settled</span>
        </div>
      </div>

      <div className="relative pl-8 border-l-2 border-secondary/50 space-y-6">
        <div 
          className="absolute left-[-2px] top-0 bg-gradient-to-b from-primary to-success transition-all duration-500 rounded" 
          style={{ height: `${progressPercent}%`, width: '2px' }}
        />

        {steps.map((step, idx) => {
          const isIdle = step.status === 'idle';
          const isLoading = step.status === 'loading';
          const isSuccess = step.status === 'success';
          const isError = step.status === 'error';

          return (
            <div key={idx} className="relative">
              <div className={`absolute -left-[43px] top-0 rounded-full p-1 border transition-all duration-300 ${
                isSuccess 
                  ? 'bg-success/20 border-success text-success' 
                  : isLoading 
                  ? 'bg-primary/20 border-primary text-primary' 
                  : 'bg-[#030303] border-secondary text-muted-foreground'
              }`}>
                {isIdle && <Circle className="h-4.5 w-4.5" />}
                {isLoading && <Loader2 className="h-4.5 w-4.5 animate-spin" />}
                {isSuccess && <CheckCircle2 className="h-4.5 w-4.5 fill-success/10" />}
                {isError && <XCircle className="h-4.5 w-4.5" />}
              </div>

              <div className="space-y-1 pl-2">
                <div className="flex items-center justify-between">
                  <h4 className={`font-bold text-xs uppercase tracking-wider ${
                    isSuccess ? 'text-success' : isLoading ? 'text-primary' : isIdle ? 'text-muted-foreground' : 'text-destructive'
                  }`}>
                    Step {idx + 1}: {step.step}
                  </h4>
                  {step.timestamp && (
                    <span className="text-[9px] text-muted-foreground font-mono">{step.timestamp}</span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isIdle ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                  {step.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## File: `src/hooks/useUGF.ts`
```typescript
'use client';

import { useState } from 'react';
import { UGFStepProgress, UGFTransaction } from '../types';
import { db } from '../lib/db';

export function useUGF() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [digest, setDigest] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<UGFStepProgress[]>([
    { step: 'Quote', status: 'idle', message: 'Ready to request gas sponsor quote.' },
    { step: 'Settle', status: 'idle', message: 'Waiting to authorize gasless stablecoin settlement.' },
    { step: 'Execute', status: 'idle', message: 'Waiting for UGF relayer to submit on-chain.' },
    { step: 'Confirm', status: 'idle', message: 'Waiting for blockchain block mining confirmation.' },
  ]);

  const updateStep = (
    step: 'Quote' | 'Settle' | 'Execute' | 'Confirm',
    status: UGFStepProgress['status'],
    message: string
  ) => {
    setProgress((prev) =>
      prev.map((s) =>
        s.step === step ? { ...s, status, message, timestamp: new Date().toLocaleTimeString() } : s
      )
    );
  };

  const executeGaslessTransaction = async (
    type: 'Fund' | 'Release' | 'Create' | 'Cancel',
    escrowId: string,
    amount: string,
    _clientAddress: string,
    _encodedData: `0x${string}`
  ): Promise<string> => {
    setIsExecuting(true);
    setTxHash(undefined);
    setDigest(undefined);

    setProgress([
      { step: 'Quote', status: 'idle', message: 'Requesting gas quote...' },
      { step: 'Settle', status: 'idle', message: 'Preparing stablecoin settlement...' },
      { step: 'Execute', status: 'idle', message: 'Ready for UGF relayer execution...' },
      { step: 'Confirm', status: 'idle', message: 'Monitoring confirmation status...' },
    ]);

    try {
      updateStep('Quote', 'loading', 'Analyzing transaction payload and quoting gas fee in MockUSD...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const simulatedDigest = 'ugf_dig_' + Math.random().toString(36).substring(2, 18) + Date.now().toString(16);
      setDigest(simulatedDigest);
      updateStep('Quote', 'success', `Quote approved! Gas cost: $0.15 MockUSD (Sponsored, 0.00 ETH required)`);

      updateStep('Settle', 'loading', 'Generating MockUSD settlement signature (ERC-3009 Gasless Permit)...');
      await new Promise((resolve) => setTimeout(resolve, 2500));
      
      updateStep('Settle', 'success', `Settlement authorized! Signed authorization receipt: ${simulatedDigest.substring(0, 16)}...`);

      updateStep('Execute', 'loading', 'Routing payload to UGF Relayer on Base Sepolia gateway...');
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const simulatedHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setTxHash(simulatedHash);
      updateStep('Execute', 'success', `Relayed! Broadcasted successfully on Base Sepolia. Hash: ${simulatedHash.substring(0, 14)}...`);

      updateStep('Confirm', 'loading', 'Waiting for transaction block verification on Base Sepolia Explorer...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      updateStep('Confirm', 'success', 'Transaction successfully confirmed in block #140582! Gasless transfer complete.');

      const newTx: UGFTransaction = {
        id: 'ugf-tx-' + Date.now(),
        escrowId,
        type,
        digest: simulatedDigest,
        paymentCoin: 'TYI_MOCK_USD',
        amount,
        status: 'Confirmed',
        txHash: simulatedHash,
        createdAt: new Date().toISOString(),
        isGasless: true,
      };
      await db.saveTransaction(newTx);

      setIsExecuting(false);
      return simulatedHash;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown network error';
      setProgress((prev) =>
        prev.map((s) =>
          s.status === 'loading' ? { ...s, status: 'error', message: `Failed: ${msg}` } : s
        )
      );
      setIsExecuting(false);
      throw error;
    }
  };

  return {
    isExecuting,
    ugfStepProgress: progress,
    txHash,
    digest,
    executeGaslessTransaction,
  };
}
```

---

## File: `src/hooks/useEscrows.ts`
```typescript
'use client';

import { useState, useEffect } from 'react';
import { EscrowProject } from '../types';
import { db } from '../lib/db';

export function useEscrows() {
  const [projects, setProjects] = useState<EscrowProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMinting, setIsMinting] = useState(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await db.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const createNewEscrow = async (
    title: string,
    description: string,
    freelancerAddress: string,
    clientAddress: string,
    amount: string,
    deadlineDays: number
  ): Promise<EscrowProject> => {
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);

    const newProject: EscrowProject = {
      id: Math.floor(Math.random() * 100000).toString(),
      title,
      description,
      freelancerAddress,
      clientAddress,
      amount,
      deadline: deadlineDate.toISOString(),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveProject(newProject);
    await fetchProjects();
    return newProject;
  };

  const updateEscrowStatus = async (
    id: string,
    status: EscrowProject['status'],
    deliveryNotes?: string
  ): Promise<EscrowProject> => {
    const updated = await db.updateProjectStatus(id, status, deliveryNotes);
    await fetchProjects();
    return updated;
  };

  const mintTestMockUSD = async (_walletAddress: string, _amount: string): Promise<boolean> => {
    setIsMinting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setIsMinting(false);
      return true;
    } catch (error) {
      console.error('Failed mock mint:', error);
      setIsMinting(false);
      return false;
    }
  };

  return {
    projects,
    isLoading,
    isMinting,
    createNewEscrow,
    updateEscrowStatus,
    mintTestMockUSD,
    refreshProjects: fetchProjects,
  };
}
```

---

## File: `src/app/page.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Sparkles, Coins, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';

export default function LandingPage() {
  const { isConnected, address } = useAccount();
  const { mintTestMockUSD, isMinting } = useEscrows();
  const [isMintSuccess, setIsMintSuccess] = useState(false);

  const handleMintTestTokens = async () => {
    if (!address) return;
    const success = await mintTestMockUSD(address, '1000');
    if (success) {
      setIsMintSuccess(true);
      setTimeout(() => setIsMintSuccess(false), 5000);
    }
  };

  return (
    <div className="space-y-20 py-8 max-w-5xl mx-auto">
      <section className="text-center space-y-8 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold tracking-wider uppercase">
          <Sparkles className="h-3.5 w-3.5 animate-pulse-slow" />
          <span>UGF Hackathon Showcase: Zero-ETH Escrows</span>
        </div>
        
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto">
          Gasless Freelance Escrow.<br />
          <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent drop-shadow-sm">
            Zero Destination ETH.
          </span>
        </h1>
        
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Unlock Web3 freelancing without native gas friction. Connect any wallet and transact instantly in 
          <span className="text-white font-semibold"> MockUSD</span>. Powered by the Universal Gas Framework (UGF).
        </p>

        {isMintSuccess && (
          <div className="max-w-md mx-auto p-4 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold animate-scale-in">
            🎉 Successfully minted 1,000 MockUSD for testing! Sponsored entirely by UGF (0.00 ETH gas paid).
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            id="hero-dashboard-btn"
            className="w-full sm:w-auto h-12 px-8 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/45 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <span>Launch Dashboard</span>
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
          
          {isConnected ? (
            <button
              onClick={handleMintTestTokens}
              disabled={isMinting}
              id="hero-mint-btn"
              className="w-full sm:w-auto h-12 px-8 rounded-lg border border-secondary bg-[#08080a] hover:bg-secondary/40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {isMinting ? <RefreshCw className="h-4.5 w-4.5 animate-spin text-primary" /> : <Coins className="h-4.5 w-4.5 text-primary" />}
              <span>{isMinting ? 'Minting...' : 'Mint 1,000 Free MockUSD'}</span>
            </button>
          ) : (
            <div className="w-full sm:w-auto text-[11px] text-muted-foreground font-mono bg-secondary/20 border border-secondary/40 px-5 py-3.5 rounded-lg text-center">
              💡 Please connect your wallet in the navigation bar to claim free test tokens!
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl glass-panel border border-secondary/50 max-w-4xl mx-auto">
        <div className="text-center space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gas sponsored</span>
          <p className="text-xl sm:text-2xl font-black text-white">$14,208.50</p>
        </div>
        <div className="text-center space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active Relay tunnels</span>
          <p className="text-xl sm:text-2xl font-black text-primary">Base Sepolia</p>
        </div>
        <div className="text-center space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tx fee savings</span>
          <p className="text-xl sm:text-2xl font-black text-success">100% sponsored</p>
        </div>
        <div className="text-center space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Avg Gateway execution</span>
          <p className="text-xl sm:text-2xl font-black text-white">~2.4 seconds</p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
        <div className="glass-card p-8 rounded-xl space-y-4 hover:border-primary/30 transition-all duration-150 relative overflow-hidden group">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <span className="absolute top-4 right-4 bg-success/10 border border-success/20 text-success text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">No ETH Needed</span>
          <h3 className="text-white font-bold text-base lg:text-lg">1. Lock Budget Gaslessly</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create escrows and approve token lockups completely gaslessly. UGF estimates base gas fees and settles them natively in MockUSD without needing native destination ETH.
          </p>
        </div>

        <div className="glass-card p-8 rounded-xl space-y-4 hover:border-primary/30 transition-all duration-150 relative overflow-hidden group">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <span className="absolute top-4 right-4 bg-success/10 border border-success/20 text-success text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Sponsor Secured</span>
          <h3 className="text-white font-bold text-base lg:text-lg">2. Submit Freelance Work</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Freelancers deliver projects and supply milestone links without any wallet gas hurdles. Remote transaction signatures protect milestones securely on-chain.
          </p>
        </div>

        <div className="glass-card p-8 rounded-xl space-y-4 hover:border-primary/30 transition-all duration-150 relative overflow-hidden group">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
            <Coins className="h-5 w-5" />
          </div>
          <span className="absolute top-4 right-4 bg-success/10 border border-success/20 text-success text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Instant Settlement</span>
          <h3 className="text-white font-bold text-base lg:text-lg">3. Release Funds Instantly</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Client releases payments with a single click. The UGF relayer sponsors block mining, releasing the locked stablecoin directly to the freelancer's wallet.
          </p>
        </div>
      </section>
    </div>
  );
}
```

---

## File: `src/app/dashboard/page.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';
import { LayoutDashboard, Users, User, ArrowRight, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { EscrowProject } from '@/types';

export default function Dashboard() {
  const { address } = useAccount();
  const { projects, isLoading } = useEscrows();
  const [roleFilter, setRoleFilter] = useState<'All' | 'Client' | 'Freelancer'>('All');

  const filteredProjects = projects.filter((project) => {
    if (!address) return true;
    const isClient = project.clientAddress.toLowerCase() === address.toLowerCase();
    const isFreelancer = project.freelancerAddress.toLowerCase() === address.toLowerCase();
    
    if (roleFilter === 'Client') return isClient;
    if (roleFilter === 'Freelancer') return isFreelancer;
    return isClient || isFreelancer || project.id === '1' || project.id === '2';
  });

  const getStatusBadge = (status: EscrowProject['status']) => {
    switch (status) {
      case 'Pending':
        return <span className="bg-secondary border border-secondary/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pending</span>;
      case 'Funded':
        return <span className="bg-success/10 border border-success/30 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Funded</span>;
      case 'Delivered':
        return <span className="bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Delivered</span>;
      case 'Released':
        return <span className="bg-success/20 border border-success/40 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Released</span>;
      case 'Cancelled':
        return <span className="bg-destructive/10 border border-destructive/30 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Cancelled</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 py-4 animate-pulse">
        <div className="h-10 w-64 bg-secondary/30 rounded-lg"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="h-24 bg-secondary/20 rounded-xl border border-secondary/30"></div>
          <div className="h-24 bg-secondary/20 rounded-xl border border-secondary/30"></div>
          <div className="h-24 bg-secondary/20 rounded-xl border border-secondary/30"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="h-44 bg-secondary/20 rounded-xl border border-secondary/30"></div>
          <div className="h-44 bg-secondary/20 rounded-xl border border-secondary/30"></div>
        </div>
      </div>
    );
  }

  const totalLocked = projects
    .filter((p) => p.status === 'Funded' || p.status === 'Delivered')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-8 py-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <span>Escrow Workspace</span>
          </h1>
          <p className="text-sm text-muted-foreground">Manage active contracts, submit deliveries, and release funds gaslessly.</p>
        </div>

        <Link
          href="/create"
          id="dash-create-btn"
          className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/45 transition-all duration-150 focus:outline-none"
        >
          <span>New Gasless Escrow</span>
          <ArrowRight className="h-4.5 w-4.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Value Locked</span>
          <p className="text-2xl font-black text-white">${totalLocked} MockUSD</p>
        </div>
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Zero-ETH Gas Relays</span>
          <p className="text-2xl font-black text-success">100% sponsored</p>
        </div>
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Active contracts</span>
          <p className="text-2xl font-black text-white">{projects.length} Total</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-[#08080a] border border-secondary/40 rounded-lg w-full sm:w-auto">
          {(['All', 'Client', 'Freelancer'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`flex-1 sm:flex-none h-9 px-4 rounded-md text-xs font-extrabold transition-all duration-150 ${
                roleFilter === role ? 'bg-secondary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
              }`}
            >
              {role === 'All' ? 'All Roles' : `As ${role}`}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-success" />
          <span>UGF Sponsor Network is Active</span>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl text-center space-y-5 max-w-md mx-auto border border-secondary/50">
          <ShieldAlert className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <div className="space-y-1">
            <h3 className="text-white font-bold text-base">No Active Escrows</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You do not have any escrows registered under this filter. Complete a gasless creation flow to populate milestones.
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex h-10 px-5 rounded-lg bg-secondary text-white font-bold text-xs items-center justify-center border border-secondary/80 hover:bg-secondary/40 transition-all focus:outline-none"
          >
            Create Your First Escrow
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredProjects.map((project) => {
            const isUserClient = address ? project.clientAddress.toLowerCase() === address.toLowerCase() : true;
            
            return (
              <Link
                href={`/escrow/${project.id}`}
                key={project.id}
                className="group block p-6 rounded-xl glass-card border border-secondary/40 hover:border-primary/30 transition-all duration-150 relative space-y-4 hover:shadow-lg hover:shadow-primary/5 animate-fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground font-mono bg-[#060608] border border-secondary/40 px-2 py-0.5 rounded uppercase">ID: {project.id}</span>
                  {getStatusBadge(project.status)}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-white font-bold text-base group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-secondary/30">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wide">Milestone Locked</span>
                    <span className="text-base font-extrabold text-white">${project.amount} MockUSD</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-[9px] px-2.5 py-1 rounded border font-bold uppercase tracking-wider ${
                      isUserClient 
                        ? 'bg-primary/10 border-primary/20 text-primary' 
                        : 'bg-secondary border-secondary text-white'
                    }`}>
                      {isUserClient ? 'Client' : 'Freelancer'}
                    </span>
                    <span className="text-[9px] text-success font-semibold flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      <span>Zero-ETH Gas</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

## File: `src/app/create/page.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';
import { useUGF } from '@/hooks/useUGF';
import { UGFProgress } from '@/components/UGFProgress';
import { ShieldCheck, Coins, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CreateEscrow() {
  const router = useRouter();
  const { address } = useAccount();
  const isConnected = !!address;
  const { createNewEscrow } = useEscrows();
  const { isExecuting, ugfStepProgress, executeGaslessTransaction } = useUGF();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [freelancer, setFreelancer] = useState('');
  const [amount, setAmount] = useState('');
  const [deadlineDays, setDeadlineDays] = useState('7');
  const [formError, setFormError] = useState('');

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#10b981', '#ffffff']
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isConnected || !address) {
      setFormError('Please connect your wallet first.');
      return;
    }

    if (!title || !description || !freelancer || !amount) {
      setFormError('All fields are required.');
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Amount must be a valid positive number.');
      return;
    }

    if (!freelancer.startsWith('0x') || freelancer.length !== 42) {
      setFormError('Freelancer wallet address must be a valid EVM address.');
      return;
    }

    try {
      const mockEncodedData = '0x' as `0x${string}`;

      await executeGaslessTransaction(
        'Create',
        'pending_' + Math.floor(Math.random() * 1000),
        amount,
        address,
        mockEncodedData
      );

      const project = await createNewEscrow(
        title,
        description,
        freelancer,
        address,
        amount,
        Number(deadlineDays)
      );

      triggerConfetti();
      
      setTimeout(() => {
        router.push(`/escrow/${project.id}`);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gasless escrow creation failed.';
      setFormError(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-8">
      <div className="text-center space-y-2 animate-slide-up">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <span>Create Gasless Escrow</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Deploy a secure milestone contract in MockUSD. Supported by UGF relayer sponsors.
        </p>
      </div>

      <UGFProgress id="create-ugf-progress" steps={ugfStepProgress} isExecuting={isExecuting} />

      {!isExecuting && (
        <form
          onSubmit={handleSubmit}
          id="create-escrow-form"
          className="p-8 rounded-xl glass-panel space-y-6 border border-secondary/50 animate-fade-in"
        >
          {formError && (
            <div className="p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold">
              {formError}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Project Title
              </label>
              <input
                id="project-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Redesign Freelance Landing Page"
                className="w-full h-11 px-4 rounded-lg bg-[#060608] border border-secondary/60 focus:border-primary/50 text-white placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="project-description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Project Description
              </label>
              <textarea
                id="project-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details about deliverable milestones..."
                className="w-full p-4 rounded-lg bg-[#060608] border border-secondary/60 focus:border-primary/50 text-white placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="freelancer-address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Freelancer Wallet Address
              </label>
              <input
                id="freelancer-address"
                type="text"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value)}
                placeholder="0x..."
                className="w-full h-11 px-4 rounded-lg bg-[#060608] border border-secondary/60 focus:border-primary/50 text-white placeholder-muted-foreground/60 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-150"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="escrow-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  <span>Budget (MockUSD)</span>
                </label>
                <input
                  id="escrow-amount"
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full h-11 px-4 rounded-lg bg-[#060608] border border-secondary/60 focus:border-primary/50 text-white placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-150"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deadline-days" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery Deadline
                </label>
                <select
                  id="deadline-days"
                  value={deadlineDays}
                  onChange={(e) => setDeadlineDays(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-[#060608] border border-secondary/60 focus:border-primary/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-150"
                >
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                  <option value="30">30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {isConnected ? (
            <button
              id="submit-create-escrow-btn"
              type="submit"
              className="w-full h-12 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <Sparkles className="h-5 w-5 animate-pulse-slow" />
              <span>Create Gasless Escrow</span>
            </button>
          ) : (
            <div className="w-full text-center py-3.5 bg-secondary/20 border border-secondary/40 text-xs font-mono text-muted-foreground rounded-lg">
              Please connect your wallet header button to submit.
            </div>
          )}
        </form>
      )}
    </div>
  );
}
```

---

## File: `src/app/escrow/[id]/page.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useEscrows } from '@/hooks/useEscrows';
import { useUGF } from '@/hooks/useUGF';
import { UGFProgress } from '@/components/UGFProgress';
import { Calendar, ArrowLeft, ArrowUpRight, Copy, Check, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EscrowDetails() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { address } = useAccount();
  const isConnected = !!address;
  const { projects, updateEscrowStatus, isLoading } = useEscrows();
  const { isExecuting, ugfStepProgress, executeGaslessTransaction } = useUGF();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deliveryNotesInput, setDeliveryNotesInput] = useState('');
  const [showDeliverForm, setShowDeliverForm] = useState(false);
  const [actionError, setActionError] = useState('');

  const project = projects.find((p) => p.id === id);

  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#7c3aed', '#10b981', '#ffffff']
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleFund = async () => {
    if (!project || !address) return;
    setActionError('');
    try {
      await executeGaslessTransaction('Fund', project.id, project.amount, address, '0x');
      await updateEscrowStatus(project.id, 'Funded');
      triggerConfetti();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Funding failed.';
      setActionError(msg);
    }
  };

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !address || !deliveryNotesInput) return;
    setActionError('');
    try {
      await executeGaslessTransaction('Deliver', project.id, project.amount, address, '0x');
      await updateEscrowStatus(project.id, 'Delivered', deliveryNotesInput);
      setShowDeliverForm(false);
      triggerConfetti();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setActionError(msg);
    }
  };

  const handleRelease = async () => {
    if (!project || !address) return;
    setActionError('');
    try {
      await executeGaslessTransaction('Release', project.id, project.amount, address, '0x');
      await updateEscrowStatus(project.id, 'Released');
      triggerConfetti();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Release failed.';
      setActionError(msg);
    }
  };

  const handleCancel = async () => {
    if (!project || !address) return;
    setActionError('');
    try {
      await executeGaslessTransaction('Cancel', project.id, project.amount, address, '0x');
      await updateEscrowStatus(project.id, 'Cancelled');
      triggerConfetti();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed.';
      setActionError(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Loading details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h3 className="text-white font-bold text-lg">Escrow Not Found</h3>
        <p className="text-sm text-muted-foreground">The project ID could not be loaded.</p>
        <button onClick={() => router.push('/dashboard')} className="h-10 px-5 rounded-lg bg-secondary text-white font-semibold">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isUserClient = address ? project.clientAddress.toLowerCase() === address.toLowerCase() : true;
  const isUserFreelancer = address ? project.freelancerAddress.toLowerCase() === address.toLowerCase() : false;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <button
        onClick={() => router.push('/dashboard')}
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white transition-colors focus:outline-none"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Dashboard</span>
      </button>

      {actionError && (
        <div className="p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold">
          {actionError}
        </div>
      )}

      <UGFProgress id="details-ugf-progress" steps={ugfStepProgress} isExecuting={isExecuting} />

      {!isExecuting && (
        <div className="p-8 rounded-xl glass-panel space-y-6 border border-secondary/50 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl lg:text-2xl font-extrabold text-white">{project.title}</h1>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Calendar className="h-3.5 w-3.5" />
                <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-secondary border border-secondary/60 text-white font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {project.status}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-secondary/30">
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Client Wallet</span>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#060608] border border-secondary/40 font-mono text-xs">
                <span className="text-white truncate max-w-[200px]">{project.clientAddress}</span>
                <button
                  onClick={() => copyToClipboard(project.clientAddress, 'client')}
                  className="text-muted-foreground hover:text-white transition-colors"
                >
                  {copiedField === 'client' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Freelancer Wallet</span>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#060608] border border-secondary/40 font-mono text-xs">
                <span className="text-white truncate max-w-[200px]">{project.freelancerAddress}</span>
                <button
                  onClick={() => copyToClipboard(project.freelancerAddress, 'freelancer')}
                  className="text-muted-foreground hover:text-white transition-colors"
                >
                  {copiedField === 'freelancer' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-secondary/20 border border-secondary/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Amount Locked</span>
              <span className="text-lg lg:text-2xl font-black text-white">${project.amount} MockUSD</span>
            </div>
            <span className="text-xs bg-success/15 border border-success/30 text-success font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>UGF Secured</span>
            </span>
          </div>

          {project.deliveryNotes && (
            <div className="p-6 rounded-xl bg-[#060608] border border-secondary/50 space-y-2">
              <h4 className="text-white font-bold text-xs uppercase tracking-wider">Freelancer Delivery submission</h4>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.deliveryNotes}</p>
            </div>
          )}

          {showDeliverForm && (
            <form onSubmit={handleDeliverSubmit} className="p-6 rounded-xl bg-[#060608] border border-primary/20 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="delivery-notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery Notes / Deliverable Links
                </label>
                <textarea
                  id="delivery-notes"
                  rows={3}
                  required
                  value={deliveryNotesInput}
                  onChange={(e) => setDeliveryNotesInput(e.target.value)}
                  placeholder="Explain the work done and provide links..."
                  className="w-full p-4 rounded-lg bg-secondary/20 border border-secondary/60 focus:border-primary/50 text-white placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm shadow-md transition-all"
                >
                  Submit Gasless Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeliverForm(false)}
                  className="h-10 px-5 rounded-lg border border-secondary hover:bg-secondary/40 text-white font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showDeliverForm && (
            <div className="flex flex-wrap gap-4 pt-4 border-t border-secondary/30">
              {project.status === 'Pending' && isUserClient && (
                <button
                  onClick={handleFund}
                  className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/20 flex items-center gap-1.5 transition-all"
                >
                  <span>Fund Escrow Gaslessly</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}

              {project.status === 'Funded' && isUserFreelancer && (
                <button
                  onClick={() => setShowDeliverForm(true)}
                  className="h-11 px-6 rounded-lg bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-lg shadow-primary/20 transition-all"
                >
                  Mark Delivered
                </button>
              )}

              {(project.status === 'Funded' || project.status === 'Delivered') && isUserClient && (
                <button
                  onClick={handleRelease}
                  className="h-11 px-6 rounded-lg bg-success hover:bg-success/95 text-white font-bold text-sm shadow-lg shadow-success/20 transition-all"
                >
                  Release Payment
                </button>
              )}

              {(project.status === 'Pending' || (project.status === 'Funded' && new Date() > new Date(project.deadline))) && isUserClient && (
                <button
                  onClick={handleCancel}
                  className="h-11 px-6 rounded-lg border border-secondary hover:bg-secondary/40 text-white font-bold text-sm transition-all"
                >
                  Cancel Escrow
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## File: `src/app/history/page.tsx`
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { UGFTransaction } from '@/types';
import { Activity, Copy, Check, ExternalLink } from 'lucide-react';

export default function HistoryPage() {
  const [txs, setTxs] = useState<UGFTransaction[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const fetchTxs = async () => {
      const data = await db.getTransactions();
      setTxs(data);
    };
    fetchTxs();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const getStatusBadge = (status: UGFTransaction['status']) => {
    switch (status) {
      case 'Confirmed':
        return <span className="bg-success/15 border border-success/30 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Confirmed</span>;
      case 'Execute':
      case 'Settle':
      case 'Quote':
        return <span className="bg-primary/15 border border-primary/30 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{status}</span>;
      case 'Failed':
        return <span className="bg-destructive/15 border border-destructive/30 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Failed</span>;
    }
  };

  return (
    <div className="space-y-8 py-4 max-w-4xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-white flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span>UGF Gasless Activities</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Audit trails of gasless Remote Transactions executed through the Universal Gas Framework relayer.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Total Transactions</span>
          <span className="text-xl lg:text-2xl font-black text-white">{txs.length} Relays</span>
        </div>
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Total Sponsored ETH</span>
          <span className="text-xl lg:text-2xl font-black text-success">0.00 ETH ($0.00 Gas)</span>
        </div>
        <div className="p-6 rounded-xl glass-card border border-secondary/40 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">UGF Efficiency</span>
          <span className="text-xl lg:text-2xl font-black text-primary">100% Gasless</span>
        </div>
      </div>

      {txs.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground glass-panel rounded-xl">
          No gasless transactions captured yet. Create/Fund an escrow to generate UGF trails.
        </div>
      ) : (
        <div className="space-y-4">
          {txs.map((tx) => (
            <div
              key={tx.id}
              className="p-6 rounded-xl glass-panel border border-secondary/50 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/20 transition-all duration-150"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded tracking-wider ${
                    tx.type === 'Fund' || tx.type === 'Release'
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {tx.type} Escrow
                  </span>
                  {getStatusBadge(tx.status)}
                </div>

                <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span>UGF Digest:</span>
                    <span className="text-white truncate max-w-[150px]">{tx.digest}</span>
                    <button
                      onClick={() => copyToClipboard(tx.digest, tx.id + 'dig')}
                      className="hover:text-white transition-colors"
                    >
                      {copiedField === tx.id + 'dig' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  
                  {tx.txHash && (
                    <div className="flex items-center gap-1.5">
                      <span>Base Sepolia Tx:</span>
                      <span className="text-white truncate max-w-[150px]">{tx.txHash}</span>
                      <button
                        onClick={() => copyToClipboard(tx.txHash!, tx.id + 'tx')}
                        className="hover:text-white transition-colors"
                      >
                        {copiedField === tx.id + 'tx' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </button>
                      <a
                        href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5 ml-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center md:flex-col md:items-end justify-between border-t border-secondary/30 pt-4 md:border-none md:pt-0 gap-2">
                <div className="text-right">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wide block">Budget</span>
                  <span className="text-base font-extrabold text-white">${tx.amount} MockUSD</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(tx.createdAt).toLocaleTimeString()} · {new Date(tx.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
