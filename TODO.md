# TODO

## 2024-06-22

- [ ] Add oauth flow so others can use this
- [x] Add support for using amazon transaction csv directly

  - [ ] Offer to create shorturls to the amazon order pages
  - [ ] Get transaction dates and amounts from payments field (temporary)
  - [ ] Do anything else that I do in the google sheet version

- [ ] Fix placement of version number (currently at the bottom of the screen, not the whole page)
- [ ] Add check for "Amazon" or "AMZN" in the payee field to ensure we don't label something that's not amazon
- [ ] Add code that checks for our labels and doesn't re-label anything

  - [ ] Should I try to parse the label that's already in the memo in YNAB, and then make sure I don't use that label for something else? The text would have to be verbatim, unless I could come up with some other unique identifier (amazon order # ??)

- [x] Add Dark mode toggle
- [x] Make update logs downloadable in case of problems, where I might need to manually apply/undo some update logs
- [x] Move calls to matching functions into effects in order to keep the UI responsive
- [x] Only match non-reconciled transactions from ynab
- [x] Add a toggle for whether this app should label things that have already been approved
- [x] Add toggle for whether to label things that already have something in their memo field
- [x] Write function to actually apply the updates
- [x] Have this app produce an output log of what its done, and also some sort of data to allow us to undo what we just did (ie transaction id, original memo, text that was added to the memo, whether it was appended/prepended, etc)
