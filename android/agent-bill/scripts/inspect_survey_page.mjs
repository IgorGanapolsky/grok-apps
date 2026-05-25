import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("[inspector] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[inspector] Opening new tab...");
            page = await ctx.newPage();
        }

        console.log("[inspector] Navigating to Content Rating page...");
        const ratingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/content-rating-overview`;
        await page.goto(ratingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        // Click Edit/Start
        await page.evaluate(() => {
            const editBtn = Array.from(document.querySelectorAll('a, span, button')).find(el => el.textContent.trim() === 'Edit');
            if (editBtn) {
                editBtn.click();
                return;
            }
            const startBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Start questionnaire') || el.textContent.includes('Start new questionnaire'));
            if (startBtn) startBtn.click();
        });
        await page.waitForTimeout(5000);

        console.log("[inspector] Page URL after Edit/Start:", page.url());

        // Check if on category page
        const onCategory = await page.evaluate(() => {
            return document.body.innerHTML.includes("Terms of Use") || document.body.innerHTML.includes("agree to the Terms");
        });

        if (onCategory) {
            console.log("[inspector] Category page active. Filling Step 1...");
            await page.evaluate(() => {
                // Email
                const emailInput = document.querySelector('input[type="email"], input[aria-label*="email"], input[aria-label*="Email"]');
                if (emailInput) {
                    emailInput.value = 'igor@iganapolsky.com';
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Category
                const radios = Array.from(document.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'));
                const utilityRadio = radios.find(el => el.textContent.includes("Utility") || el.textContent.includes("productivity") || el.textContent.includes("other") || el.textContent.includes("All Other App Types"));
                if (utilityRadio) utilityRadio.click();

                // Terms Checkbox
                const cb = document.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) cb.click();
            });
            await page.waitForTimeout(2000);

            // Click Next
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(6000);
        }

        console.log("[inspector] Questionnaire loaded. URL:", page.url());
        await page.screenshot({ path: resolve(rootDir, "survey_loaded_state.png") });

        // Let's analyze all radio buttons and containers
        const info = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            const radios = allElements.filter(el => {
                const tagName = el.tagName.toLowerCase();
                const role = el.getAttribute('role');
                const type = el.getAttribute('type');
                return tagName.includes('radio') || role === 'radio' || type === 'radio';
            });

            return radios.map((r, i) => {
                // Let's get parent container and labels
                const parent = r.closest('label') || r.parentElement;
                const grandParent = parent ? parent.parentElement : null;
                const text = parent ? parent.textContent.trim() : "";
                
                return {
                    index: i,
                    tagName: r.tagName,
                    id: r.id,
                    className: r.className,
                    type: r.getAttribute('type'),
                    role: r.getAttribute('role'),
                    name: r.name || r.getAttribute('name'),
                    ariaLabel: r.getAttribute('aria-label'),
                    ariaChecked: r.getAttribute('aria-checked'),
                    checkedProperty: r.checked,
                    parentTagName: parent ? parent.tagName : null,
                    parentText: text,
                    grandParentTagName: grandParent ? grandParent.tagName : null,
                    outerHTML: r.outerHTML.substring(0, 300)
                };
            });
        });

        console.log("[inspector] Radio buttons found:", JSON.stringify(info, null, 2));

    } catch (e) {
        console.error("[inspector] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
