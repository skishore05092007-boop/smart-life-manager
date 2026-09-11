import { createActor } from "@/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  Banknote,
  Brain,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface SettingsPageProps {
  isPro: boolean;
  onUpgrade: () => void;
  onNavigate: (view: string) => void;
}

function exportAllData() {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("slm_")) {
      try {
        const raw = localStorage.getItem(key);
        data[key] = raw ? JSON.parse(raw) : null;
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }

  const payload = {
    exportDate: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = `slm_data_export_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AIParserSettings() {
  const { actor, isFetching } = useActor(createActor);
  const [keyIsSet, setKeyIsSet] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    if (!actor || isFetching) return;
    actor
      .getOpenAIKeyStatus()
      .then(({ isSet }) => setKeyIsSet(isSet))
      .catch(() => {});
  }, [actor, isFetching]);

  const handleSave = async () => {
    if (!actor || !keyInput.trim()) return;
    setSaving(true);
    try {
      await actor.setOpenAIKey(keyInput.trim());
      const { isSet } = await actor.getOpenAIKeyStatus();
      setKeyIsSet(isSet);
      setKeyInput("");
      setTestResult("idle");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!actor) return;
    setTesting(true);
    setTestResult("idle");
    try {
      const result = await actor.parseTransaction("I spent 50 on coffee");
      setTestResult(result.__kind__ === "ok" ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!actor) return;
    setRemoving(true);
    try {
      await actor.setOpenAIKey("");
      const { isSet } = await actor.getOpenAIKeyStatus();
      setKeyIsSet(isSet);
      setTestResult("idle");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.09 }}
      className="rounded-2xl bg-card border px-4 py-4 space-y-3"
      data-ocid="settings.ai_parser_card"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Brain size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-bold text-foreground">AI Parser</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Powers voice & receipt parsing
          </p>
        </div>
        {/* Status badge */}
        {keyIsSet ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
            <CheckCircle2 size={12} />
            Connected
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not set</span>
        )}
      </div>

      {/* Current status message */}
      {keyIsSet ? (
        <div
          className="rounded-xl px-3 py-2 flex items-center gap-2"
          style={{
            background: "oklch(0.62 0.17 148 / 0.08)",
            border: "1px solid oklch(0.62 0.17 148 / 0.25)",
          }}
        >
          <CheckCircle2
            size={13}
            style={{ color: "oklch(0.62 0.17 148)" }}
            className="shrink-0"
          />
          <p
            className="text-[12px] font-medium"
            style={{ color: "oklch(0.62 0.17 148)" }}
          >
            ✓ OpenAI Connected
          </p>
          <span className="ml-auto font-mono text-[12px] text-muted-foreground tracking-widest select-none">
            ••••••••••••••••••••
          </span>
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground leading-snug">
          No API key set — using built-in parser. Add your OpenAI key to enable
          full AI-powered transaction parsing.
        </p>
      )}

      {/* Key input */}
      <div className="space-y-2">
        <label
          htmlFor="settings-ai-key-input"
          className="text-[12px] font-semibold text-foreground block"
        >
          {keyIsSet ? "Replace API Key" : "Enter OpenAI API Key"}
        </label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder="sk-..."
              className="text-[12px] h-9 rounded-xl pr-9 border-border/60 bg-muted/40 focus-visible:ring-primary/40"
              aria-label="OpenAI API Key"
              data-ocid="settings.ai_key_input"
              id="settings-ai-key-input"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showKey ? "Hide API key" : "Show API key"}
              data-ocid="settings.ai_key_toggle"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Button
            size="sm"
            disabled={saving || !keyInput.trim()}
            onClick={handleSave}
            className="h-9 px-3 rounded-xl text-[12px] shrink-0"
            data-ocid="settings.ai_save_key_button"
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              "Save Key"
            )}
          </Button>
        </div>
      </div>

      {/* Test + Remove actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={testing || !keyIsSet}
          onClick={handleTest}
          className="flex-1 h-8 rounded-xl text-[12px] gap-1.5"
          data-ocid="settings.ai_test_button"
        >
          {testing ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
        {keyIsSet && (
          <Button
            variant="outline"
            size="sm"
            disabled={removing}
            onClick={handleRemove}
            className="h-8 px-3 rounded-xl text-[12px] text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
            data-ocid="settings.ai_remove_key_button"
          >
            {removing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <>
                <Trash2 size={12} /> Remove
              </>
            )}
          </Button>
        )}
      </div>

      {/* Test result feedback */}
      {testResult !== "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl px-3 py-2 flex items-center gap-2 text-[12px] font-medium ${
            testResult === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-500"
              : "bg-destructive/10 border border-destructive/25 text-destructive"
          }`}
          data-ocid="settings.ai_test_result"
          aria-live="polite"
        >
          {testResult === "ok" ? (
            <>
              <CheckCircle2 size={13} className="shrink-0" /> ✓ AI is working
            </>
          ) : (
            <>
              <XCircle size={13} className="shrink-0" /> ✗ Failed — check your
              key
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function SettingsPage({ isPro, onUpgrade }: SettingsPageProps) {
  const [storedIsPro] = useLocalStorage<boolean>("slm_is_pro", false);
  const [dailyBudget, setDailyBudget] = useLocalStorage<{
    limit: number;
  } | null>("slm_daily_budget", null);
  const [dailyLimitInput, setDailyLimitInput] = useState(
    dailyBudget ? String(dailyBudget.limit) : "",
  );
  const [dailyLimitSaved, setDailyLimitSaved] = useState(false);

  const handleSaveDailyLimit = () => {
    const val = Number(dailyLimitInput);
    if (!val || val <= 0) return;
    setDailyBudget({ limit: val });
    setDailyLimitSaved(true);
    setTimeout(() => setDailyLimitSaved(false), 2000);
  };
  const proActive = isPro || storedIsPro;

  return (
    <div className="space-y-4 pb-4" data-ocid="settings.page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-foreground">Settings ⚙️</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and preferences
        </p>
      </motion.div>

      {/* Pro Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06 }}
        data-ocid="settings.pro_status_card"
      >
        {proActive ? (
          <div
            className="rounded-2xl px-4 py-4"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.62 0.17 148 / 0.1), oklch(0.56 0.22 252 / 0.06))",
              border: "1px solid oklch(0.62 0.17 148 / 0.35)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "oklch(0.62 0.17 148 / 0.15)" }}
              >
                <Rocket size={18} style={{ color: "oklch(0.62 0.17 148)" }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">
                  ✅ Pro Version Active
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  All features unlocked.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Sparkles size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">
                    Free Version
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Upgrade to Pro
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 h-8 px-3 text-[12px] rounded-xl"
                onClick={onUpgrade}
                data-ocid="settings.upgrade_pro_button"
              >
                Upgrade to Pro
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Daily Budget Limit Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.09 }}
        className="rounded-2xl bg-card border px-4 py-4 space-y-3"
        data-ocid="settings.daily_budget_card"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Banknote size={15} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-bold text-foreground">
              Daily Budget Limit
            </h2>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Powers "Today's Spending Power" in Finance
            </p>
          </div>
          {dailyBudget && (
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              ₹{dailyBudget.limit.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="settings-daily-limit-input"
            className="text-[12px] font-semibold text-foreground block"
          >
            Set Daily Budget Limit (₹)
          </label>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                ₹
              </span>
              <Input
                id="settings-daily-limit-input"
                type="number"
                min="1"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveDailyLimit()}
                placeholder="e.g. 500"
                className="text-[12px] h-9 rounded-xl pl-7 border-border/60 bg-muted/40 focus-visible:ring-primary/40"
                data-ocid="settings.daily_limit_input"
              />
            </div>
            <Button
              size="sm"
              disabled={!dailyLimitInput || Number(dailyLimitInput) <= 0}
              onClick={handleSaveDailyLimit}
              className="h-9 px-3 rounded-xl text-[12px] shrink-0"
              data-ocid="settings.daily_limit_save_button"
            >
              {dailyLimitSaved ? "✓ Saved" : "Save"}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          {dailyBudget
            ? `Current limit: ₹${dailyBudget.limit.toLocaleString("en-IN")} / day. Finance tab will show spending power in real time.`
            : "Not set — Finance tab will prompt you to set a limit."}
        </p>
      </motion.div>

      {/* AI Parser Settings */}
      <AIParserSettings />

      {/* Data Export Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="rounded-2xl bg-card border px-4 py-4 space-y-3"
        data-ocid="settings.data_export_card"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Lock size={15} className="text-primary" />
          </div>
          <h2 className="text-[13px] font-bold text-foreground">
            Private Life Vault 🔒
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Your data belongs to you. All stored locally — no cloud, no tracking.
        </p>
        <Button
          variant="outline"
          className="w-full h-9 text-[13px] rounded-xl gap-2 font-semibold"
          onClick={exportAllData}
          data-ocid="settings.export_data_button"
        >
          <Download size={15} />
          Export My Data 📦
        </Button>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Download a backup of your goals, expenses, streaks, and all settings.
        </p>
      </motion.div>

      {/* Privacy Notice Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.21 }}
        className="rounded-2xl px-4 py-4 space-y-2"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.56 0.22 252 / 0.06), oklch(0.6 0.18 300 / 0.04))",
          border: "1px solid oklch(0.56 0.22 252 / 0.2)",
        }}
        data-ocid="settings.privacy_card"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.56 0.22 252 / 0.12)" }}
          >
            <Shield size={15} style={{ color: "oklch(0.56 0.22 252)" }} />
          </div>
          <h2 className="text-[13px] font-bold text-foreground">
            100% Private 🔒
          </h2>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          No sign-up required. No bank access. No cloud sync. Your data never
          leaves your device. Smart Life OS stores everything in your browser's
          local storage.
        </p>
      </motion.div>

      {/* App Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.27 }}
        className="rounded-2xl bg-card border px-4 py-4 space-y-2"
        data-ocid="settings.app_info_card"
      >
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-[11px] font-bold">
              SL
            </span>
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">
              Smart Life OS
            </p>
            <p className="text-[11px] text-muted-foreground">
              v2.0 — Smart Life OS Edition
            </p>
          </div>
        </div>
        <div className="border-t pt-2.5 space-y-1">
          <p className="text-[12px] text-muted-foreground">
            <span className="text-foreground font-medium">Developer: </span>
            Made by Kishore · BBA Finance Student
          </p>
          <p className="text-[11px] text-muted-foreground">
            For educational purposes only.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
