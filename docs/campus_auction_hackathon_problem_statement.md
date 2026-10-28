# Campus Auction Hackathon

**Problem statement**  
**Candidate brief:** October 2026

> Build the place where campus competes fairly for them, and every item finds its next owner.

## 1. The Story

It is the last day of the final semester exams. Seniors are packing up, leaving behind cycles, calculators, and books. Most of them leave campus within a week. Juniors need exactly those things, but today they are sold through chat groups where the fastest person wins, and the price is a guess.

Build a place where campus competes fairly for these items and every item finds its next owner.

## 2. The Basics

Every app must implement these requirements first.

### 2.1 Listings

- Each item is its own auction.
- A seller can create a listing with:
  - Title
  - Category (for example, cycle, calculator, books, or electronics)
  - Description
  - Condition
  - Photos
  - Starting price
  - Minimum bid increment
  - Closing date and time for that item
- Different items can close at different times.
- A seller can edit or cancel a listing.

### 2.2 Browsing

- Students can search by keyword.
- Students can filter by:
  - Category
  - Condition
  - Price
  - Closing soon
- Each auction displays:
  - Item details
  - Current leading bid
  - Full bid history
  - Its own countdown

### 2.3 Bidding

- The first bid must be at least the starting price.
- Each subsequent bid must be at least the current price plus the minimum bid increment.
- Students cannot bid after the auction closes.
- Every bid is recorded with:
  - Bidder
  - Amount
  - Time
- All bids and maximums are public. Nothing about bidding is private.

### 2.4 Closing and Sale

- When an item's closing time passes, bidding stops.
- The highest valid bid becomes the provisional winner.
- If nobody bids, the item is marked **unsold**. The seller can list it again manually.
- The seller approves or rejects the winning price.
- If the seller approves:
  - The item is reserved for the winner.
  - Confirmed campus handover completes the sale.
- Rejection, seller cancellation, and failed pickup must be recorded with a clear outcome.

### 2.5 Notifications

- Students can allow browser notifications.
- The same alerts then appear as browser pop-ups when the app is open in a background tab.

## 3. Key Features

These features build on the basics. There is more here than most teams can finish in the available time, so teams should choose what to build and in what order, and be ready to explain why.

### 3.1 AI Assistant Tab

- Some students may prefer to ask for what they need instead of searching and comparing items manually.
- Example request: **“Find me a cycle under ₹2,000.”**
- The assistant should give a direct answer and may be able to bid on the student's behalf.
- The assistant must follow the same rules as every other bidder:
  - It never acts without the student's go-ahead.
  - It never exceeds the limit the student agreed to.
  - It never reveals other students' account details.

### 3.2 Questions Before Bidding

- Buyers may want more information before bidding.
- Examples include:
  - Whether a cycle's brake works
  - Whether a calculator's display is faded
  - Whether a book's pages are marked
- Provide a way for buyers and sellers to resolve these questions on each auction.
- Avoid making sellers answer the same question repeatedly.
- Avoid allowing auction pages to fill with spam.

### 3.3 Never Miss What You Need

- Juniors may not be able to check the app every hour.
- An item they need might be listed while they are in class or asleep.
- Students should be able to specify what they are looking for.
- Example request: **“Scientific calculator, up to ₹400.”**
- Students should not miss a matching item just because they were offline when it was listed.

### 3.4 Last-Minute Extensions

- If a valid bid arrives in the last **30 seconds** of an auction, move the closing time to **60 seconds after that bid**.
- Everyone watching the auction must see the updated countdown.

### 3.5 Automatic Bidding

- A buyer can set a maximum amount for an auction.
- Example: a maximum of **₹1,800** for a cycle.
- The app bids on the buyer's behalf only for as much as needed to keep them in the lead.

## 4. What We’ll Look At

Use any tools you like, including AI coding assistants.

### 4.1 Code

- Create a **public GitHub repository at the start**.
- Push work to the repository as development progresses.
- Commit each time a piece of work is completed, so the commit history shows how the app came together.

### 4.2 Planning

- Do all planning with your AI assistant in **one chat session**.
- Share the link to that chat session at the end.
