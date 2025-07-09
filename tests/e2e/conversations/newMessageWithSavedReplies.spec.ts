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
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      
      await savedRepliesPage.expectPageVisible();
      
      await page.waitForTimeout(1000);
      
      const testContent = `Hello! Thank you for contacting us. How can I help you today? - ${generateRandomString()}`;
      await savedRepliesPage.createSavedReply(testSavedReplyName, testContent);
      
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error("Failed to create test saved reply:", error);
      await takeDebugScreenshot(page, "failed-saved-reply-creation.png");
      throw error;
    }
    
    try {
      await page.goto("/mailboxes/gumroad/mine", { timeout: 15000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch (error) {
      console.log("Initial navigation failed, retrying...", error);
      await page.goto("/mailboxes/gumroad/mine", { timeout: 15000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
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

    const savedReplySelector = page.locator('button:has-text("Insert saved reply")');
    await expect(savedReplySelector).toBeVisible();

    await savedReplySelector.click();

    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await expect(searchInput).toBeVisible();

    const replyOptions = page.locator('[role="option"]');
    await expect(replyOptions.first()).toBeVisible();

    await replyOptions.first().click();

    const messageEditor = page.locator('[role="textbox"][contenteditable="true"]').last();
    await page.waitForTimeout(500);
    
    const editorContent = await messageEditor.textContent();
    expect(editorContent?.length).toBeGreaterThan(0);

    const toastSelectors = [
      'text*="inserted"',
      '[role="alert"]',
      '[data-testid="toast"]',
      '.toast'
    ];
    
    let toastFound = false;
    for (const selector of toastSelectors) {
      try {
        await page.locator(selector).waitFor({ state: "visible", timeout: 2000 });
        toastFound = true;
        break;
      } catch {
      }
    }

    if (toastFound) {
      console.log("Success toast found");
    } else {
      console.log("Success toast not found but content was inserted");
    }

    await takeDebugScreenshot(page, "saved-reply-functionality-working.png");

    await page.keyboard.press("Escape");
  });

  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/mailboxes/gumroad/mine");
    await page.waitForLoadState("networkidle");

    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await expect(newMessageButton).toBeVisible();
    await newMessageButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    const savedReplySelector = page.locator('button:has-text("Insert saved reply")');
    await expect(savedReplySelector).toBeVisible();
    
    await savedReplySelector.click();
    
    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await expect(searchInput).toBeVisible();

    await takeDebugScreenshot(page, "new-message-mobile-saved-replies.png");

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test("should filter saved replies when searching", async ({ page }) => {
    const secondReplyName = `Different Reply ${generateRandomString()}`;
    const secondReplyContent = `This is a different saved reply - ${generateRandomString()}`;
    
    await savedRepliesPage.navigateToSavedReplies();
    await savedRepliesPage.createSavedReply(secondReplyName, secondReplyContent);
    
    await page.goto("/mailboxes/gumroad/mine");
    await page.waitForLoadState("networkidle");

    const newMessageButton = page.locator('button[class*="fixed"][class*="bottom-6"][class*="right-6"]');
    await newMessageButton.click();

    const savedReplySelector = page.locator('button:has-text("Insert saved reply")');
    await savedReplySelector.click();

    const replyOptions = page.locator('[role="option"]');
    const initialCount = await replyOptions.count();
    expect(initialCount).toBeGreaterThanOrEqual(2);

    const searchInput = page.locator('input[placeholder="Search saved replies..."]');
    await searchInput.fill("Test Reply");
    await page.waitForTimeout(500);

    const filteredOptions = page.locator('[role="option"]');
    await expect(filteredOptions.first()).toBeVisible();
    
    const optionText = await filteredOptions.first().textContent();
    expect(optionText).toContain("Test Reply");

    await takeDebugScreenshot(page, "saved-reply-search-filtering.png");

    await page.keyboard.press("Escape");
  });
}); 