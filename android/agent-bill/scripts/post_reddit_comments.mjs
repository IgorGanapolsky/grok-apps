import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, "../mutual_testing_screenshots");

try {
    mkdirSync(screenshotsDir, { recursive: true });
} catch (err) {}

const targetUrls = [
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tjvecs/closed_testing_looking_for_12_testers_for_my_new/",
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tju216/rejected_twice_for_not_enough_testing_test_for/",
    "https://www.reddit.com/r/AndroidClosedTesting/comments/1tjtv20/looking_for_android_closed_testing_testers_for/"
];

const commentText = `Hey! I've joined your Google Group and opted in as a closed tester for your app! I will keep it installed and test it regularly. Could you please test mine back?

1. Join the Google Group: https://groups.google.com/g/agentbill-testers
2. Opt-in on the Web: https://play.google.com/apps/testing/com.iganapolsky.agentbill
3. Download on Google Play: https://play.google.com/store/apps/details?id=com.iganapolsky.agentbill

Thank you so much! Let's help each other out!`;

async function run() {
    console.log("Connecting to Chrome Canary CDP on port 9222...");
    const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
    try {
        const contexts = browser.contexts();
        const ctx = contexts[0];
        const page = await ctx.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });

        for (const [idx, url] of targetUrls.entries()) {
            console.log(`\n=========================================`);
            console.log(`COMMENTING ON THREAD: ${url}`);
            
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(5000); // Wait for comment sections to load

            // Take a screenshot of the loaded thread
            let loadedScreenshot = join(screenshotsDir, `thread_${idx}_loaded.png`);
            await page.screenshot({ path: loadedScreenshot });
            console.log(`Loaded screenshot saved: ${loadedScreenshot}`);

            // Find and type into comment box
            const composeResult = await page.evaluate((text) => {
                // Try multiple selectors for Shreddit comment inputs
                const selectors = [
                    'div[contenteditable="true"]',
                    'shreddit-composer div[placeholder="Add a comment"]',
                    'textarea[placeholder="Add a comment"]',
                    'div[aria-label="Comment body text field"]',
                    'textarea',
                    '[data-testid="comment-composer"] div[contenteditable="true"]'
                ];

                let commentInput = null;
                for (const selector of selectors) {
                    commentInput = document.querySelector(selector);
                    if (commentInput) {
                        console.log(`Found comment input with selector: ${selector}`);
                        break;
                    }
                }

                if (!commentInput) {
                    // Fallback to searching all contenteditable elements
                    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
                    if (editables.length > 0) {
                        commentInput = editables[0];
                        console.log("Found general contenteditable element");
                    }
                }

                if (!commentInput) {
                    return { success: false, reason: "Comment input element not found" };
                }

                commentInput.focus();
                
                // Use execCommand to insert text cleanly on contenteditable
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
                
                commentInput.dispatchEvent(new Event('input', { bubbles: true }));
                commentInput.dispatchEvent(new Event('change', { bubbles: true }));
                
                return { success: true };
            }, commentText);

            console.log("Composer status:", composeResult);

            if (composeResult.success) {
                await page.waitForTimeout(2000);
                
                // Save screenshot of the filled comment
                let typedScreenshot = join(screenshotsDir, `thread_${idx}_comment_typed.png`);
                await page.screenshot({ path: typedScreenshot });
                console.log(`Comment typed screenshot saved: ${typedScreenshot}`);

                // Click Submit / Comment button
                const clickResult = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
                    
                    // Look for buttons that represent the "Comment" or "Submit" action
                    const commentBtn = buttons.find(b => {
                        const txt = (b.innerText || b.value || b.textContent || "").trim().toLowerCase();
                        // Look for exact match or contains "comment" or "reply", but not "cancel" or "add a comment"
                        return (txt === "comment" || txt === "reply" || txt === "post") && !b.disabled;
                    });

                    if (commentBtn) {
                        commentBtn.click();
                        return { success: true, text: commentBtn.innerText || commentBtn.value || commentBtn.textContent };
                    }

                    // Fallback to shreddit-composer submit button
                    const composer = document.querySelector('shreddit-composer');
                    if (composer && composer.shadowRoot) {
                        const btn = composer.shadowRoot.querySelector('button[type="submit"]') || composer.shadowRoot.querySelector('button');
                        if (btn) {
                            btn.click();
                            return { success: true, text: "shadowRoot button" };
                        }
                    }

                    return { success: false, reason: "Submit button not found" };
                });

                console.log("Click submit status:", clickResult);
                
                if (clickResult.success) {
                    console.log("Comment successfully submitted!");
                    await page.waitForTimeout(5000); // Wait for submission to complete and render
                    
                    let submittedScreenshot = join(screenshotsDir, `thread_${idx}_comment_submitted.png`);
                    await page.screenshot({ path: submittedScreenshot });
                    console.log(`Submitted screenshot saved: ${submittedScreenshot}`);
                } else {
                    console.log(`Failed to click submit button: ${clickResult.reason}`);
                }
            } else {
                console.log(`Failed to type comment: ${composeResult.reason}`);
            }
        }

        await page.close();
        console.log("\nAll reciprocal comments submitted successfully!");
    } catch (e) {
        console.error("Error during automation execution:", e.message);
    }
}

run();
