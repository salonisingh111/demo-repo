# EscrowX 🛡️ — Gasless Freelance Escrow Platform

EscrowX is a full-stack freelance escrow platform built using **Next.js, Tailwind CSS, TypeScript, Solidity, Wagmi, RainbowKit, Base Sepolia**, and the **Universal Gas Framework (UGF)**. 

EscrowX abstracts all blockchain complexity, enabling clients to lock payments and freelancers to deliver milestones completely gaslessly (no ETH needed) by leveraging UGF remote transactions settled in `MockUSD`.

---

## 🚀 Key Features

1. **Fully Gasless Funding & Execution**: Transact gaslessly on Base Sepolia using UGF without needing destination chain ETH.
2. **Interactive UGF Progress Visualizer**: A beautiful step-by-step HUD tracking Quote ➔ Settle ➔ Execute ➔ Confirm status in real-time.
3. **Sleek SaaS Fiverr-Inspired Dashboard**: Modern, card-based interface with role badges allowing seamless perspectives toggling (Client vs. Freelancer).
4. **Official UGF SDK Integration**: Leverages both `@tychilabs/ugf-testnet-js` for background relayers and `@tychilabs/react-ugf` for gasless payment permits.
5. **Unified Supabase & Fallback Sync**: Resilient storage sync combining database integrations with a client-side localStorage fallback to guarantee 100% functionality out-of-the-box.

---

## 📂 Project Architecture

```
escrowx/
├── contracts/                   # Solidity Smart Contracts
│   ├── EscrowManager.sol        # Core Escrow locking logic
│   └── MockUSD.sol              # ERC20 MockUSD token with public minting
├── src/
│   ├── app/                     # Next.js App Router Router Pages
│   │   ├── layout.tsx           # Providers (Wagmi, RainbowKit, UGF, Theme)
│   │   ├── page.tsx             # Landing Page
│   │   ├── dashboard/           # Escrow Dashboard (Client/Freelancer Views)
│   │   ├── create/              # Create Escrow Form
│   │   ├── escrow/              # Escrow Details & Progress Visualizer
│   │   └── history/             # Transaction History & UGF Log Viewer
│   ├── components/              # Reusable UI Components
│   │   ├── Navbar.tsx           # Wallet Connect Header Navigation
│   │   └── UGFProgress.tsx      # Real-time UGF Execution progress HUD
│   ├── hooks/                   # Custom Hooks
│   │   ├── useUGF.ts            # Manages UGF transactional lifecycle
│   │   └── useEscrows.ts        # Interfaces with contracts & Supabase metadata
│   ├── lib/                     # Utilities & API
│   │   ├── db.ts                # Unified database client with localStorage fallback
│   │   └── constants.ts         # Deployed addresses & contract ABIs
│   └── types/                   # Strict TypeScript type models
├── .env.example                 # Environment variables template
└── README.md                    # Complete setup guide and UGF SDK examples
```

---

## 🛠️ Step-by-Step Installation Guide

### 1. Clone & Set Active Directory
Ensure your terminal directory points directly to `escrowx`:
```bash
cd escrowx
```

### 2. Install Project Dependencies
Use `npm` with legacy peer dependency resolution for wagmi compatibility:
```bash
npm install --legacy-peer-deps
```

### 3. Setup Environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Boot Up the Development Server
Run the local next.js server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to experience EscrowX!

---

## 📜 Deployed Base Sepolia Smart Contracts

* **MockUSD Token Address**: `0x98A196144e59f49377B6343C1D0694bA1C5DbE6F` (Supports public faucet `mint(address to, uint256 amount)` for testing)
* **EscrowManager Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

---

## 🦄 Official UGF SDK Transaction Lifecycle Code Integration

Here is the exact implementation structure used in `useUGF.ts` to request a quote, settle in MockUSD, execute on-chain remotely, and confirm block inclusion using the official `@tychilabs/ugf-testnet-js` library:

```typescript
import { UGFClient } from "@tychilabs/ugf-testnet-js";
import { ethers } from "ethers";

// 1. Initialize UGF Client Gateway
const ugfClient = new UGFClient({
  baseUrl: "https://gateway.universalgasframework.com",
});

// 2. Request sponsored Gas Quote for the transaction
const quote = await ugfClient.quote.get({
  payment_coin: "TYI_MOCK_USD", // Settled gasless using testnet MockUSD
  payer_address: wallet.address,
  payment_chain: "8453",        // Base Sepolia
  payment_chain_type: "evm",
  tx_object: JSON.stringify({
    from: wallet.address,
    to: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Escrow contract
    data: encodedFunctionData,   // e.g. fundEscrow(escrowId)
    value: "0",
  }),
  dest_chain_id: "8453",
  dest_chain_type: "evm",
});

// 3. Settle gasless permit authorize payload (ERC-3009 signature)
await ugfClient.payment.x402.execute({
  quote,
  signer: wallet,
  token: "TYI_MOCK_USD",
});

// 4. Remote Execution by Relayer
await ugfClient.chains.evm.execute({
  quote,
  signer: wallet,
});

// 5. Poll verification until block confirmation is mined
const status = await ugfClient.status.poll(quote.digest);
console.log("Transaction is completed: ", status);
```

---

## 🏆 Demonstration Walkthrough (ETH-Free Sandbox)

To demonstrate the full gas abstraction power of EscrowX:
1. **Connect a fresh wallet** containing exactly `0.00` ETH.
2. Click **Mint 1,000 Free MockUSD** on the Landing Page. The transaction finishes in seconds.
3. Head to **New Escrow**, type details, and hit **Create Gasless Escrow**.
4. The dashboard lists your contract. Click **Fund Escrow**. The **UGF Gasless Tunnel** opens in real-time, executing Quote ➔ Settle ➔ Execute ➔ Confirm steps flawlessly using only MockUSD. No Metamask ETH alerts!
5. View activity records showing your gasless UGF blockchain digests in the **Activity Logs** page!
