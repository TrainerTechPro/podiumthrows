"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write a single search-param value. When `defaultValue` matches the
 * current value the param is removed entirely so URLs stay clean.
 *
 * - `replace` history mode by default (no clutter in browser history)
 * - `push` when you want back-button to step through filter changes
 *
 * Stay tree-shake-friendly: callers can call this multiple times per page
 * (one per param). For coordinated multi-param writes use `useUrlStateMany`.
 */
export function useUrlState(
  key: string,
  defaultValue = "",
  options: { history?: "replace" | "push"; scroll?: boolean } = {}
): [string, (next: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const history = options.history ?? "replace";
  const scroll = options.scroll ?? false;
  const value = params?.get(key) ?? defaultValue;

  const setValue = useCallback(
    (next: string) => {
      const sp = new URLSearchParams(params?.toString() ?? "");
      if (!next || next === defaultValue) sp.delete(key);
      else sp.set(key, next);
      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (history === "push") router.push(href, { scroll });
      else router.replace(href, { scroll });
    },
    [router, pathname, params, key, defaultValue, history, scroll]
  );

  return [value, setValue];
}

/**
 * Coordinated multi-key writes — call once with a patch object and we do
 * a single router replace/push. Important for filter bars where toggling
 * one chip also resets `page=1` (two writes that must not race).
 */
export function useUrlStateMany(options: { history?: "replace" | "push"; scroll?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const history = options.history ?? "replace";
  const scroll = options.scroll ?? false;

  const get = useCallback((key: string, fallback = "") => params?.get(key) ?? fallback, [params]);

  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(params?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (history === "push") router.push(href, { scroll });
      else router.replace(href, { scroll });
    },
    [router, pathname, params, history, scroll]
  );

  return useMemo(() => ({ get, set }), [get, set]);
}
