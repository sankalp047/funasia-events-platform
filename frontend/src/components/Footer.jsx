import { Link } from "react-router-dom";
import { MapPin, Globe, Mail, Instagram, Facebook, Twitter, Youtube } from "lucide-react";

const LINKS = {
  discover: [
    { label: "Browse Events",    to: "/events" },
    { label: "Houston",          to: "/events?city=Houston" },
    { label: "Dallas",           to: "/events?city=Dallas" },
    { label: "Austin",           to: "/events?city=Austin" },
    { label: "San Antonio",      to: "/events?city=San+Antonio" },
    { label: "Online Events",    to: "/events?location=online" },
  ],
  organizers: [
    { label: "Create an Event",  to: "/create-event" },
    { label: "Organizer Portal", to: "/organizer" },
    { label: "Promo Codes",      to: "/organizer/promo-codes" },
    { label: "Manage Orders",    to: "/organizer/orders" },
    { label: "Finance",          to: "/organizer/finance" },
  ],
  company: [
    { label: "About FunAsia",    to: "/" },
    { label: "Contact Us",       to: "/" },
    { label: "Help Center",      to: "/" },
    { label: "Blog",             to: "/" },
  ],
  legal: [
    { label: "Privacy Policy",   to: "/" },
    { label: "Terms of Service", to: "/" },
    { label: "Cookie Policy",    to: "/" },
    { label: "Refund Policy",    to: "/" },
  ],
};

const SOCIAL = [
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Facebook,  label: "Facebook",  href: "#" },
  { icon: Twitter,   label: "Twitter/X", href: "#" },
  { icon: Youtube,   label: "YouTube",   href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-brand-dark text-white mt-20">

      {/* ── Main grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <span className="text-2xl">🎪</span>
              <span className="font-display text-xl font-extrabold tracking-tight">
                Fun<span className="text-brand-accent">Asia</span>
              </span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-6">
              The home for South Asian events in Texas. Find concerts, cultural festivals, food fairs, and more — all in one place.
            </p>

            {/* Location badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-xs text-gray-400 mb-6">
              <MapPin size={11} className="text-brand-accent" />
              Based in Texas, USA 🤠
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-brand-accent flex items-center justify-center text-gray-400 hover:text-white transition-all duration-150"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Discover */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Discover</p>
            <ul className="space-y-2.5">
              {LINKS.discover.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Organizers */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Organizers</p>
            <ul className="space-y-2.5">
              {LINKS.organizers.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Company</p>
            <ul className="space-y-2.5">
              {LINKS.company.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Contact</p>
              <a href="mailto:hello@funasia.events"
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                <Mail size={12} /> hello@funasia.events
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Legal</p>
            <ul className="space-y-2.5">
              {LINKS.legal.map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/5" />

      {/* ── Bottom bar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-600 order-2 sm:order-1">
          © {new Date().getFullYear()} FunAsia Events, LLC. All rights reserved.
        </p>

        <div className="flex items-center gap-4 order-1 sm:order-2">
          {/* Accepted payment methods */}
          <div className="flex items-center gap-1.5">
            {["VISA", "MC", "AMEX", "GPay"].map((p) => (
              <span key={p}
                className="px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-bold text-gray-600 tracking-wider">
                {p}
              </span>
            ))}
          </div>
          <span className="text-gray-700 text-xs hidden sm:inline">·</span>
          <span className="text-xs text-gray-600 flex items-center gap-1">
            <Globe size={10} /> All times in Central Time (CT)
          </span>
        </div>
      </div>

    </footer>
  );
}
