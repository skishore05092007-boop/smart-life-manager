import { type ParsedTransaction, createActor } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Mic,
  PiggyBank,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "../hooks/useLocalStorage";

// ─── Web Speech API type shim ───
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export type ExpenseCategory =
  | "Food"
  | "Travel"
  | "Shopping"
  | "Entertainment"
  | "Health"
  | "Other";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  merchantName?: string;
  category?: ExpenseCategory;
}

interface ImpulseLock {
  amount: number;
  lockedAt: number;
}

const CATEGORIES: ExpenseCategory[] = [
  "Food",
  "Travel",
  "Shopping",
  "Entertainment",
  "Health",
  "Other",
];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: "bg-orange-100 text-orange-700",
  Travel: "bg-blue-100 text-blue-700",
  Shopping: "bg-pink-100 text-pink-700",
  Entertainment: "bg-purple-100 text-purple-700",
  Health: "bg-green-100 text-green-700",
  Other: "bg-muted text-muted-foreground",
};

const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_EXPENSES: Expense[] = [
  {
    id: "1",
    description: "Groceries",
    amount: 850,
    date: TODAY,
    merchantName: "Local Mart",
    category: "Food",
  },
  {
    id: "2",
    description: "Metro Pass",
    amount: 200,
    date: TODAY,
    merchantName: "DMRC",
    category: "Travel",
  },
  {
    id: "3",
    description: "Coffee",
    amount: 120,
    date: TODAY,
    merchantName: "Café Coffee Day",
    category: "Food",
  },
];

const QUICK_LOGS = [
  {
    id: "chai",
    emoji: "☕",
    label: "Chai/Coffee",
    amount: 20,
    category: "Food" as ExpenseCategory,
    cardClass: "bg-amber-50 border-amber-200 text-amber-900",
    badgeClass: "bg-amber-200 text-amber-800",
  },
  {
    id: "lunch",
    emoji: "🍱",
    label: "Lunch",
    amount: 100,
    category: "Food" as ExpenseCategory,
    cardClass: "bg-green-50 border-green-200 text-green-900",
    badgeClass: "bg-green-200 text-green-800",
  },
  {
    id: "travel",
    emoji: "🚌",
    label: "Travel",
    amount: 50,
    category: "Travel" as ExpenseCategory,
    cardClass: "bg-blue-50 border-blue-200 text-blue-900",
    badgeClass: "bg-blue-200 text-blue-800",
  },
  {
    id: "other",
    emoji: "💳",
    label: "Other",
    amount: 50,
    category: "Other" as ExpenseCategory,
    cardClass: "bg-slate-50 border-slate-200 text-slate-900",
    badgeClass: "bg-slate-200 text-slate-700",
  },
] as const;

// ─── Voice Log Types ───
interface VoiceParseResult {
  amount: number;
  category: ExpenseCategory;
  type: "DEBIT" | "CREDIT";
  description: string;
  merchantName?: string;
}

// ─── Simple Voice Expense Parser ───
interface SimpleVoiceExpense {
  title: string;
  amount: number;
}

const CURRENCY_WORDS = new Set(["rs", "rupees", "inr", "₹", "paisa", "paise"]);

function parseSimpleVoiceExpense(text: string): SimpleVoiceExpense | null {
  const lower = text.toLowerCase();
  // Extract first number (integer or decimal)
  const numMatch = lower.match(/(\d+(?:\.\d+)?)/);
  if (!numMatch) return null;
  const amount = Number.parseFloat(numMatch[1]);
  if (Number.isNaN(amount) || amount <= 0) return null;

  // Build title from words that are NOT numbers and NOT currency words
  const tokens = lower.split(/\s+/);
  const titleTokens: string[] = [];
  for (const token of tokens) {
    const clean = token.replace(/[^a-z0-9]/g, "");
    if (!clean) continue;
    if (/^\d+(?:\.\d+)?$/.test(clean)) continue;
    if (CURRENCY_WORDS.has(clean)) continue;
    titleTokens.push(clean);
  }
  const title = titleTokens.join(" ") || "Expense";
  return { title, amount };
}

function mapTitleToCategory(title: string): ExpenseCategory {
  const lower = title.toLowerCase();
  if (
    /\b(food|chai|tea|coffee|lunch|dinner|breakfast|snack|meal|biryani|pizza|burger)\b/.test(
      lower,
    )
  )
    return "Food";
  if (
    /\b(travel|uber|ola|rapido|cab|auto|bus|train|metro|petrol|fuel|gas|flight)\b/.test(
      lower,
    )
  )
    return "Travel";
  if (
    /\b(shopping|amazon|flipkart|myntra|clothes|shoes|mall|buy|purchase)\b/.test(
      lower,
    )
  )
    return "Shopping";
  if (
    /\b(netflix|spotify|youtube|movie|game|ott|entertainment|pub|party)\b/.test(
      lower,
    )
  )
    return "Entertainment";
  if (
    /\b(medicine|doctor|hospital|gym|pharmacy|health|fitness|yoga)\b/.test(
      lower,
    )
  )
    return "Health";
  return "Other";
}

