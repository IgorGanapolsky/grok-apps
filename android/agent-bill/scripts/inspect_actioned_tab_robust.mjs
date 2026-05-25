import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }

        console.log("Locating elements with text 'Actioned'...");
        const actionedElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("a, button, div, span, li, p"))
                .filter(el => el.innerText && el.innerText.trim() === "Actioned")
                .map(el => ({
                    tag: el.tagName.toLowerCase(),
                    className: el.className,
                    visible: el.getBoundingClientRect().height > 0
                }));
            return elements;
        });
        console.log("Found 'Actioned' elements:", actionedElements);

        // Click the first visible one
        const actionedClick = page.locator('div:has-text("Actioned"), a:has-text("Actioned"), span:has-text("Actioned"), button:has-text("Actioned")').filter({ hasText: /^Actioned$/ }).first();
        if (await actionedClick.count() > 0) {
            console.log("Clicking 'Actioned' tab/link...");
            await actionedClick.click();
            await page.waitForTimeout(3000);

            const actionedHeadings = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("simple-html[role='heading'], h3, h4")).map(h => h.innerText.trim());
            });
            console.log("Actioned Headings after click:", actionedHeadings);

            await page.screenshot({ path: "actioned_tab_state_robust.png" });
            console.log("Saved Actioned tab screenshot to actioned_tab_state_robust.png");

            // Go back
            const needAttentionClick = page.locator('div:has-text("Need attention"), a:has-text("Need attention"), span:has-text("Need attention"), button:has-text("Need attention")').filter({ hasText: /Need attention/ }).first();
            if (await needAttentionClick.count() > 0) {
                await needAttentionClick.click();
                await page.waitForTimeout(2000);
            }
        } else {
            console.log("No 'Actioned' text element found.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
