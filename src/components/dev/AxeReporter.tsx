"use client";

import { useEffect } from "react";

/**
 * Dev-only axe-core integration. Mounts in non-production builds and runs
 * @axe-core/react with a 1000ms debounce, logging violations to the browser
 * console with axe's default formatting (severity, rule id, target selector,
 * fix suggestions).
 *
 * Tree-shaking guarantee: this module + its `@axe-core/react` import are
 * dynamically imported inside `useEffect`, AND the parent layout gates the
 * `<AxeReporter />` JSX on `process.env.NODE_ENV !== "production"`. Webpack
 * statically replaces NODE_ENV at build time, so prod renders never reach
 * this module and the dynamic-import chunk is unreferenced. Bundle analyzer
 * confirms no axe-core in prod chunks.
 *
 * The runtime guard inside useEffect is a belt-and-suspenders second line —
 * if the layout guard ever regresses, this still no-ops in prod.
 */
export function AxeReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;

    // axe-core/react instruments React.createElement at runtime, which
    // requires a mutable React object. Dynamic imports return frozen
    // ES Module namespace objects, so we unwrap the `.default` export
    // (which IS the underlying mutable React/ReactDOM module).
    void Promise.all([import("react"), import("react-dom"), import("@axe-core/react")]).then(
      ([reactNs, reactDomNs, axeNs]) => {
        const React = reactNs.default ?? reactNs;
        const ReactDOM = reactDomNs.default ?? reactDomNs;
        const axe = axeNs.default;
        axe(React, ReactDOM, 1000);
      }
    );
  }, []);

  return null;
}
