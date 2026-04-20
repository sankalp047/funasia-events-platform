import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import {
  ChevronDown, ArrowRight, Check, Calendar, Users,
  BarChart2, CreditCard, Mail, Globe, Zap, X,
} from "lucide-react";
import useAuthStore from "../../hooks/useAuthStore";

const FEATURES = [
  {
    icon: Calendar,
    title: "Easy Event Creation",
    desc: "Build your event page in minutes. Add images, descriptions, ticket tiers, and food options with our intuitive wizard.",
  },
  {
    icon: Users,
    title: "Attendee Management",
    desc: "Track registrations, manage check-ins with barcodes, and communicate with your attendees all in one place.",
  },
  {
    icon: BarChart2,
    title: "Real-time Analytics",
    desc: "Watch ticket sales roll in live. Revenue breakdowns, attendance tracking, and downloadable reports.",
  },
  {
    icon: CreditCard,
    title: "Fast Payouts",
    desc: "Connect your bank account via Stripe. Funds hit your account automatically after your event.",
  },
  {
    icon: Mail,
    title: "Automated Emails",
    desc: "Confirmation emails with unique barcodes sent instantly. Online event links delivered the day before.",
  },
  {
    icon: Globe,
    title: "Online & In-Person",
    desc: "Host live events or virtual experiences. FunAsia handles both with meeting link delivery built in.",
  },
];

const STATS = [
  { value: "10,000+", label: "Events hosted" },
  { value: "$2M+", label: "Tickets sold" },
  { value: "50+", label: "Texas cities" },
  { value: "99.9%", label: "Uptime" },
];

