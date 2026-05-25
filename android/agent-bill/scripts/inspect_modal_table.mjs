import { chromium } from "playwright";

async function run() {
    console.log("[table-inspector] Connecting to Comet CDP...");
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

        console.log(`[table-inspector] Found tab: "${await page.title()}"`);

        const result = await page.evaluate(() => {
            const table = document.querySelector('console-table[debug-id="prior-release-notes-table"]');
            if (!table) {
                return { error: "console-table[debug-id='prior-release-notes-table'] not found." };
            }

            const html = table.outerHTML;
            const descendants = Array.from(table.querySelectorAll("*")).map((el, idx) => {
                const styles = window.getComputedStyle(el);
                return {
                    idx,
                    tagName: el.tagName.toLowerCase(),
                    className: el.className || "",
                    id: el.id || "",
                    type: el.getAttribute("type") || "",
                    role: el.getAttribute("role") || "",
                    innerText: el.innerText ? el.innerText.trim().substring(0, 100) : "",
                    width: styles.width,
                    height: styles.height,
                    visible: el.getBoundingClientRect().height > 0
                };
            });

            return { html: html.substring(0, 10000), descendants };
        });

        if (result.error) {
            console.log("Error:", result.error);
        } else {
            console.log("\n--- DESCENDANTS OF MODAL TABLE ---");
            result.descendants.forEach(d => {
                if (d.visible) {
                    console.log(`Descendant #${d.idx}: Tag=${d.tagName}, Class="${d.className}", Type="${d.type}", Role="${d.role}", Size=${d.width}x${d.height}, Text="${d.innerText}"`);
                }
            });
            console.log("\n--- HTML OF MODAL TABLE ---");
            console.log(result.html);
            console.log("-----------------------------\n");
        }

    } catch (e) {
        console.error("Error occurred:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
