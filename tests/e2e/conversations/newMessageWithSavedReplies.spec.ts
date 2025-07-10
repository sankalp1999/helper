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
      // First, create a saved reply
      await savedRepliesPage.navigateToSavedReplies();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      
      await savedRepliesPage.expectPageVisible();
      
      // Wait for the page to be fully loaded
      await page.waitForTimeout(1000);
      
      const testContent = `Hello! Thank you for contacting us. How can I help you today? - ${generateRandomString()}`;
      await savedRepliesPage.createSavedReply(testSavedReplyName, testContent);
      
      // Wait for saved reply to be created and indexed
      await page.waitForTimeout(2000);
    } catch (error) {
      console.error("Failed to create test saved reply:", error);
      await takeDebugScreenshot(page, "failed-saved-reply-creation.png");
      throw error;
    }
    
    // Navigate to conversations page with improved error handling
    let navigationSuccessful = false;
    let retries = 0;
    const maxRetries = 3;

    while (!navigationSuccessful && retries < maxRetries) {
      try {
        await page.goto("/mailboxes/gumroad/mine", { 
          timeout: 30000,
          waitUntil: 'domcontentloaded' 
        });
        
        // Wait for any loading states to complete
        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
          // Continue even if networkidle times out
        });
        
        // Wait for the new message button - use multiple possible selectors
        const buttonSelectors = [
          'button[aria-label="New message"]',
          'button:has(svg.lucide-send)',
          '.fixed.bottom-6.right-6 button'
        ];
        
        let buttonFound = false;
        for (const selector of buttonSelectors) {
          try {
            await page.waitForSelector(selector, { 
              timeout: 5000,
              state: 'visible' 
            });
            buttonFound = true;
            break;
          } catch {
            // Try next selector
          }
        }
        
        if (buttonFound) {
          navigationSuccessful = true;
        } else {
          throw new Error("New message button not found with any selector");
        }
      } catch (error) {
        retries++;
        console.log(`Navigation attempt ${retries} failed:`, error);
        if (retries >= maxRetries) {
          throw new Error(`Failed to navigate after ${maxRetries} attempts: ${error}`);
        }
        await page.waitForTimeout(3000);
      }
    }
  });

  test("should show saved reply selector in new message modal and insert content", async ({ page }) => {
    // Use multiple selectors for the new message button
    const newMessageButton = page.locator('button[aria-label="New message"]').or(page.locator('.fixed.bottom-6.right-6 button'));
    await expect(newMessageButton).toBeVisible({ timeout: 10000 });
    await newMessageButton.click();

    // Wait for modal to open
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verify modal title
    const modalTitle = modal.locator('h2:has-text("New message")');
    await expect(modalTitle).toBeVisible();

    // Wait for the modal content to fully load
    await page.waitForTimeout(1500);

    // Look for the saved reply selector button - it contains both icon and text
    const savedReplySelector = modal.locator('button[role="combobox"]:has-text("Use saved reply")');
    await expect(savedReplySelector).toBeVisible({ timeout: 10000 });

    await savedReplySelector.click();
    await page.waitForTimeout(500);

    // Wait for the popover content
    const searchInput = page.getByPlaceholder('Search saved replies...');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Look for command items instead of options
    const replyItems = page.locator('[role="option"]');
    await expect(replyItems.first()).toBeVisible({ timeout: 5000 });

    // Click the first saved reply
    await replyItems.first().click();

    // Wait for the content to be inserted
    await page.waitForTimeout(1000);

    // Check that the message editor has content
    const messageEditor = modal.locator('[role="textbox"][contenteditable="true"]');
    const editorContent = await messageEditor.textContent();
    expect(editorContent?.length).toBeGreaterThan(0);

    await takeDebugScreenshot(page, "saved-reply-functionality-working.png");

    // Close the modal
    await page.keyboard.press("Escape");
  });

  test("should open saved reply selector using keyboard shortcut", async ({ page }) => {
    // Use multiple selectors for the new message button
    const newMessageButton = page.locator('button[aria-label="New message"]').or(page.locator('.fixed.bottom-6.right-6 button'));
    await expect(newMessageButton).toBeVisible({ timeout: 10000 });
    await newMessageButton.click();

    // Wait for modal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for saved reply button to be visible
    const savedReplyButton = modal.locator('button[role="combobox"]:has-text("Use saved reply")');
    await expect(savedReplyButton).toBeVisible({ timeout: 10000 });

    // Click on the message editor to focus it
    const messageEditor = modal.locator('[role="textbox"][contenteditable="true"]');
    await messageEditor.click();
    await messageEditor.focus();
    
    // Use the keyboard shortcut
    const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifierKey}+/`);

    // Check that the search input appears
    const searchInput = page.getByPlaceholder('Search saved replies...');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("should populate subject field when saved reply is selected", async ({ page }) => {
    // Use multiple selectors for the new message button
    const newMessageButton = page.locator('button[aria-label="New message"]').or(page.locator('.fixed.bottom-6.right-6 button'));
    await expect(newMessageButton).toBeVisible({ timeout: 10000 });
    await newMessageButton.click();

    // Wait for modal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check subject input is initially empty
    const subjectInput = modal.locator('input[placeholder="Subject"]');
    await expect(subjectInput).toBeVisible();
    expect(await subjectInput.inputValue()).toBe("");

    // Wait for modal content to load
    await page.waitForTimeout(1500);

    // Click saved reply selector
    const savedReplySelector = modal.locator('button[role="combobox"]:has-text("Use saved reply")');
    await expect(savedReplySelector).toBeVisible({ timeout: 10000 });
    await savedReplySelector.click();
    
    // Wait for popover
    await page.waitForTimeout(500);

    // Search for the specific test saved reply
    const searchInput = page.getByPlaceholder('Search saved replies...');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill(testSavedReplyName);
    await page.waitForTimeout(800);

    // Select the first (and should be only) option
    const replyOptions = page.locator('[role="option"]');
    await expect(replyOptions.first()).toBeVisible({ timeout: 5000 });
    
    // Verify we found the correct saved reply
    const firstOptionText = await replyOptions.first().textContent();
    expect(firstOptionText).toContain(testSavedReplyName);
    
    await replyOptions.first().click();

    // Wait for the form to update
    await page.waitForTimeout(1000);

    // Check that subject is populated
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toBe(testSavedReplyName);

    // Check that message content is populated
    const messageEditor = modal.locator('[role="textbox"][contenteditable="true"]');
    const editorContent = await messageEditor.textContent();
    expect(editorContent?.length).toBeGreaterThan(0);

    await takeDebugScreenshot(page, "subject-population-working.png");

    // Close the modal
    await page.keyboard.press("Escape");
  });

  test("should work on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to the page
    await page.goto("/mailboxes/gumroad/mine", { waitUntil: 'domcontentloaded' });
    
    // Wait for network to stabilize
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
      // Continue even if networkidle times out
    });

    // Wait for page to stabilize on mobile
    await page.waitForTimeout(2000);

    // Use multiple selectors for the new message button
    const newMessageButton = page.locator('button[aria-label="New message"]').or(page.locator('.fixed.bottom-6.right-6 button'));
    await expect(newMessageButton).toBeVisible({ timeout: 15000 });
    await newMessageButton.click();

    // Wait for modal
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for modal content to load on mobile
    await page.waitForTimeout(2000);

    // Look for saved reply selector
    const savedReplySelector = modal.locator('button[role="combobox"]:has-text("Use saved reply")');
    
    // Wait longer for mobile rendering
    await expect(savedReplySelector).toBeVisible({ timeout: 15000 });
    
    await savedReplySelector.click();
    await page.waitForTimeout(800);
    
    // Check search input appears
    const searchInput = page.getByPlaceholder('Search saved replies...');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await takeDebugScreenshot(page, "new-message-mobile-saved-replies.png");

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("should filter saved replies when searching", async ({ page, context }) => {
    // Set a longer default timeout for this test
    test.setTimeout(60000);
    
    const secondReplyName = `Different Reply ${generateRandomString()}`;
    const secondReplyContent = `This is a different saved reply - ${generateRandomString()}`;
    
    // Create second saved reply
    try {
      await savedRepliesPage.navigateToSavedReplies();
      await page.waitForTimeout(1000);
      await savedRepliesPage.createSavedReply(secondReplyName, secondReplyContent);
      await page.waitForTimeout(2000); // Wait for second reply to be saved
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
      
      // Wait for network to stabilize
      await newPage.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {
        // Continue even if networkidle times out
      });
      
      // Wait for the page to be fully loaded
      await newPage.waitForTimeout(2000);

      // Use multiple selectors for the new message button
      const newMessageButton = newPage.locator('button[aria-label="New message"]').or(newPage.locator('.fixed.bottom-6.right-6 button'));
      await expect(newMessageButton).toBeVisible({ timeout: 15000 });
      await newMessageButton.click();

      // Wait for modal and content to load
      const modal = newPage.getByRole('dialog');
      await expect(modal).toBeVisible({ timeout: 5000 });
      await newPage.waitForTimeout(1500);

      // Click saved reply selector
      const savedReplySelector = modal.locator('button[role="combobox"]:has-text("Use saved reply")');
      await expect(savedReplySelector).toBeVisible({ timeout: 10000 });
      await savedReplySelector.click();
      await newPage.waitForTimeout(500);

      // Check we have multiple options initially
      const replyOptions = newPage.locator('[role="option"]');
      await expect(replyOptions.first()).toBeVisible({ timeout: 5000 });
      const initialCount = await replyOptions.count();
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Search for "Test Reply"
      const searchInput = newPage.getByPlaceholder('Search saved replies...');
      await searchInput.fill("Test Reply");
      await newPage.waitForTimeout(800);

      // Check filtered results
      const filteredOptions = newPage.locator('[role="option"]');
      await expect(filteredOptions.first()).toBeVisible();
      
      // Verify the first option contains "Test Reply"
      const optionText = await filteredOptions.first().textContent();
      expect(optionText).toContain("Test Reply");

      await takeDebugScreenshot(newPage, "saved-reply-search-filtering.png");

      // Close modal
      await newPage.keyboard.press("Escape");
    } finally {
      await newPage.close();
    }
  });
}); 