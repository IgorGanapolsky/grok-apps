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

        console.log("Checking if Actioned tab is visible...");
        const actionedTab = page.locator('div[role="tab"]:has-text("Actioned"), button[role="tab"]:has-text("Actioned"), span:has-text("Actioned")').first();
        if (await actionedTab.count() > 0) {
            console.log("Clicking 'Actioned' tab...");
            await actionedTab.click();
            await page.waitForTimeout(3000);
            
            console.log("Extracting actioned headings...");
            const actionedHeadings = await page.evaluate(() => {
                return Array.from(document.querySelectorAll("simple-html[role='heading'], h3, h4")).map(h => h.innerText.trim());
            });
            console.log("Actioned Headings:", actionedHeadings);

            await page.screenshot({ path: "actioned_tab_state.png" });
            console.log("Saved Actioned tab screenshot to actioned_tab_state.png");

            // Click back to Need Attention tab
            const needAttentionTab = page.locator('div[role="tab"]:has-text("Need attention"), button[role="tab"]:has-text("Need attention"), span:has-text("Need attention")').first();
            if (await needAttentionTab.count() > 0) {
                await needAttentionTab.click();
                await page.waitForTimeout(2000);
            }
        } else {
            console.log("Actioned tab not found.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
