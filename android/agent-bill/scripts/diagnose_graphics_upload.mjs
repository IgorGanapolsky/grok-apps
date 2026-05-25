import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

async function run() {
    console.log("[graphics-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[graphics-bot] Found ${pages.length} active tabs.`);
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            throw new Error("No active Play Console tab found.");
        }
        
        console.log(`[graphics-bot] Active page title: "${await page.title()}"`);
        await page.setViewportSize({ width: 1440, height: 900 });

        // Scroll to the bottom or Graphics section
        console.log("[graphics-bot] Scrolling down to the Graphics / Upload elements...");
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(3000);

        await page.screenshot({ path: resolve(rootDir, "graphics_scrolled_middle.png") });
        console.log("[graphics-bot] Saved middle page screenshot.");

        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight * 0.8);
        });
        await page.waitForTimeout(3000);

        await page.screenshot({ path: resolve(rootDir, "graphics_scrolled_bottom.png") });
        console.log("[graphics-bot] Saved bottom page screenshot.");

        // Inspect DOM structure of each upload zone
        const uploadContainers = await page.evaluate(() => {
            // Let's find all headers and check their containers
            const headers = Array.from(document.querySelectorAll("h1, h2, h3, h4, div"));
            const sections = [];
            
            // Look for headings and their closest parent containers
            headers.forEach(h => {
                const text = h.textContent ? h.textContent.trim() : "";
                if (text === "App icon" || text === "Feature graphic" || text === "Phone screenshots") {
                    let parent = h.parentElement;
                    // Let's go up a few levels and dump details
                    for (let i = 0; i < 4 && parent; i++) {
                        sections.push({
                            sectionName: text,
                            level: i,
                            tagName: parent.tagName,
                            className: parent.className,
                            buttons: Array.from(parent.querySelectorAll("button")).map(b => b.textContent.trim()),
                            inputs: Array.from(parent.querySelectorAll("input")).map(inp => ({
                                type: inp.type,
                                accept: inp.accept,
                                className: inp.className,
                                id: inp.id
                            })),
                            outerHTMLSnippet: parent.outerHTML.substring(0, 500)
                        });
                        parent = parent.parentElement;
                    }
                }
            });
            return sections;
        });

        writeFileSync(resolve(rootDir, "upload_containers.json"), JSON.stringify(uploadContainers, null, 2));
        console.log("[graphics-bot] Written upload_containers.json");

    } catch (e) {
        console.error("[graphics-bot] Error:", e.message);
    } finally {
        await browser.close().catch(() => {});
        console.log("[graphics-bot] CDP client disconnected.");
    }
}

run();
