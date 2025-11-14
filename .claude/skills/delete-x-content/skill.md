# Delete X Content

Automate deletion of all posts, replies, and reposts from your X (Twitter) account using browser automation.

## What This Does

This skill uses Chrome DevTools browser automation to systematically delete:
- **Posts** - All original tweets
- **Replies** - All replies to other users
- **Reposts** - All retweets/reposts

## Prerequisites

**Required:**
- Chrome browser with MCP Chrome DevTools server configured
- Active X (Twitter) account login in Chrome
- Claude Code with chrome-devtools MCP integration

**Recommended:**
- Download your X archive first (backup your data)
- Works best for accounts with <10,000 posts
- Stable internet connection

## Safety Warnings

⚠️ **IMPORTANT:**
- Deletions are **permanent** and **cannot be undone**
- This may violate X's Terms of Service (use at your own risk)
- X may temporarily block your account if rate limits are exceeded
- Keep the browser window open during the process
- Do NOT interrupt the process mid-deletion

## How It Works

1. **Navigate** to your X profile in Chrome
2. **Identify** tweets using the accessibility tree snapshot
3. **Automate** the deletion flow:
   - Click "More" button (⋯) on each tweet
   - Click "Delete" in menu
   - Confirm deletion dialog
   - Wait for appropriate delays (rate limiting protection)
4. **Scroll** to load more content dynamically
5. **Repeat** until no more content exists
6. **Process** all tabs: Posts, Replies, Reposts

## Process Overview

The automation will:
- Add 1-second delays between deletions (rate limiting protection)
- Add 3-second delays for content loading
- Log progress every 10 deletions
- Handle errors gracefully
- Stop when all content is deleted

**Estimated Time:**
- <100 items: ~5-10 minutes
- 100-1,000 items: 20-60 minutes
- 1,000-10,000 items: 2-5 hours

## User Instructions

When invoked, guide the user through:

1. **Preparation:**
   - Ask: "Have you downloaded your X archive for backup?"
   - Ask: "Are you sure you want to delete ALL your X content? This cannot be undone."
   - Confirm: Wait for explicit "yes" or "proceed"

2. **Browser Setup:**
   - Use `mcp__chrome-devtools__list_pages` to check open pages
   - If X.com not open, use `mcp__chrome-devtools__new_page` to open https://x.com
   - Verify user is logged in by checking for profile elements

3. **Get Username:**
   - Ask user for their X username (e.g., "@username")
   - Will be used to navigate to profile tabs

4. **Execute Deletion:**
   - Process in order: Posts → Replies → Reposts
   - For each content type:
     a. Navigate to appropriate tab
     b. Take snapshot to identify tweets
     c. Find and delete tweets using automation
     d. Scroll and repeat until no more content
     e. Report progress

5. **Completion:**
   - Report total items deleted
   - Suggest user verify their profile
   - Remind them deletion is complete

## Automation Logic

Use the following approach for deletion:

```javascript
// Pseudocode for automation flow
async function deleteTweets(contentType) {
  let deletedCount = 0;
  let hasMore = true;

  // Navigate to correct tab
  await navigateToTab(contentType); // /username, /username/with_replies, etc.

  while (hasMore) {
    // Take snapshot
    const snapshot = await takeSnapshot();

    // Find tweet elements
    const tweets = findTweetElements(snapshot);

    if (tweets.length === 0) {
      hasMore = false;
      break;
    }

    for (const tweet of tweets) {
      try {
        // Find "More" button in tweet
        const moreButton = findMoreButton(tweet);

        // Click More
        await click(moreButton);
        await delay(500);

        // Take new snapshot to find delete menu
        const menuSnapshot = await takeSnapshot();
        const deleteButton = findDeleteButton(menuSnapshot);

        // Click Delete
        await click(deleteButton);
        await delay(500);

        // Handle confirmation dialog
        await handleDialog('accept');
        await delay(1000);

        deletedCount++;

        // Log progress every 10 deletions
        if (deletedCount % 10 === 0) {
          console.log(`Deleted ${deletedCount} ${contentType}...`);
        }

      } catch (error) {
        console.error(`Error deleting tweet: ${error.message}`);
        // Continue to next tweet
      }
    }

    // Scroll to load more
    await scrollPage(150);
    await delay(3000);
  }

  return deletedCount;
}
```

## Error Handling

If errors occur:
- **Rate Limited**: Wait 15-30 minutes, then resume
- **UI Changes**: X may have updated selectors - skill may need updates
- **Stuck Loading**: Refresh page and restart from current position
- **Account Blocked**: Wait for X to unblock (usually 1-24 hours)

## Expected Behavior

**Success Indicators:**
- Console shows progress logs
- Tweet count decreases on profile
- No error messages
- Smooth scrolling and deletion

**Failure Indicators:**
- Errors in console
- No tweets being deleted after 5 minutes
- Browser disconnected
- X shows "unusual activity" warning

## Tips for Success

1. Run during off-peak hours (late night)
2. Don't use X in other tabs during process
3. Keep laptop plugged in (prevents sleep)
4. Monitor first 50 deletions to ensure it's working
5. If blocked, wait and resume later

## Output Format

Provide user updates like:
```
✓ Navigated to Posts tab
⏳ Deleting posts... (10/estimated 500)
⏳ Deleting posts... (50/estimated 500)
✓ Completed Posts: 487 deleted
✓ Navigated to Replies tab
⏳ Deleting replies... (10/estimated 200)
...
✓ All content deleted successfully!
📊 Summary: 487 posts, 213 replies, 45 reposts = 745 total items deleted
```

## Limitations

- Cannot recover deleted content
- May miss some tweets if X's UI changes during process
- Cannot delete tweets from suspended accounts
- Protected/locked accounts may have issues
- Very old tweets (>10 years) may not appear in profile

## Alternative Approach

If MCP Chrome DevTools automation has issues, provide user with console script alternative:
- Share JavaScript snippet they can paste in DevTools Console
- Less reliable but simpler fallback option
- Reference: lucahammer's X deletion script (GitHub)

## Invocation

Users can invoke this skill by:
- Natural language: "Delete all my X content"
- Skill name: Type or select "delete-x-content" skill
- After invocation, follow the user guidance steps above

**Always prioritize user safety and data protection. Confirm multiple times before executing permanent deletions.**
