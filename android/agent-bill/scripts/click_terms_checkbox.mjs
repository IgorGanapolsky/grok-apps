import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        const page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log(`Current page: ${page.url()}`);

        const result = await page.evaluate(() => {
            console.log("Attempting to locate Terms of Use checkbox...");
            
            // 1. Find all checkboxes
            const elements = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, [role="checkbox"], label, span, input[type="checkbox"]'));
            
            const checkboxEl = elements.find(el => 
                el.textContent.includes("agree to the Terms") || 
                el.textContent.includes("Terms of Use") || 
                el.textContent.includes("International Age Rating Coalition")
            );

            if (!checkboxEl) {
                return { success: false, reason: "Terms checkbox element not found" };
            }

            console.log("Found target element:", checkboxEl.tagName, checkboxEl.className);

            // Let's see if it's already checked
            const isChecked = () => {
                const checkedAttr = checkboxEl.getAttribute('aria-checked') === 'true';
                const inputChecked = checkboxEl.querySelector('input[type="checkbox"]')?.checked;
                return checkedAttr || inputChecked || checkboxEl.checked;
            };

            console.log("Before click, isChecked:", isChecked());

            // Try clicking the element
            checkboxEl.click();
            
            // Return current state after click
            return {
                success: true,
                tagName: checkboxEl.tagName,
                outerHTML: checkboxEl.outerHTML.substring(0, 300),
                isCheckedAfterClick: isChecked()
            };
        });

        console.log("Diagnostic result:", result);

        // Let's try clicking via Playwright Locator as well if evaluate click didn't work
        if (result.success && !result.isCheckedAfterClick) {
            console.log("Evaluate click did not toggle state. Trying Playwright locator click...");
            
            const checkboxLocator = page.locator('mat-checkbox, console-checkbox, label').filter({ hasText: /agree to the Terms/i }).first();
            if (await checkboxLocator.count() > 0) {
                console.log("Clicking locator...");
                await checkboxLocator.click();
                await page.waitForTimeout(1000);
                
                const finalState = await page.evaluate(() => {
                    const el = Array.from(document.querySelectorAll('mat-checkbox, console-checkbox, label')).find(el => 
                        el.textContent.includes("agree to the Terms")
                    );
                    return el ? el.getAttribute('aria-checked') : null;
                });
                console.log("Aria-checked after Playwright click:", finalState);
            }
        }

        await page.screenshot({ path: "checkbox_clicked_result.png" });
        console.log("Screenshot saved as checkbox_clicked_result.png");
    } catch (e) {
        console.error("Error during diagnosis:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
