import { chromium } from "playwright";

async function run() {
    console.log("[dialog-check] Connecting to Comet CDP...");
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

        const dialogInfo = await page.evaluate(() => {
            const modal = document.querySelector('div[role="dialog"], .popup, mat-dialog-container, relative-popup');
            if (!modal) {
                return { hasModal: false };
            }

            const header = modal.querySelector('h2, [role="heading"], .header-text');
            const styles = window.getComputedStyle(modal);
            const rect = modal.getBoundingClientRect();
            
            // Also let's check any elements with class containing modal or popup
            const popups = Array.from(document.querySelectorAll('.popup, .modal, [role="dialog"]')).map(el => {
                const h = el.querySelector('h2, [role="heading"], .header-text');
                return {
                    tagName: el.tagName.toLowerCase(),
                    className: el.className,
                    visible: el.getBoundingClientRect().height > 0,
                    header: h ? h.innerText : "no header"
                };
            });

            return {
                hasModal: true,
                tagName: modal.tagName.toLowerCase(),
                className: modal.className,
                visible: rect.height > 0,
                headerText: header ? header.innerText.trim() : "no header",
                width: styles.width,
                height: styles.height,
                popups
            };
        });

        console.log("\n--- CURRENT DIALOG INFO ---");
        console.log(JSON.stringify(dialogInfo, null, 2));
        console.log("---------------------------\n");

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
