#!/usr/bin/env python3
"""
save_policies_full.py

Fetch and save full cleaned text of:
  - Privacy Policy
  - Terms of Use / Terms of Service
  - Cookie Policy
  - Code of Conduct

Saves each found policy to ./policies/<domain>_<type>.txt

Usage:
  python save_policies_full.py https://example.com
  python save_policies_full.py https://example.com --headful --screenshot-on-failure --no-block
"""
import argparse
import os
import re
import sys
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# Playwright import (exit with helpful message if missing)
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError
except Exception as e:
    print("Playwright import failed:", e)
    print("Install with: pip install playwright beautifulsoup4")
    print("Then run: python -m playwright install")
    sys.exit(1)


# Policy keyword maps and fallback paths
KEYWORDS = {
    "privacy": ["privacy", "privacy-policy", "data-protection"],
    "terms": ["terms", "terms-of-service", "terms-and-conditions", "terms_of_use", "terms-of-use"],
    "cookies": ["cookie", "cookie-policy", "cookies"],
    "code_of_conduct": ["code of conduct", "code-of-conduct", "conduct"]
}
COMMON_PATHS = {
    "privacy": ["/privacy", "/privacy-policy"],
    "terms": ["/terms", "/terms-of-service", "/terms-and-conditions"],
    "cookies": ["/cookie-policy", "/cookies", "/cookie"],
    "code_of_conduct": ["/code-of-conduct", "/conduct"]
}


def html_to_text(html: str) -> str:
    """Return cleaned visible text using built-in html.parser (no lxml needed)."""
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s{2,}", " ", text).strip()


def fetch_with_playwright(
    url: str,
    headless: bool = True,
    primary_timeout_ms: int = 60000,
    fallback_timeout_ms: int = 15000,
    screenshot_on_failure: bool = False,
    block_third_party: bool = True,
) -> str:
    """
    Fetch raw HTML from url using Playwright with robust fallbacks.
    Returns raw HTML (string).
    """
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )

        if block_third_party:
            def route_handler(route, request):
                req_url = request.url
                blocked = [
                    "google-analytics.com", "googletagmanager.com", "doubleclick.net",
                    "facebook.net", "mc.yandex.ru", "ads", "adservice", "pubmatic.com"
                ]
                if any(p in req_url for p in blocked):
                    try:
                        return route.abort()
                    except Exception:
                        return route.continue_()
                return route.continue_()
            try:
                context.route("**/*", route_handler)
            except Exception:
                pass

        page = context.new_page()
        page.set_default_navigation_timeout(primary_timeout_ms + 5000)

        try:
            page.goto(url, wait_until="networkidle", timeout=primary_timeout_ms)
            page.wait_for_timeout(400)
            html = page.content()
            browser.close()
            return html
        except PWTimeoutError:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=fallback_timeout_ms)
                page.wait_for_timeout(700)
                html = page.content()
                browser.close()
                return html
            except PWTimeoutError:
                try:
                    page.goto(url, timeout=5000)
                except Exception:
                    pass
                if screenshot_on_failure:
                    try:
                        os.makedirs("debug_playwright", exist_ok=True)
                        safe = re.sub(r"[^\w\-\.]", "_", url)[:120]
                        shot = os.path.join("debug_playwright", f"{safe}.png")
                        page.screenshot(path=shot, full_page=True)
                        print(f"[debug] screenshot: {shot}")
                    except Exception as se:
                        print("[debug] screenshot failed:", se)
                html = page.content()
                browser.close()
                return html
        except Exception as e:
            try:
                browser.close()
            except Exception:
                pass
            raise e


