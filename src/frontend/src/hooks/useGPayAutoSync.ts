import { useEffect, useRef } from "react";

type ExpenseCategory =
  | "Food"
  | "Travel"
  | "Shopping"
  | "Entertainment"
  | "Health"
  | "Other";

interface AutoSyncExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  merchantName?: string;
  category?: ExpenseCategory;
}

type SetExpenses = (
  val: AutoSyncExpense[] | ((prev: AutoSyncExpense[]) => AutoSyncExpense[]),
) => void;

const MOCK_POOL: Omit<AutoSyncExpense, "id" | "date">[] = [
  {
    description: "Coffee",
    merchantName: "Cafe Coffee Day",
    amount: 40,
    category: "Food",
  },
  {
    description: "Amazon Order",
    merchantName: "Amazon",
    amount: 450,
    category: "Shopping",
  },
  {
    description: "Electricity Bill",
    merchantName: "State Electricity Board",
    amount: 1200,
    category: "Health",
  },
  {
    description: "Swiggy Dinner",
    merchantName: "Swiggy",
    amount: 320,
    category: "Food",
  },
  {
    description: "Metro Card Recharge",
    merchantName: "Delhi Metro",
    amount: 200,
    category: "Travel",
  },
  {
    description: "Gym Membership",
    merchantName: "Cult.fit",
    amount: 800,
    category: "Health",
  },
  {
    description: "Netflix Subscription",
    merchantName: "Netflix",
    amount: 199,
    category: "Entertainment",
  },
  {
    description: "Grocery Shopping",
    merchantName: "DMart",
    amount: 650,
    category: "Food",
  },
];

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const GROCERS = ["dmart", "bigbazaar", "reliance fresh", "big bazaar"];

export function getBudgetCategory(
  category: ExpenseCategory,
  merchantName?: string,
): "Needs" | "Wants" | "Savings" {
  switch (category) {
    case "Food": {
      const lowerMerchant = (merchantName ?? "").toLowerCase();
      const isGrocery = GROCERS.some((g) => lowerMerchant.includes(g));
      return isGrocery ? "Needs" : "Wants";
    }
    case "Travel":
      return "Needs";
    case "Shopping":
      return "Wants";
    case "Entertainment":
      return "Wants";
    case "Health":
      return "Needs";
    default:
      return "Needs";
  }
}

export function useGPayAutoSync(setExpenses: SetExpenses): void {
  // Stable ref so the effect can call the latest setter without re-running
  const setExpensesRef = useRef(setExpenses);
  setExpensesRef.current = setExpenses;

  useEffect(() => {
    const setExpensesFn = setExpensesRef.current;
    const gpayLinked = (() => {
      try {
        const raw = window.localStorage.getItem("slm_gpay_linked");
        return raw ? (JSON.parse(raw) as boolean) : false;
      } catch {
        return false;
      }
    })();

    if (!gpayLinked) return;

    const lastSyncRaw = window.localStorage.getItem("slm_last_gpay_sync");
    const now = Date.now();

    const shouldSync =
      !lastSyncRaw || now - new Date(lastSyncRaw).getTime() > FOUR_HOURS_MS;

    if (!shouldSync) return;

    // Pick 1 or 2 random transactions from the pool
    const count = Math.random() < 0.5 ? 1 : 2;
    const shuffled = [...MOCK_POOL].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count);

    const today = new Date().toISOString().slice(0, 10);
    const ts = Date.now();

    const newExpenses: AutoSyncExpense[] = picked.map((item, idx) => ({
      id: `auto-${ts}${idx}`,
      description: item.description,
      amount: item.amount,
      date: today,
      merchantName: item.merchantName,
      category: item.category,
    }));

    setExpensesFn((prev) => [...newExpenses, ...prev]);

    try {
      window.localStorage.setItem(
        "slm_last_gpay_sync",
        new Date().toISOString(),
      );
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
