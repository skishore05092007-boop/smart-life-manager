import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Download,
  Flame,
  LayoutDashboard,
  Settings,
  Sparkles,
  Target,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { usePWAInstall } from "./hooks/usePWAInstall";
import About from "./pages/About";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Goals from "./pages/Goals";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import SettingsPage from "./pages/SettingsPage";
import StreaksV2 from "./pages/StreaksV2";
import Tools from "./pages/Tools";

type Tab = "dashboard" | "goals" | "streaks" | "money" | "tools" | "settings";
type View = Tab | "privacy-policy" | "about";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Home", icon: <LayoutDashboard size={18} /> },
  { id: "goals", label: "Goals", icon: <Target size={18} /> },
  { id: "streaks", label: "Streaks", icon: <Flame size={18} /> },
  { id: "money", label: "Finance", icon: <Wallet size={18} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

const TAB_IDS = new Set<View>([
  "dashboard",
  "goals",
  "streaks",
  "money",
  "tools",
  "settings",
]);

export default function App() {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [proDialogOpen, setProDialogOpen] = useState(false);
  const [proCode, setProCode] = useState("");
  const [proCodeError, setProCodeError] = useState("");
  const [isPro, setIsPro] = useLocalStorage<boolean>("slm_is_pro", false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const { canInstall, promptInstall } = usePWAInstall();

  const activeTab: Tab = TAB_IDS.has(activeView)
    ? (activeView as Tab)
    : "dashboard";

  const navigate = (view: string) => setActiveView(view as View);
  const openProDialog = () => setProDialogOpen(true);

  const handleActivateCode = () => {
    const trimmed = proCode.trim().toUpperCase();
    if (trimmed === "MINDPRO26" || trimmed === "KISHOREPRO26") {
      setIsPro(true);
      toast.success("Promo Code Applied! Pro Features Unlocked.");
      setProDialogOpen(false);
      setProCode("");
      setProCodeError("");
    } else {
      setProCodeError("Invalid code. Please try again.");
    }
  };

  const renderPage = () => {
    switch (activeView) {
      case "privacy-policy":
        return <PrivacyPolicy onNavigate={navigate} />;
      case "about":
        return <About onNavigate={navigate} />;
      case "goals":
        return <Goals isPro={isPro} onUpgrade={openProDialog} />;
      case "streaks":
        return <StreaksV2 />;
      case "money":
        return <Finance />;
      case "tools":
        return <Tools />;
      case "settings":
        return (
          <SettingsPage
            isPro={isPro}
            onUpgrade={openProDialog}
            onNavigate={navigate}
          />
        );
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-background flex flex-col relative">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card border-b shadow-sm px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-sm font-bold">
                SL
              </span>
            </div>
            <div>
              <h1 className="font-bold text-sm text-foreground">
                Smart Life OS
              </h1>
              <button
                type="button"
                className="text-[10px] text-muted-foreground cursor-pointer hover:text-primary transition-colors duration-200 flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                onClick={openProDialog}
                aria-label="Upgrade to Pro"
                data-ocid="header.pro_version_tag"
              >
                <Sparkles size={9} className="inline-block" />
                {isPro ? "Pro ✓" : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* PWA Install Banner */}
        <AnimatePresence>
          {canInstall && !installBannerDismissed && (
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-[72px] left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30 px-3"
              data-ocid="pwa.install_banner"
            >
              <div className="rounded-2xl bg-primary text-primary-foreground shadow-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                  <Download size={16} className="text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight">Install App</p>
                  <p className="text-[11px] text-primary-foreground/80 leading-tight mt-0.5 truncate">
                    Add to home screen for the best experience
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 h-8 px-3 text-xs font-bold rounded-xl"
                  onClick={async () => {
                    await promptInstall();
                  }}
                  data-ocid="pwa.install_button"
                >
                  Install
                </Button>
                <button
                  type="button"
                  onClick={() => setInstallBannerDismissed(true)}
                  className="shrink-0 p-1 rounded-lg hover:bg-primary-foreground/15 transition-colors"
                  aria-label="Dismiss install prompt"
                  data-ocid="pwa.dismiss_button"
                >
                  <X size={14} className="text-primary-foreground/70" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Tab Navigation */}
        <nav
          data-ocid="nav.bottom_tabs"
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-card border-t px-1 py-2 z-20"
        >
          <div className="flex items-center justify-around">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-ocid={`nav.tab_${tab.id}`}
                onClick={() => setActiveView(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-all duration-200 min-w-0 ${
                  activeTab === tab.id &&
                  activeView !== "privacy-policy" &&
                  activeView !== "about"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                aria-label={tab.label}
                aria-current={
                  activeTab === tab.id &&
                  activeView !== "privacy-policy" &&
                  activeView !== "about"
                    ? "page"
                    : undefined
                }
              >
                {tab.icon}
                <span className="text-[9px] font-medium leading-tight">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      <Toaster position="top-center" />

      {/* Pro Upgrade Dialog */}
      <Dialog open={proDialogOpen} onOpenChange={setProDialogOpen}>
        <DialogContent
          className="max-w-[340px] rounded-2xl"
          data-ocid="dialog.pro_upgrade"
        >
          <DialogHeader className="items-center text-center gap-2 pt-2">
            <div className="w-12 h-12 rounded-full bg-[#FF0000]/10 flex items-center justify-center mx-auto">
              {/* YouTube icon */}
              <svg
                viewBox="0 0 24 24"
                width="26"
                height="26"
                fill="#FF0000"
                aria-hidden="true"
              >
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <DialogTitle className="text-lg font-bold">
              {isPro ? "You're on Pro!" : "Get Pro Version for FREE!"}
            </DialogTitle>
            <DialogDescription className="text-sm text-foreground/80 leading-relaxed">
              {isPro
                ? "All Pro features are unlocked. Thank you for your support!"
                : "Follow the steps below to unlock all Pro features at no cost."}
            </DialogDescription>
          </DialogHeader>

          {!isPro && (
            <DialogFooter className="flex-col gap-3 sm:flex-col mt-1">
              {/* Step 1 — YouTube subscribe */}
              <div
                className="w-full rounded-xl border border-[#FF0000]/25 bg-[#FF0000]/5 px-4 py-3 space-y-2"
                data-ocid="dialog.youtube_section"
              >
                <p className="text-[12px] font-semibold text-foreground">
                  Step 1: Subscribe to get the Activation Code
                </p>
                <a
                  href="https://www.youtube.com/@MindCapital-z7l"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#FF0000] hover:bg-[#cc0000] active:bg-[#aa0000] text-white font-semibold text-[13px] py-2.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0000]/60"
                  data-ocid="dialog.youtube_subscribe_btn"
                  aria-label="Subscribe to MindCapital YouTube channel"
                >
                  {/* YouTube icon inline */}
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="white"
                    aria-hidden="true"
                  >
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  Subscribe to my YouTube channel
                </a>
                <p className="text-[11px] text-muted-foreground text-center leading-snug">
                  📹 Check the channel description for the code!
                </p>
              </div>

              {/* Step 2 — Activation Code input */}
              <div
                className="w-full space-y-1.5"
                data-ocid="dialog.pro_code_input"
              >
                <p className="text-[12px] font-semibold text-foreground px-0.5">
                  Step 2: Enter the Activation Code found in the channel
                  description
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={proCode}
                    onChange={(e) => {
                      setProCode(e.target.value);
                      if (proCodeError) setProCodeError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleActivateCode();
                    }}
                    placeholder="Enter Activation Code here"
                    className="flex-1 text-[12px] placeholder:text-[11px] h-9 rounded-xl border-border/60 bg-muted/40 focus-visible:ring-primary/40"
                    aria-label="Activation Code"
                    data-ocid="dialog.pro_code_field"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3 rounded-xl text-[12px] shrink-0"
                    onClick={handleActivateCode}
                    data-ocid="dialog.activate_btn"
                  >
                    Activate
                  </Button>
                </div>
                {proCodeError && (
                  <p
                    className="text-[11px] text-destructive px-1"
                    role="alert"
                    data-ocid="dialog.pro_code_error"
                  >
                    {proCodeError}
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setProDialogOpen(false)}
                data-ocid="dialog.cancel_btn"
              >
                Maybe Later
              </Button>
            </DialogFooter>
          )}

          {isPro && (
            <DialogFooter className="mt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setProDialogOpen(false)}
                data-ocid="dialog.close_btn"
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
