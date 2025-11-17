# CLAUDE.md

This file provides guidance to Claude Code when working with the X Content Deleter project.

## Project Overview

**X Content Deleter** - A free, open-source browser automation tool that helps users delete all their X (Twitter) content (posts, replies, reposts) without paying for third-party services.

**Tech Stack:**
- Pure JavaScript (browser automation)
- MCP Chrome DevTools integration
- Claude Code skill system

**Target Users:**
- Anyone wanting to clean up their X account
- Privacy-conscious users
- People sharing with friends/community
- No technical expertise required (skill-based)

## Project Structure

```
tweet-x-deleter/
├── .claude/
│   └── skills/
│       └── delete-x-content/
│           └── skill.md              # Claude Code skill - main entry point
├── src/
│   ├── delete-x-content.js           # Core automation logic & helper functions
│   └── remove-inactive-followers.js  # Remove inactive followers script
├── README.md                          # User-facing documentation
├── LICENSE                            # MIT + disclaimers
├── CLAUDE.md                          # This file - developer guidance
└── .gitignore                         # Standard ignores
```

## Core Principles

### 1. Simplicity First
- **Keep it simple** - This is a single-purpose tool
- **No dependencies** - Pure JS, no npm packages needed
- **Self-contained** - Everything in one script file
- **Easy to share** - Copy-paste friendly

### 2. Safety & Transparency
- **Always warn users** - Deletions are permanent
- **Recommend backups** - Download X archive first
- **Open source** - All code reviewable
- **No hidden behavior** - Clear logging and progress

### 3. Reliability
- **Rate limiting protection** - Built-in delays
- **Error handling** - Graceful failures, continue processing
- **Resume capability** - Can restart after interruptions
- **Progress tracking** - User always knows status

### 4. Shareability
- **Skill-based interface** - Easy for non-technical users
- **Console fallback** - Works without Claude Code
- **Clear documentation** - README covers all use cases
- **No configuration** - Works out of the box

## File Responsibilities

### `.claude/skills/delete-x-content/skill.md`

**Purpose:** Claude Code skill definition - the "interface" to the automation

**Guidelines:**
- Write clear, user-friendly prompts
- Include all safety warnings
- Provide step-by-step guidance
- Handle edge cases gracefully
- Always confirm before destructive actions

**When modifying:**
- Test the skill invocation flow
- Ensure all user questions are asked upfront
- Verify error messages are helpful
- Update pseudocode if automation logic changes

### `src/delete-x-content.js`

**Purpose:** Core automation logic and helper functions

**Guidelines:**
- **Pure functions** - No global state
- **Clear naming** - Functions describe what they do
- **Defensive coding** - Handle missing elements gracefully
- **Configurable delays** - Easy to adjust rate limiting
- **Logging** - Progress indicators every 10 deletions

**Code organization:**
1. Configuration constants (top)
2. Utility functions (delay, parsing)
3. Core deletion logic (main functions)
4. Console usage example (bottom)

**When modifying:**
- Keep delays configurable in CONFIG object
- Maintain backward compatibility
- Update console example if API changes
- Test with real X account (or test account)

### `README.md`

**Purpose:** User-facing documentation and marketing

**Guidelines:**
- Clear, friendly language
- Assume zero technical knowledge
- Include troubleshooting section
- Provide multiple usage options
- Emphasize safety warnings

**Sections to maintain:**
1. Quick Start (get users running fast)
2. How It Works (transparency)
3. Troubleshooting (common issues)
4. Advanced Usage (for power users)
5. Legal/Safety disclaimers (protect users & project)

## Development Workflow

### Making Changes

1. **Understand the request**
   - Is this a bug fix or new feature?
   - Does it maintain simplicity?
   - Will it help users or add complexity?

2. **Update files in order:**
   - Start with `src/delete-x-content.js` (logic changes)
   - Update `.claude/skills/delete-x-content/skill.md` (if user flow changes)
   - Update `README.md` (if user-facing behavior changes)
   - Update this `CLAUDE.md` (if development process changes)

