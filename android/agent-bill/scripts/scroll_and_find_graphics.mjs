import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[graphics-scroll] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) throw new Error("No active Play Console tab found.");
        
        console.log(`[graphics-scroll] Active page title: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll the Graphics header into view
        const scrolled = await page.evaluate(() => {
            const divs = Array.from(document.querySelectorAll("h1, h2, h3, h4, div, span, legend"));
            const target = divs.find(el => {
                const text = el.textContent ? el.textContent.trim() : "";
                return text === "Graphics" || text === "Listing assets";
            });
            if (target) {
                target.scrollIntoView({ block: "start", inline: "nearest" });
                return { success: true, text: target.textContent.trim(), tagName: target.tagName };
            }
            return { success: false };
        });

        console.log("[graphics-scroll] Scroll attempt result:", scrolled);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: resolve(rootDir, "graphics_scroll_attempt.png") });
        console.log("[graphics-scroll] Saved graphics_scroll_attempt.png");

        // Inspect the DOM under the scrolled section
        const pageInfo = await page.evaluate(() => {
            // Find all headings
            const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, legend, div.section-title, span.section-title")).map(h => ({
                tagName: h.tagName,
                text: h.textContent ? h.textContent.trim().substring(0, 100) : "",
                className: h.className
            })).filter(h => h.text.length > 0);

            // Find all input files on the entire page
            const inputs = Array.from(document.querySelectorAll("input[type='file']")).map(inp => ({
                id: inp.id,
                name: inp.name,
                accept: inp.accept,
                className: inp.className,
                placeholder: inp.placeholder,
                outerHTML: inp.outerHTML.substring(0, 300)
            }));

            // Find all buttons that mention "Add" or "Upload" or "assets"
            const buttons = Array.from(document.querySelectorAll("button")).map(btn => ({
                text: btn.textContent ? btn.textContent.trim() : "",
                className: btn.className,
                ariaLabel: btn.getAttribute("aria-label"),
                outerHTML: btn.outerHTML.substring(0, 300)
            })).filter(b => b.text.toLowerCase().includes("add") || b.text.toLowerCase().includes("upload") || b.text.toLowerCase().includes("asset"));

            // Let's also look for text elements that contain "icon", "feature", "screenshot"
            const keywordElements = [];
            const allElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, div, span, p, label, legend"));
            allElements.forEach(el => {
                const text = el.textContent ? el.textContent.trim() : "";
                if (text.length > 0 && text.length < 150) {
                    const low = text.toLowerCase();
                    if (low.includes("app icon") || low.includes("feature graphic") || low.includes("phone screenshot")) {
                        keywordElements.push({
                            tagName: el.tagName,
                            text: text,
                            className: el.className,
                            parentTagName: el.parentElement ? el.parentElement.tagName : null,
                            parentClassName: el.parentElement ? el.parentElement.className : null
                        });
                    }
                }
            });

            return { headings, inputs, buttons, keywordElements };
        });

        writeFileSync(resolve(rootDir, "graphics_dom_info.json"), JSON.stringify(pageInfo, null, 2));
        console.log("[graphics-scroll] Dumped graphics DOM info to graphics_dom_info.json");

    } catch (e) {
        console.error("[graphics-scroll] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[graphics-scroll] CDP client disconnected.");
    }
}

run();
