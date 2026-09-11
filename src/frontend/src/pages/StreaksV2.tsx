import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { useLocalStorage } from "../hooks/useLocalStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryStreak {
  count: number;
  best: number;
  lastDate: string;
}

interface StreaksV2Data {
  health: CategoryStreak;
  money: CategoryStreak;
  deepWork: CategoryStreak;
  relationship: CategoryStreak;
}

type CategoryKey = keyof StreaksV2Data;

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_STREAK: CategoryStreak = { count: 0, best: 0, lastDate: "" };

const DEFAULT_DATA: StreaksV2Data = {
  health: { ...DEFAULT_STREAK },
  money: { ...DEFAULT_STREAK },
  deepWork: { ...DEFAULT_STREAK },
  relationship: { ...DEFAULT_STREAK },
};

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  emoji: string;
  trend: string;
  gradient: string;
  gradientLight: string;
  accentColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: "health",
    label: "Health",
    emoji: "🏃",
    trend: "Most consistent on weekdays · Build morning routine",
    gradient:
      "linear-gradient(135deg, oklch(0.55 0.18 148) 0%, oklch(0.65 0.2 160) 100%)",
    gradientLight: "oklch(0.55 0.18 148 / 0.1)",
    accentColor: "oklch(0.45 0.18 148)",
  },
  {
    key: "money",
    label: "Money",
    emoji: "💰",
    trend: "Saving momentum builds slowly · Small wins compound",
    gradient:
      "linear-gradient(135deg, oklch(0.65 0.18 75) 0%, oklch(0.72 0.2 60) 100%)",
    gradientLight: "oklch(0.65 0.18 75 / 0.1)",
    accentColor: "oklch(0.52 0.18 75)",
  },
  {
    key: "deepWork",
    label: "Deep Work",
    emoji: "🎯",
    trend: "Focus blocks increase weekly · Protect your peak hours",
    gradient:
      "linear-gradient(135deg, oklch(0.45 0.22 278) 0%, oklch(0.55 0.25 290) 100%)",
    gradientLight: "oklch(0.45 0.22 278 / 0.1)",
    accentColor: "oklch(0.45 0.22 278)",
  },
  {
    key: "relationship",
    label: "Relationships",
    emoji: "💬",
    trend: "Consistency matters more than duration · 5 min counts",
    gradient:
      "linear-gradient(135deg, oklch(0.58 0.22 350) 0%, oklch(0.65 0.2 10) 100%)",
    gradientLight: "oklch(0.58 0.22 350 / 0.1)",
    accentColor: "oklch(0.52 0.22 350)",
  },
];

const MILESTONES = [
  {
    days: 7,
    tagline: "You can form a micro-habit",
    reflection: "What small change have you noticed?",
    reward: "Buy yourself a coffee ☕",
  },
  {
    days: 21,
    tagline: "You've built a stable pattern",
    reflection: "What's become automatic?",
    reward: "Take a half-day off 🎉",
  },
  {
    days: 60,
    tagline: "Behavior change is becoming identity",
    reflection: "How are you different now?",
    reward: "Share your win with someone 🏆",
  },
  {
    days: 100,
    tagline: "Life-defining discipline milestone",
    reflection: "What's your next 100-day goal?",
    reward: "Treat yourself to something meaningful 🌟",
  },
];

