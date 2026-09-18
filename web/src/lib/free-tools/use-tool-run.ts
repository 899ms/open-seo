import { useState } from "react";
import { trackTool } from "@/lib/free-tools/analytics";
import type { ToolStatus } from "@/lib/free-tools/form";
import { useTurnstile } from "@/lib/free-tools/turnstile";

/**
 * The submit cycle every API-backed free tool shares: status machine, error
 * message, Plausible events, and a single-use Turnstile token.
 */
export function useToolRun<T>(tool: string, path: string) {
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<T | null>(null);
  const turnstile = useTurnstile();

  const run = async (body: Record<string, unknown>) => {
    setStatus("loading");
    setErrorMessage("");
    trackTool("tool_run", tool);
    try {
      // Blocks only while Turnstile is still solving; resolves immediately
      // when no widget is configured.
      const turnstileToken = await turnstile.waitForToken();
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, turnstileToken }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | T
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "Something went wrong",
        );
      }
      setResult(data as T);
      setStatus("done");
      trackTool("tool_result", tool);
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      // Turnstile tokens are single-use; get a fresh one for the next run.
      turnstile.reset();
    }
  };

  return { status, errorMessage, result, run, turnstile };
}
