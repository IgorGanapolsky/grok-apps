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

        console.log(`[inspector] Inspecting HTML of Release details...`);
        const result = await page.evaluate(() => {
            // Find container of Release details
            const headers = Array.from(document.querySelectorAll("h2, h3, h4, div"));
            const releaseDetailsHeader = headers.find(el => el.innerText && el.innerText.trim() === "Release details");
            if (!releaseDetailsHeader) {
                return { error: "Could not find 'Release details' header." };
            }

            // Get the parent or sibling container
            let container = releaseDetailsHeader.parentElement;
            
            // Let's dump all textareas and inputs again, check their CSS display/visibility
            const elements = Array.from(container.querySelectorAll("input, textarea, button, a, div[role], span")).map(el => {
                const styles = window.getComputedStyle(el);
                return {
                    tagName: el.tagName.toLowerCase(),
                    id: el.id || "",
                    className: el.className || "",
                    innerText: el.innerText ? el.innerText.trim().substring(0, 100) : "",
                    value: el.value || "",
                    ariaLabel: el.getAttribute("aria-label") || "",
                    display: styles.display,
                    visibility: styles.visibility,
                    opacity: styles.opacity,
                    height: styles.height,
                    width: styles.width
                };
            });

            return { html: container.outerHTML.substring(0, 3000), elements };
        });

        if (result.error) {
            console.log("Error:", result.error);
        } else {
            console.log("\n--- ELEMENTS UNDER RELEASE DETAILS ---");
            result.elements.forEach((el, idx) => {
                if (el.display !== "none" && el.visibility !== "hidden") {
                    console.log(`El #${idx}: Tag=${el.tagName}, ID="${el.id}", Class="${el.className}", Text="${el.innerText}", Value="${el.value}", AriaLabel="${el.ariaLabel}", Size=${el.width}x${el.height}`);
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
