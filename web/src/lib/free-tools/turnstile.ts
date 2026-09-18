import { useEffect, useRef } from "react";

// Public site key. Cloudflare's always-passing test key is the dev-only
// fallback; a build without VITE_TURNSTILE_SITE_KEY renders no widget.
const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ||
  (import.meta.env.DEV ? "1x00000000000000000000AA" : "");

// A deployable build without this key is rejected by the
// openseo:require-turnstile-site-key plugin in vite.config.ts — a throw here
// would only be swallowed by the prerenderer.

/** How long a submit waits for the widget to produce its first token. */
const TOKEN_WAIT_MS = 3_000;

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance?: string;
      action?: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
    },
  ): string;
  reset(widgetId?: string): void;
};

/**
 * Renders Turnstile into `containerRef`. `waitForToken()` waits for verification;
 * `reset()` clears the single-use token after every submit.
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef("");

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const w = window as unknown as {
      turnstile?: TurnstileApi;
      onloadTurnstileCallback?: () => void;
    };
    const renderWidget = () => {
      if (!w.turnstile || !containerRef.current) return;
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = w.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        // Invisible unless Turnstile decides the visitor needs a challenge.
        appearance: "interaction-only",
        action: "free_tool",
        callback: (token) => {
          tokenRef.current = token;
        },
        "expired-callback": () => {
          tokenRef.current = "";
        },
      });
    };

    if (w.turnstile) {
      renderWidget();
      return;
    }
    w.onloadTurnstileCallback = renderWidget;
    if (!document.querySelector("script[data-turnstile]")) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
      script.async = true;
      script.dataset.turnstile = "true";
      document.head.appendChild(script);
    }
  }, []);

  return {
    containerRef,
    /**
     * Turnstile solves asynchronously, so an immediate first submit can race
     * the widget and come back 403. Wait briefly for a token instead of
     * POSTing without one. Resolves immediately when Turnstile isn't
     * configured. Local development uses a public test site key.
     */
    waitForToken: async () => {
      if (!TURNSTILE_SITE_KEY) return undefined;
      const deadline = Date.now() + TOKEN_WAIT_MS;
      while (!tokenRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return tokenRef.current || undefined;
    },
    reset: () => {
      tokenRef.current = "";
      const w = window as unknown as { turnstile?: TurnstileApi };
      if (w.turnstile && widgetIdRef.current !== null) {
        w.turnstile.reset(widgetIdRef.current);
      }
    },
  };
}
