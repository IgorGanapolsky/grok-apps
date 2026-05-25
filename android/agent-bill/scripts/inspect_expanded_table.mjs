import { chromium } from "playwright";

async function run() {
    console.log("[inspect-expanded] Connecting to Comet CDP...");
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

        console.log(`[inspect-expanded] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Check if modal is open, if not, open it
        const isOpen = await page.evaluate(() => {
            const modal = document.querySelector('div[role="dialog"], .popup');
            if (modal) {
                const header = modal.querySelector('h2');
                return header && header.innerText.includes("Copy notes from a previous release");
            }
            return false;
        });

        if (!isOpen) {
            console.log("[inspect-expanded] Modal is not open. Clicking 'Copy from a previous release' button...");
            const copyBtn = page.locator('button:has-text("Copy from a previous release")').first();
            await copyBtn.click();
            await page.waitForTimeout(5000);
        }

        // Expand track row
        console.log("[inspect-expanded] Expanding 'Internal testing' track row...");
        await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return;
            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            const targetRow = rows.find(r => r.innerText && r.innerText.includes("Internal testing"));
            if (targetRow) {
                const buttons = Array.from(targetRow.querySelectorAll('button'));
                const zippy = buttons.find(b => {
                    const txt = b.innerText ? b.innerText.trim() : "";
                    const ariaLabel = b.getAttribute("aria-label") || "";
                    return b.classList.contains("zippy") || ariaLabel.includes("Expand") || txt.includes("arrow_right");
                }) || buttons[0];
                if (zippy) zippy.click();
            }
        });

        await page.waitForTimeout(4000);

        // Dump row details
        const details = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { error: "Table not found." };
            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            return rows.map((r, idx) => {
                const radio = r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
                return {
                    index: idx,
                    innerText: r.innerText ? r.innerText.trim() : "",
                    hasRadio: !!radio,
                    radioChecked: radio ? (radio.getAttribute("aria-checked") === "true") : false,
                    outerHTML: r.outerHTML.substring(0, 300)
                };
            });
        });

        console.log("\n--- TABLE ROWS AFTER EXPANSION ---");
        console.log(JSON.stringify(details, null, 2));
        console.log("----------------------------------\n");

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
