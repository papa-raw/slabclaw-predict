import { createContext, useContext, useState, useCallback } from 'react';

const DevWalletContext = createContext(null);

export function DevWalletProvider({ children }) {
  const [address, setAddress] = useState(null);

  const connect = useCallback((addr) => {
    setAddress(addr);
    sessionStorage.setItem('anima-dev-wallet', addr);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    sessionStorage.removeItem('anima-dev-wallet');
  }, []);

  // Restore on mount
  if (!address) {
    const saved = sessionStorage.getItem('anima-dev-wallet');
    if (saved) setAddress(saved);
  }

  return (
    <DevWalletContext.Provider value={{ address, connect, disconnect }}>
      {children}
    </DevWalletContext.Provider>
  );
}

export function useDevWallet() {
  return useContext(DevWalletContext) || { address: null, connect: () => {}, disconnect: () => {} };
}
