import { useEffect, useRef, useState } from "react";

export type NotificationPermissionState =
  | NotificationPermission
  | "unsupported";

export interface CapturedExpense {
  amount: number;
  merchant: string;
  timestamp: Date;
}

export interface NotificationTrackerResult {
  permission: NotificationPermissionState;
  requestPermission: () => Promise<void>;
  isTracking: boolean;
  lastCaptured: CapturedExpense | null;
}

const LS_TRACKING_KEY = "slm_notification_tracking";

const PAYMENT_KEYWORDS = [
  "gpay",
  "paid",
  "sent",
  "₹",
  "debited",
  "credited",
  "upi",
  "neft",
  "imps",
];

function containsPaymentKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractAmount(text: string): number | null {
  // ₹ symbol followed by amount (e.g. ₹ 1,234.56 or ₹1234)
  const rupeeMatch = text.match(/₹\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (rupeeMatch) {
    const val = Number.parseFloat(rupeeMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(val) && val > 0) return val;
  }
  // Rs. or rs followed by amount
  const rsMatch = text.match(/rs\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (rsMatch) {
    const val = Number.parseFloat(rsMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(val) && val > 0) return val;
  }
  // amount followed by debited/credited
  const debitCreditMatch = text.match(
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|credited)/i,
  );
  if (debitCreditMatch) {
    const val = Number.parseFloat(debitCreditMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(val) && val > 0) return val;
  }
  return null;
}

function extractMerchant(text: string): string {
  // "at <Merchant>" pattern
  const atMatch = text.match(/\bat\s+([A-Za-z0-9 &'.-]+?)(?:\s*[.,!\n]|$)/i);
  if (atMatch) return atMatch[1].trim();
  // "to <Merchant>" pattern
  const toMatch = text.match(/\bto\s+([A-Za-z0-9 &'.-]+?)(?:\s*[.,!\n]|$)/i);
  if (toMatch) return toMatch[1].trim();
  return "Auto-Tracked Payment";
}

export function useNotificationTracker(): NotificationTrackerResult {
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => {
      if (!isSupported) return "unsupported";
      return Notification.permission;
    },
  );

  const [isTracking, setIsTracking] = useState<boolean>(() => {
    try {
      return (
        isSupported &&
        Notification.permission === "granted" &&
        window.localStorage.getItem(LS_TRACKING_KEY) === "true"
      );
    } catch {
      return false;
    }
  });

  const [lastCaptured, setLastCaptured] = useState<CapturedExpense | null>(
    null,
  );

  // Keep a stable ref to lastCaptured setter to use in event handler
  const setLastCapturedRef = useRef(setLastCaptured);
  setLastCapturedRef.current = setLastCaptured;

  const requestPermission = async (): Promise<void> => {
    if (!isSupported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setIsTracking(true);
      try {
        window.localStorage.setItem(LS_TRACKING_KEY, "true");
      } catch {
        // ignore
      }
    }
  };

  // Listen for messages from service worker carrying intercepted notification data
  useEffect(() => {
    if (!isSupported || !isTracking) return;
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; title?: string; body?: string }
        | undefined;
      if (!data) return;

      // Accept messages from SW with type 'NOTIFICATION_DATA'
      const text = [data.title ?? "", data.body ?? ""].join(" ");
      if (!containsPaymentKeyword(text)) return;

      const amount = extractAmount(text);
      if (!amount) return;

      const merchant = extractMerchant(text);
      const captured: CapturedExpense = {
        amount,
        merchant,
        timestamp: new Date(),
      };

      setLastCapturedRef.current(captured);

      // Dispatch a DOM event so Finance.tsx (or any listener) can add the expense
      window.dispatchEvent(
        new CustomEvent("slm:auto-expense", {
          detail: {
            amount,
            merchant,
            category: "Needs",
            source: "notification",
          },
        }),
      );
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
    };
  }, [isSupported, isTracking]);

  return { permission, requestPermission, isTracking, lastCaptured };
}
