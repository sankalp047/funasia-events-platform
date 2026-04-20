import { Construction } from "lucide-react";

export default function OrganizerPlaceholder({ title, description }) {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-brand-text">{title}</h1>
      </div>
      <div className="text-center py-20 bg-white rounded-2xl border border-brand-border">
        <Construction size={40} className="text-brand-textLight mx-auto mb-4" />
        <h3 className="font-display text-lg font-bold text-brand-text mb-2">Coming Soon</h3>
        <p className="text-sm text-brand-textMid max-w-xs mx-auto">
          {description || `${title} features are being built. Check back soon!`}
        </p>
      </div>
    </div>
  );
}
