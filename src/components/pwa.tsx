"use client";
import { CheckCircle2, Download, Share, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Button } from "./ui";

/* ---------------- Service worker ---------------- */
export function useRegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      /* sem service worker o app continua funcionando, só não abre offline */
    });
  }, []);
}

/* ---------------- Instalação ---------------- */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
let deferred: InstallPromptEvent | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

// Registra cedo (ao carregar o módulo): o Chrome pode disparar o evento antes do React montar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

const STANDALONE = "(display-mode: standalone)";
const subscribeDisplay = (cb: () => void) => {
  const mq = matchMedia(STANDALONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const isStandalone = () => matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOSDevice = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
const noop = () => () => {};

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const installed = useSyncExternalStore(subscribeDisplay, isStandalone, () => false);
  const isIOS = useSyncExternalStore(noop, isIOSDevice, () => false);
  const prompt = useCallback(async () => {
    const ev = deferred;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice.catch(() => undefined);
    deferred = null;
    emit();
  }, []);
  return { canPrompt, prompt, isIOS, installed };
}

const DISMISS_KEY = "cf-install-dismissed";
const dismissSubs = new Set<() => void>();
const subscribeDismiss = (cb: () => void) => {
  dismissSubs.add(cb);
  return () => {
    dismissSubs.delete(cb);
  };
};
const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

function IOSSteps() {
  return (
    <span>
      Toque em <b>Compartilhar</b> <Share size={13} className="inline -translate-y-0.5" /> e depois em <b>“Adicionar à Tela de Início”</b>.
    </span>
  );
}

/** Faixa no Resumo (só celular), dispensável, enquanto o app não estiver instalado. */
export function InstallBanner() {
  const { canPrompt, prompt, isIOS, installed } = useInstall();
  const dismissed = useSyncExternalStore(subscribeDismiss, readDismissed, () => true);
  if (installed || dismissed || !(canPrompt || isIOS)) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    dismissSubs.forEach((f) => f());
  };
  return (
    <div className="card fade-up flex items-start gap-3 p-4 lg:hidden">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Smartphone size={18} /></span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Instale o app no celular</p>
        <p className="mt-0.5 text-[13px] text-muted">{isIOS && !canPrompt ? <IOSSteps /> : "Abra com um toque pela tela inicial, em tela cheia e até sem internet."}</p>
        {canPrompt && <Button size="sm" variant="primary" className="mt-2" onClick={prompt}><Download size={14} /> Instalar</Button>}
      </div>
      <button onClick={dismiss} aria-label="Dispensar" className="shrink-0 cursor-pointer rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={16} /></button>
    </div>
  );
}

/** Bloco fixo no menu "Mais". */
export function InstallCard() {
  const { canPrompt, prompt, isIOS, installed } = useInstall();
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Smartphone size={16} className="text-brand" /> App no celular</p>
      <div className="mt-1.5 text-[13px] text-muted">
        {installed ? (
          <span className="flex items-center gap-1.5 text-ok"><CheckCircle2 size={14} /> App já instalado neste aparelho.</span>
        ) : canPrompt ? (
          <Button size="sm" variant="primary" onClick={prompt}><Download size={14} /> Instalar app</Button>
        ) : isIOS ? (
          <IOSSteps />
        ) : (
          <span>Abra este site no Chrome (Android) ou no Safari (iPhone) e use a opção do navegador <b>“Instalar app”</b> ou <b>“Adicionar à tela inicial”</b>.</span>
        )}
      </div>
    </div>
  );
}
