import { ArrowLeft, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

interface PrivacyPolicyProps {
  onNavigate: (view: string) => void;
}

export default function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
  return (
    <div className="space-y-6" data-ocid="privacy.section">
      {/* Back button */}
      <div className="px-1">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="privacy.back_btn"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="px-1"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={20} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-IN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </motion.div>

      {/* Policy content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card rounded-xl border border-border p-5 space-y-4"
        data-ocid="privacy.policy_card"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Advertising
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Smart Life Manager uses Google AdSense to serve ads.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="text-base font-semibold text-foreground mb-2">
            Your Data
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not sell user data.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="text-base font-semibold text-foreground mb-2">
            Cookies
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cookies are used to improve your experience.
          </p>
        </div>
      </motion.div>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-muted/40 rounded-xl border border-border p-4"
      >
        <p className="text-xs text-muted-foreground leading-relaxed text-center">
          Smart Life Manager uses Google AdSense to serve ads. We do not sell
          user data. Cookies are used to improve your experience.
        </p>
      </motion.div>
    </div>
  );
}
