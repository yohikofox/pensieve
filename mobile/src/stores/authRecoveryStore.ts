import { create } from 'zustand';

interface AuthRecoveryState {
  isPasswordRecovery: boolean;
  setPasswordRecovery: (value: boolean) => void;
}

export const useAuthRecoveryStore = create<AuthRecoveryState>((set) => ({
  isPasswordRecovery: false,
  setPasswordRecovery: (value) => set({ isPasswordRecovery: value }),
}));
