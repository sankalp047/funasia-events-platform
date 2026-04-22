import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import useAuthStore from "../hooks/useAuthStore";
import toast from "react-hot-toast";
import logo from "../logo.png";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, sendRegisterOtp, loginWithGoogle, error, clearError } = useAuthStore();

  const [step, setStep] = useState(1); // 1 = fill form, 2 = enter OTP
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Step 1 — send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      await sendRegisterOtp(form.email);
      toast.success("Verification code sent — check your inbox");
      setStep(2);
    } catch (err) {
      toast.error(err.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP and create account
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    try {
      await register({ ...form, otp_code: otp });
      toast.success("Account created! Welcome to FunAsia.");
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendRegisterOtp(form.email);
      toast.success("New code sent!");
      setOtp("");
    } catch (err) {
      toast.error(err.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-brand-bg">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <img src={logo} alt="FunAsia Entertainment" className="h-14 w-auto mx-auto" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-text">Join FunAsia</h1>
          <p className="text-sm text-brand-textMid mt-1">Create your account to start booking events</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { n: 1, label: "Your details" },
            { n: 2, label: "Verify email" },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-12 h-0.5 transition-colors ${step > 1 ? "bg-brand-teal" : "bg-brand-border"}`} />
              )}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step === n
                    ? "bg-brand-accent text-white"
                    : step > n
                    ? "bg-brand-teal text-white"
                    : "bg-brand-muted text-brand-textLight"
                }`}>
                  {step > n ? <CheckCircle size={15} /> : n}
                </div>
                <span className={`text-[10px] font-semibold ${step === n ? "text-brand-accent" : "text-brand-textLight"}`}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm">

          {step === 1 ? (
            <>
              {/* Google sign-up */}
              <button
                onClick={loginWithGoogle}
                className="w-full py-3 mb-5 border-2 border-brand-border rounded-xl text-brand-text font-bold text-sm hover:bg-brand-muted transition-colors flex items-center justify-center gap-2">
                <span className="text-lg font-extrabold text-blue-500">G</span> Sign up with Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-brand-border" />
                <span className="text-xs text-brand-textLight">or use email</span>
                <div className="flex-1 h-px bg-brand-border" />
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                {[
                  { key: "full_name", label: "Full name",        type: "text",     ph: "Your full name",    req: true  },
                  { key: "email",     label: "Email",            type: "email",    ph: "you@email.com",     req: true  },
                  { key: "phone",     label: "Phone (optional)", type: "tel",      ph: "+1 (214) 555-0100", req: false },
                  { key: "password",  label: "Password",         type: "password", ph: "Min 8 characters",  req: true  },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-semibold text-brand-text mb-1.5">{f.label}</label>
                    <input
                      type={f.type}
                      value={form[f.key]}
                      onChange={update(f.key)}
                      required={f.req}
                      placeholder={f.ph}
                      className="w-full px-4 py-3 bg-brand-muted border border-brand-border rounded-xl text-sm text-brand-text placeholder-brand-textLight outline-none focus:border-brand-accent focus:bg-white transition-colors"
                    />
                  </div>
                ))}
                <button
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-brand-accent text-white font-bold text-sm hover:bg-brand-accentHover transition-colors disabled:opacity-50">
                  {loading ? "Sending code…" : "Continue — Send Verification Code"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Step 2: OTP input */}
              <div className="flex items-start gap-3 p-4 bg-brand-muted rounded-xl mb-6">
                <div className="w-9 h-9 rounded-full bg-brand-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail size={16} className="text-brand-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-text">Check your inbox</p>
                  <p className="text-xs text-brand-textMid mt-0.5">
                    We sent a 6-digit code to <strong>{form.email}</strong>
                  </p>
                </div>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-brand-text mb-1.5">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    className="w-full px-4 py-4 bg-brand-muted border-2 border-brand-border rounded-xl text-3xl font-mono text-center tracking-[0.4em] text-brand-text placeholder-brand-border outline-none focus:border-brand-accent focus:bg-white transition-colors"
                  />
                  <p className="text-xs text-brand-textLight mt-1.5 text-center">Code expires in 10 minutes</p>
                </div>

                <button
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 rounded-xl bg-brand-accent text-white font-bold text-sm hover:bg-brand-accentHover transition-colors disabled:opacity-50">
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </form>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-brand-border">
                <button
                  onClick={() => { setStep(1); setOtp(""); clearError(); }}
                  className="flex items-center gap-1.5 text-sm text-brand-textMid hover:text-brand-text transition-colors">
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-brand-accent font-semibold hover:underline disabled:opacity-50">
                  {resending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </>
          )}

          {error && <p className="text-brand-accent text-sm mt-4 text-center">{error}</p>}

          <p className="text-center text-sm text-brand-textMid mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-accent font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