3. **Test changes:**
   - Read through skill.md prompt (does it make sense?)
   - Review JavaScript logic (does it handle errors?)
   - Check README (is it clear for non-technical users?)

### Adding Features

**Before adding features, ask:**
- Does this align with "delete all content" purpose?
- Will it confuse non-technical users?
- Can it be a separate tool instead?
- Is the added complexity worth it?

**Good feature candidates:**
- Better error handling
- More content types (likes, bookmarks)
- Progress UI improvements
- Date range filtering (simple)
- Dry-run mode (preview)

**Avoid:**
- Complex configuration files
- Dependencies (keep it dependency-free)
- Account management (one account at a time)
- OAuth/API integration (browser automation only)

### Testing Strategy

**Manual testing checklist:**
1. **Skill invocation** - Does it prompt correctly?
2. **Safety checks** - Does it confirm with user?
3. **Browser automation** - Does it find elements?
4. **Error handling** - Does it continue on errors?
5. **Progress logging** - Can user track progress?
6. **Completion** - Does it report summary?

**Test with:**
- Test X account with ~10-50 tweets
- Different content types (posts, replies, reposts)
- Rate limiting scenarios (aggressive deletion)
- UI edge cases (missing buttons, changed selectors)

**DON'T test with:**
- Real accounts with valuable content (use test accounts!)
- Production data (always backup first)

## X Platform Specifics

### DOM Selectors (as of 2025)

**Stable selectors (use these):**
- `article[data-testid="tweet"]` - Tweet container
- `[data-testid="caret"]` - More button (⋯)
- `[data-testid="confirmationSheetConfirm"]` - Delete confirmation
- `[data-testid="unretweet"]` - Unretweet button
- `[data-testid="unretweetConfirm"]` - Unretweet confirmation

**Fragile selectors (avoid):**
- Classes (change frequently)
- IDs (dynamically generated)
- Absolute positions (layout changes)

**When X changes UI:**
1. Open X in Chrome DevTools
2. Inspect the new element structure
3. Find new `data-testid` values
4. Update `CONFIG.selectors` in `src/delete-x-content.js`
5. Update skill.md pseudocode if flow changes
6. Test thoroughly

### Rate Limiting

**X's known limits (2024-2025):**
- API: ~50 deletions per 15 minutes (very restrictive)
- Browser: Less restrictive, but monitored
- Aggressive automation: Can trigger temporary blocks (1-24 hours)

**Our protection strategy:**
- 1 second minimum between deletions
- 3 seconds for content loading
- 500ms between UI clicks
- Total: ~0.5-1 tweet per second

**If user reports rate limiting:**
1. Increase delays in CONFIG
2. Recommend running during off-peak hours
3. Suggest waiting 15-30 minutes between batches

### Content Type URLs

**Profile tab structure:**
- Posts: `https://x.com/{username}`
- Replies: `https://x.com/{username}/with_replies`
- Media: `https://x.com/{username}/media`
- Likes: `https://x.com/{username}/likes`

**Current implementation:** Posts + Replies
**Future:** Could add Likes, Media

## MCP Chrome DevTools Integration

### Available Tools

**Navigation:**
- `mcp__chrome-devtools__navigate_page` - Go to URLs
- `mcp__chrome-devtools__list_pages` - Check open pages
- `mcp__chrome-devtools__new_page` - Open new tab

**Interaction:**
- `mcp__chrome-devtools__take_snapshot` - Get page structure
- `mcp__chrome-devtools__click` - Click elements by UID
- `mcp__chrome-devtools__handle_dialog` - Confirm/dismiss dialogs
- `mcp__chrome-devtools__evaluate_script` - Run JavaScript (for scrolling)

**Key pattern:**
1. Take snapshot → Find UIDs → Click UID → Delay → Repeat

### Snapshot Parsing

**Challenge:** MCP snapshots return accessibility tree as text, not DOM

**Our approach:**
1. Parse text to find element patterns
2. Extract UID values using regex
3. Match UIDs to tweet containers
4. Find nested UIDs (More button within tweet)

