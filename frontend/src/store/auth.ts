import { create } from "zustand";
import type { User } from "../types";

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
};

const storedToken = localStorage.getItem("ucc_token");
const storedUser = localStorage.getItem("ucc_user");

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  setAuth: (token, user) => {
    localStorage.setItem("ucc_token", token);
    localStorage.setItem("ucc_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("ucc_token");
    localStorage.removeItem("ucc_user");
    set({ token: null, user: null });
  },
}));
