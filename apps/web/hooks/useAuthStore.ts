import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  avatar_url: string | null;
  has_google?: boolean;
  has_github?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  chatSessionCount: number;

  setToken: (token: string) => void;
  fetchUser: () => Promise<void>;
  logout: () => void;
  incrementChatSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      isAuthenticated: false,
      chatSessionCount: 0,

      setToken: (token: string) => {
        api.setToken(token);
        set({ token, isAuthenticated: true });
      },

      fetchUser: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true });
        try {
          api.setToken(token);
          const user = await api.getMe();
          set({
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatar_url || undefined,
              avatar_url: user.avatar_url,
              has_google: user.has_google,
              has_github: user.has_github,
            },
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({ token: null, user: null, isAuthenticated: false, isLoading: false });
          api.clearToken();
        }
      },

      logout: () => {
        api.clearToken();
        set({ token: null, user: null, isAuthenticated: false, chatSessionCount: 0 });
      },

      incrementChatSession: () => {
        set((state) => ({ chatSessionCount: state.chatSessionCount + 1 }));
      },
    }),
    {
      name: "neuralflow-auth",
      partialize: (state) => ({ token: state.token, chatSessionCount: state.chatSessionCount }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.setToken(state.token);
          state.fetchUser();
        }
      },
    }
  )
);
