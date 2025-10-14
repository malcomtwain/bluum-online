import { create } from 'zustand';

export type PlanType = 'free' | 'basic' | 'professional' | 'business';

interface UserPlanState {
  plan: PlanType;
  videoCredits: number;
  maxCredits: number;
  setPlan: (email: string | null | undefined) => void;
}

export const useUserPlanStore = create<UserPlanState>((set) => ({
  plan: 'free',
  videoCredits: 0,
  maxCredits: 0,
  setPlan: (email) => {
    if (!email) {
      set({ plan: 'free', videoCredits: 0, maxCredits: 0 });
      return;
    }

    // Attribution du plan business à tous les utilisateurs authentifiés
    // Maintenant que nous utilisons un système de code d'invitation,
    // tous les utilisateurs qui ont accès au site ont le plan business
    set({ plan: 'business', videoCredits: 2000, maxCredits: 2000 });
  },
})); 