def find_policy_links_from_html(page_url: str, html: str) -> dict:
    """
    Return mapping: policy_type -> list of absolute candidate URLs found on the page.
    """
    soup = BeautifulSoup(html or "", "html.parser")
    results = {k: [] for k in KEYWORDS.keys()}
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        text = (a.get_text(" ", strip=True) or "").lower()
        href_lower = (href or "").lower()
        for ptype, keys in KEYWORDS.items():
            if any(k in text or k in href_lower for k in keys):
                abs_url = urljoin(page_url, href)
                if abs_url not in results[ptype]:
                    results[ptype].append(abs_url)

    # fallback to common domain-rooted paths if none found for a type
    parsed = urlparse(page_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    for ptype, lst in results.items():
        if not lst:
            for p in COMMON_PATHS.get(ptype, []):
                results[ptype].append(urljoin(origin, p))
    return results


def save_text_file(domain_tag: str, ptype: str, text: str, out_dir: str = "policies") -> str:
    """Save `text` to policies/<domain>_<ptype>.txt and return path."""
    os.makedirs(out_dir, exist_ok=True)
    fname = f"{domain_tag}_{ptype}.txt"
    path = os.path.join(out_dir, fname)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def safe_domain_name(url: str) -> str:
    p = urlparse(url)
    domain = p.netloc.replace(":", "_")
    return re.sub(r"[^\w\-\.]", "_", domain)


def main():
    parser = argparse.ArgumentParser(description="Fetch and save full policy texts (privacy, terms, cookies, code_of_conduct).")
    parser.add_argument("url", help="Site URL (include http/https)")
    parser.add_argument("--headful", action="store_true", help="Open visible browser for debugging")
    parser.add_argument("--no-block", action="store_true", help="Don't block analytics/ads")
    parser.add_argument("--primary-timeout-ms", type=int, default=60000, help="Playwright networkidle timeout (ms)")
    parser.add_argument("--screenshot-on-failure", action="store_true", help="Save a screenshot on failure (debug_playwright/)")
    parser.add_argument("--try-candidates", type=int, default=3, help="Number of link candidates to try per policy type")
    args = parser.parse_args()

    url = args.url
    if not url.lower().startswith("http"):
        url = "https://" + url

    print(f"Visiting main page: {url}")
    try:
        main_html = fetch_with_playwright(
            url,
            headless=not args.headful,
            primary_timeout_ms=args.primary_timeout_ms,
            fallback_timeout_ms=15000,
            screenshot_on_failure=args.screenshot_on_failure,
            block_third_party=not args.no_block,
        )
    except Exception as e:
        print("Failed to fetch main page:", e)
        sys.exit(1)

    discovered = find_policy_links_from_html(url, main_html)
    print("\nCandidate policy URLs discovered:")
    for ptype, urls in discovered.items():
        print(f"\n[{ptype}]")
        for i, u in enumerate(urls, 1):
            print(f" {i}. {u}")

    domain_tag = safe_domain_name(url)
    saved = {}

    # For each policy type, try up to args.try_candidates candidates; save full text on first valid fetch
    for ptype, candidates in discovered.items():
        fetched_text = None
        fetched_url = None
        for candidate in candidates[: args.try_candidates]:
            try:
                print(f"\nFetching candidate for [{ptype}]: {candidate}")
                raw_html = fetch_with_playwright(
                    candidate,
                    headless=not args.headful,
                    primary_timeout_ms=args.primary_timeout_ms,
                    fallback_timeout_ms=15000,
                    screenshot_on_failure=args.screenshot_on_failure,
                    block_third_party=not args.no_block,
                )
                cleaned = html_to_text(raw_html)
                # sanity check: does it contain expected keywords to reduce false positives?
                lower = (cleaned or "").lower()
                check_words = {
                    "privacy": ["privacy", "data", "personal data"],
                    "terms": ["terms", "terms of service", "terms and conditions", "conditions of use"],
                    "cookies": ["cookie", "cookies", "tracking"],
                    "code_of_conduct": ["code of conduct", "conduct", "behaviour", "behavioural"]
                }.get(ptype, [ptype])
                if any(w in lower for w in check_words):
                    fetched_text = cleaned
                    fetched_url = candidate
                    print(f" -> fetched and looks like {ptype} (len {len(cleaned)} chars)")
                    break
                else:
                    # If it doesn't look like a policy page, still consider saving if not empty later; try next candidate first
                    print(" -> fetched but does not look policy-like, trying next candidate.")
            except Exception as e:
                print(" -> fetch failed:", e)

        if fetched_text:
            path = save_text_file(domain_tag, ptype, fetched_text)
            saved[ptype] = {"url": fetched_url, "path": path, "chars": len(fetched_text)}
        else:
            # attempt: if none of the candidates validated, try the first candidate anyway and save if non-empty
            fallback_saved = False
            for candidate in candidates[: args.try_candidates]:
                try:
                    raw_html = fetch_with_playwright(
                        candidate,
                        headless=not args.headful,
                        primary_timeout_ms=args.primary_timeout_ms,
                        fallback_timeout_ms=15000,
                        screenshot_on_failure=args.screenshot_on_failure,
                        block_third_party=not args.no_block,
                    )
                    cleaned = html_to_text(raw_html)
                    if cleaned and len(cleaned) > 50:
                        path = save_text_file(domain_tag, ptype, cleaned)
                        saved[ptype] = {"url": candidate, "path": path, "chars": len(cleaned)}
                        print(f"Saved fallback content for {ptype} from {candidate} (len {len(cleaned)})")
                        fallback_saved = True
                        break
                except Exception:
                    continue
            if not fallback_saved:
                saved[ptype] = {"url": None, "path": None, "chars": 0}
                print(f"No valid {ptype} policy found or fetched.")

    # Summary
    print("\n\n=== SAVED POLICY FILES ===")
    for ptype, info in saved.items():
        print(f"\n[{ptype}]")
        if info["path"]:
            print("URL:", info["url"])
            print("Saved file:", info["path"])
            print("Characters:", info["chars"])
        else:
            print("Not found / not saved.")

    print("\nDone. Files are under ./policies/ if any were saved.")


if __name__ == "__main__":
    main()
