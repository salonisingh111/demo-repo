import { createClient } from '@supabase/supabase-js';
import { EscrowProject, UGFTransaction } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Initial dummy seed data for modern Stripe/Fiverr experience
const DEFAULT_PROJECTS: EscrowProject[] = [
  {
    id: "1",
    title: "Sleek Landing Page Redesign",
    description: "Design and implement a high-converting landing page with 3D glassmorphic elements and optimized CTA pathways in React/Tailwind.",
    clientAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    freelancerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "450",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    status: "Funded",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    title: "UGF Smart Contract Integration",
    description: "Build robust Solidity contracts, deploy on Base Sepolia, and integrate the UGF SDK into the freelance escrow application.",
    clientAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    freelancerAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    amount: "800",
    deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired
    status: "Delivered",
    deliveryNotes: "Contracts successfully compiled and deployed on Base Sepolia. Verified source code on block explorer. Ready for client inspection.",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_TRANSACTIONS: UGFTransaction[] = [
  {
    id: "tx-1",
    escrowId: "1",
    type: "Fund",
    digest: "0x89ab4c7de3ff901a084fb122849c7198d0fe1a0980ef5a8b79ca5e0321fb8442",
    paymentCoin: "TYI_MOCK_USD",
    amount: "450",
    status: "Confirmed",
    txHash: "0x84fca873523f669a918a223e7f4c56858a74e50d879201f91da6b9c9f28d8442",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isGasless: true,
  }
];

export const db = {
  getProjects: async (): Promise<EscrowProject[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*');
      if (!error) return data || [];
    }
    
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('escrowx_projects');
      if (local) return JSON.parse(local);
      localStorage.setItem('escrowx_projects', JSON.stringify(DEFAULT_PROJECTS));
    }
    return DEFAULT_PROJECTS;
  },

  saveProject: async (project: EscrowProject): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('projects').insert([project]);
    }
    if (typeof window !== 'undefined') {
      const projects = await db.getProjects();
      const existsIndex = projects.findIndex(p => p.id === project.id);
      if (existsIndex >= 0) {
        projects[existsIndex] = project;
      } else {
        projects.push(project);
      }
      localStorage.setItem('escrowx_projects', JSON.stringify(projects));
    }
  },

  updateProjectStatus: async (id: string, status: EscrowProject['status'], deliveryNotes?: string): Promise<EscrowProject> => {
    let updatedProject: EscrowProject | null = null;
    
    if (isSupabaseConfigured && supabase) {
      const updateData: Partial<EscrowProject> = { status, updatedAt: new Date().toISOString() };
      if (deliveryNotes) updateData.deliveryNotes = deliveryNotes;
      const { data } = await supabase.from('projects').update(updateData).eq('id', id).select();
      if (data && data[0]) updatedProject = data[0];
    }
    
    if (typeof window !== 'undefined') {
      const projects = await db.getProjects();
      const index = projects.findIndex(p => p.id === id);
      if (index >= 0) {
        projects[index].status = status;
        projects[index].updatedAt = new Date().toISOString();
        if (deliveryNotes) projects[index].deliveryNotes = deliveryNotes;
        updatedProject = projects[index];
        localStorage.setItem('escrowx_projects', JSON.stringify(projects));
      }
    }
    
    if (!updatedProject) throw new Error("Project not found");
    return updatedProject;
  },

  getTransactions: async (): Promise<UGFTransaction[]> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('transactions').select('*');
      if (!error) return data || [];
    }
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('escrowx_transactions');
      if (local) return JSON.parse(local);
      localStorage.setItem('escrowx_transactions', JSON.stringify(DEFAULT_TRANSACTIONS));
    }
    return DEFAULT_TRANSACTIONS;
  },

  saveTransaction: async (tx: UGFTransaction): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('transactions').insert([tx]);
    }
    if (typeof window !== 'undefined') {
      const transactions = await db.getTransactions();
      transactions.unshift(tx);
      localStorage.setItem('escrowx_transactions', JSON.stringify(transactions));
    }
  }
};
