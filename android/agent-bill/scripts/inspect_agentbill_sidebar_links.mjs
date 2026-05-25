import { chromium } from "playwright";

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        
        const dashboardUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-dashboard`;
        console.log(`Navigating to dashboard: ${dashboardUrl}`);
        await page.goto(dashboardUrl, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(5000);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.innerText.trim().replace(/\n/g, ' ')
            })).filter(l => l.href.includes("testing") || l.href.includes("release") || l.href.includes("closed"));
        });

        console.log("\n=== Sidebar/Testing Links Found ===");
        console.log(JSON.stringify(links, null, 2));
        console.log("===================================\n");

        await page.close();

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
