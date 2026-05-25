import { chromium } from "playwright";

const DEV_ID = "8239620436488925047";
const APP_IDS = [
    "4975052170380819841",
    "4973243580627455820",
    "4975394319223159909",
    "4974102653489500289",
    "4974783165629137921",
    "4973155392583982050",
    "4976249162120849673"
];

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        
        console.log("Analyzing each App ID...");
        const results = [];
        for (const appId of APP_IDS) {
            const url = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${appId}/app-dashboard`;
            console.log(`Checking app ${appId}...`);
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
            await page.waitForTimeout(2000);
            
            const title = await page.title();
            const text = await page.evaluate(() => document.body.innerText);
            
            // Try to find package name in body
            const matches = text.match(/com\.[a-zA-Z0-9_.]+/g) || [];
            const packageNames = Array.from(new Set(matches)).filter(p => p.includes("iganapolsky") || p.includes("tactical") || p.includes("lucid") || p.includes("openclaw"));
            
            results.push({
                appId,
                title: title.replace(" - Google Play Console", ""),
                packages: packageNames
            });
        }
        
        console.log("\n=== Play Store App Mapping ===");
        console.log(JSON.stringify(results, null, 2));
        console.log("==============================\n");

        await page.close();

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP disconnected.");
    }
}
run();
