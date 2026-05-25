import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet...");
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

        console.log("Locating 'Advertising ID' heading ancestors...");
        const ancestors = await page.evaluate(() => {
            const heading = Array.from(document.querySelectorAll("simple-html[role='heading'], h3, h4"))
                .find(h => h.innerText.trim().includes("Advertising ID"));
            if (!heading) return null;
            
            const list = [];
            let el = heading.parentElement;
            while (el) {
                list.push({
                    tag: el.tagName.toLowerCase(),
                    className: el.className,
                    id: el.id
                });
                el = el.parentElement;
            }
            return list;
        });

        console.log("Ancestors:", JSON.stringify(ancestors, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
