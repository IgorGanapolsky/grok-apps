import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console page found.");
            return;
        }

        console.log(`Current page URL: ${page.url()}`);
        
        const linksInfo = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a, button, [role="button"]')).map(el => ({
                tagName: el.tagName,
                text: el.innerText ? el.innerText.trim() : "",
                href: el.getAttribute('href') || "",
                className: el.className || "",
                id: el.id || ""
            })).filter(item => item.text.length > 0 || item.href.length > 0);
        });
        
        console.log("Found links and buttons:");
        console.log(JSON.stringify(linksInfo, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("CDP client disconnected safely.");
    }
}
run();
