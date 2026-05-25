import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

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

        const targetUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(7000);

        console.log(`Page title: "${await page.title()}"`);
        console.log(`Page URL: ${page.url()}`);

        // Find all links on the dashboard
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a")).map(a => ({
                text: a.innerText ? a.innerText.trim().replace(/\n/g, " | ") : "",
                href: a.href || "",
                className: a.className || ""
            })).filter(l => l.href.includes("/app/"));
        });

        console.log(`Found ${links.length} links on the page.`);
        writeFileSync(resolve(rootDir, "dashboard_links.json"), JSON.stringify(links, null, 2));
        console.log("Dumped links to dashboard_links.json");

        // Print links containing "content", "setup", "rating", "policy" or "safety"
        const relevantLinks = links.filter(l => 
            l.text.toLowerCase().includes("content") ||
            l.text.toLowerCase().includes("policy") ||
            l.text.toLowerCase().includes("safety") ||
            l.text.toLowerCase().includes("financial") ||
            l.text.toLowerCase().includes("rating") ||
            l.text.toLowerCase().includes("setup") ||
            l.href.includes("content") ||
            l.href.includes("policy") ||
            l.href.includes("safety")
        );
        console.log("Relevant navigation links:", JSON.stringify(relevantLinks, null, 2));

        await page.screenshot({ path: resolve(rootDir, "dashboard_sidebar_state.png") });
        console.log("Saved screenshot to dashboard_sidebar_state.png");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
