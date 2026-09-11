import { useLocalStorage } from "@/hooks/useLocalStorage";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Expense {
  id: string;
  amount: number;
  category: string;
  merchant: string;
  date: string;
  type: "EXPENSE" | "INCOME";
}

interface HarvestedAsset {
  merchant: string;
  harvestedAt: string;
}

interface LoanInputs {
  amount: string;
  rate: string;
  tenure: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcEMI(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0 || principal <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  return (principal * r * (1 + r) ** months) / ((1 + r) ** months - 1);
}

function fmtINR(n: number): string {
  return `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

// Seeded pseudo-random for consistent "current value" simulation
function seededRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 0.7 + (((h >>> 0) % 10000) / 10000) * 0.6; // 0.7 → 1.3
}

// Monte Carlo: 1000 paths, SIP returns N(10%, 15% stddev), 30 years
function runMonteCarlo(monthlyInvestment: number): {
  p10: number;
  p50: number;
  p90: number;
} {
  const paths: number[] = [];
  const n = 360; // 30 years × 12
  for (let sim = 0; sim < 1000; sim++) {
    let fv = 0;
    for (let m = 0; m < n; m++) {
      // Box-Muller for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = 0.1 + z * 0.15;
      const monthlyReturn = Math.max(annualReturn / 12, -0.05);
      fv = (fv + monthlyInvestment) * (1 + monthlyReturn);
    }
    paths.push(Math.max(fv, 0));
  }
  paths.sort((a, b) => a - b);
  return { p10: paths[99], p50: paths[499], p90: paths[899] };
}

// ─── Module 1: Cash-Flow Forecaster ──────────────────────────────────────────
function CashFlowModule({
  expenses,
  monthlyBudget,
}: { expenses: Expense[]; monthlyBudget: number }) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentExpenses = expenses.filter(
    (e) => e.type === "EXPENSE" && new Date(e.date) >= thirtyDaysAgo,
  );

  // Detect recurring merchants (2+ times in 60 days)
  const merchantCounts = new Map<string, { total: number; count: number }>();
  for (const e of recentExpenses) {
    const existing = merchantCounts.get(e.merchant) ?? { total: 0, count: 0 };
    merchantCounts.set(e.merchant, {
      total: existing.total + e.amount,
      count: existing.count + 1,
    });
  }
  const recurring = Array.from(merchantCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([merchant, v]) => ({ merchant, avgAmount: v.total / v.count }));

  const dailyRecurring = recurring.reduce((s, r) => s + r.avgAmount / 30, 0);
  const dailyBudget = monthlyBudget / 30 || 300;

  // Build 30-day projection
  const thisMonthSpent = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return (
        e.type === "EXPENSE" &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((s, e) => s + e.amount, 0);

  let runningBalance = monthlyBudget - thisMonthSpent;
  const projection: number[] = [];
  for (let d = 0; d < 30; d++) {
    runningBalance -= dailyBudget + dailyRecurring;
    projection.push(runningBalance);
  }

  const deficitDay = projection.findIndex((b) => b < monthlyBudget * 0.1);
  const maxAbs = Math.max(...projection.map((v) => Math.abs(v)), 1);

  return (
    <div
      className="rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 p-4 space-y-3"
      data-ocid="wealth.cashflow_module"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">
          📈 Cash-Flow Forecaster
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${deficitDay >= 0 ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
        >
          {deficitDay >= 0 ? `⚠ Day ${deficitDay + 1} risk` : "✓ Healthy"}
        </span>
      </div>

      {/* Bar chart */}
      <div
        className="flex items-end gap-0.5 h-16"
        aria-label="30-day cash flow projection"
      >
        {projection.map((val, i) => {
          const heightPct = Math.max((Math.abs(val) / maxAbs) * 100, 4);
          const isDeficit = val < monthlyBudget * 0.1;
          const dayKey = `day-${i}`;
          return (
            <div
              key={dayKey}
              className={`flex-1 rounded-sm transition-all ${
                isDeficit
                  ? "bg-red-500/70"
                  : val > monthlyBudget * 0.5
                    ? "bg-emerald-500/70"
                    : "bg-amber-500/60"
              }`}
              style={{ height: `${heightPct}%` }}
              title={`Day ${i + 1}: ${fmtINR(val)}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Today</span>
        <span>Day 30</span>
      </div>

      {/* Deficit alert */}
      {deficitDay >= 0 && (
        <div
          className="rounded-xl bg-red-500/10 border border-red-500/30 p-3"
          data-ocid="wealth.cashflow_alert"
        >
          <p className="text-red-400 text-xs font-semibold">🚨 Deficit Alert</p>
          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
            Based on your trajectory, you'll hit a{" "}
            {fmtINR(Math.abs(projection[deficitDay]))} cash deficit by day{" "}
            {deficitDay + 1}. Avoid non-essential spending this week.
          </p>
        </div>
      )}

      {recurring.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-400 font-medium">
            Recurring detected:
          </p>
          {recurring.slice(0, 3).map((r) => (
            <div key={r.merchant} className="flex justify-between text-[11px]">
              <span className="text-slate-300 truncate max-w-[60%]">
                {r.merchant || "Unknown"}
              </span>
              <span className="text-amber-400">{fmtINR(r.avgAmount)}/mo</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Module 2: Micro-Surplus Harvester ────────────────────────────────────────
function SurplusModule({
  expenses,
  monthlyBudget,
}: { expenses: Expense[]; monthlyBudget: number }) {
  const [confirmed, setConfirmed] = useState(false);
  const today = new Date();

  const thisMonthSpent = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return (
        e.type === "EXPENSE" &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((s, e) => s + e.amount, 0);

  const surplus = Math.max(monthlyBudget - thisMonthSpent, 0);
  const dailyAvg = thisMonthSpent / (today.getDate() || 1);
  const next4DaysNeeded = dailyAvg * 4;
  const idleSurplus = Math.max(surplus - next4DaysNeeded, 0);

  const handleAllocate = () => {
    setConfirmed(true);
    toast.success(
      `₹${Math.round(idleSurplus).toLocaleString("en-IN")} routing instruction generated for SIP top-up!`,
    );
  };

  const pct =
    monthlyBudget > 0
      ? Math.min((thisMonthSpent / monthlyBudget) * 100, 100)
      : 0;

  return (
    <div
      className="rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 p-4 space-y-3"
      data-ocid="wealth.surplus_module"
    >
      <h3 className="text-white font-semibold text-sm">
        💰 Micro-Surplus Harvester
      </h3>

      {/* Radial-like progress */}
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="#1e293b"
              strokeWidth="8"
            />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={pct > 80 ? "#f87171" : pct > 60 ? "#fbbf24" : "#34d399"}
              strokeWidth="8"
              strokeDasharray={`${(pct / 100) * 163.4} 163.4`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="space-y-0.5">
          <p className="text-[11px] text-slate-400">Month spent</p>
          <p className="text-amber-400 font-bold text-sm">
            {fmtINR(thisMonthSpent)}
          </p>
          <p className="text-[11px] text-slate-400">
            of {fmtINR(monthlyBudget)} budget
          </p>
        </div>
      </div>

      {idleSurplus > 0 ? (
        <>
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3">
            <p className="text-emerald-400 text-xs font-semibold">
              ✨ Idle Balance Detected
            </p>
            <p className="text-slate-300 text-[11px] mt-0.5">
              You have{" "}
              <span className="text-emerald-400 font-bold">
                {fmtINR(idleSurplus)}
              </span>{" "}
              idle for the next 4 days. Suggest: sweep to SIP top-up.
            </p>
          </div>
          {!confirmed ? (
            <button
              type="button"
              onClick={handleAllocate}
              className="w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-colors"
              data-ocid="wealth.allocate_sip_button"
            >
              Allocate {fmtINR(idleSurplus)} to SIP ↑
            </button>
          ) : (
            <div
              className="text-center text-emerald-400 text-xs font-semibold py-2"
              data-ocid="wealth.surplus_success_state"
            >
              ✓ Routing instruction sent for SIP top-up!
            </div>
          )}
        </>
      ) : (
        <div
          className="text-center text-slate-500 text-xs py-2"
          data-ocid="wealth.surplus_empty_state"
        >
          No idle surplus detected right now. Stay on budget to unlock
          harvesting.
        </div>
      )}
    </div>
  );
}

// ─── Module 3: Voice Wealth Triggers ─────────────────────────────────────────
function VoiceModule({ expenses }: { expenses: Expense[] }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState<null | {
    purchaseAmount: number;
    fundSource: string;
    emiResult: number;
    monteCarlo: { p10: number; p50: number; p90: number };
  }>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const totalInvestments = useMemo(
    () =>
      expenses
        .filter((e) => e.category.toLowerCase() === "investment")
        .reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const monthlySIP = Math.max(totalInvestments / 12, 1000);

  const parseWealthCommand = useCallback(
    (text: string) => {
      const lower = text.toLowerCase();
      // Extract amount
      let amount = 0;
      const lakhMatch = lower.match(/(\d+(?:\.\d+)?)\s*lakh/);
      const thousandMatch = lower.match(/(\d+(?:\.\d+)?)\s*thousand/);
      const directMatch = lower.match(/(\d+(?:,\d+)*)/);
      if (lakhMatch) amount = Number.parseFloat(lakhMatch[1]) * 100000;
      else if (thousandMatch)
        amount = Number.parseFloat(thousandMatch[1]) * 1000;
      else if (directMatch)
        amount = Number.parseFloat(directMatch[1].replace(/,/g, ""));

      const financeAmount = Math.max(amount * 0.667, 100000);
      const emiResult = calcEMI(financeAmount, 9, 60);
      const mc = runMonteCarlo(monthlySIP);

      // Identify fund source
      const fundMatch = lower.match(
        /pull\s+.+?from\s+([a-z\s]+?)(?:\s+and|\s+recalc|$)/,
      );
      const fundSource = fundMatch
        ? fundMatch[1].trim()
        : "low-performing mutual fund";

      setReport({
        purchaseAmount: amount || 1200000,
        fundSource,
        emiResult,
        monteCarlo: mc,
      });
    },
    [monthlySIP],
  );

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Voice not supported on this browser. Use Chrome.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: {
      results: { [key: number]: { [key: number]: { transcript: string } } };
    }) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      parseWealthCommand(text);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recogRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recogRef.current?.stop();
    setIsListening(false);
  };

  return (
    <div
      className="rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 p-4 space-y-3"
      data-ocid="wealth.voice_module"
    >
      <h3 className="text-white font-semibold text-sm">
        🎙 Voice Wealth Triggers
      </h3>
      <p className="text-slate-400 text-[11px]">
        Say: "I'm buying a car for 12 Lakhs. Pull 4 Lakhs from my mutual fund,
        recalculate EMI."
      </p>

      {/* Waveform + mic */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
            isListening
              ? "bg-red-500/20 border-red-500 text-red-400"
              : "bg-amber-500/10 border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
          }`}
          data-ocid="wealth.voice_mic_button"
          aria-label={isListening ? "Stop listening" : "Start voice command"}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 13.93A7.001 7.001 0 0 1 5 8H3a9.001 9.001 0 0 0 8 8.94V19H9v2h6v-2h-2v-2.07A9.001 9.001 0 0 0 21 8h-2a7 7 0 0 1-6 6.93z" />
          </svg>
        </button>

        {/* Waveform bars */}
        <div className="flex items-center gap-1 h-8" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1.5 rounded-full ${
                isListening ? "bg-amber-400 animate-waveform" : "bg-slate-600"
              }`}
              style={{
                height: isListening ? undefined : "6px",
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>

        {isListening && (
          <span className="text-amber-400 text-[11px] animate-pulse font-medium">
            Listening...
          </span>
        )}
      </div>

      {transcript && (
        <div className="rounded-xl bg-slate-700/40 border border-slate-600/40 p-2.5">
          <p className="text-[10px] text-slate-500 mb-0.5">Heard:</p>
          <p className="text-slate-300 text-xs">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      {/* Impact Report */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl bg-amber-500/5 border border-amber-500/30 p-3 space-y-2"
            data-ocid="wealth.impact_report"
          >
            <p className="text-amber-400 text-xs font-bold">
              📊 Wealth Impact Report
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-slate-500">Purchase</p>
                <p className="text-white font-semibold">
                  {fmtINR(report.purchaseAmount)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Fund Source</p>
                <p className="text-white font-semibold capitalize">
                  {report.fundSource}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Monthly EMI</p>
                <p className="text-amber-400 font-bold">
                  {fmtINR(report.emiResult)}/mo
                </p>
              </div>
              <div>
                <p className="text-slate-500">At 9% / 5yr</p>
                <p className="text-slate-300">on balance</p>
              </div>
            </div>
            <div className="border-t border-slate-700/50 pt-2">
              <p className="text-[10px] text-slate-400 mb-1">
                Retirement Impact (Monte Carlo — 1000 paths, 30yr SIP)
              </p>
              <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-1.5">
                  <p className="text-red-400 font-semibold">P10</p>
                  <p className="text-white">{fmtINR(report.monteCarlo.p10)}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-1.5">
                  <p className="text-amber-400 font-semibold">P50</p>
                  <p className="text-white">{fmtINR(report.monteCarlo.p50)}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1.5">
                  <p className="text-emerald-400 font-semibold">P90</p>
                  <p className="text-white">{fmtINR(report.monteCarlo.p90)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Module 4: Loan Optimizer ─────────────────────────────────────────────────
function LoanModule() {
  const [inputs, setInputs] = useState<LoanInputs>({
    amount: "800000",
    rate: "11",
    tenure: "60",
  });
  const [scenarios, setScenarios] = useState<
    { rate: number; emi: number; total: number }[]
  >([]);

  const recalculate = useCallback(() => {
    const p = Number.parseFloat(inputs.amount) || 0;
    const r = Number.parseFloat(inputs.rate) || 0;
    const t = Number.parseInt(inputs.tenure) || 0;
    const results = [
      { rate: r, emi: calcEMI(p, r, t), total: calcEMI(p, r, t) * t },
      {
        rate: Math.max(r - 1, 0.1),
        emi: calcEMI(p, Math.max(r - 1, 0.1), t),
        total: calcEMI(p, Math.max(r - 1, 0.1), t) * t,
      },
      {
        rate: Math.max(r - 2, 0.1),
        emi: calcEMI(p, Math.max(r - 2, 0.1), t),
        total: calcEMI(p, Math.max(r - 2, 0.1), t) * t,
      },
    ];
    setScenarios(results);
  }, [inputs]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  const bestSavings =
    scenarios.length >= 3 ? scenarios[0].total - scenarios[2].total : 0;

  return (
    <div
      className="rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 p-4 space-y-3"
      data-ocid="wealth.loan_module"
    >
      <h3 className="text-white font-semibold text-sm">🏦 Loan Optimizer</h3>

      <div className="grid grid-cols-3 gap-2">
        {(["amount", "rate", "tenure"] as const).map((field) => (
          <div key={field} className="space-y-1">
            <label
              htmlFor={`loan-${field}`}
              className="text-[10px] text-slate-400 capitalize block"
            >
              {field === "amount"
                ? "Loan (₹)"
                : field === "rate"
                  ? "Rate (%)"
                  : "Tenure (mo)"}
            </label>
            <input
              id={`loan-${field}`}
              type="number"
              value={inputs[field]}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, [field]: e.target.value }))
              }
              className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-xs px-2 py-1.5 focus:outline-none focus:border-amber-500/60"
              data-ocid={`wealth.loan_${field}_input`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={recalculate}
        className="w-full py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
        data-ocid="wealth.loan_recalculate_button"
      >
        Recalculate Scenarios
      </button>

      {/* Comparison table */}
      {scenarios.length > 0 && (
        <div className="space-y-1.5">
          {scenarios.map((s, i) => (
            <div
              key={s.rate}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                i === 0
                  ? "bg-slate-700/40 border border-slate-600/30"
                  : "bg-emerald-500/10 border border-emerald-500/25"
              }`}
              data-ocid={`wealth.loan_scenario.${i + 1}`}
            >
              <div className="text-[11px]">
                <span
                  className={i === 0 ? "text-slate-400" : "text-emerald-400"}
                >
                  {i === 0 ? "Current" : `Switch to ${s.rate}%`}
                </span>
                <span className="text-slate-500 ml-1">@ {s.rate}%</span>
              </div>
              <div className="text-right">
                <p className="text-white text-xs font-semibold">
                  {fmtINR(s.emi)}/mo
                </p>
                {i > 0 && (
                  <p className="text-emerald-400 text-[10px]">
                    Save {fmtINR(scenarios[0].total - s.total)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {bestSavings > 0 && (
        <div
          className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center"
          data-ocid="wealth.loan_savings_card"
        >
          <p className="text-emerald-400 text-xs font-bold">
            Switching saves you {fmtINR(bestSavings)} over tenure!
          </p>
          <p className="text-slate-400 text-[10px] mt-0.5">
            Say 'Execute' to start the paperless transfer process
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Module 5: Tax-Loss Agent ─────────────────────────────────────────────────
function TaxModule({ expenses }: { expenses: Expense[] }) {
  const [harvested, setHarvested] = useLocalStorage<HarvestedAsset[]>(
    "slm_harvested_assets",
    [],
  );

  const investments = expenses.filter(
    (e) => e.type === "EXPENSE" && e.category.toLowerCase() === "investment",
  );

  const holdings = investments
    .map((e) => {
      const multiplier = seededRand(e.merchant + e.date.slice(0, 7));
      const currentValue = e.amount * multiplier;
      const isAlreadyHarvested = harvested.some(
        (h) => h.merchant === e.merchant,
      );
      const purchaseDate = new Date(e.date);
      const daysHeld = Math.round(
        (Date.now() - purchaseDate.getTime()) / 86400000,
      );
      const taxRate = daysHeld > 365 ? 0.1 : 0.15;
      const loss = e.amount - currentValue;
      const taxOffset = loss > 0 ? loss * taxRate : 0;
      return {
        ...e,
        currentValue,
        loss,
        taxOffset,
        taxRate,
        daysHeld,
        isAlreadyHarvested,
      };
    })
    .filter((h) => h.loss > 0 && !h.isAlreadyHarvested);

  const totalOffset = holdings.reduce((s, h) => s + h.taxOffset, 0);

  const harvest = (h: (typeof holdings)[0]) => {
    setHarvested((prev) => [
      ...prev,
      { merchant: h.merchant, harvestedAt: new Date().toISOString() },
    ]);
    toast.success(
      `Tax-loss harvest executed for ${h.merchant || "asset"}! ₹${Math.round(h.taxOffset).toLocaleString("en-IN")} in tax offset.`,
    );
  };

  return (
    <div
      className="rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 p-4 space-y-3"
      data-ocid="wealth.tax_module"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">📉 Tax-Loss Agent</h3>
        {totalOffset > 0 && (
          <span className="text-emerald-400 text-xs font-semibold">
            {fmtINR(totalOffset)} offset available
          </span>
        )}
      </div>

      {holdings.length === 0 ? (
        <div
          className="text-center text-slate-500 text-xs py-3"
          data-ocid="wealth.tax_empty_state"
        >
          {investments.length === 0
            ? "Log investment expenses to enable tax-loss harvesting."
            : "No loss-making holdings detected. Your portfolio looks healthy! 🎉"}
        </div>
      ) : (
        <div className="space-y-2">
          {holdings.map((h, i) => (
            <div
              key={h.id}
              className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 space-y-2"
              data-ocid={`wealth.tax_holding.${i + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">
                    {h.merchant || "Unknown Asset"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Cost: {fmtINR(h.amount)} → Current: {fmtINR(h.currentValue)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {h.daysHeld}d held · {h.taxRate * 100}% tax · Offsets{" "}
                    {fmtINR(h.taxOffset)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-red-400 text-xs font-bold">
                    -{fmtINR(h.loss)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => harvest(h)}
                className="w-full py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors"
                data-ocid={`wealth.harvest_button.${i + 1}`}
              >
                Harvest Tax Loss → Save {fmtINR(h.taxOffset)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Wealth IQ Score ──────────────────────────────────────────────────────────
function calcWealthIQ(
  expenses: Expense[],
  monthlyBudget: number,
  savingsGoalProgress: number,
  streakDays: number,
): number {
  const today = new Date();
  const thisMonthSpent = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return (
        e.type === "EXPENSE" &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    })
    .reduce((s, e) => s + e.amount, 0);

  const adherencePct =
    monthlyBudget > 0 ? Math.min(thisMonthSpent / monthlyBudget, 1) : 0.5;
  const budgetScore = Math.round((1 - adherencePct) * 40);
  const goalScore = Math.round(Math.min(savingsGoalProgress, 1) * 30);
  const streakScore = Math.round(Math.min(streakDays / 30, 1) * 20);

  const categories = new Set(
    expenses.filter((e) => e.type === "EXPENSE").map((e) => e.category),
  );
  const diversityScore = Math.min(categories.size * 2, 10);

  return Math.max(
    0,
    Math.min(100, budgetScore + goalScore + streakScore + diversityScore),
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WealthEngine() {
  const [expenses] = useLocalStorage<Expense[]>("slm_expenses", []);
  const [dailyBudget] = useLocalStorage<number>("slm_daily_budget", 2000);
  const monthlyBudget = dailyBudget * 30;
  const [streaksObj] = useLocalStorage<{
    health?: { current: number; best: number; lastCheckin?: string };
    money?: { current: number; best: number; lastCheckin?: string };
    deepWork?: { current: number; best: number; lastCheckin?: string };
    relationships?: { current: number; best: number; lastCheckin?: string };
  }>("slm_streaks_v2", {});
  const streakDays = Math.max(
    streaksObj.health?.current ?? 0,
    streaksObj.money?.current ?? 0,
    streaksObj.deepWork?.current ?? 0,
    streaksObj.relationships?.current ?? 0,
  );
  const [goals] = useLocalStorage<
    {
      id: string;
      title: string;
      target: number;
      current: number;
      deadline?: string;
    }[]
  >("slm_goals", []);
  const savingsProgress =
    goals.length > 0
      ? Math.round(
          (goals.reduce(
            (acc, g) => acc + (g.target > 0 ? g.current / g.target : 0),
            0,
          ) /
            goals.length) *
            100,
        )
      : 0;

  const wealthIQ = useMemo(
    () => calcWealthIQ(expenses, monthlyBudget, savingsProgress, streakDays),
    [expenses, monthlyBudget, savingsProgress, streakDays],
  );

  const nextBestAction = useMemo(() => {
    const thisMonthSpent = expenses
      .filter((e) => {
        const d = new Date(e.date);
        const today = new Date();
        return e.type === "EXPENSE" && d.getMonth() === today.getMonth();
      })
      .reduce((s, e) => s + e.amount, 0);
    const pct = monthlyBudget > 0 ? thisMonthSpent / monthlyBudget : 0;
    if (pct > 0.9) return "🛑 Halt discretionary spending — budget critical";
    if (pct > 0.7) return "⚡ Review subscriptions to free up budget headroom";
    if (streakDays < 7) return "🔥 Check in daily to grow your Wealth streak";
    return "📈 Surplus available — consider SIP top-up this week";
  }, [expenses, monthlyBudget, streakDays]);

  const iqColor =
    wealthIQ >= 75
      ? "text-emerald-400"
      : wealthIQ >= 50
        ? "text-amber-400"
        : "text-red-400";
  const iqBg =
    wealthIQ >= 75
      ? "border-emerald-500/30"
      : wealthIQ >= 50
        ? "border-amber-500/30"
        : "border-red-500/30";

  return (
    <div className="space-y-4 pb-6" data-ocid="wealth.page">
      {/* Hero Card — Wealth IQ */}
      <div
        className={`rounded-2xl bg-slate-800/80 backdrop-blur-sm border ${iqBg} p-5 relative overflow-hidden`}
        data-ocid="wealth.hero_card"
      >
        {/* Decorative glow */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-purple-500/10 blur-xl pointer-events-none" />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-widest">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </p>
            <h2 className="text-white font-bold text-xl mt-1">Wealth Engine</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Autonomous Financial Twin
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">
              Wealth IQ
            </p>
            <p className={`font-black text-4xl leading-none ${iqColor}`}>
              {wealthIQ}
            </p>
            <p className="text-slate-500 text-[10px]">/100</p>
          </div>
        </div>

        {/* IQ progress bar */}
        <div className="mt-4 space-y-1">
          <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                wealthIQ >= 75
                  ? "bg-emerald-400"
                  : wealthIQ >= 50
                    ? "bg-amber-400"
                    : "bg-red-400"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${wealthIQ}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>Budget (40)</span>
            <span>Goals (30)</span>
            <span>Streak (20)</span>
            <span>Diversity (10)</span>
          </div>
        </div>

        {/* Next Best Action */}
        <div className="mt-3 rounded-xl bg-slate-700/40 border border-slate-600/30 px-3 py-2">
          <p className="text-[10px] text-slate-500 font-medium">
            Next Best Action
          </p>
          <p className="text-slate-200 text-xs mt-0.5">{nextBestAction}</p>
        </div>
      </div>

      {/* Modules */}
      <CashFlowModule expenses={expenses} monthlyBudget={monthlyBudget} />
      <SurplusModule expenses={expenses} monthlyBudget={monthlyBudget} />
      <VoiceModule expenses={expenses} />
      <LoanModule />
      <TaxModule expenses={expenses} />
    </div>
  );
}
