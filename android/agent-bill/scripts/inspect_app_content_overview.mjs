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
        }

        const targetUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-content/overview";
        console.log(`Navigating directly to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        console.log(`Page title: "${await page.title()}"`);
        console.log(`Page URL: ${page.url()}`);

        // Let's print out all headers or text elements on this page
        const textSegments = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll("h1, h2, h3, [role='heading']")).map(h => h.innerText.trim());
            const lists = Array.from(document.querySelectorAll("section, li, tr, [role='row']")).map(el => el.innerText ? el.innerText.trim().replace(/\n/g, " | ") : "").filter(t => t.includes("safety") || t.includes("Safety") || t.includes("financial") || t.includes("Financial") || t.includes("rating") || t.includes("Rating"));
            return { headings, lists };
        });
        console.log("Headings found:", textSegments.headings);
        console.log("Interesting lists/rows:", textSegments.lists);

        // Let's find all active action links or buttons that can navigate to questionnaires
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a, button")).map(el => ({
                tag: el.tagName.toLowerCase(),
                text: el.innerText ? el.innerText.trim().replace(/\n/g, " | ") : "",
                href: el.href || "",
                visible: el.getBoundingClientRect().height > 0
            })).filter(l => l.visible);
        });
        console.log("Visible links/buttons:", JSON.stringify(links, null, 2));

        await page.screenshot({ path: resolve(rootDir, "app_content_overview_state.png") });
        console.log("Screenshot saved to app_content_overview_state.png");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
