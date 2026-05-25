import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

async function run() {
    console.log("[inspect-remove] Connecting to Comet CDP...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No contexts");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No Play Console tab found.");

        const rowsInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("console-form-row"));
            return rows.map(row => {
                const label = row.querySelector("label")?.innerText || "Unknown label";
                const buttons = Array.from(row.querySelectorAll("button")).map(btn => ({
                    text: btn.innerText ? btn.innerText.trim() : "",
                    ariaLabel: btn.getAttribute("aria-label"),
                    debugId: btn.getAttribute("debug-id"),
                    className: btn.className,
                    outerHTML: btn.outerHTML.substring(0, 300)
                }));
                const images = Array.from(row.querySelectorAll("img")).map(img => ({
                    alt: img.getAttribute("alt"),
                    src: img.getAttribute("src")?.substring(0, 100),
                    outerHTML: img.outerHTML.substring(0, 300)
                }));
                return {
                    label: label.trim().replace(/\n/g, " "),
                    buttons,
                    images
                };
            }).filter(r => r.label.includes("icon") || r.label.includes("graphic") || r.label.includes("screenshot"));
        });

        console.log("\n=================== ROW BUTTONS & IMAGES ===================");
        console.log(JSON.stringify(rowsInfo, null, 2));
        console.log("============================================================\n");

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
    }
}
run();
