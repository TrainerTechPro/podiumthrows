"""
Read-only smoke test for all static athlete pages.
Logs in as athlete1@example.com, navigates each route, records:
- HTTP status of the document request
- Final URL (detect redirects to /login or elsewhere)
- Console errors (excluding noisy known-OK patterns)
- 4xx/5xx network responses

NO mutations performed. Safe for any DB.
"""
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, Response

BASE = "http://localhost:3000"
EMAIL = "athlete1@example.com"
PASSWORD = "athlete123"

ROUTES = [
    "/athlete/dashboard",
    "/athlete/insights",
    "/athlete/settings",
    "/athlete/settings/notifications",
    "/athlete/settings/fix-throw-history",
    "/athlete/assessments",
    "/athlete/tools",
    "/athlete/drill-videos",
    "/athlete/questionnaires",
    "/athlete/achievements",
    "/athlete/goals",
    "/athlete/self-program",
    "/athlete/self-program/create",
    "/athlete/throws",
    "/athlete/throws/quiz",
    "/athlete/throws/trends",
    "/athlete/throws/readiness",
    "/athlete/throws/history",
    "/athlete/throws/log",
    "/athlete/wellness",
    "/athlete/codex",
    "/athlete/whoop",
    "/athlete/competitions",
    "/athlete/feedback",
    "/athlete/oura",
    "/athlete/integrations",
    "/athlete/videos",
    "/athlete/log-session",
    "/athlete/sessions",
    "/athlete/profile",
    "/athlete/team",
    "/athlete/quick-start",
    "/athlete/availability",
    "/athlete/notifications",
    "/athlete/onboarding",
    # Dynamic routes (IDs discovered via psql for athlete1@example.com seed)
    "/athlete/session/cmol48tqm0054w11bpihkbasq",
    "/athlete/sessions/cmol48tqm0054w11bpihkbasq",
    "/athlete/throws/e2e-throws-assignment-1",
    # Skipped (no seed): /athlete/videos/[id], /athlete/competitions/[id],
    # /athlete/questionnaires/[id], /athlete/self-program/[id]
]

# Known-noisy console patterns to ignore (third-party / dev-only).
# DO NOT add `TypeError: Failed to fetch` here — that's usually a real
# app fetch failure being observed by Sentry's instrument wrapper, not
# Sentry causing the failure.
IGNORE_CONSOLE_PATTERNS = [
    re.compile(r"Download the React DevTools"),
    re.compile(r"\[Fast Refresh\]"),
    re.compile(r"webpack-hmr"),
    re.compile(r"Failed to load resource.*favicon"),
    re.compile(r"net::ERR_ABORTED.*favicon"),
    # Claude dev tool injected by the editor, blocked by app CSP — not an app bug.
    re.compile(r"skills-pearl\.vercel\.app"),
    # axe-core dev-only a11y reports — informational, not a page failure.
    re.compile(r"^Fix (all|any) of the following:"),
]


def should_ignore(text: str) -> bool:
    return any(p.search(text) for p in IGNORE_CONSOLE_PATTERNS)


def login(page) -> bool:
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    try:
        page.wait_for_url(re.compile(r"/(athlete|coach)/"), timeout=10_000)
        return True
    except Exception:
        return False


def test_route(page, route: str) -> dict:
    console_errors = []
    network_errors = []  # 4xx / 5xx for document or fetch/xhr

    def on_console(msg):
        if msg.type in ("error", "warning"):
            text = msg.text
            if not should_ignore(text):
                console_errors.append({"type": msg.type, "text": text[:300]})

    def on_response(resp: Response):
        try:
            status = resp.status
            if status >= 400:
                # Skip favicon-ish & known noise
                url = resp.url
                if "favicon" in url:
                    return
                rtype = resp.request.resource_type
                if rtype in ("document", "fetch", "xhr"):
                    network_errors.append({
                        "status": status,
                        "url": url.replace(BASE, ""),
                        "type": rtype,
                    })
        except Exception:
            pass

    page.on("console", on_console)
    page.on("response", on_response)

    result = {"route": route}
    try:
        resp = page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=20_000)
        result["doc_status"] = resp.status if resp else None
        result["final_url"] = page.url.replace(BASE, "")
        result["title"] = page.title()
        # settle long enough for client useEffect fetches to complete or fail
        # (otherwise navigation aborts in-flight fetches and they log as errors)
        page.wait_for_timeout(2000)
    except Exception as e:
        result["error"] = str(e)[:300]
        result["final_url"] = page.url.replace(BASE, "")

    page.remove_listener("console", on_console)
    page.remove_listener("response", on_response)

    if console_errors:
        result["console"] = console_errors
    if network_errors:
        # dedupe by (status, url)
        seen = set()
        deduped = []
        for n in network_errors:
            key = (n["status"], n["url"])
            if key not in seen:
                seen.add(key)
                deduped.append(n)
        result["network"] = deduped
    return result


def classify(r: dict) -> str:
    if r.get("error"):
        return "ERROR"
    if r.get("doc_status", 0) >= 500:
        return "5XX"
    if r.get("doc_status", 0) >= 400:
        return "4XX"
    final = r.get("final_url", "")
    if final.startswith("/login"):
        return "REDIR_LOGIN"
    if not final.startswith(r["route"].rstrip("/")):
        # Some pages legit redirect (e.g. onboarding gates) — flag but don't fail
        return "REDIRECTED"
    if r.get("network") or r.get("console"):
        return "WARN"
    return "OK"


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 390, "height": 844})  # iPhone 14 Pro size — athlete is mobile-primary
        page = ctx.new_page()

        if not login(page):
            print("LOGIN FAILED", file=sys.stderr)
            page.screenshot(path="/tmp/login-fail.png")
            browser.close()
            sys.exit(2)

        print(f"Logged in. Testing {len(ROUTES)} routes...")
        for i, route in enumerate(ROUTES, 1):
            r = test_route(page, route)
            verdict = classify(r)
            r["verdict"] = verdict
            results.append(r)
            print(f"  [{i:>2}/{len(ROUTES)}] {verdict:<11} {route}  -> {r.get('final_url', '?')}")

        browser.close()

    out = Path("/tmp/athlete-pages-report.json")
    out.write_text(json.dumps(results, indent=2))
    print(f"\nFull report: {out}")

    # summary
    by_verdict = {}
    for r in results:
        by_verdict.setdefault(r["verdict"], []).append(r["route"])
    print("\n=== SUMMARY ===")
    for v in ["OK", "WARN", "REDIRECTED", "REDIR_LOGIN", "4XX", "5XX", "ERROR"]:
        if v in by_verdict:
            print(f"  {v}: {len(by_verdict[v])}")
            if v != "OK":
                for rt in by_verdict[v]:
                    print(f"      - {rt}")


if __name__ == "__main__":
    main()