const TIPS = [
  {
    icon: "⏰",
    text: "Check in at the same time every day to lock in your routine.",
  },
  {
    icon: "🏆",
    text: "Missing a day resets your streak — protect it like a high score.",
  },
  {
    icon: "🔗",
    text: "Link each streak to one habit: Health → morning walk, Money → no impulse buy.",
  },
  {
    icon: "📈",
    text: "Hit 7 days on one category, then unlock the next — stack your wins.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StreakCategoryCard({
  config,
  data,
  onCheckIn,
  index,
}: {
  config: CategoryConfig;
  data: CategoryStreak;
  onCheckIn: (key: CategoryKey) => void;
  index: number;
}) {
  const todayStr = today();
  const checkedInToday = data.lastDate === todayStr;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: config.gradient }}
      data-ocid={`streaks.category_card.${index + 1}`}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{config.emoji}</span>
            <span className="text-white font-bold text-lg">{config.label}</span>
          </div>
          {checkedInToday && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
              data-ocid={`streaks.done_badge.${index + 1}`}
            >
              <CheckCircle2 size={12} />
              Done for today
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-4">
          <div
            className="flex-1 rounded-xl py-3 text-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p
              className="text-3xl font-black text-white leading-none"
              data-ocid={`streaks.current_count.${index + 1}`}
            >
              {data.count}
            </p>
            <p className="text-white/75 text-xs font-medium mt-1">
              Current days
            </p>
          </div>
          <div
            className="flex-1 rounded-xl py-3 text-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <p
              className="text-3xl font-black text-white leading-none"
              data-ocid={`streaks.best_count.${index + 1}`}
            >
              {data.best}
            </p>
            <p className="text-white/75 text-xs font-medium mt-1">Best days</p>
          </div>
        </div>

        {/* Trend */}
        <p className="text-white/80 text-xs leading-relaxed mb-4">
          📊 {config.trend}
        </p>

        {/* Check-in button */}
        {checkedInToday ? (
          <div
            className="w-full py-3 rounded-xl text-center text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.18)", color: "white" }}
          >
            ✅ Checked in! Come back tomorrow
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onCheckIn(config.key)}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 hover:opacity-90"
            style={{
              background: "rgba(255,255,255,0.95)",
              color: config.accentColor,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
            data-ocid={`streaks.checkin_button.${index + 1}`}
          >
            Check In Today 🔥
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StreaksV2() {
  const [streaks, setStreaks] = useLocalStorage<StreaksV2Data>(
    "slm_streaks_v2",
    DEFAULT_DATA,
  );

  const todayStr = today();
  const yesterdayStr = yesterday();

  const handleCheckIn = (key: CategoryKey) => {
    const current = streaks[key];
    if (current.lastDate === todayStr) return;

    const wasYesterday = current.lastDate === yesterdayStr;
    const newCount = wasYesterday ? current.count + 1 : 1;
    const newBest = Math.max(current.best, newCount);

    setStreaks({
      ...streaks,
      [key]: { count: newCount, best: newBest, lastDate: todayStr },
    });
  };

  // Find best performing category for milestone priority
  const sortedCategories = [...CATEGORIES].sort(
    (a, b) => streaks[b.key].count - streaks[a.key].count,
  );

  return (
    <div className="space-y-5 pb-6" data-ocid="streaks_v2.page">
      {/* Page Header */}
      <div className="px-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Life Streaks 2.0 🔥
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track what actually matters
        </p>
      </div>

      {/* Category Streak Cards */}
      <div className="space-y-4" data-ocid="streaks_v2.categories.list">
        {CATEGORIES.map((config, i) => (
          <StreakCategoryCard
            key={config.key}
            config={config}
            data={streaks[config.key]}
            onCheckIn={handleCheckIn}
            index={i}
          />
        ))}
      </div>

      {/* Milestones Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="bg-card rounded-2xl border border-border shadow-sm p-5"
        data-ocid="streaks_v2.milestones.section"
      >
        <h2 className="text-lg font-bold text-foreground mb-0.5">
          Milestones That Matter
        </h2>
        <p className="text-muted-foreground text-xs mb-4">
          Based on your best performing streak first
        </p>

        <div className="space-y-5">
          {MILESTONES.map((milestone, mi) => (
            <div
              key={milestone.days}
              className="space-y-2"
              data-ocid={`streaks_v2.milestone.${mi + 1}`}
            >
              {/* Milestone header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    🎯 {milestone.days} days —{" "}
                    <span className="font-normal text-muted-foreground">
                      {milestone.tagline}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    💭 {milestone.reflection}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    🎁 {milestone.reward}
                  </p>
                </div>
              </div>

              {/* Category progress rows */}
              <div className="space-y-1.5 pl-1">
                {sortedCategories.map((cat, ci) => {
                  const count = streaks[cat.key].count;
                  const achieved = count >= milestone.days;
                  const pct = Math.min(
                    100,
                    Math.round((count / milestone.days) * 100),
                  );

                  return (
                    <div
                      key={cat.key}
                      className="flex items-center gap-2"
                      data-ocid={`streaks_v2.milestone_progress.${mi + 1}.${ci + 1}`}
                    >
                      <span className="text-sm w-4 shrink-0">{cat.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-muted-foreground truncate">
                            {cat.label}
                          </span>
                          {achieved ? (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={{
                                background: "oklch(0.55 0.18 148 / 0.15)",
                                color: "oklch(0.45 0.18 148)",
                              }}
                            >
                              ✅ Unlocked
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                              {count}/{milestone.days} days
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{
                              delay: 0.4 + mi * 0.05 + ci * 0.03,
                              duration: 0.6,
                              ease: "easeOut",
                            }}
                            className="h-1.5 rounded-full"
                            style={{ background: cat.gradient }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {mi < MILESTONES.length - 1 && (
                <div className="border-t border-border/50 mt-1" />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Power Tips */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        data-ocid="streaks_v2.tips.section"
      >
        <h2 className="text-lg font-bold text-foreground mb-3 px-1">
          💡 Streak Power Tips
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {TIPS.map((tip, i) => (
            <motion.div
              key={tip.icon}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.07 }}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
              data-ocid={`streaks_v2.tips.item.${i + 1}`}
            >
              <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
              <p className="text-sm text-foreground leading-relaxed">
                {tip.text}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
