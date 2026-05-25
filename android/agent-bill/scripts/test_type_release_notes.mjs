import { chromium } from "playwright";

async function run() {
    console.log("[typer] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            throw new Error("No Play Console tab found.");
        }

        console.log(`[typer] Found tab: "${await page.title()}"`);

        // Focus and select Release notes textarea
        const textarea = page.locator('textarea[aria-label="Release notes"], textarea').first();
        if (await textarea.count() > 0) {
            console.log("[typer] Focusing release notes textarea...");
            await textarea.focus();
            await page.waitForTimeout(500);

            console.log("[typer] Selecting all and deleting current text...");
            await page.keyboard.press("Meta+A");
            await page.waitForTimeout(200);
            await page.keyboard.press("Backspace");
            await page.waitForTimeout(500);

            const notesText = "<en-US>AgentBill v0.1.2 - Internal Track release. Audit AI provider bills for repeat-offender patterns. BYO xAI key.</en-US>";
            console.log("[typer] Typing formatted notes with delays...");
            await page.keyboard.type(notesText, { delay: 20 });
            await page.waitForTimeout(1000);

            console.log("[typer] Blurring textarea to trigger Angular validation...");
            await page.evaluate(() => {
                const ta = document.querySelector('textarea[aria-label="Release notes"]');
                if (ta) ta.blur();
            });
            await page.waitForTimeout(3000);

            // Let's check the validation error text
            const errorText = await page.evaluate(() => {
                const el = document.querySelector(".mdc-text-field-helper-line, .mdc-text-field-helper-text");
                return el ? el.innerText : "No helper text element found";
            });
            console.log(`[typer] Helper/Error text now: "${errorText}"`);

            // Check if Save as draft button is enabled
            const saveReleaseBtn = page.locator('button:has-text("Save as draft"), button:has-text("Save")').first();
            if (await saveReleaseBtn.count() > 0) {
                console.log(`[typer] 'Save as draft' button enabled state: ${await saveReleaseBtn.isEnabled()}`);
            }
        } else {
            console.log("[typer] Textarea not found.");
        }

    } catch (e) {
        console.error("[typer] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
