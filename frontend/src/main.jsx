import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { createNetworkConfig } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import App from './App.jsx';
import { DevWalletProvider } from './lib/devWallet.jsx';
import './index.css';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: 'https://fullnode.testnet.sui.io',
    variables: {
      packageId: import.meta.env.VITE_PACKAGE_ID || '0xb0f9ba3da143c92225ada477204a57fd61bae3f2c5c70e8593ce29eac309da21',
      gameMapId: import.meta.env.VITE_GAME_MAP_ID || '',
    },
  },
  mainnet: {
    url: 'https://fullnode.mainnet.sui.io',
    variables: {
      packageId: import.meta.env.VITE_MAINNET_PACKAGE_ID || '',
      gameMapId: import.meta.env.VITE_MAINNET_GAME_MAP_ID || '',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <DevWalletProvider>
            <App />
          </DevWalletProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
