import { Flame, Lock, Target, TrendingUp, Trophy, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  merchantName?: string;
  category?: string;
}

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  Food: {
    label: "Food",
    className: "bg-green-100 text-green-700 border border-green-200",
  },
  Travel: {
    label: "Travel",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
  },
  Shopping: {
    label: "Shopping",
    className: "bg-purple-100 text-purple-700 border border-purple-200",
  },
  Entertainment: {
    label: "Entertainment",
    className: "bg-orange-100 text-orange-700 border border-orange-200",
  },
  Health: {
    label: "Health",
    className: "bg-red-100 text-red-700 border border-red-200",
  },
  Other: {
    label: "Other",
    className: "bg-secondary text-muted-foreground border border-border",
  },
};

function CategoryBadge({ category }: { category: string }) {
  const badge = CATEGORY_BADGE[category] ?? CATEGORY_BADGE.Other;
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

interface Goal {
  id: string;
  name: string;
  goal: number;
  saved: number;
}
interface StreakData {
  count: number;
  lastDate: string;
}

const COLORS = [
  "oklch(0.52 0.18 245)",
  "oklch(0.68 0.18 148)",
  "oklch(0.72 0.18 55)",
];

const MOCK_LEADERBOARD = [
  { name: "Aarav K.", score: 94 },
  { name: "Priya S.", score: 88 },
  { name: "Rahul M.", score: 85 },
  { name: "Kishore V.", score: 82 },
  { name: "Kavya T.", score: 78 },
  { name: "Dev R.", score: 73 },
];

function getRankPercentile(score: number): number {
  if (score >= 90) return 1;
  if (score >= 80) return 5;
  if (score >= 70) return 15;
  if (score >= 60) return 30;
  return 50;
}

interface DashboardProps {
  onNavigate?: (view: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [expenses] = useLocalStorage<Expense[]>("slm_expenses", []);
  const [goals] = useLocalStorage<Goal[]>("slm_goals", []);
  const [streak] = useLocalStorage<StreakData>("slm_streak", {
    count: 0,
    lastDate: "",
  });
  const [budgetData] = useLocalStorage<{ income: number }>("slm_budget", {
    income: 0,
  });
  const [wealthScore, setWealthScore] = useLocalStorage<number>(
    "slm_wealth_score",
    70,
  );

  const currentMonth = new Date().toISOString().slice(0, 7);

  const monthlyExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date.startsWith(currentMonth))
        .reduce((s, e) => s + e.amount, 0),
    [expenses, currentMonth],
  );

  const totalGoalProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const total = goals.reduce((s, g) => s + g.goal, 0);
    const saved = goals.reduce((s, g) => s + g.saved, 0);
    return total > 0 ? Math.round((saved / total) * 100) : 0;
  }, [goals]);

  // Recalculate wealth score based on expenses + goals
  useEffect(() => {
    let score = 70;
    const monthExpenses = expenses.filter((e) =>
      e.date.startsWith(currentMonth),
    );

    // +2 per ₹100 of non-Impulse expenses tracked (encourages tracking discipline)
    const nonImpulse = monthExpenses.filter((e) => e.category !== "Impulse");
    const nonImpulseTotal = nonImpulse.reduce((s, e) => s + e.amount, 0);
    score += Math.floor(nonImpulseTotal / 100) * 2;

    // -3 per Impulse-category expense
    const impulseCount = monthExpenses.filter(
      (e) => e.category === "Impulse",
    ).length;
    score -= impulseCount * 3;

    // +5 for each goal hit
    const goalsHit = goals.filter((g) => g.saved >= g.goal).length;
    score += goalsHit * 5;

    // Clamp 0–100
    score = Math.min(100, Math.max(0, score));
    setWealthScore(score);
  }, [expenses, goals, currentMonth, setWealthScore]);

  const income = budgetData.income;
  const rankPercentile = getRankPercentile(wealthScore);

  // Build leaderboard rows inserting user
  const leaderboardRows = useMemo(() => {
    const userRow = { name: "You", score: wealthScore, isUser: true };
    const rows = MOCK_LEADERBOARD.map((r) => ({ ...r, isUser: false }));
    rows.push(userRow);
    return rows.sort((a, b) => b.score - a.score);
  }, [wealthScore]);

  const pieData =
    income > 0
      ? [
          { name: "Needs (50%)", value: income * 0.5 },
          { name: "Wants (30%)", value: income * 0.3 },
          { name: "Savings (20%)", value: income * 0.2 },
        ]
      : [
          { name: "Needs", value: 50 },
          { name: "Wants", value: 30 },
          { name: "Savings", value: 20 },
        ];

  // Build weekly bar data — real expenses grouped into last 4 weeks
  const barData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      const startStr = weekStart.toISOString().slice(0, 10);
      const endStr = weekEnd.toISOString().slice(0, 10);
      const total = expenses
        .filter((e) => e.date >= startStr && e.date <= endStr)
        .reduce((s, e) => s + e.amount, 0);
      const label = i === 0 ? "This week" : `${i}w ago`;
      return { name: label, amount: total };
    }).reverse();
  }, [expenses]);

  const stats = [
    {
      label: "Daily Streak",
      value: streak.count,
      icon: <Flame size={20} />,
      color: "bg-chart-3/10 text-chart-3",
      highlight: "text-chart-3",
    },
    {
      label: "Monthly Expenses",
      value: `₹${monthlyExpenses.toLocaleString("en-IN")}`,
      icon: <Wallet size={20} />,
      color: "bg-primary/10 text-primary",
      highlight: "text-primary",
    },
    {
      label: "Goal Progress",
      value: `${totalGoalProgress}%`,
      icon: <Target size={20} />,
      color: "bg-accent/10 text-accent",
      highlight: "text-accent",
    },
    {
      label: "Monthly Income",
      value: income > 0 ? `₹${income.toLocaleString("en-IN")}` : "Not Set",
      icon: <TrendingUp size={20} />,
      color: "bg-chart-4/10 text-chart-4",
      highlight: "text-chart-4",
    },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-5" data-ocid="dashboard.section">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-foreground">{greeting} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here's your financial overview
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3" data-ocid="dashboard.stats_grid">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="bg-card rounded-xl shadow-card border border-border p-4"
            data-ocid="dashboard.card"
          >
            <div
              className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${stat.color}`}
            >
              {stat.icon}
            </div>
            <p className={`text-xl font-bold ${stat.highlight}`}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Chennai Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
        data-ocid="dashboard.leaderboard_card"
      >
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={18} className="text-yellow-500 flex-shrink-0" />
          <h2 className="text-base font-semibold text-foreground">
            Your Chennai Rank
          </h2>
        </div>
        <p className="text-[13px] font-bold text-foreground mt-2 leading-snug">
          You are in the{" "}
          <span className="text-primary">Top {rankPercentile}%</span> of
          disciplined students in Chennai!
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Based on your Financial Health Score
        </p>

        <div
          className="mt-4 rounded-xl overflow-hidden border border-border"
          data-ocid="dashboard.leaderboard.table"
        >
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-semibold">
                  Rank
                </th>
                <th className="text-left px-3 py-2 text-muted-foreground font-semibold">
                  Student
                </th>
                <th className="text-right px-3 py-2 text-muted-foreground font-semibold">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboardRows.map((row, idx) => (
                <tr
                  key={row.name}
                  className={`border-t border-border transition-colors ${
                    row.isUser
                      ? "bg-primary/8 font-bold"
                      : "bg-card hover:bg-muted/30"
                  }`}
                  data-ocid={`dashboard.leaderboard.item.${idx + 1}`}
                >
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {idx === 0
                      ? "🥇"
                      : idx === 1
                        ? "🥈"
                        : idx === 2
                          ? "🥉"
                          : `#${idx + 1}`}
                  </td>
                  <td
                    className={`px-3 py-2.5 ${row.isUser ? "text-primary font-bold" : "text-foreground"}`}
                  >
                    {row.name}
                    {row.isUser && (
                      <span className="ml-1.5 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                        You
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      row.score >= 80
                        ? "text-emerald-600"
                        : row.score >= 60
                          ? "text-yellow-600"
                          : "text-red-500"
                    }`}
                  >
                    {row.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Budget Breakdown Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.52 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <h2 className="text-base font-semibold text-foreground mb-4">
          Budget Breakdown
        </h2>
        {income > 0 ? (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  dataKey="value"
                  strokeWidth={2}
                >
                  {pieData.map((item, index) => (
                    <Cell
                      key={item.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i] }}
                  />
                  <span className="text-xs text-muted-foreground flex-1">
                    {item.name}
                  </span>
                  <span className="text-xs font-semibold">
                    ₹{item.value.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              Set your income in Finance tab to see breakdown
            </p>
          </div>
        )}
      </motion.div>

      {/* Monthly Overview Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.58 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <h2 className="text-base font-semibold text-foreground mb-4">
          Monthly Overview
        </h2>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart
            data={barData}
            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
            />
            <Bar
              dataKey="amount"
              fill="oklch(0.52 0.18 245)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Goal Progress */}
      {goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.63 }}
          className="bg-card rounded-xl shadow-card border border-border p-5"
        >
          <h2 className="text-base font-semibold text-foreground mb-4">
            Savings Goals
          </h2>
          <div className="space-y-3">
            {goals.slice(0, 3).map((goal) => {
              const pct = Math.min(
                100,
                Math.round((goal.saved / goal.goal) * 100),
              );
              return (
                <div key={goal.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent Expenses */}
      {expenses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.68 }}
          className="bg-card rounded-xl shadow-card border border-border p-5"
        >
          <h2 className="text-base font-semibold text-foreground mb-4">
            Recent Expenses
          </h2>
          <div className="space-y-2" data-ocid="dashboard.recent_expenses.list">
            {expenses
              .slice()
              .sort((a, b) => (b.date > a.date ? 1 : -1))
              .slice(0, 5)
              .map((expense, idx) => (
                <div
                  key={expense.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  data-ocid={`dashboard.recent_expenses.item.${idx + 1}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {expense.merchantName || expense.description}
                      </span>
                      {expense.category && (
                        <CategoryBadge category={expense.category} />
                      )}
                    </div>
                    {expense.merchantName && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {expense.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      ₹{expense.amount.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(expense.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="text-center py-6 text-xs text-muted-foreground space-y-2 border-t border-border/50 mt-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <a
            href="/privacy-policy"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.("privacy-policy");
            }}
            className="hover:text-foreground hover:underline transition-colors"
            data-ocid="footer.privacy_policy_link"
          >
            Privacy Policy
          </a>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.("about");
            }}
            className="hover:text-foreground hover:underline transition-colors"
            data-ocid="footer.about_link"
          >
            About Us
          </a>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <button
            type="button"
            className="hover:text-foreground hover:underline transition-colors"
          >
            Contact
          </button>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <button
            type="button"
            className="hover:text-foreground hover:underline transition-colors"
          >
            Terms of Use
          </button>
        </div>
        <div>Disclaimer: For educational purposes only.</div>
        <div data-ocid="footer.made_by_credit">Made by Kishore</div>

        {/* Zero-Bank Privacy Badge */}
        <div
          className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-1 text-[11px] font-medium mt-1"
          data-ocid="footer.zero_bank_badge"
          role="note"
          aria-label="Privacy assurance"
        >
          <Lock size={11} className="flex-shrink-0" />
          <span>
            100% Privacy. No Bank Access Required. You are in control of your
            data.
          </span>
        </div>

        <div>
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </div>
      </div>
    </div>
  );
}
