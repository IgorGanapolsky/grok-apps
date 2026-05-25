import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");

        const dashboardUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to Dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        console.log("Dumping all tasks and checklist texts...");
        const textTree = await page.evaluate(() => {
            // Find all headers like "Provide app information..."
            const accordions = Array.from(document.querySelectorAll("mat-expansion-panel, .expansion-panel, .accordion, [role='region']"));
            
            // Let's get all list items or divs that have tasks
            const items = Array.from(document.querySelectorAll("div, a, li, span")).filter(el => {
                const text = el.innerText || "";
                // If it contains task names or subtask names
                return text.includes("Set privacy policy") || 
                       text.includes("App access") ||
                       text.includes("Ads") ||
                       text.includes("Content rating") ||
                       text.includes("Target audience") ||
                       text.includes("News apps") ||
                       text.includes("COVID-19") ||
                       text.includes("Data safety") ||
                       text.includes("Government apps") ||
                       text.includes("Financial features") ||
                       text.includes("Store listing") ||
                       text.includes("Select an app category");
            });

            return items.map(item => ({
                tagName: item.tagName,
                text: item.innerText ? item.innerText.trim().substring(0, 150) : "",
                className: item.className
            }));
        });

        console.log("Match count:", textTree.length);
        console.log("Filtered Text Tree:", JSON.stringify(textTree.slice(0, 40), null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("Disconnected.");
    }
}
run();
