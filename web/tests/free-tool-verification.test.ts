// @vitest-environment jsdom
import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TurnstileProps } from "@marsidev/react-turnstile";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolForm, SubmitButton } from "../src/lib/free-tools/form";

const widget = vi.hoisted(() => ({
  props: {} as TurnstileProps,
  reset: vi.fn(),
  isExpired: vi.fn(() => false),
}));
vi.mock("@marsidev/react-turnstile", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    DEFAULT_SCRIPT_ID: "cf-turnstile-script",
    Turnstile: forwardRef((props: TurnstileProps, ref) => {
      widget.props = props;
      useImperativeHandle(ref, () => widget);
      return null;
    }),
  };
});
let root: Root;
let host: HTMLDivElement;
let onSubmit: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  onSubmit = vi.fn().mockResolvedValue(undefined);
  await act(async () =>
    root.render(
      createElement(ToolForm, {
        onSubmit,
        input: { target: "example.com" },
        status: "idle",
        errorMessage: "",
        children: createElement(SubmitButton, {
          status: "idle",
          idleLabel: "Check",
        }),
      }),
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const submit = async () =>
  act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
const solve = async () =>
  act(async () => widget.props.onSuccess!("verified-token"));
const button = () =>
  host.querySelector<HTMLButtonElement>('button[type="submit"]')!;

it("does not submit or restart verification until a token exists", async () => {
  expect(button().disabled).toBe(true);
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(widget.reset).not.toHaveBeenCalled();
  await solve();
  expect(button().disabled).toBe(false);
  await submit();
  expect(onSubmit).toHaveBeenCalledWith(
    { target: "example.com" },
    "verified-token",
  );
  expect(widget.reset).toHaveBeenCalledOnce();
  await submit();
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("blocks duplicate submissions and requires a fresh token for the next request", async () => {
  let finish!: () => void;
  onSubmit.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await solve();
  await submit();
  await submit();
  expect(onSubmit).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(button().disabled).toBe(true);
  await solve();
  await submit();
  expect(onSubmit).toHaveBeenCalledTimes(2);
});

it.each(["onExpire", "onError", "onTimeout", "onUnsupported"] as const)(
  "%s invalidates a ready token",
  async (callback) => {
    await solve();
    await act(async () => widget.props[callback]!("test-error"));
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(button().disabled).toBe(true);
    await solve();
    await submit();
    expect(onSubmit).toHaveBeenCalledOnce();
  },
);

it("checks expiry at submit time and retries script failures without submitting", async () => {
  await solve();
  widget.isExpired.mockReturnValueOnce(true);
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  const script = document.createElement("script");
  script.id = "cf-turnstile-script";
  document.head.appendChild(script);
  await act(async () => widget.props.scriptOptions!.onError!());
  expect(host.textContent).toContain("Verification could not complete");
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[type="button"]')!.click(),
  );
  expect(script.isConnected).toBe(false);
  await solve();
  await submit();
  expect(onSubmit).toHaveBeenCalledOnce();
});

const tools = [
  ["backlink-checker", "BacklinkCheckerTool", "backlink-check"],
  ["spam-score-checker", "SpamScoreCheckerTool", "spam-score-checker"],
  [
    "website-traffic-checker",
    "WebsiteTrafficCheckerTool",
    "website-traffic-checker",
  ],
  ["competitor-analysis", "CompetitorAnalysisTool", "competitor-analysis"],
  ["domain-age-checker", "DomainAgeCheckerTool", "domain-age-checker"],
  ["keyword-discovery", "KeywordDiscoveryTool", "keyword-generator"],
  ["keyword-discovery", "KeywordDiscoveryTool", "competitor-keyword-finder"],
];
it.each(tools)(
  "%s routes %s through the verified form (%s)",
  async (file, name, endpoint) => {
    const module = await import(`../src/components/${file}-tool.tsx`);
    const Component = module[name] as ComponentType<Record<string, unknown>>;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Try again" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await act(async () =>
      root.render(createElement(Component, { tool: endpoint })),
    );
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
    await solve();
    await submit();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/${endpoint}`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).turnstileToken).toBe(
      "verified-token",
    );
    expect(button().disabled).toBe(true);
  },
);
