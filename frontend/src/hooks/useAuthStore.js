import { create } from "zustand";
import api from "../utils/api";
import { supabase } from "../utils/supabase";

const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  error: null,

  // Initialize — check for existing session
  init: async () => {
    const token = localStorage.getItem("funasia_token");
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user, loading: false });
    } catch {
      localStorage.removeItem("funasia_token");
      localStorage.removeItem("funasia_refresh_token");
      set({ user: null, loading: false });
    }
  },

  // Send registration email OTP
  sendRegisterOtp: async (email) => {
    set({ error: null });
    try {
      await api.post("/auth/send-register-otp", { email });
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to send verification code";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // Email/password register (requires otp_code)
  register: async (formData) => {
    set({ error: null });
    try {
      const { data } = await api.post("/auth/register", formData);
      localStorage.setItem("funasia_token", data.session.access_token);
      localStorage.setItem("funasia_refresh_token", data.session.refresh_token);
      set({ user: data.user });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // Email/password login
  login: async ({ email, password }) => {
    set({ error: null });
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("funasia_token", data.session.access_token);
      localStorage.setItem("funasia_refresh_token", data.session.refresh_token);
      set({ user: data.user });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed";
      set({ error: msg });
      throw new Error(msg);
    }
  },

  // Google OAuth — initiate directly from browser so PKCE verifier stays in localStorage
  loginWithGoogle: async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      // Supabase redirects the browser automatically — nothing else to do here
    } catch (err) {
      set({ error: "Google sign-in failed" });
    }
  },

  // Phone OTP — send
  sendPhoneOtp: async (phone) => {
    try {
      await api.post("/auth/phone/otp", { phone });
      return true;
    } catch {
      set({ error: "Failed to send OTP" });
      return false;
    }
  },

  // Phone OTP — verify
  verifyPhoneOtp: async (phone, otp_code) => {
    try {
      const { data } = await api.post("/auth/phone/verify", { phone, otp_code });
      localStorage.setItem("funasia_token", data.session.access_token);
      localStorage.setItem("funasia_refresh_token", data.session.refresh_token);
      set({ user: data.user });
      return data;
    } catch {
      set({ error: "OTP verification failed" });
      throw new Error("OTP verification failed");
    }
  },

  // Update profile
  updateProfile: async (updates) => {
    try {
      const { data } = await api.patch("/auth/me", updates);
      set({ user: data.user });
      return data;
    } catch {
      set({ error: "Profile update failed" });
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Continue logout even if API fails
    }
    localStorage.removeItem("funasia_token");
    localStorage.removeItem("funasia_refresh_token");
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
