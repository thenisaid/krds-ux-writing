"""
실제 unpacked 확장을 --load-extension으로 헤드풀 Chromium에 로드해 검증한다.

Playwright MCP(browser_evaluate로 <script src> 직접 주입)나 headless Chrome은
확장의 isolated/MAIN world 분리를 재현하지 못해 두 차례나 가짜 통과를 냈다
(2026-08-20, content.js의 프로그램적 value 감지 관련 codex 리뷰 참고).
이 스크립트는 실제 확장 로딩 경로를 그대로 타므로 그 경계를 정확히 재현한다.

사전 준비: `python3 -m http.server 8300` 를 리포 루트에서 실행해 둘 것.
실행: `python3 krds-extension/scripts/verify-real-chrome.py`
"""
import json, os, tempfile
from playwright.sync_api import sync_playwright

EXT_PATH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "http://127.0.0.1:8300/lint.html"

results = {}

with sync_playwright() as p:
    user_data_dir = tempfile.mkdtemp(prefix="krds-ext-test-")
    ctx = p.chromium.launch_persistent_context(
        user_data_dir,
        headless=False,
        args=[
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
        ],
    )
    try:
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(500)

        # confirm extension actually attached (backdrop element exists)
        results["backdrop_present_before_sample"] = page.locator(".krds-inline-lint-backdrop").count() > 0

        page.get_by_role("button", name="샘플 텍스트 불러오기").click()
        page.wait_for_timeout(800)

        live = page.locator(".sr-only").inner_text()
        results["live_region_after_sample"] = live
        results["mark_count_after_sample"] = page.locator("mark.krds-inline-lint-mark").count()

        # real mouse click on the first mark
        first_mark = page.locator("mark.krds-inline-lint-mark").first
        if first_mark.count() > 0:
            first_mark.click()
            page.wait_for_timeout(300)
            popover = page.locator(".krds-inline-lint-popover")
            results["popover_visible_after_click"] = popover.is_visible()
            results["popover_text"] = popover.inner_text() if popover.is_visible() else None
        else:
            results["popover_visible_after_click"] = False

    finally:
        ctx.close()

print(json.dumps(results, ensure_ascii=False, indent=2))
