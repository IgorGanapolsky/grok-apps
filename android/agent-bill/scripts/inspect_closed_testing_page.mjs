import { chromium } from "playwright";

async function run() {
    console.log("Connecting to Comet CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("No Play Console tab found.");
            return;
        }
        console.log(`Analyzing page: ${page.url()}`);
        
        const data = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText ? a.innerText.trim() : "",
                href: a.getAttribute('href') || "",
                outerHTML: a.outerHTML.substring(0, 200)
            }));
            const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.innerText ? b.innerText.trim() : "",
                outerHTML: b.outerHTML.substring(0, 200)
            }));
            const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText);
            return { links, buttons, headings };
        });

        console.log("Headings found:", data.headings);
        console.log("Links found:");
        data.links.forEach(l => {
            if (l.text || l.href) {
                console.log(`  - "${l.text}" -> href: ${l.href} (${l.outerHTML})`);
            }
        });
        console.log("Buttons found:");
        data.buttons.forEach(b => {
            if (b.text) {
                console.log(`  - "${b.text}" -> (${b.outerHTML})`);
            }
        });
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
