import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Calculator,
  Globe,
  Landmark,
  RefreshCw,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const AI_RESPONSES: Record<string, string> = {
  "how to save": "Save at least 20% of your income. Try the 50/30/20 rule! 💰",
  save: "Save at least 20% of your income. Try the 50/30/20 rule! 💰",
  budget: "Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings. 📊",
  invest:
    "Start with SIP (Systematic Investment Plan) with as little as ₹500/month. 📈",
  sip: "SIP lets you invest a fixed amount monthly. Even ₹500/month grows significantly over time!",
  expense: "Track every rupee you spend. Small expenses add up quickly! 💸",
  habit: "Build one habit at a time. Consistency beats intensity. 🔥",
  streak:
    "Check in daily to maintain your streak. Streaks build discipline! ⚡",
  salary:
    "Allocate: 60% spend, 30% save, 10% invest for smart salary planning. 💼",
};

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
}

function getAIResponse(msg: string): string {
  const lower = msg.toLowerCase();
  for (const key of Object.keys(AI_RESPONSES)) {
    if (lower.includes(key)) return AI_RESPONSES[key];
  }
  return "Great question! Focus on consistent tracking and smart planning to achieve your financial goals. 🎯";
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
};

const CURRENCIES = [
  { label: "USD", flag: "🇺🇸", symbol: "$" },
  { label: "EUR", flag: "🇪🇺", symbol: "€" },
  { label: "GBP", flag: "🇬🇧", symbol: "£" },
];

type RateStatus = "loading" | "live" | "cached" | "fallback" | "error";

interface RateState {
  rates: Record<string, number>;
  status: RateStatus;
  lastUpdated: Date | null;
  countdown: number;
}

const REFRESH_INTERVAL = 60; // seconds

