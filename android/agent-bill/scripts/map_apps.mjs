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

        const appListUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app-list";
        console.log(`[promote-bot] Navigating directly to App List: ${appListUrl}`);
        await page.goto(appListUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Map name, package and app ID
        const appMap = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
            return rows.map(r => {
                const text = r.innerText || "";
                const links = Array.from(r.querySelectorAll('a'));
                const href = links.length > 0 ? links[0].href : "";
                
                // Extract app ID from href (e.g. /app/123456/)
                const match = href.match(/\/app\/(\d+)/);
                const appId = match ? match[1] : "";

                return {
                    text: text.trim().replace(/\n/g, ' | '),
                    appId,
                    href
                };
            }).filter(item => item.appId !== "");
        });

        console.log("Mapped Apps on Google Play Console:");
        console.log(JSON.stringify(appMap, null, 2));

    } catch (e) {
        console.error("[promote-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[promote-bot] CDP client disconnected.");
    }
}

run();