**Example snapshot line:**
```
article uid="abc123" tweet by @username: "Tweet text..."
  button uid="xyz789" label="More"
```

**Helper functions:**
- `findTweetElements(snapshot)` - Extract tweet UIDs
- `findMoreButtonInTweet(snapshot, tweet)` - Find nested button UID
- `findDeleteButton(snapshot)` - Find delete menu item

## Coding Guidelines

### JavaScript Style

**Keep it simple:**
```javascript
// Good - clear and simple
async function deleteTweet(tweetUid) {
  await clickMore(tweetUid);
  await delay(500);
  await clickDelete();
  await delay(500);
  await confirmDeletion();
}

// Bad - overly clever
const deleteTweet = async (uid) =>
  Promise.all([clickMore(uid), delay(500)]).then(() =>
    Promise.all([clickDelete(), delay(500)]));
```

**Error handling:**
```javascript
// Good - continue on errors
try {
  await deleteTweet(tweet);
  deletedCount++;
} catch (error) {
  console.error(`Failed to delete tweet: ${error.message}`);
  // Continue to next tweet
}

// Bad - crash on error
await deleteTweet(tweet);  // Unhandled errors stop entire process
deletedCount++;
```

**Configuration:**
```javascript
// Good - configurable at top of file
const CONFIG = {
  delays: { betweenClicks: 500 },
  selectors: { tweet: 'article[data-testid="tweet"]' }
};

// Bad - magic numbers scattered throughout
await delay(500);  // What is 500? Why 500?
const tweet = doc.querySelector('article[data-testid="tweet"]');  // Repeated string
```

### File Size Limits

**Current sizes:**
- `skill.md`: ~350 lines (OK)
- `delete-x-content.js`: ~450 lines (OK)
- `README.md`: ~550 lines (OK)
- `CLAUDE.md`: ~400 lines (this file)

**Target:** Keep all files under 500 lines
**If growing:** Split into multiple files or simplify

### Documentation

**Code comments:**
- Explain WHY, not WHAT
- Document edge cases
- Note X platform quirks
- Reference rate limits

**Examples:**
```javascript
// Good comment
// X's UI doesn't load all tweets at once, need to scroll to trigger infinite scroll
await scrollPage(150);

// Bad comment
// Scroll the page
await scrollPage(150);
```

## User Support & Sharing

### Common User Issues

**1. "It's not working"**
- Check: Logged into X?
- Check: Chrome DevTools MCP configured?
- Check: X changed UI recently?
- Fallback: Suggest console script method

**2. "I got rate limited"**
- Normal behavior if aggressive
- Wait 15-30 minutes
- Increase delays in config
- Run during off-peak hours

**3. "Some tweets remain"**
- Very old tweets may not load
- Refresh and re-run
- Check X search (cache takes 24-48 hours)
- Manual cleanup for stragglers

**4. "Can I undo?"**
- No - deletions are permanent
- Should have downloaded X archive first
- No recovery options

### Helping Users Install

**For non-technical users:**
1. Point to README Quick Start section
2. Recommend console script method (simpler)
3. Provide step-by-step screenshots (future)
4. Offer to create video tutorial (future)

**For technical users:**
1. Point to Claude Code + MCP setup
2. Share skill installation commands
3. Link to MCP documentation
4. Encourage customization

### Sharing the Project

**GitHub repo checklist:**
- [ ] Clear README with Quick Start
- [ ] LICENSE file (MIT + disclaimers)
- [ ] .gitignore configured
- [ ] Tagged releases for versions
- [ ] Issues enabled for support
- [ ] CONTRIBUTING.md (if accepting PRs)

**Alternative sharing:**
- GitHub Gist (just the console script)
- Zip file download (entire project)
- Copy-paste skill folder (just skill)

## Future Enhancements

### Potential Features

**High Priority:**
- [ ] Delete likes (similar flow)
- [ ] Delete bookmarks
- [ ] Dry-run mode (count without deleting)
- [ ] Better progress bar/UI

