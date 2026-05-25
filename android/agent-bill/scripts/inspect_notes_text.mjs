import { chromium } from "playwright";

async function run() {
    console.log("[inspector] Connecting to Comet CDP...");
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

        console.log(`[inspector] Locating "Copy from a previous release" element...`);
        const result = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll("*"));
            const target = elements.find(el => el.innerText && el.innerText.trim() === "Copy from a previous release");
            if (!target) {
                return { error: "Could not find element with text 'Copy from a previous release'." };
            }

            // Dump parent's outerHTML (up to 4 levels up)
            let current = target;
            for (let i = 0; i < 4; i++) {
                if (current.parentElement) {
                    current = current.parentElement;
                }
            }

            // Also find any textareas or inputs near it
            const localElements = Array.from(current.querySelectorAll("input, textarea, button, a, div, span")).map(el => {
                const styles = window.getComputedStyle(el);
                return {
                    tagName: el.tagName.toLowerCase(),
                    className: el.className || "",
                    innerText: el.innerText ? el.innerText.trim().substring(0, 100) : "",
                    value: el.value || "",
                    ariaLabel: el.getAttribute("aria-label") || "",
                    display: styles.display,
                    visibility: styles.visibility,
                    height: styles.height,
                    width: styles.width
                };
            });

            return { html: current.outerHTML.substring(0, 4000), localElements };
        });

        if (result.error) {
            console.log("Error:", result.error);
        } else {
            console.log("\n--- LOCAL ELEMENTS AROUND NOTES LINK ---");
            result.localElements.forEach((el, idx) => {
                if (el.display !== "none" && el.visibility !== "hidden") {
                    console.log(`El #${idx}: Tag=${el.tagName}, Class="${el.className}", Text="${el.innerText}", Value="${el.value}", AriaLabel="${el.ariaLabel}", Size=${el.width}x${el.height}`);
                }
            });
            console.log("\n--- HTML SNIPPET ---");
            console.log(result.html);
            console.log("--------------------\n");
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}

run();