export default function Tools() {
  const [sipP, setSipP] = useState("5000");
  const [sipY, setSipY] = useState("10");
  const [sipR, setSipR] = useState("12");
  const [sipResult, setSipResult] = useState<number | null>(null);

  const calcSIP = () => {
    const P = Number(sipP);
    const r = Number(sipR) / 100 / 12;
    const n = Number(sipY) * 12;
    if (P <= 0 || r <= 0 || n <= 0) return;
    const fv = P * ((((1 + r) ** n - 1) / r) * (1 + r));
    setSipResult(Math.round(fv));
  };

  // EMI Calculator state
  const [emiPrincipal, setEmiPrincipal] = useState("500000");
  const [emiRate, setEmiRate] = useState("8.5");
  const [emiYears, setEmiYears] = useState("20");
  const [emiResult, setEmiResult] = useState<{
    emi: number;
    total: number;
    interest: number;
  } | null>(null);
  const [emiError, setEmiError] = useState("");

  const calcEMI = () => {
    setEmiError("");
    const P = Number(emiPrincipal);
    const annualRate = Number(emiRate);
    const years = Number(emiYears);

    if (!P || P <= 0) {
      setEmiError("Please enter a valid loan amount.");
      return;
    }
    if (!annualRate || annualRate <= 0) {
      setEmiError("Please enter a valid interest rate.");
      return;
    }
    if (!years || years <= 0) {
      setEmiError("Please enter a valid loan tenure.");
      return;
    }

    const r = annualRate / 12 / 100;
    const n = years * 12;
    const emi = (P * r * (1 + r) ** n) / ((1 + r) ** n - 1);
    const total = emi * n;
    const interest = total - P;

    setEmiResult({
      emi: Math.round(emi),
      total: Math.round(total),
      interest: Math.round(interest),
    });
  };

  const [inrAmount, setInrAmount] = useState("1000");
  const inr = Number(inrAmount) || 0;

  // Live rates state
  const [rateState, setRateState] = useState<RateState>({
    rates: FALLBACK_RATES,
    status: "loading",
    lastUpdated: null,
    countdown: REFRESH_INTERVAL,
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/INR");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.rates) throw new Error("No rates in response");

      const newRates: Record<string, number> = {
        USD: data.rates.USD ?? FALLBACK_RATES.USD,
        EUR: data.rates.EUR ?? FALLBACK_RATES.EUR,
        GBP: data.rates.GBP ?? FALLBACK_RATES.GBP,
      };

      setRateState((prev) => ({
        ...prev,
        rates: newRates,
        status: "live",
        lastUpdated: new Date(),
        countdown: REFRESH_INTERVAL,
      }));
    } catch {
      setRateState((prev) => ({
        ...prev,
        status: prev.lastUpdated ? "cached" : "fallback",
        countdown: REFRESH_INTERVAL,
      }));
    }
  }, []);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchRates();

    fetchIntervalRef.current = setInterval(fetchRates, REFRESH_INTERVAL * 1000);

    return () => {
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, [fetchRates]);

  // Countdown ticker
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setRateState((prev) => ({
        ...prev,
        countdown: Math.max(0, prev.countdown - 1),
      }));
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleManualRefresh = () => {
    setRateState((prev) => ({
      ...prev,
      status: "loading",
      countdown: REFRESH_INTERVAL,
    }));
    if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    fetchRates();
    fetchIntervalRef.current = setInterval(fetchRates, REFRESH_INTERVAL * 1000);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "bot",
      text: "Hi! I'm your Smart Finance Assistant. Ask me anything about saving, budgeting, investing, or habits! 😊",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const uid = Date.now().toString();
    setMessages((prev) => [...prev, { id: uid, role: "user", text: userMsg }]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `${uid}b`, role: "bot", text: getAIResponse(userMsg) },
      ]);
    }, 400);
  };

  const isLive = rateState.status === "live";
  const isLoading = rateState.status === "loading";
  const hasError =
    rateState.status === "cached" ||
    rateState.status === "fallback" ||
    rateState.status === "error";

  return (
    <div className="space-y-5" data-ocid="tools.section">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-foreground">Tools 🛠️</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Calculators and smart assistants
        </p>
      </div>

      {/* SIP Calculator */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
            <Calculator size={18} />
          </div>
          <h2 className="font-semibold text-foreground">SIP Calculator</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="sip-amount"
              className="text-xs text-muted-foreground mb-1 block"
            >
              Monthly Amount (₹)
            </label>
            <Input
              id="sip-amount"
              value={sipP}
              onChange={(e) => setSipP(e.target.value)}
              type="number"
              min="0"
              className="text-sm"
              data-ocid="sip.amount_input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="sip-years"
                className="text-xs text-muted-foreground mb-1 block"
              >
                Years
              </label>
              <Input
                id="sip-years"
                value={sipY}
                onChange={(e) => setSipY(e.target.value)}
                type="number"
                min="1"
                className="text-sm"
                data-ocid="sip.years_input"
              />
            </div>
            <div>
              <label
                htmlFor="sip-rate"
                className="text-xs text-muted-foreground mb-1 block"
              >
                Annual Rate (%)
              </label>
              <Input
                id="sip-rate"
                value={sipR}
                onChange={(e) => setSipR(e.target.value)}
                type="number"
                min="0"
                className="text-sm"
                data-ocid="sip.rate_input"
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={calcSIP}
            data-ocid="sip.submit_button"
          >
            Calculate Future Value
          </Button>
          {sipResult !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/10 rounded-xl p-4 text-center"
              data-ocid="sip.success_state"
            >
              <p className="text-xs text-muted-foreground">
                Estimated Future Value
              </p>
              <p className="text-3xl font-bold text-primary mt-1">
                ₹{sipResult.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Invested: ₹
                {(Number(sipP) * Number(sipY) * 12).toLocaleString("en-IN")} →
                Gains: ₹
                {(sipResult - Number(sipP) * Number(sipY) * 12).toLocaleString(
                  "en-IN",
                )}
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* EMI Calculator */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
            <Landmark size={18} />
          </div>
          <h2 className="font-semibold text-foreground">EMI Calculator</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="emi-principal"
              className="text-xs text-muted-foreground mb-1 block"
            >
              Loan Amount (₹)
            </label>
            <Input
              id="emi-principal"
              value={emiPrincipal}
              onChange={(e) => setEmiPrincipal(e.target.value)}
              type="number"
              min="0"
              placeholder="500000"
              className="text-sm"
              data-ocid="emi.principal_input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="emi-rate"
                className="text-xs text-muted-foreground mb-1 block"
              >
                Annual Interest Rate (%)
              </label>
              <Input
                id="emi-rate"
                value={emiRate}
                onChange={(e) => setEmiRate(e.target.value)}
                type="number"
                min="0"
                step="0.1"
                placeholder="8.5"
                className="text-sm"
                data-ocid="emi.rate_input"
              />
            </div>
            <div>
              <label
                htmlFor="emi-years"
                className="text-xs text-muted-foreground mb-1 block"
              >
                Loan Tenure (Years)
              </label>
              <Input
                id="emi-years"
                value={emiYears}
                onChange={(e) => setEmiYears(e.target.value)}
                type="number"
                min="1"
                placeholder="20"
                className="text-sm"
                data-ocid="emi.years_input"
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={calcEMI}
            data-ocid="emi.submit_button"
          >
            Calculate EMI
          </Button>
          {emiError && (
            <p className="text-xs text-red-500 text-center">{emiError}</p>
          )}
          {emiResult !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-purple-50 rounded-xl p-4 text-center"
              data-ocid="emi.success_state"
            >
              <p className="text-xs text-muted-foreground">Monthly EMI</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                ₹{emiResult.emi.toLocaleString("en-IN")}
              </p>
              <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                <div className="text-center flex-1">
                  <p className="font-medium text-foreground">
                    ₹{emiResult.total.toLocaleString("en-IN")}
                  </p>
                  <p>Total Payable</p>
                </div>
                <div className="text-center flex-1 border-l border-border">
                  <p className="font-medium text-foreground">
                    ₹{emiResult.interest.toLocaleString("en-IN")}
                  </p>
                  <p>Total Interest</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Currency Converter */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
              <Globe size={18} />
            </div>
            <h2 className="font-semibold text-foreground">
              Currency Converter
            </h2>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            aria-label="Refresh exchange rates"
            disabled={isLoading}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            data-ocid="currency.refresh_button"
          >
            <RefreshCw size={14} className={isLoading ? "spin-loader" : ""} />
          </button>
        </div>

        {/* Live rate status badge */}
        <div
          className="flex items-center gap-2 mb-4"
          data-ocid="currency.rate_status"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw size={11} className="spin-loader" />
              Fetching live rates…
            </span>
          ) : isLive ? (
            <>
              <span className="flex items-center gap-1 text-xs font-medium text-accent">
                <Wifi size={11} />
                Live rates
              </span>
              <span className="text-xs text-muted-foreground">
                · Updated{" "}
                {rateState.lastUpdated
                  ? formatTime(rateState.lastUpdated)
                  : "—"}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Refresh in {rateState.countdown}s
              </span>
            </>
          ) : hasError ? (
            <span className="flex items-center gap-1 text-xs text-orange-500">
              <WifiOff size={11} />
              {rateState.status === "fallback"
                ? "Using estimated rates — check connection"
                : `Using cached rates · Updated ${rateState.lastUpdated ? formatTime(rateState.lastUpdated) : "—"}`}
            </span>
          ) : null}
        </div>

        {/* INR input */}
        <div className="mb-4">
          <label
            htmlFor="inr-amount"
            className="text-xs text-muted-foreground mb-1 block"
          >
            Amount in INR (₹)
          </label>
          <Input
            id="inr-amount"
            value={inrAmount}
            onChange={(e) => setInrAmount(e.target.value)}
            type="number"
            min="0"
            placeholder="Enter INR amount"
            className="text-sm"
            data-ocid="currency.input"
          />
        </div>

        {/* Results grid */}
        <div className="grid grid-cols-3 gap-3" data-ocid="currency.results">
          {CURRENCIES.map((cur) => {
            const rate =
              rateState.rates[cur.label] ?? FALLBACK_RATES[cur.label];
            const converted = (inr * rate).toFixed(2);
            return (
              <div
                key={cur.label}
                className="bg-muted/50 rounded-xl p-3 text-center relative"
              >
                {isLoading && (
                  <div className="absolute inset-0 rounded-xl bg-muted/60 flex items-center justify-center">
                    <RefreshCw
                      size={14}
                      className="spin-loader text-muted-foreground"
                    />
                  </div>
                )}
                <p className="text-lg">{cur.flag}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cur.label}
                </p>
                <p
                  className={`font-bold text-foreground mt-1 ${isLoading ? "opacity-30" : ""}`}
                >
                  {cur.symbol}
                  {converted}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  1 ₹ = {cur.symbol}
                  {rate.toFixed(5)}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* AI Assistant */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-accent">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Ask about saving, budgeting, investing
            </p>
          </div>
        </div>

        <div
          className="bg-muted/40 rounded-xl p-3 h-56 overflow-y-auto mb-3 space-y-3"
          data-ocid="ai.panel"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask a question..."
            className="flex-1 text-sm"
            data-ocid="ai.input"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            data-ocid="ai.submit_button"
          >
            <Send size={16} />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