// Known merchants for name extraction
const KNOWN_MERCHANTS: { name: string; keywords: string[] }[] = [
  { name: "Zomato", keywords: ["zomato"] },
  { name: "Swiggy", keywords: ["swiggy"] },
  { name: "Amazon", keywords: ["amazon"] },
  { name: "Flipkart", keywords: ["flipkart"] },
  { name: "Myntra", keywords: ["myntra"] },
  { name: "Netflix", keywords: ["netflix"] },
  { name: "Spotify", keywords: ["spotify"] },
  { name: "YouTube", keywords: ["youtube"] },
  { name: "Uber", keywords: ["uber"] },
  { name: "Ola", keywords: ["ola"] },
  { name: "Rapido", keywords: ["rapido"] },
  { name: "Nippon", keywords: ["nippon"] },
  { name: "SIP", keywords: ["sip"] },
];

const WORD_MAP: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
};

function wordsToNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();

  // "half a lakh" → 50000
  if (/half\s+a\s+lakh/.test(lower)) return 50000;

  // "X lakh" or "X lakh Y thousand" etc.
  const lakhMatch = lower.match(
    /(one|two|three|four|five|six|seven|eight|nine|\d+)\s+lakh/,
  );
  if (lakhMatch) {
    const base = WORD_MAP[lakhMatch[1]] ?? Number(lakhMatch[1]);
    return base * 100000;
  }

  // "X.Yk" or "Xk"
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return Number.parseFloat(kMatch[1]) * 1000;

  // Digit with rupee symbols: ₹500, Rs.500, Rs 500, INR 500
  const digitMatch = lower.match(/(?:₹|rs\.?|inr)\s*(\d+(?:[,\d]*)(?:\.\d+)?)/);
  if (digitMatch) {
    const cleaned = digitMatch[1].replace(/,/g, "");
    return Number.parseFloat(cleaned);
  }

  // "X point Y" → X.Y
  const pointMatch = lower.match(/(\w+)\s+point\s+(\w+)/);
  if (pointMatch) {
    const intPart = WORD_MAP[pointMatch[1]] ?? Number(pointMatch[1]);
    const decPart = WORD_MAP[pointMatch[2]] ?? Number(pointMatch[2]);
    if (!Number.isNaN(intPart) && !Number.isNaN(decPart))
      return Number.parseFloat(`${intPart}.${decPart}`);
  }

  // Compound word numbers: "two thousand five hundred" → 2500, "five hundred" → 500
  const wordTokens = lower.split(/[\s,]+/);
  let total = 0;
  let current = 0;
  let found = false;
  for (const token of wordTokens) {
    const num = WORD_MAP[token];
    if (num !== undefined) {
      found = true;
      if (num === 1000 || num === 100000) {
        current = (current || 1) * num;
        total += current;
        current = 0;
      } else if (num === 100) {
        current = (current || 1) * num;
      } else {
        current += num;
      }
    } else if (/^\d+(?:\.\d+)?$/.test(token)) {
      found = true;
      const n = Number.parseFloat(token);
      if (!Number.isNaN(n)) current += n;
    }
  }
  if (found) return total + current;

  return null;
}

