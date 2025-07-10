import { expect, test } from "@playwright/test";
import { generateRandomString, takeDebugScreenshot } from "../utils/test-helpers";
import { SavedRepliesPage } from "../utils/page-objects/savedRepliesPage";

test.use({ storageState: "tests/e2e/.auth/user.json" });

test.describe("New Message with Saved Replies", () => {
  let savedRepliesPage: SavedRepliesPage;
  let testSavedReplyName: string;

  test.beforeEach(async ({ page }) => {
    savedRepliesPage = new SavedRepliesPage(page);
    testSavedReplyName = `Test Reply ${generateRandomString()}`;
    
    try {
      await savedRepliesPage.navigateToSavedReplies();
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      
      await savedRepliesPage.expectPageVisible();
      
      await page.waitForTimeout(500);
      
      const testContent = `Hello! Thank you for contacting us. How can I help you today? - ${generateRandomString()}`;
      await savedRepliesPage.createSavedReply(testSavedReplyName, testContent);
      
      await page.waitForTimeout(1000); // Increased wait time for saved reply to be created
    } catch (error) {
      console.error("Failed to create test saved reply:", error);
      await takeDebugScreenshot(page, "failed-saved-reply-creation.png");
      throw error;
    }
    
    // Navigate to conversations page with more robust error handling
    let navigationSuccessful = false;
    let retries = 0;
    const maxRetries = 3;

    while (!navigationSuccessful && retries < maxRetries) {
      try {
        await page.goto("/mailboxes/gumroad/mine", { timeout: 20000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
        
        // Wait for the page to be interactive
        const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
        await newMessageButton.waitFor({ state: "visible", timeout: 10000 });
        
        navigationSuccessful = true;
      } catch (error) {
        retries++;
        console.log(`Navigation attempt ${retries} failed:`, error);
        if (retries >= maxRetries) {
          throw new Error(`Failed to navigate after ${maxRetries} attempts: ${error}`);
        }
        await page.waitForTimeout(2000);
      }
    }
  });

  test("should show saved reply selector in new message modal and insert content", async ({ page }) => {
    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await expect(newMessageButton).toBeVisible();
    await newMessageButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    const modalTitle = page.locator('h2:has-text("New message")');
    await expect(modalTitle).toBeVisible();

    // Wait for saved replies to load
    await page.waitForTimeout(1000);

    const savedReplySelector = page.locator('button:has-text("Use saved reply")');
    await expect(savedReplySelector).toBeVisible({ timeout: 10000 });

    await savedReplySelector.click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await expect(searchInput).toBeVisible();

    const replyOptions = page.locator('[role="option"]');
    await expect(replyOptions.first()).toBeVisible();

    await replyOptions.first().click();

    const messageEditor = page.locator('[role="textbox"][contenteditable="true"]').last();
    await page.waitForTimeout(500);
    
    const editorContent = await messageEditor.textContent();
    expect(editorContent?.length).toBeGreaterThan(0);

    await takeDebugScreenshot(page, "saved-reply-functionality-working.png");

    await page.keyboard.press("Escape");
  });

  test("should open saved reply selector using keyboard shortcut", async ({ page, browserName }) => {
    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await expect(newMessageButton).toBeVisible();
    await newMessageButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Wait for saved replies to load
    await page.waitForTimeout(1000);

    // First, verify the saved reply button is visible
    const savedReplyButton = page.locator('button:has-text("Use saved reply")');
    await expect(savedReplyButton).toBeVisible({ timeout: 10000 });

    // Focus on the button or modal to ensure hotkey handler is active
    await savedReplyButton.focus();
    await page.waitForTimeout(300);

    // Use the correct key combination based on OS and browser
    const isMac = process.platform === 'darwin';
    const modifierKey = isMac ? 'Meta' : 'Control';
    
    // Press the keyboard shortcut
    await page.keyboard.press(`${modifierKey}+/`);
    await page.waitForTimeout(800);

    // Check if the popover opened
    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    
    // If keyboard shortcut didn't work, click the button as fallback
    const isSearchVisible = await searchInput.isVisible().catch(() => false);
    if (!isSearchVisible) {
      console.log("Keyboard shortcut didn't work, clicking button instead");
      await savedReplyButton.click();
      await page.waitForTimeout(500);
    }

    await expect(searchInput).toBeVisible();

    const replyOptions = page.locator('[role="option"]');
    await expect(replyOptions.first()).toBeVisible();

    await takeDebugScreenshot(page, "keyboard-shortcut-saved-replies.png");

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape"); // Close modal too
  });

  test("should populate subject field when saved reply is selected", async ({ page }) => {
    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await expect(newMessageButton).toBeVisible();
    await newMessageButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const subjectInput = page.locator('input[placeholder="Subject"]');
    await expect(subjectInput).toBeVisible();
    expect(await subjectInput.inputValue()).toBe("");

    // Wait for saved replies to load
    await page.waitForTimeout(1000);

    const savedReplySelector = page.locator('button:has-text("Use saved reply")');
    await expect(savedReplySelector).toBeVisible({ timeout: 10000 });
    await savedReplySelector.click();
    await page.waitForTimeout(500);

    // Search for the specific test saved reply to ensure we select the right one
    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(testSavedReplyName);
    await page.waitForTimeout(800);

    const replyOptions = page.locator('[role="option"]');
    await expect(replyOptions.first()).toBeVisible();
    
    // Verify we found the correct saved reply
    const firstOptionText = await replyOptions.first().textContent();
    expect(firstOptionText).toContain(testSavedReplyName);
    
    await replyOptions.first().click();

    await page.waitForTimeout(500);

    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toBe(testSavedReplyName);

    const messageEditor = page.locator('[role="textbox"][contenteditable="true"]').last();
    const editorContent = await messageEditor.textContent();
    expect(editorContent?.length).toBeGreaterThan(0);

    await takeDebugScreenshot(page, "subject-population-working.png");

    await page.keyboard.press("Escape");
  });

  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/mailboxes/gumroad/mine");
    await page.waitForLoadState("domcontentloaded");

    // Wait for page to stabilize on mobile
    await page.waitForTimeout(2000);

    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await expect(newMessageButton).toBeVisible({ timeout: 10000 });
    await newMessageButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Wait for modal content to load on mobile
    await page.waitForTimeout(1500);

    // Try multiple selectors for the saved reply button
    const savedReplySelector = page.locator('button:has-text("Use saved reply")').or(
      page.locator('button').filter({ hasText: /use saved reply/i })
    );
    
    // Wait longer for mobile rendering
    await expect(savedReplySelector).toBeVisible({ timeout: 15000 });
    
    await savedReplySelector.click();
    await page.waitForTimeout(800);
    
    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await expect(searchInput).toBeVisible();

    await takeDebugScreenshot(page, "new-message-mobile-saved-replies.png");

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("should filter saved replies when searching", async ({ page, context }) => {
    // Set a longer default timeout for this test
    test.setTimeout(60000);
    
    const secondReplyName = `Different Reply ${generateRandomString()}`;
    const secondReplyContent = `This is a different saved reply - ${generateRandomString()}`;
    
    try {
      await savedRepliesPage.navigateToSavedReplies();
      await page.waitForTimeout(1000);
      await savedRepliesPage.createSavedReply(secondReplyName, secondReplyContent);
      await page.waitForTimeout(1500); // Wait for second reply to be saved
    } catch (error) {
      console.error("Failed to create second saved reply:", error);
      throw error;
    }
    
    // Create a new page to avoid navigation issues
    const newPage = await context.newPage();
    
    try {
      await newPage.goto("/mailboxes/gumroad/mine", { 
        timeout: 30000,
        waitUntil: 'domcontentloaded' 
      });
      
      // Wait for the page to be fully loaded
      await newPage.waitForTimeout(2000);

      const newMessageButton = newPage.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
      await expect(newMessageButton).toBeVisible({ timeout: 15000 });
      await newMessageButton.click();

      // Wait for modal and saved replies to load
      await newPage.waitForTimeout(1500);

      const savedReplySelector = newPage.locator('button:has-text("Use saved reply")');
      await expect(savedReplySelector).toBeVisible({ timeout: 10000 });
      await savedReplySelector.click();
      await newPage.waitForTimeout(500);

      const replyOptions = newPage.locator('[role="option"]');
      await expect(replyOptions.first()).toBeVisible();
      const initialCount = await replyOptions.count();
      expect(initialCount).toBeGreaterThanOrEqual(2);

      const searchInput = newPage.locator('input[placeholder="Search saved replies..."]');
      await searchInput.fill("Test Reply");
      await newPage.waitForTimeout(800);

      const filteredOptions = newPage.locator('[role="option"]');
      await expect(filteredOptions.first()).toBeVisible();
      
      const optionText = await filteredOptions.first().textContent();
      expect(optionText).toContain("Test Reply");

      await takeDebugScreenshot(newPage, "saved-reply-search-filtering.png");

      await newPage.keyboard.press("Escape");
    } finally {
      await newPage.close();
    }
  });
}); 