export default function OrganizerLandingPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleGetStarted = () => {
    if (!user) {
      navigate("/login?next=/organizer/onboarding");
    } else {
      navigate("/organizer/onboarding");
    }
  };

  return (
    <div className="min-h-screen bg-white font-body">

      {/* ── Organizer Nav ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo + home link */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🎪</span>
            <span className="font-display text-xl font-extrabold text-brand-text">
              Fun<span className="text-brand-accent">Asia</span>
            </span>
            <span className="hidden sm:inline text-xs text-brand-textLight font-medium ml-1 border-l border-brand-border pl-3">
              For Organizers
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {/* Features dropdown */}
            <div className="relative">
              <button
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm text-brand-textMid hover:text-brand-text hover:bg-brand-muted transition-colors font-medium">
                Features <ChevronDown size={14} className={`transition-transform ${featuresOpen ? "rotate-180" : ""}`} />
              </button>
              {featuresOpen && (
                <div className="absolute top-11 left-0 w-80 bg-white border border-brand-border rounded-xl shadow-xl p-4 z-50">
                  <p className="text-[10px] uppercase tracking-wider text-brand-textLight font-semibold mb-3">Coming soon</p>
                  {FEATURES.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3 p-2 rounded-lg hover:bg-brand-muted transition-colors mb-1">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <Icon size={15} className="text-brand-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-text">{title}</p>
                        <p className="text-xs text-brand-textLight leading-snug">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link to="/organizer/pricing"
              className="px-4 py-2 rounded-lg text-sm text-brand-textMid hover:text-brand-text hover:bg-brand-muted transition-colors font-medium">
              Pricing
            </Link>
            <a href="mailto:sales@funasia.events"
              className="px-4 py-2 rounded-lg text-sm text-brand-textMid hover:text-brand-text hover:bg-brand-muted transition-colors font-medium">
              Contact Sales
            </a>
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <button onClick={handleGetStarted}
                className="px-5 py-2 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-brand-textMid hover:text-brand-text hover:bg-brand-muted transition-colors">
                  Log in
                </Link>
                <button onClick={handleGetStarted}
                  className="px-5 py-2 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors">
                  Get started
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 text-brand-textMid rounded-lg hover:bg-brand-muted">
            {mobileNavOpen ? <X size={22} /> : <ChevronDown size={22} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-brand-border bg-white p-4 space-y-1">
            <Link to="/organizer/pricing" onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">Pricing</Link>
            <a href="mailto:sales@funasia.events" onClick={() => setMobileNavOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">Contact Sales</a>
            {!user && (
              <Link to="/login" onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm text-brand-textMid hover:bg-brand-muted">Log in</Link>
            )}
            <button onClick={handleGetStarted}
              className="w-full px-4 py-3 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accentHover transition-colors text-center">
              Get started
            </button>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-4 sm:px-6 text-center"
        style={{ background: "linear-gradient(135deg, #FFF8F0 0%, #FDFAF6 60%, #FFF0F0 100%)" }}>
        <div className="max-w-3xl mx-auto relative z-10">
          <span className="inline-flex items-center gap-2 text-xs font-bold text-brand-accent bg-red-50 border border-red-100 px-3 py-1.5 rounded-full mb-6">
            <Zap size={11} fill="currentColor" /> The #1 event platform for South Asian events in Texas
          </span>

          <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-brand-text leading-tight mb-6">
            Create unforgettable<br />
            <span className="text-brand-accent">events.</span> We handle the rest.
          </h1>
          <p className="text-lg text-brand-textMid leading-relaxed mb-10 max-w-2xl mx-auto">
            FunAsia makes it simple to sell tickets, manage attendees, and get paid — whether you're hosting
            a concert, cultural festival, business summit, or online workshop.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={handleGetStarted}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-brand-accent text-white text-base font-bold hover:bg-brand-accentHover transition-all hover:shadow-lg hover:-translate-y-0.5 w-full sm:w-auto justify-center">
              Start for free <ArrowRight size={17} />
            </button>
            <Link to="/"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-brand-border text-brand-text text-base font-semibold hover:border-brand-accent transition-colors w-full sm:w-auto justify-center">
              Browse events
            </Link>
          </div>

          <p className="mt-4 text-xs text-brand-textLight">No credit card required · Free for free events</p>
        </div>

        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-50 rounded-full opacity-40 blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-50 rounded-full opacity-50 blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-brand-dark py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="font-display text-3xl font-extrabold text-white">{value}</p>
              <p className="text-sm text-stone-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-brand-text mb-4">
            Everything you need to run a successful event
          </h2>
          <p className="text-brand-textMid max-w-xl mx-auto">
            From the first ticket sold to the final check-in — FunAsia covers it all.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 bg-brand-muted rounded-2xl hover:bg-white hover:shadow-md hover:border hover:border-brand-border transition-all border border-transparent">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                <Icon size={20} className="text-brand-accent" />
              </div>
              <h3 className="font-semibold text-brand-text text-base mb-2">{title}</h3>
              <p className="text-sm text-brand-textMid leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-brand-muted py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-brand-text mb-4">
            Up and running in minutes
          </h2>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Create your account", desc: "Sign up and set up your organizer profile in under 2 minutes." },
            { step: "2", title: "Build your event", desc: "Add event details, images, ticket tiers, food options, and pricing." },
            { step: "3", title: "Publish & get paid", desc: "Go live, start selling tickets, and receive payouts directly to your bank." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-brand-accent text-white font-display text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {step}
              </div>
              <h3 className="font-semibold text-brand-text text-base mb-2">{title}</h3>
              <p className="text-sm text-brand-textMid">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's included (free tier) ── */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-bold text-brand-text mb-2">Free to get started</h2>
        <p className="text-brand-textMid mb-8">Free events are always free. Paid events have a small platform fee.</p>
        <div className="bg-brand-muted rounded-2xl p-8 text-left space-y-3">
          {[
            "Unlimited free events",
            "Up to 10 paid events per month",
            "Barcode check-in included",
            "Email confirmations with tickets",
            "Real-time sales dashboard",
            "Online & in-person support",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-brand-teal flex items-center justify-center shrink-0">
                <Check size={11} className="text-white" strokeWidth={3} />
              </div>
              <span className="text-sm text-brand-text">{item}</span>
            </div>
          ))}
        </div>
        <button onClick={handleGetStarted}
          className="mt-8 flex items-center gap-2 px-8 py-4 rounded-2xl bg-brand-accent text-white text-base font-bold hover:bg-brand-accentHover transition-all mx-auto">
          Start for free <ArrowRight size={17} />
        </button>
      </section>

      <Footer />
    </div>
  );
}
