import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
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

        console.log("Extracting card-to-button mapping...");
        const mapping = await page.evaluate(() => {
            // Find all card elements or section blocks in App Content
            // Typically cards are enclosed in standard divs or custom elements
            // Let's find all buttons and trace their parent headings
            const cards = Array.from(document.querySelectorAll("section, [role='listitem'], .card, .section, ytd-section-renderer, console-card"));
            const results = [];
            
            // If custom components are used, let's find all headers and locate the closest button in their container
            const headings = Array.from(document.querySelectorAll("h2, h3, h4, [role='heading']"));
            for (const h of headings) {
                const text = h.innerText.trim();
                // Find sibling or child buttons
                let container = h.parentElement;
                let btn = null;
                // Go up 3 levels to find a button in the same container
                for (let i = 0; i < 4; i++) {
                    if (!container) break;
                    btn = container.querySelector("button, a.item-link");
                    if (btn && btn.innerText.trim().includes("declaration")) {
                        break;
                    }
                    container = container.parentElement;
                }
                
                if (btn) {
                    results.push({
                        heading: text,
                        buttonText: btn.innerText.trim().replace(/\n/g, " | "),
                        buttonTag: btn.tagName.toLowerCase(),
                        hasHref: btn.href || ""
                    });
                }
            }
            return results;
        });

        console.log("Card-to-button Mapping Results:", JSON.stringify(mapping, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
