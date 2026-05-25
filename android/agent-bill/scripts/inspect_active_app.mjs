import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts found");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found. Opening a new one...");
            page = await ctx.newPage();
            await page.goto("https://play.google.com/console/u/0/developers/8239620436488925047/app-list", { waitUntil: "networkidle" });
        }

        console.log(`Current page title: "${await page.title()}"`);
        console.log(`Current page URL: ${page.url()}`);

        if (page.url().includes("app-list")) {
            console.log("We are on the app-list page. Let's find AgentBill and click it...");
            
            // Wait for elements to load
            await page.waitForTimeout(5000);
            
            // Let's find the link that contains AgentBill
            const agentBillLink = page.locator('a:has-text("AgentBill")');
            if (await agentBillLink.count() > 0) {
                console.log("Found AgentBill link! Clicking it...");
                const href = await agentBillLink.getAttribute("href");
                console.log(`AgentBill href attribute: ${href}`);
                await agentBillLink.click();
                await page.waitForLoadState("networkidle");
                console.log(`Navigated to: ${page.url()}`);
            } else {
                console.log("AgentBill link not found in text list. Let's look for rows.");
                const links = await page.evaluate(() => {
                    return Array.from(document.querySelectorAll('a'))
                        .map(a => ({ text: a.innerText.trim(), href: a.href }))
                        .filter(l => l.text.toLowerCase().includes("agentbill") || l.href.includes("app/"));
                });
                console.log("All matching links on page:", JSON.stringify(links, null, 2));
            }
        }

        // Wait another 5 seconds for page load
        await page.waitForTimeout(5000);
        await page.screenshot({ path: resolve(rootDir, "active_app_state.png") });
        console.log(`Screenshot saved to active_app_state.png`);
        console.log(`Final URL: ${page.url()}`);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