**Medium Priority:**
- [ ] Date range filtering ("delete tweets older than 1 year")
- [ ] Keyword exclusion ("keep tweets with #important")
- [ ] Export deletion log (CSV of what was deleted)
- [ ] Multiple account support (switch accounts)

**Low Priority:**
- [ ] GUI wrapper (Electron app)
- [ ] Browser extension version
- [ ] Scheduled deletions (cron-like)
- [ ] Backup integration (auto-download archive first)

### Technical Debt

**None currently** - Project is new and clean

**Watch for:**
- X UI changes (will break selectors)
- MCP API changes (may need updates)
- Chrome DevTools protocol changes

## Maintenance

### When X Changes UI

**Detection:**
- User reports "not working"
- Script can't find elements
- Console shows selector errors

**Fix process:**
1. Open x.com in Chrome
2. Inspect current DOM structure
3. Find new `data-testid` values
4. Update `CONFIG.selectors` in JS
5. Update skill.md pseudocode
6. Test with test account
7. Update version number
8. Notify users (GitHub release)

### Version Management

**Semantic Versioning:**
- Major (1.0.0): Breaking changes, complete rewrites
- Minor (0.1.0): New features, X UI updates
- Patch (0.0.1): Bug fixes, documentation updates

**Current:** v1.0.0 (initial release)

**Changelog location:** Add to README.md or separate CHANGELOG.md

## Security & Privacy

### User Data Protection

**We NEVER:**
- ❌ Store user credentials
- ❌ Send data to external servers
- ❌ Track user behavior
- ❌ Require API keys

**We ALWAYS:**
- ✅ Run in user's browser (local)
- ✅ Use user's existing login session
- ✅ Show all code (open source)
- ✅ Warn about permanence

### Responsible Disclosure

**If X issues a takedown:**
- Comply immediately
- Inform users via README
- Archive project responsibly
- Don't encourage ToS violations

**If security issue found:**
- Fix immediately
- Notify users if data at risk
- Document in changelog
- Thank reporter

## Contributing Guidelines (for future contributors)

### How to Contribute

**Good contributions:**
- Bug fixes (especially X UI changes)
- Documentation improvements
- Error handling enhancements
- Test coverage
- Troubleshooting guides

**Discuss first:**
- New features (may increase complexity)
- Breaking changes (affects existing users)
- Dependencies (we're dependency-free)
- Major refactors (simplicity over cleverness)

### Pull Request Process

1. **Fork and branch** - `feature/your-feature-name`
2. **Test thoroughly** - Use test X account
3. **Update docs** - README, skill.md, CLAUDE.md
4. **Keep it simple** - No unnecessary complexity
5. **Submit PR** - Clear description of changes

## Quick Reference

### Key Files

| File | Purpose | Edit When |
|------|---------|-----------|
| `skill.md` | User interface | Changing user flow, questions, or prompts |
| `delete-x-content.js` | Core logic | Fixing bugs, adding features, updating selectors |
| `README.md` | User docs | Changing usage, adding features, troubleshooting |
| `CLAUDE.md` | Dev docs | Changing development process, guidelines |

### Common Tasks

**Update X selectors:**
→ Edit `CONFIG.selectors` in `src/delete-x-content.js:46-52`

**Adjust rate limiting:**
→ Edit `CONFIG.delays` in `src/delete-x-content.js:43-48`

**Modify user prompts:**
→ Edit `.claude/skills/delete-x-content/skill.md:48-80`

**Add troubleshooting:**
→ Edit `README.md` "Troubleshooting" section (~line 200)

**Test the skill:**
→ Copy `.claude/skills/delete-x-content/` to `~/.claude/skills/`
→ Invoke in Claude Code: "Use delete-x-content skill"

---

## Philosophy

**Remember:** This tool is about giving people control of their own data. Keep it:
- ✅ Simple enough for anyone
- ✅ Transparent and trustworthy
- ✅ Free and open source
- ✅ Respectful of user safety

**When in doubt:** Choose simplicity. Choose user safety. Choose transparency.

**Questions?** Open an issue or read the README.
