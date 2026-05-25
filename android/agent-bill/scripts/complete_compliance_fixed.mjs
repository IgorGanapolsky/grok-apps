import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const DEV_ID = "8239620436488925047";
const APP_ID = "4973243580627455820";
const OVERVIEW_URL = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/overview`;

async function run() {
    console.log("[compliance-bot] Connecting to Comet on remote debugging port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    
    try {
        const contexts = browser.contexts();
        if (contexts.length === 0) throw new Error("No browser contexts found.");
        const ctx = contexts[0];
        const pages = await ctx.pages();
        
        console.log(`[compliance-bot] Found ${pages.length} active tabs.`);
        let page = pages.find((p) => p.url().includes("play.google.com/console"));
        if (!page) {
            console.log("[compliance-bot] No Play Console tab found. Opening a new tab...");
            page = await ctx.newPage();
        } else {
            console.log(`[compliance-bot] Attaching directly to existing tab: "${await page.title()}"`);
        }

        await page.setViewportSize({ width: 1440, height: 900 });

        // ==========================================
        // 1. GOVERNMENT APPS DECLARATION
        // ==========================================
        console.log("\n[compliance-bot] --- 1. Processing Government Apps ---");
        const govUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/government-apps`;
        await page.goto(govUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        // Select No robustly
        const govSelected = await page.evaluate(() => {
            console.log("Searching for Government radio buttons...");
            // Try to find the radio input or element with 'No'
            const radios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'));
            const noRadio = radios.find(r => {
                const parent = r.closest('label') || r.parentElement;
                const text = parent ? parent.textContent.trim().toLowerCase() : "";
                return text === 'no' || text.includes('does not represent a government');
            });
            if (noRadio) {
                noRadio.click();
                return true;
            }
            return false;
        });

        if (govSelected) {
            console.log("[compliance-bot] Selected 'No' for Government apps.");
            await page.waitForTimeout(2000);
            
            // Save
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            // Dismiss modal
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Not now');
                if (btn) btn.click();
            });
            await page.waitForTimeout(2000);
        } else {
            console.log("[compliance-bot] Warning: Government apps 'No' radio not found. (Might be already completed)");
        }

        await page.screenshot({ path: resolve(rootDir, "government_apps_completed.png") });

        // ==========================================
        // 2. CONTENT RATINGS QUESTIONNAIRE
        // ==========================================
        console.log("\n[compliance-bot] --- 2. Processing Content Ratings ---");
        const ratingUrl = `https://play.google.com/console/u/0/developers/${DEV_ID}/app/${APP_ID}/app-content/content-rating-overview`;
        await page.goto(ratingUrl, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);

        const ratingStarted = await page.evaluate(() => {
            const editBtn = Array.from(document.querySelectorAll('a, span, button')).find(el => el.textContent.trim() === 'Edit');
            if (editBtn) {
                editBtn.click();
                return true;
            }
            const startBtn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Start questionnaire') || el.textContent.includes('Start new questionnaire'));
            if (startBtn) {
                startBtn.click();
                return true;
            }
            return false;
        });

        if (ratingStarted) {
            await page.waitForTimeout(6000);
            console.log(`[compliance-bot] Questionnaires page loaded: ${page.url()}`);

            // 2a. Step 1: Category & Email & Terms of Use
            const filledStep1 = await page.evaluate(() => {
                // Email
                const emailInput = document.querySelector('input[type="email"], input[aria-label*="email"], input[aria-label*="Email"]');
                if (emailInput) {
                    emailInput.value = 'igor@iganapolsky.com';
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                    emailInput.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Category select
                const radios = Array.from(document.querySelectorAll('mat-radio-button, console-radio-button, [role="radio"]'));
                const utilityRadio = radios.find(el => el.textContent.includes("Utility") || el.textContent.includes("productivity") || el.textContent.includes("other") || el.textContent.includes("All Other App Types"));
                if (utilityRadio) {
                    utilityRadio.click();
                }

                // Terms of Use Checkbox - precise native checkbox selector
                const cb = document.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) {
                    cb.click();
                }
                return true;
            });

            if (filledStep1) {
                console.log("[compliance-bot] Step 1 Category Screen: Filled email, category, and checked Terms of Use.");
                await page.waitForTimeout(2000);

                // Click Next
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
                    if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(6000);
            }

            // 2b. Answer survey questions
            let surveyPageNum = 1;
            let consecutiveSameUrlCount = 0;
            let lastPageUrl = page.url();
            let lastPageHtml = "";

            while (surveyPageNum <= 15) {
                console.log(`[compliance-bot] Answering survey questions on page #${surveyPageNum}...`);
                
                // Fetch page body HTML to see if page content is changed
                const currentPageHtml = await page.evaluate(() => document.body.innerHTML);
                const currentUrl = page.url();

                if (currentUrl === lastPageUrl && currentPageHtml === lastPageHtml) {
                    consecutiveSameUrlCount++;
                    if (consecutiveSameUrlCount >= 3) {
                        console.log("[compliance-bot] Page state did not change after 3 attempts. Breaking survey loop.");
                        break;
                    }
                } else {
                    consecutiveSameUrlCount = 0;
                }

                lastPageUrl = currentUrl;
                lastPageHtml = currentPageHtml;

                const hasRadios = await page.evaluate(() => {
                    const radios = Array.from(document.querySelectorAll('input[type="radio"], [role="radio"]'));
                    if (radios.length === 0) return false;

                    let clickedCount = 0;
                    
                    // Group radios by name attribute (which groups them by question)
                    const groupsByName = {};
                    for (const r of radios) {
                        const name = r.name || r.getAttribute('name');
                        if (name) {
                            if (!groupsByName[name]) groupsByName[name] = [];
                            groupsByName[name].push(r);
                        }
                    }

                    // For each group, click the "No" option
                    for (const name in groupsByName) {
                        const groupRadios = groupsByName[name];
                        const noRadio = groupRadios.find(r => {
                            const labelContainer = r.closest('material-radio, mat-radio-button, console-radio-button, label') || r.parentElement;
                            const text = labelContainer ? labelContainer.textContent.trim().toLowerCase() : "";
                            if (text === 'no' || (text.includes("no") && !text.includes("not now") && !text.includes("game"))) {
                                return true;
                            }
                            const ariaLabel = r.getAttribute('aria-label') || "";
                            if (ariaLabel.toLowerCase().includes("no")) return true;

                            return false;
                        });

                        if (noRadio) {
                            const isChecked = noRadio.checked || noRadio.getAttribute('aria-checked') === 'true';
                            if (!isChecked) {
                                noRadio.click();
                            }
                            clickedCount++;
                        }
                    }

                    return clickedCount > 0;
                });

                if (!hasRadios) {
                    console.log("[compliance-bot] No radio groups found on this page. Checking if we are on rating calculation...");
                    break;
                }

                await page.waitForTimeout(2000);

                // Click Save if present and enabled
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Save');
                    if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(3000);

                // Click Next
                const clickedNext = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Next');
                    if (btn && !btn.disabled) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (!clickedNext) {
                    console.log("[compliance-bot] 'Next' button is not available or disabled.");
                    break;
                }
                
                await page.waitForTimeout(5000);
                surveyPageNum++;
            }

            // 2c. Calculate & Submit rating
            console.log("[compliance-bot] Submitting and applying rating calculation...");
            
            // Try clicking Calculate/Save
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Calculate' || el.textContent.trim() === 'Save' || el.textContent.trim() === 'Save rating');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            // Click Apply rating/Submit
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'Submit' || el.textContent.trim() === 'Apply rating');
                if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            await page.screenshot({ path: resolve(rootDir, "content_rating_completed.png") });
            console.log("[compliance-bot] Content Rating completed successfully!");
        } else {
            console.log("[compliance-bot] Content Rating already completed or couldn't start questionnaire.");
        }

        // ==========================================
        // 3. FINAL VERIFICATION
        // ==========================================
        console.log("\n[compliance-bot] --- 3. Final Verification ---");
        await page.goto(OVERVIEW_URL, { waitUntil: "networkidle" });
        await page.waitForTimeout(6000);
        await page.screenshot({ path: resolve(rootDir, "app_content_overview_state.png") });
        console.log("[compliance-bot] Completed remaining declarations. Saved final Overview screenshot.");

    } catch (e) {
        console.error("[compliance-bot] Error:", e.message);
        try {
            await page.screenshot({ path: resolve(rootDir, "compliance_error.png") });
        } catch (screenshotErr) {}
    } finally {
        await browser.close().catch(() => {});
        console.log("[compliance-bot] CDP client disconnected safely.");
    }
}

run();
