import { ArrowLeft, Info } from "lucide-react";
import { motion } from "motion/react";

interface AboutProps {
  onNavigate: (view: string) => void;
}

export default function About({ onNavigate }: AboutProps) {
  return (
    <div className="space-y-6" data-ocid="about.section">
      {/* Back button */}
      <div className="px-1">
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="about.back_btn"
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
            <Info size={20} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">About Us</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          The story behind Smart Life Manager
        </p>
      </motion.div>

      {/* About content */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card rounded-xl border border-border p-5 space-y-4"
        data-ocid="about.content_card"
      >
        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">
            Our Mission
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Smart Life Manager was developed by a BBA Finance student Kishore to
            help users master the 50/30/20 rule and reduce daily expenses
            through disciplined tracking.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="text-base font-semibold text-foreground mb-2">
            The 50/30/20 Rule
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Allocate 50% of your income to needs, 30% to wants, and 20% to
            savings. This simple framework helps build lasting financial
            discipline.
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
          Built with passion for financial empowerment — helping students and
          young professionals take control of their money.
        </p>
      </motion.div>
    </div>
  );
}
