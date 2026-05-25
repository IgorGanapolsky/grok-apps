import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[inspect-copy] Connecting to Comet CDP...");
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

        console.log(`[inspect-copy] Found tab: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // 1. Close any open dialogs first
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const cancelBtn = btns.find(b => {
                const txt = b.innerText ? b.innerText.trim() : "";
                const isVisible = b.getBoundingClientRect().height > 0;
                return (txt === "Cancel" || txt === "Dismiss") && isVisible;
            });
            if (cancelBtn) {
                cancelBtn.click();
                console.log("[browser] Closed existing dialog.");
            }
        });
        await page.waitForTimeout(2000);

        // 2. Click "Copy from a previous release"
        console.log("[inspect-copy] Clicking 'Copy from a previous release' button...");
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button"));
            const copyBtn = btns.find(b => b.innerText && b.innerText.trim() === "Copy from a previous release" && b.getBoundingClientRect().height > 0);
            if (copyBtn) {
                copyBtn.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            throw new Error("'Copy from a previous release' button not found or not visible.");
        }

        console.log("[inspect-copy] Clicked button, waiting 4s for modal to render...");
        await page.waitForTimeout(4000);

        // 3. Inspect modal HTML and elements
        const modalData = await page.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"], .popup, mat-dialog-container');
            if (!dialog) {
                return { error: "No dialog/modal element found." };
            }

            const headerText = dialog.querySelector('h2, h3, .header-text')?.innerText || "";
            const elements = Array.from(dialog.querySelectorAll('input, button, tr, [role="row"], .mdc-radio, label')).map((el, idx) => {
                return {
                    index: idx,
                    tagName: el.tagName.toLowerCase(),
                    type: el.getAttribute('type') || '',
                    role: el.getAttribute('role') || '',
                    className: el.className || '',
                    innerText: el.innerText ? el.innerText.trim().substring(0, 150) : '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    checked: el.checked || false,
                };
            });

            return {
                headerText,
                html: dialog.outerHTML.substring(0, 8000),
                elements
            };
        });

        console.log("\n--- MODAL INSPECTION RESULTS ---");
        if (modalData.error) {
            console.log("Error:", modalData.error);
        } else {
            console.log(`Header Text: "${modalData.headerText}"`);
            console.log("\n--- ELEMENTS IN MODAL ---");
            modalData.elements.forEach(inp => {
                console.log(`El #${inp.index}: Tag=${inp.tagName}, Type="${inp.type}", Role="${inp.role}", Class="${inp.className}", Text="${inp.innerText}", Checked=${inp.checked}, AriaLabel="${inp.ariaLabel}"`);
            });
            console.log("\n--- HTML SNIPPET ---");
            console.log(modalData.html);
        }
        console.log("---------------------------------\n");

        // Save screenshot of the modal
        const modalScreenshot = resolve(rootDir, "current_tab_after_copy_previous.png");
        await page.screenshot({ path: modalScreenshot });
        console.log(`[inspect-copy] Saved modal screenshot to: ${modalScreenshot}`);

    } catch (e) {
        console.error("[inspect-copy] Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[inspect-copy] CDP connection closed.");
    }
}

run();