/** Pure function — parses a free-text voice/typed log entry into a structured expense. */
export function parseVoiceInput(text: string): VoiceParseResult | null {
  const lower = text.toLowerCase();

  // ── Amount detection ──
  let amount: number | null = null;

  // Try digit-based amount first (₹500, Rs.500, 500 rupees, plain number)
  const digitRupeeMatch = lower.match(
    /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)/i,
  );
  if (digitRupeeMatch) {
    amount = Number.parseFloat(digitRupeeMatch[1].replace(/,/g, ""));
  }

  if (!amount) {
    const rupeesMatch = lower.match(/(\d[\d,]*(?:\.\d+)?)\s*rupees?/i);
    if (rupeesMatch)
      amount = Number.parseFloat(rupeesMatch[1].replace(/,/g, ""));
  }

  // Try word-based amount
  if (!amount) {
    amount = wordsToNumber(text);
  }

  // Try bare digit at start or after trigger words
  if (!amount) {
    const bareMatch = lower.match(
      /(?:paid|spent|debited|for|charged|received|got|salary|earned)?\s*(\d[\d,]*(?:\.\d+)?)/i,
    );
    if (bareMatch) amount = Number.parseFloat(bareMatch[1].replace(/,/g, ""));
  }

  if (!amount || amount <= 0) return null;

  // ── CREDIT / DEBIT detection ──
  const creditKw =
    /\b(received|credited|got|income|salary|bonus|refund|cashback|freelance|earned)\b/i;
  const type: "DEBIT" | "CREDIT" = creditKw.test(lower) ? "CREDIT" : "DEBIT";

  // ── Category detection (priority order) ──
  let category: ExpenseCategory = "Other";
  let isInvestment = false;

  if (
    /\b(sip|small\s*cap|nippon|market|mutual\s*fund|stock|invest)\b/i.test(
      lower,
    )
  ) {
    category = "Other";
    isInvestment = true;
  } else if (
    /\b(zomato|swiggy|lunch|dinner|breakfast|chai|tea|coffee|snack|eat|food|restaurant|hotel)\b/i.test(
      lower,
    )
  ) {
    category = "Food";
  } else if (
    /\b(uber|ola|rapido|cab|auto|bus|train|metro|travel|petrol|fuel|gas)\b/i.test(
      lower,
    )
  ) {
    category = "Travel";
  } else if (
    /\b(amazon|flipkart|myntra|shop|mall|clothes|buy|purchase)\b/i.test(lower)
  ) {
    category = "Shopping";
  } else if (/\b(netflix|spotify|youtube|movie|game|ott)\b/i.test(lower)) {
    category = "Entertainment";
  } else if (
    /\b(medicine|doctor|hospital|gym|pharmacy|health)\b/i.test(lower)
  ) {
    category = "Health";
  }

  // ── Merchant name extraction ──
  let merchantName: string | undefined;
  for (const m of KNOWN_MERCHANTS) {
    if (m.keywords.some((kw) => lower.includes(kw))) {
      merchantName = m.name;
      break;
    }
  }

  // ── Description ──
  let description = text
    .replace(/(?:₹|rs\.?|inr)\s*\d[\d,]*(?:\.\d+)?/gi, "")
    .replace(/\b\d[\d,]*(?:\.\d+)?\s*(?:rupees?|k)?\b/gi, "")
    .replace(
      /\b(paid|debited|spent|bought|charged|received|credited|got|for|to|on|the|a|an|my|i)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  if (!description) description = merchantName ?? "Expense";
  if (isInvestment)
    description = `Investment: ${description || (merchantName ?? "SIP/Fund")}`;

  return { amount, category, type, description, merchantName };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00h 00m 00s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Sum of expenses for the current calendar month. */
function currentMonthSpending(expenses: Expense[]): number {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return expenses
    .filter((e) => e.date.startsWith(yearMonth))
    .reduce((s, e) => s + e.amount, 0);
}

/** Derive card colour class based on spending vs budget. */
function allowanceCardClass(spending: number, budget: number): string {
  if (budget <= 0) return "bg-muted/60 border-border";
  if (spending >= budget) return "bg-red-100 border-red-300";
  if (spending >= budget * 0.8) return "bg-yellow-100 border-yellow-300";
  return "bg-green-100 border-green-300";
}

function allowanceAmountClass(spending: number, budget: number): string {
  if (budget <= 0) return "text-muted-foreground";
  if (spending >= budget) return "text-red-700";
  if (spending >= budget * 0.8) return "text-yellow-700";
  return "text-green-700";
}

export default function Finance() {
  const [expenses, setExpenses] = useLocalStorage<Expense[]>(
    "slm_expenses",
    DEFAULT_EXPENSES,
  );
  const [, setWealthScore] = useLocalStorage<number>("slm_wealth_score", 70);
  const [impulseLock, setImpulseLock] = useLocalStorage<ImpulseLock | null>(
    "slm_impulse_lock",
    null,
  );
  const [budgetData, setBudgetData] = useLocalStorage<{ income: number }>(
    "slm_budget",
    { income: 40000 },
  );
  const [dailyBudget] = useLocalStorage<{ limit: number } | null>(
    "slm_daily_budget",
    null,
  );
  const [salaryData, setSalaryData] = useLocalStorage<{ salary: number }>(
    "slm_salary",
    { salary: 0 },
  );

  // ─── Backend actor ───
  const { actor } = useActor(createActor);

  // ─── Voice Log state ───
  const [voiceText, setVoiceText] = useState("");
  const [voiceResult, setVoiceResult] = useState<VoiceParseResult | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [isParsingAI, setIsParsingAI] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isMicListening, setIsMicListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // ─── Simple Mic state (separate from AI Voice Log) ───
  const [isSimpleMicListening, setIsSimpleMicListening] = useState(false);
  const simpleRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const simpleMicSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [incomeInput, setIncomeInput] = useState(
    String(budgetData.income || ""),
  );
  const [salaryInput, setSalaryInput] = useState(
    String(salaryData.salary || ""),
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showImpulseModal, setShowImpulseModal] = useState(false);
  const [impulseInput, setImpulseInput] = useState("");
  const [impulseSuccess, setImpulseSuccess] = useState(false);
  const [countdown, setCountdown] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for active impulse lock
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!impulseLock) {
      setCountdown("");
      return;
    }
    const tick = () => {
      const elapsed = Date.now() - impulseLock.lockedAt;
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      setCountdown(formatCountdown(remaining));
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [impulseLock]);

  // --- Derived values for Passive Wealth Hub ---
  const monthlyBudget = budgetData.income;
  const monthSpending = currentMonthSpending(expenses);

  // Daily spending power — uses user-defined daily limit from Settings
  const dailyLimit = dailyBudget?.limit ?? null;
  const todaySpending = expenses
    .filter((e) => e.date === TODAY)
    .reduce((s, e) => s + e.amount, 0);
  const spendingPower = dailyLimit !== null ? dailyLimit - todaySpending : null;

  // For the card color, use daily limit vs today's spending when set,
  // otherwise fall back to monthly budget ratio
  const cardClass =
    dailyLimit !== null
      ? allowanceCardClass(todaySpending, dailyLimit)
      : allowanceCardClass(monthSpending, monthlyBudget);
  const amountClass =
    dailyLimit !== null
      ? allowanceAmountClass(todaySpending, dailyLimit)
      : allowanceAmountClass(monthSpending, monthlyBudget);

  // Budget status messaging
  const budgetStatusText =
    dailyLimit !== null
      ? todaySpending >= dailyLimit
        ? "Over daily limit"
        : todaySpending >= dailyLimit * 0.8
          ? "Approaching limit"
          : "On track"
      : monthlyBudget > 0
        ? monthSpending >= monthlyBudget
          ? "Over budget"
          : monthSpending >= monthlyBudget * 0.8
            ? "Approaching limit"
            : "On track"
        : "";

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  /** Map backend category string → frontend ExpenseCategory */
  const mapBackendCategory = useCallback(
    (
      cat: string,
      isInvestment: boolean,
    ): { category: ExpenseCategory; descPrefix: string } => {
      if (isInvestment || /invest/i.test(cat))
        return { category: "Other", descPrefix: "Investment: " };
      const map: Record<string, ExpenseCategory> = {
        Food: "Food",
        "Food & Dining": "Food",
        Transport: "Travel",
        Travel: "Travel",
        Shopping: "Shopping",
        Entertainment: "Entertainment",
        Health: "Health",
      };
      return {
        category: (map[cat] ?? "Other") as ExpenseCategory,
        descPrefix: "",
      };
    },
    [],
  );

  /** Log a parsed result directly into expenses (no confirm step). */
  const logParsedExpense = useCallback(
    (result: VoiceParseResult) => {
      const newExp: Expense = {
        id: Date.now().toString(),
        description: result.description,
        amount: result.amount,
        date: TODAY,
        merchantName: result.merchantName,
        category: result.category,
      };
      setExpenses((prev) => [newExp, ...prev]);
      if (result.type === "DEBIT") {
        setWealthScore((prev) => Math.max(0, prev - 1));
      }
      const merchant = result.merchantName ?? result.description;
      toast.success(
        `✅ Added ₹${result.amount.toLocaleString("en-IN")} for ${merchant} (${result.category})`,
        { duration: 3000 },
      );
    },
    [setExpenses, setWealthScore],
  );

  /** Try AI backend parse first, fall back to local parse on failure. */
  const handleVoiceParse = useCallback(async () => {
    const text = voiceText.trim();
    if (!text) {
      setVoiceError("Please describe your expense");
      return;
    }
    setVoiceError("");
    setVoiceResult(null);

    // Try AI backend first
    if (actor) {
      setIsParsingAI(true);
      try {
        const res = await actor.parseTransaction(text);
        if (res.__kind__ === "ok") {
          const pt: ParsedTransaction = res.ok;
          const isInvestment =
            /\b(sip|small\s*cap|nippon|market|mutual\s*fund|stock|invest)\b/i.test(
              text,
            );
          const { category, descPrefix } = mapBackendCategory(
            pt.category,
            isInvestment,
          );
          const result: VoiceParseResult = {
            amount: pt.amount,
            category,
            type: pt.transactionType === "INCOME" ? "CREDIT" : "DEBIT",
            description: `${descPrefix}${pt.merchant || text.slice(0, 40)}`,
            merchantName: pt.merchant || undefined,
          };
          logParsedExpense(result);
          setVoiceText("");
          return;
        }
      } catch {
        // fall through to local parse
      } finally {
        setIsParsingAI(false);
      }
    }

    // Local fallback
    const result = parseVoiceInput(text);
    if (!result) {
      setVoiceError("Couldn't detect an amount. Try: 'Paid 200 for lunch'");
      return;
    }
    logParsedExpense(result);
    setVoiceText("");
  }, [voiceText, actor, mapBackendCategory, logParsedExpense]);

  /** Handle camera/receipt image capture → base64 → backend parse */
  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!e.target.files?.length || !file) return;
      // Reset input so same file can be re-selected
      e.target.value = "";

      setVoiceError("");
      setIsParsingAI(true);

      try {
        // Convert image to base64 data URL
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Prefix so backend knows it's an image
        const payload = `[RECEIPT_IMAGE]${base64}`;

        if (actor) {
          const res = await actor.parseTransaction(payload);
          if (res.__kind__ === "ok") {
            const pt: ParsedTransaction = res.ok;
            const { category, descPrefix } = mapBackendCategory(
              pt.category,
              false,
            );
            const result: VoiceParseResult = {
              amount: pt.amount,
              category,
              type: pt.transactionType === "INCOME" ? "CREDIT" : "DEBIT",
              description: `${descPrefix}${pt.merchant || "Receipt"}`,
              merchantName: pt.merchant || undefined,
            };
            logParsedExpense(result);
            return;
          }
          setVoiceError(
            "Could not parse receipt. Try again or use manual entry.",
          );
          return;
        }
        setVoiceError("Service unavailable. Please try again shortly.");
      } catch {
        setVoiceError(
          "Could not parse receipt. Try again or use manual entry.",
        );
      } finally {
        setIsParsingAI(false);
      }
    },
    [actor, mapBackendCategory, logParsedExpense],
  );

  const _handleVoiceLog = useCallback(() => {
    if (!voiceResult) return;
    logParsedExpense(voiceResult);
    setVoiceText("");
    setVoiceResult(null);
    setVoiceError("");
  }, [voiceResult, logParsedExpense]);

  const _handleVoiceDismiss = useCallback(() => {
    setVoiceResult(null);
    setVoiceError("");
  }, []);
  /** Start / stop Web Speech API microphone recording. */
  const handleMicToggle = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error(
        "Microphone not supported on this browser. Use the text input instead.",
        { duration: 4000 },
      );
      return;
    }

    if (isMicListening) {
      recognitionRef.current?.stop();
      setIsMicListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setVoiceText(transcript);
        setVoiceError("");
        setVoiceResult(null);
        // Auto-trigger parse after short delay so textarea updates first
        setTimeout(() => {
          const text = transcript.trim();
          if (!text) return;
          setVoiceError("");
          setVoiceResult(null);
          if (actor) {
            setIsParsingAI(true);
            actor
              .parseTransaction(text)
              .then((res) => {
                if (res.__kind__ === "ok") {
                  const pt = res.ok;
                  const isInvestment =
                    /\b(sip|small\s*cap|nippon|market|mutual\s*fund|stock|invest)\b/i.test(
                      text,
                    );
                  const { category, descPrefix } = mapBackendCategory(
                    pt.category,
                    isInvestment,
                  );
                  const result: VoiceParseResult = {
                    amount: pt.amount,
                    category,
                    type: pt.transactionType === "INCOME" ? "CREDIT" : "DEBIT",
                    description: `${descPrefix}${pt.merchant || text.slice(0, 40)}`,
                    merchantName: pt.merchant || undefined,
                  };
                  logParsedExpense(result);
                  setVoiceText("");
                }
              })
              .catch(() => {
                const result = parseVoiceInput(text);
                if (result) {
                  logParsedExpense(result);
                  setVoiceText("");
                } else {
                  setVoiceError(
                    "Couldn't detect an amount. Try: 'Paid 200 for lunch'",
                  );
                }
              })
              .finally(() => setIsParsingAI(false));
          } else {
            const result = parseVoiceInput(text);
            if (result) {
              logParsedExpense(result);
              setVoiceText("");
            } else {
              setVoiceError(
                "Couldn't detect an amount. Try: 'Paid 200 for lunch'",
              );
            }
          }
        }, 80);
      }
    };

    recognition.onerror = () => {
      setIsMicListening(false);
      toast.error("Microphone error. Please try again.", { duration: 3000 });
    };

    recognition.onend = () => {
      setIsMicListening(false);
    };

    recognition.start();
    setIsMicListening(true);
  }, [isMicListening, actor, mapBackendCategory, logParsedExpense]);

  const addExpense = () => {
    if (!desc.trim() || !amount || Number(amount) <= 0) {
      toast.error("Please enter a description and valid amount");
      return;
    }
    const newExp: Expense = {
      id: Date.now().toString(),
      description: desc.trim(),
      amount: Number(amount),
      date: TODAY,
      merchantName: merchantName.trim() || undefined,
      category: category || undefined,
    };
    setExpenses((prev) => [newExp, ...prev]);
    setDesc("");
    setAmount("");
    setMerchantName("");
    setCategory("");
    toast.success("Expense added!");
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Expense deleted");
  };

  const handleQuickLog = (log: (typeof QUICK_LOGS)[number]) => {
    const newExp: Expense = {
      id: `quick-${Date.now()}`,
      description: log.label,
      amount: log.amount,
      date: TODAY,
      merchantName: log.label,
      category: log.category,
    };
    setExpenses((prev) => [newExp, ...prev]);
    setWealthScore((prev) => Math.min(100, prev + 1));
    toast.success(`Logged ₹${log.amount}`);
  };

  const handleImpulseConfirm = () => {
    const val = Number(impulseInput);
    if (!val || val <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setImpulseLock({ amount: val, lockedAt: Date.now() });
    setImpulseSuccess(true);
  };

  const handleImpulseModalClose = () => {
    setShowImpulseModal(false);
    setImpulseInput("");
    setImpulseSuccess(false);
  };

  const handleLogExpiredImpulse = () => {
    if (!impulseLock) return;
    const newExp: Expense = {
      id: `impulse-${Date.now()}`,
      description: "Impulse Purchase",
      amount: impulseLock.amount,
      date: TODAY,
      category: "Shopping",
    };
    setExpenses((prev) => [newExp, ...prev]);
    setWealthScore((prev) => Math.max(0, prev - 3));
    setImpulseLock(null);
    toast.error(
      `₹${impulseLock.amount.toLocaleString("en-IN")} logged as expense.`,
    );
  };

  const handleLetItGo = () => {
    if (!impulseLock) return;
    const saved = impulseLock.amount;
    setWealthScore((prev) => Math.min(100, prev + 5));
    setImpulseLock(null);
    toast.success(
      `Great discipline! 🎉 You saved ₹${saved.toLocaleString("en-IN")}!`,
    );
  };

  /** Simple mic toggle — uses Web Speech API directly, no backend calls */
  const handleSimpleMicToggle = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      toast.error("Voice not supported in this browser", { duration: 3000 });
      return;
    }

    if (isSimpleMicListening) {
      simpleRecognitionRef.current?.stop();
      setIsSimpleMicListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    simpleRecognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (!transcript) return;
      const parsed = parseSimpleVoiceExpense(transcript);
      if (parsed) {
        const category = mapTitleToCategory(parsed.title);
        const newExp: Expense = {
          id: Date.now().toString(),
          description: parsed.title,
          amount: parsed.amount,
          date: TODAY,
          merchantName: parsed.title,
          category,
        };
        setExpenses((prev) => [newExp, ...prev]);
        toast.success(
          `Saved: ${parsed.title} ₹${parsed.amount.toLocaleString("en-IN")}`,
          { duration: 3000 },
        );
      } else {
        toast.error("Could not parse. Try 'food 100'", { duration: 3000 });
      }
    };

    recognition.onerror = () => {
      setIsSimpleMicListening(false);
      toast.error("Microphone error. Please try again.", { duration: 3000 });
    };

    recognition.onend = () => {
      setIsSimpleMicListening(false);
    };

    recognition.start();
    setIsSimpleMicListening(true);
  }, [isSimpleMicListening, setExpenses]);

  const applyIncome = () => {
    const val = Number(incomeInput);
    if (val > 0) {
      setBudgetData({ income: val });
      toast.success("Budget updated!");
    }
  };

  const applySalary = () => {
    const val = Number(salaryInput);
    if (val > 0) {
      setSalaryData({ salary: val });
      toast.success("Salary plan updated!");
    }
  };

  const income = budgetData.income;
  const salary = salaryData.salary;

  const isLockActive =
    !!impulseLock && Date.now() - impulseLock.lockedAt < 24 * 60 * 60 * 1000;
  const isLockExpired =
    !!impulseLock && Date.now() - impulseLock.lockedAt >= 24 * 60 * 60 * 1000;

  const lockedAtDate = impulseLock
    ? new Date(impulseLock.lockedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="space-y-5" data-ocid="finance.section">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-foreground">Finance 💰</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track expenses and plan your budget
        </p>
      </div>

      {/* ─── Passive Wealth Hub ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
        data-ocid="wealth_hub.section"
      >
        {/* Daily Allowance Card */}
        <div
          className={`rounded-2xl border-2 p-5 transition-colors duration-500 ${cardClass}`}
          data-ocid="wealth_hub.allowance_card"
        >
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
              Today's Spending Power
            </p>
            {budgetStatusText && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  monthSpending >= monthlyBudget
                    ? "bg-red-200/60 text-red-800"
                    : monthSpending >= monthlyBudget * 0.8
                      ? "bg-yellow-200/60 text-yellow-800"
                      : "bg-green-200/60 text-green-800"
                }`}
              >
                {budgetStatusText}
              </span>
            )}
          </div>
          {spendingPower !== null ? (
            <>
              <p
                className={`text-5xl font-extrabold leading-none mt-2 ${amountClass}`}
              >
                {spendingPower < 0 ? "-" : ""}₹
                {Math.abs(spendingPower).toLocaleString("en-IN")}
              </p>
              <p className="text-sm mt-1.5 opacity-70 font-medium">
                {spendingPower < 0 ? "over your daily limit" : "left today"}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs opacity-60">
                <span>
                  ₹{todaySpending.toLocaleString("en-IN")} spent today
                </span>
                <span>·</span>
                <span>Limit: ₹{dailyLimit!.toLocaleString("en-IN")}</span>
              </div>
              {/* Daily budget progress bar */}
              <div className="mt-3">
                <div className="w-full bg-black/10 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ${
                      todaySpending >= dailyLimit!
                        ? "bg-red-600"
                        : todaySpending >= dailyLimit! * 0.8
                          ? "bg-yellow-600"
                          : "bg-green-600"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((todaySpending / dailyLimit!) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-base font-semibold text-muted-foreground mt-2">
              Set a Daily Budget Limit in Settings ⚙️
            </p>
          )}
        </div>

        {/* 3-Second Logger */}
        <div
          className="bg-card rounded-xl border border-border p-5 shadow-sm"
          data-ocid="quicklog.section"
        >
          <h2 className="font-semibold text-foreground mb-1 text-sm">
            ⚡ 3-Second Logger
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            One tap — logged instantly. No forms.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_LOGS.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => handleQuickLog(log)}
                className={`rounded-xl border-2 p-4 text-left transition-all active:scale-95 hover:shadow-md min-h-[84px] flex flex-col gap-1 ${log.cardClass}`}
                data-ocid={`quicklog.${log.id}_button`}
              >
                <span className="text-2xl">{log.emoji}</span>
                <span className="font-bold text-sm">{log.label}</span>
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded-full w-fit ${log.badgeClass}`}
                >
                  ₹{log.amount}
                </span>
              </button>
            ))}
            {/* Simple Voice Mic Button */}
            {simpleMicSupported && (
              <button
                type="button"
                onClick={handleSimpleMicToggle}
                className={`rounded-xl border-2 p-4 text-left transition-all active:scale-95 hover:shadow-md min-h-[84px] flex flex-col gap-1 ${
                  isSimpleMicListening
                    ? "border-red-400 bg-red-50 text-red-600 animate-pulse"
                    : "bg-violet-50 border-violet-200 text-violet-900"
                }`}
                aria-label={
                  isSimpleMicListening
                    ? "Stop voice recording"
                    : "Log expense by voice"
                }
                data-ocid="quicklog.voice_mic_button"
              >
                <span className="text-2xl">🎤</span>
                <span className="font-bold text-sm">
                  {isSimpleMicListening ? "Listening..." : "Voice Log"}
                </span>
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded-full w-fit ${
                    isSimpleMicListening
                      ? "bg-red-200 text-red-800"
                      : "bg-violet-200 text-violet-800"
                  }`}
                >
                  {isSimpleMicListening ? "Speak now" : "Tap & speak"}
                </span>
              </button>
            )}
          </div>
          {isSimpleMicListening && (
            <p className="text-xs text-red-500 font-semibold flex items-center gap-1.5 animate-pulse mt-3">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Listening… say something like "food 100"
            </p>
          )}
        </div>

        {/* Privacy Promise */}
        <p
          className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5 px-2"
          data-ocid="wealth_hub.privacy_note"
        >
          🔒 100% Offline &amp; Private. Your data never leaves this device.
        </p>
      </motion.div>

      {/* ─── AI Voice + Receipt Log ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-3"
        data-ocid="voicelog.section"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground text-base flex items-center gap-2">
              <Mic size={16} className="text-primary shrink-0" />
              AI Voice &amp; Receipt Log
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Speak or type your expense — AI parses and logs it instantly.
            </p>
          </div>
          {/* AI badge */}
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            AI
          </span>
        </div>

        {/* Text input row */}
        <div className="flex gap-2 items-start">
          <textarea
            rows={2}
            value={voiceText}
            onChange={(e) => {
              setVoiceText(e.target.value);
              setVoiceError("");
              setVoiceResult(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleVoiceParse();
              }
            }}
            placeholder="Speak or type your expense… e.g. 'I spent two hundred on lunch'"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            data-ocid="voicelog.textarea"
          />
          {/* Mic button */}
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={isParsingAI}
            className={`shrink-0 w-11 h-[72px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 ${
              isMicListening
                ? "border-red-400 bg-red-50 text-red-600 animate-pulse"
                : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
            aria-label={isMicListening ? "Stop recording" : "Start voice input"}
            data-ocid="voicelog.mic_button"
          >
            <Mic size={18} />
            <span className="text-[9px] font-medium leading-none">
              {isMicListening ? "Stop" : "Speak"}
            </span>
          </button>
          {/* Camera / receipt scan button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isParsingAI}
            className="shrink-0 w-11 h-[72px] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
            aria-label="Scan Receipt"
            data-ocid="voicelog.scan_receipt_button"
          >
            <Camera size={18} />
            <span className="text-[9px] font-medium leading-none">Scan</span>
          </button>
          {/* Hidden file input for camera/gallery */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleCameraCapture}
            data-ocid="voicelog.camera_input"
          />
        </div>
        {/* Listening indicator */}
        {isMicListening && (
          <p
            className="text-xs text-red-500 font-semibold flex items-center gap-1.5 animate-pulse"
            data-ocid="voicelog.listening_state"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            Listening… speak your expense in English (Indian)
          </p>
        )}

        {voiceError && (
          <p
            className="text-xs text-destructive font-medium"
            data-ocid="voicelog.error_state"
          >
            {voiceError}
          </p>
        )}

        <Button
          onClick={() => void handleVoiceParse()}
          disabled={!voiceText.trim() || isParsingAI}
          className="w-full min-h-[44px] text-sm font-semibold"
          data-ocid="voicelog.parse_button"
        >
          {isParsingAI ? (
            <span className="flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Parsing…
            </span>
          ) : (
            "⚡ Log Instantly"
          )}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground">
          🔒 Processed on-device. Your data never leaves this app.
        </p>
      </motion.div>

      {/* Impulse Control Button */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        data-ocid="impulse.section"
      >
        <button
          type="button"
          onClick={() => setShowImpulseModal(true)}
          className="w-full min-h-[56px] rounded-xl bg-destructive text-white font-bold text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all hover:opacity-90"
          data-ocid="impulse.open_modal_button"
        >
          🛑 Wait! I want to buy something
        </button>
      </motion.div>

      {/* Active / Expired Impulse Lock Cards */}
      <AnimatePresence>
        {isLockActive && impulseLock && (
          <motion.div
            key="lock-active"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-3"
            data-ocid="impulse.lock_card"
          >
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-amber-600 shrink-0" />
              <h3 className="font-bold text-amber-900">
                🔒 Active Impulse Lock
              </h3>
            </div>
            <p className="text-sm text-amber-800">
              You locked{" "}
              <span className="font-bold">
                ₹{impulseLock.amount.toLocaleString("en-IN")}
              </span>{" "}
              on {lockedAtDate}
            </p>
            <div className="bg-amber-100 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-700 font-medium mb-1">
                Time Remaining
              </p>
              <p className="text-xl font-bold text-amber-900 tracking-widest font-mono">
                {countdown}
              </p>
            </div>
            <Badge className="bg-amber-200 text-amber-900 border-amber-300 w-full justify-center py-1.5 text-sm">
              Staying Strong 💪
            </Badge>
          </motion.div>
        )}

        {isLockExpired && impulseLock && (
          <motion.div
            key="lock-expired"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-card border-2 border-orange-300 rounded-xl p-5 space-y-4"
            data-ocid="impulse.expired_card"
          >
            <h3 className="font-bold text-foreground text-base">
              ⏰ Lock Expired — Still want it?
            </h3>
            <p className="text-sm text-muted-foreground">
              It's been 24 hours. Do you still want to spend{" "}
              <span className="font-bold text-foreground">
                ₹{impulseLock.amount.toLocaleString("en-IN")}
              </span>
              ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="destructive"
                className="min-h-[48px] text-sm"
                onClick={handleLogExpiredImpulse}
                data-ocid="impulse.log_expense_button"
              >
                Yes, Log as Expense
              </Button>
              <Button
                variant="outline"
                className="min-h-[48px] text-sm border-green-400 text-green-700 hover:bg-green-50"
                onClick={handleLetItGo}
                data-ocid="impulse.let_go_button"
              >
                I Let It Go ✨
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expense Tracker */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
        data-ocid="expense.section"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
            <Wallet size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Expense Tracker</h2>
            <p className="text-xs text-muted-foreground">
              Total:{" "}
              <span className="font-bold text-primary">
                ₹{total.toLocaleString("en-IN")}
              </span>
            </p>
          </div>
        </div>

        {/* Collapsible Custom Expense Form */}
        <button
          type="button"
          onClick={() => setShowCustomForm((v) => !v)}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors mb-3 text-sm font-medium text-foreground"
          data-ocid="expense.custom_form_toggle"
        >
          <span className="flex items-center gap-2">
            <Plus size={15} />
            Add Custom Expense
          </span>
          {showCustomForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showCustomForm && (
            <motion.div
              key="custom-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 mb-4 pt-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Description"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addExpense()}
                    className="flex-1 text-sm"
                    data-ocid="expense.input"
                  />
                  <Input
                    placeholder="₹ Amount"
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addExpense()}
                    className="w-28 text-sm"
                    data-ocid="expense.amount_input"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Merchant Name (optional)"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="flex-1 text-sm"
                    data-ocid="expense.merchant_input"
                  />
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as ExpenseCategory)}
                  >
                    <SelectTrigger
                      className="w-36 text-sm"
                      data-ocid="expense.category_select"
                    >
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    onClick={addExpense}
                    data-ocid="expense.add_button"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expense List */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {expenses.length === 0 && (
            <p
              className="text-center text-muted-foreground text-sm py-4"
              data-ocid="expense.empty_state"
            >
              No expenses yet
            </p>
          )}
          <AnimatePresence>
            {expenses.map((exp, i) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                data-ocid={`expense.item.${i + 1}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">
                      {exp.description}
                    </p>
                    {exp.category && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${CATEGORY_COLORS[exp.category]}`}
                      >
                        {exp.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {exp.merchantName ? `${exp.merchantName} · ` : ""}
                    {exp.date}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-semibold text-primary">
                    ₹{exp.amount.toLocaleString("en-IN")}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExpense(exp.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    data-ocid={`expense.delete_button.${i + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Budget Planner (50/30/20) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-accent">
            <PiggyBank size={18} />
          </div>
          <h2 className="font-semibold text-foreground">
            Budget Planner (50/30/20)
          </h2>
        </div>
        <div className="flex gap-2 mb-5">
          <Input
            placeholder="Monthly income (₹)"
            type="number"
            min="0"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyIncome()}
            className="flex-1 text-sm"
            data-ocid="budget.input"
          />
          <Button
            onClick={applyIncome}
            className="shrink-0"
            data-ocid="budget.submit_button"
          >
            Calculate
          </Button>
        </div>
        {income > 0 && (
          <div className="space-y-3">
            {[
              {
                label: "Needs",
                pct: 50,
                val: income * 0.5,
                color: "bg-primary",
              },
              {
                label: "Wants",
                pct: 30,
                val: income * 0.3,
                color: "bg-chart-3",
              },
              {
                label: "Savings",
                pct: 20,
                val: income * 0.2,
                color: "bg-accent",
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">
                    {item.label} ({item.pct}%)
                  </span>
                  <span className="font-bold text-foreground">
                    ₹{item.val.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${item.color}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Salary Planning (60/30/10) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl shadow-card border border-border p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500">
            <TrendingUp size={18} />
          </div>
          <h2 className="font-semibold text-foreground">
            Salary Planning (60/30/10)
          </h2>
        </div>
        <div className="flex gap-2 mb-5">
          <Input
            placeholder="Monthly salary (₹)"
            type="number"
            min="0"
            value={salaryInput}
            onChange={(e) => setSalaryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySalary()}
            className="flex-1 text-sm"
            data-ocid="salary.input"
          />
          <Button
            onClick={applySalary}
            className="shrink-0"
            data-ocid="salary.submit_button"
          >
            Plan
          </Button>
        </div>
        {salary > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Spend",
                pct: 60,
                val: salary * 0.6,
                color: "bg-blue-50 text-primary",
                border: "border-blue-100",
              },
              {
                label: "Save",
                pct: 30,
                val: salary * 0.3,
                color: "bg-green-50 text-accent",
                border: "border-green-100",
              },
              {
                label: "Invest",
                pct: 10,
                val: salary * 0.1,
                color: "bg-orange-50 text-orange-500",
                border: "border-orange-100",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-3 text-center ${item.color} ${item.border}`}
              >
                <p className="text-lg font-bold">{item.pct}%</p>
                <p className="text-xs font-medium mt-0.5">{item.label}</p>
                <p className="text-xs font-semibold mt-1">
                  ₹{item.val.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Impulse Control Modal */}
      <Dialog open={showImpulseModal} onOpenChange={handleImpulseModalClose}>
        <DialogContent className="max-w-sm mx-4" data-ocid="impulse.dialog">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              🛑 Impulse Control Check
            </DialogTitle>
          </DialogHeader>
          {!impulseSuccess ? (
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                How much do you want to spend?{" "}
                <span className="font-semibold text-foreground">
                  Take a breath first.
                </span>
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                  ₹
                </span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Enter amount"
                  value={impulseInput}
                  onChange={(e) => setImpulseInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImpulseConfirm()}
                  className="pl-7 text-sm"
                  data-ocid="impulse.amount_input"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[48px]"
                  onClick={handleImpulseModalClose}
                  data-ocid="impulse.cancel_button"
                >
                  Never mind
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 min-h-[48px]"
                  onClick={handleImpulseConfirm}
                  data-ocid="impulse.confirm_button"
                >
                  <Lock size={15} className="mr-1.5" />
                  Lock It for 24 Hours
                </Button>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4 py-2 text-center"
              data-ocid="impulse.success_state"
            >
              <p className="text-4xl">🔒</p>
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                I've locked this for 24 hours. If you still want it tomorrow,
                log it then.{" "}
                <span className="text-green-600">
                  You just saved ₹{Number(impulseInput).toLocaleString("en-IN")}{" "}
                  for now!
                </span>
              </p>
              <Button
                className="w-full min-h-[48px]"
                onClick={handleImpulseModalClose}
                data-ocid="impulse.close_button"
              >
                💪 Stay Strong!
              </Button>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
