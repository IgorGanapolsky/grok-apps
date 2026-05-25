import { chromium } from "playwright";

async function run() {
    console.log("[promote-bot] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        
        if (!page) {
            console.log("[promote-bot] No Play Console page found. Opening a new one...");
            page = await ctx.newPage();
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // Navigate to the developer's app list
        const appListUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app-list";
        console.log(`[promote-bot] Navigating directly to App List: ${appListUrl}`);
        await page.goto(appListUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Find the link for com.iganapolsky.agentbill
        const appLinkInfo = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links.map(a => ({
                text: a.innerText ? a.innerText.trim().replace(/\n/g, ' ') : "",
                href: a.href
            })).filter(l => l.text.includes("AgentBill — AI Cost Auditor") || l.href.includes("app/"));
        });
        
        console.log("App Links Found:");
        console.log(JSON.stringify(appLinkInfo, null, 2));

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
