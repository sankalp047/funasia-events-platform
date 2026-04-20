import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useAuthStore from "../hooks/useAuthStore";
import toast from "react-hot-toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";
  const { login, loginWithGoogle, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      await login({ email, password });
      toast.success("Welcome back!");
      navigate(next);
    } catch (err) {
      toast.error(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-brand-bg">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">🎪</span>
            <span className="font-display text-2xl font-extrabold text-brand-text">
              Fun<span className="text-brand-accent">Asia</span>
            </span>
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-text">Welcome back</h1>
          <p className="text-sm text-brand-textMid mt-1">Sign in to your FunAsia account</p>
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">

          {/* Google */}
          <button
            onClick={loginWithGoogle}
            className="w-full py-3 mb-5 border-2 border-brand-border rounded-xl text-brand-text font-bold text-sm hover:bg-brand-muted transition-colors flex items-center justify-center gap-2">
            <span className="text-lg font-extrabold text-blue-500">G</span> Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-brand-border" />
            <span className="text-xs text-brand-textLight">or sign in with email</span>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full px-4 py-3 bg-brand-muted border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-text mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-brand-muted border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-accent text-white font-bold text-sm hover:bg-brand-accentHover transition-colors disabled:opacity-50">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {error && <p className="text-brand-accent text-sm mt-4 text-center">{error}</p>}

          <p className="text-center text-sm text-brand-textMid mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-accent font-bold hover:underline">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
