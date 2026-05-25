import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("Connecting to Comet CDP...");
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

        console.log(`URL: ${page.url()}`);
        
        // Let's dump all text contents of the main page body
        const bodyText = await page.innerText("body");
        console.log("\n--- BODY TEXT ---");
        console.log(bodyText);
        console.log("-----------------\n");

        // Let's list all inputs and buttons on the page with their outerHTML or visible text
        const elements = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("input, button, label, console-checkbox, mat-checkbox")).map(el => ({
                tagName: el.tagName.toLowerCase(),
                type: el.getAttribute("type") || "",
                text: el.innerText ? el.innerText.trim().replace(/\n/g, ' ') : "",
                html: el.outerHTML.substring(0, 200)
            }));
        });
        console.log("Form Elements:", JSON.stringify(elements, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
