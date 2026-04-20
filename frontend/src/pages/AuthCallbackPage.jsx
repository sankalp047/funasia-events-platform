import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAuthStore from "../hooks/useAuthStore";
import { supabase } from "../utils/supabase";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const done = useRef(false);

  const finalize = async (session) => {
    if (done.current) return;
    done.current = true;

    try {
      const { data: profileData } = await api.post(
        "/auth/google/session",
        {},
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      localStorage.setItem("funasia_token", session.access_token);
      localStorage.setItem("funasia_refresh_token", session.refresh_token);
      useAuthStore.setState({ user: profileData.user });
      toast.success("Signed in with Google!");
      navigate("/");
    } catch (err) {
      console.error("[AuthCallback] Profile upsert failed:", err?.response?.data || err.message);
      toast.error("Sign-in failed — could not create your profile");
      navigate("/login");
    }
  };

  useEffect(() => {
    const code = params.get("code");

    // ── Supabase PKCE flow: ?code= is in the query string ──
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (error) {
            console.error("[AuthCallback] PKCE exchange failed:", error.message);
            // Code may already be consumed — fall back to getSession
            return supabase.auth.getSession();
          }
          return { data: { session: data?.session } };
        })
        .then(({ data: { session } = {} } = {}) => {
          if (session) finalize(session);
          else {
            toast.error("Sign-in failed — no session returned");
            navigate("/login");
          }
        })
        .catch((err) => {
          console.error("[AuthCallback] Exchange error:", err);
          toast.error("Sign-in failed — please try again");
          navigate("/login");
        });
      return;
    }

    // ── Supabase implicit flow: tokens land in the URL #hash ──
    // Supabase JS auto-processes the hash via detectSessionInUrl=true.
    // Give it a brief tick to finish, then read the session.
    const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
    const hashToken = hashParams.get("access_token");

    if (hashToken || window.location.hash.includes("access_token")) {
      // Tokens are in the hash — Supabase will auto-process them.
      // Poll getSession until it resolves (usually < 200ms).
      const poll = async (attempts = 0) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          finalize(session);
        } else if (attempts < 10) {
          setTimeout(() => poll(attempts + 1), 150);
        } else {
          console.error("[AuthCallback] Timed out waiting for implicit session");
          toast.error("Sign-in timed out — please try again");
          navigate("/login");
        }
      };
      poll();
      return;
    }

    // ── No code and no hash — Supabase may have set a session anyway ──
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        finalize(session);
      } else {
        console.error("[AuthCallback] No code, no hash, no session");
        toast.error("Sign-in failed — please check Supabase redirect URL settings");
        navigate("/login");
      }
    });
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full bg-brand-accent/20 mx-auto mb-3 animate-pulse" />
        <p className="text-gray-400 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}
