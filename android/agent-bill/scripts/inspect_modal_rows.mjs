import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[rows-inspector] Connecting to Comet CDP...");
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

        console.log(`[rows-inspector] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Let's check if the modal is currently open. If not, open it.
        const isOpen = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            return !!table;
        });

        if (!isOpen) {
            console.log("[rows-inspector] Modal is not open. Clicking 'Copy from a previous release' button...");
            const copyBtn = page.locator('button:has-text("Copy from a previous release")').first();
            await copyBtn.click();
            console.log("[rows-inspector] Clicked button, waiting 5s for modal to render...");
            await page.waitForTimeout(5000);
        } else {
            console.log("[rows-inspector] Modal is already open.");
        }

        // Capture a screenshot of the modal
        const screenshotPath = resolve(rootDir, "modal_open_state.png");
        await page.screenshot({ path: screenshotPath });
        console.log(`[rows-inspector] Screenshot saved to ${screenshotPath}`);

        // Inspect the rows
        const rowsInfo = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) return { error: "Table not found." };

            const rows = Array.from(table.querySelectorAll('div[role="row"], tr, .particle-table-row'));
            return {
                rowCount: rows.length,
                rows: rows.map((r, i) => {
                    const cells = Array.from(r.querySelectorAll('td, div[role="gridcell"], ess-cell, .particle-table-cell'));
                    const radio = r.querySelector('mat-radio-button, input[type="radio"], [role="radio"]');
                    return {
                        index: i,
                        innerText: r.innerText ? r.innerText.trim() : "",
                        cellCount: cells.length,
                        cellTexts: cells.map(c => c.innerText ? c.innerText.trim() : ""),
                        hasRadio: !!radio,
                        radioRole: radio ? radio.getAttribute("role") : null,
                        radioChecked: radio ? (radio.getAttribute("aria-checked") === "true" || radio.checked) : null,
                        outerHTML: r.outerHTML.substring(0, 500)
                    };
                })
            };
        });

        console.log("\n--- MODAL ROWS DETAIL ---");
        console.log(JSON.stringify(rowsInfo, null, 2));
        console.log("-------------------------\n");

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[rows-inspector] CDP connection closed.");
    }
}

run();
