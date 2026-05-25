import { chromium } from "playwright";

async function run() {
    console.log("[modal-inspector] Connecting to Comet CDP...");
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

        console.log(`[modal-inspector] Found tab: "${await page.title()}"`);

        const modalData = await page.evaluate(() => {
            // Find modal dialog or overlay
            const dialog = document.querySelector('div[role="dialog"], .modal-dialog, mat-dialog-container, console-dialog, [role="document"]');
            if (!dialog) {
                return { error: "No dialog/modal element found using standard selectors." };
            }

            // Dump basic info about the dialog
            const html = dialog.outerHTML;
            const inputs = Array.from(dialog.querySelectorAll('input, button, tr, [role="row"], .mdc-radio')).map((el, idx) => {
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
                tagName: dialog.tagName,
                className: dialog.className,
                htmlSnippet: html.substring(0, 5000),
                inputs
            };
        });

        console.log("\n--- MODAL INSPECTION RESULTS ---");
        if (modalData.error) {
            console.log("Error:", modalData.error);
        } else {
            console.log(`Tag: ${modalData.tagName}, Class: ${modalData.className}`);
            console.log("\n--- INTERACTIVE/ROW ELEMENTS IN MODAL ---");
            modalData.inputs.forEach(inp => {
                console.log(`Element #${inp.index}: Tag=${inp.tagName}, Type="${inp.type}", Role="${inp.role}", Class="${inp.className}", Text="${inp.innerText}", Checked=${inp.checked}, AriaLabel="${inp.ariaLabel}"`);
            });
            console.log("\n--- HTML SNIPPET ---");
            console.log(modalData.htmlSnippet);
        }
        console.log("---------------------------------\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
