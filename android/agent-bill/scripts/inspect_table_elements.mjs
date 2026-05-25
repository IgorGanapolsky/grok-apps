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
            page = await ctx.newPage();
        }

        const appListUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app-list";
        await page.goto(appListUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.innerText.trim().replace(/\n/g, ' ')
            }));
        });

        console.log("Found Links:");
        console.log(JSON.stringify(links, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        console.log("Done.");
    }
}
run();
