export interface Milestone {
  id: number;
  title: string;
  amount: string;
  status: 'Pending' | 'Funded' | 'Delivered' | 'Released' | 'Cancelled' | 'Disputed';
  deliveryNotes: string;
  deliveryTime: number;
}

export interface EscrowProject {
  id: string;
  title: string;
  description: string;
  freelancerAddress: string;
  clientAddress: string;
  amount: string; // total amount locked or allocated
  deadline: string;
  status: 'Pending' | 'Funded' | 'Delivered' | 'Released' | 'Cancelled' | 'Disputed';
  milestones: Milestone[];
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
  type: 'Create' | 'Fund' | 'Deliver' | 'Release' | 'Cancel' | 'Dispute';
  digest: string;
  paymentCoin: string;
  amount: string;
  status: 'Quote' | 'Settle' | 'Execute' | 'Confirmed' | 'Failed';
  txHash?: string;
  createdAt: string;
  isGasless: boolean;
}
