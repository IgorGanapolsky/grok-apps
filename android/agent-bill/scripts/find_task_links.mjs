import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

async function run() {
    console.log("Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Find elements with text "category" or "store" and dump their HTML and tag structure
        const elements = await page.evaluate(() => {
            const results = [];
            const allElements = document.querySelectorAll("*");
            for (const el of allElements) {
                const text = el.innerText ? el.innerText.trim() : "";
                if (text.includes("Select an app category") || text.includes("Set up your store listing")) {
                    results.push({
                        tagName: el.tagName,
                        className: el.className,
                        text: text.substring(0, 100),
                        id: el.id,
                        debugId: el.getAttribute("debug-id"),
                        href: el.getAttribute("href") || el.href,
                        onclick: el.getAttribute("onclick"),
                        hasClick: typeof el.onclick === "function" || el.getAttribute("role") === "button"
                    });
                }
            }
            return results;
        });

        console.log("Found matching elements:", JSON.stringify(elements, null, 2));
        writeFileSync("matching_elements.json", JSON.stringify(elements, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("CDP client disconnected safely.");
    }
}

run();
