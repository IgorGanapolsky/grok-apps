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

        const targetUrl = "https://play.google.com/console/u/0/developers/8239620436488925047/app/4973243580627455820/app-dashboard";
        console.log(`Navigating directly to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000);

        const pageTitle = await page.title();
        console.log(`Page title: "${pageTitle}"`);
        console.log(`Page URL: ${page.url()}`);

        const appHeader = await page.evaluate(() => {
            const h1 = document.querySelector("h1");
            return h1 ? h1.innerText.trim() : "No H1 found";
        });
        console.log(`App header element text: "${appHeader}"`);

        await page.screenshot({ path: resolve(rootDir, "verify_app_dashboard.png") });
        console.log("Screenshot saved to verify_app_dashboard.png");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
