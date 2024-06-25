# TODO

## 2024-06-22

- [ ] Only match cleared transactions from ynab
- [ ] Add a toggle for whether this app should label things that have already been approved
- [ ] Add toggle for whether to label things that already have something in their memo field
- [ ] Add code that checks for our labels and doesn't re-label anything
  - [ ] Should I try to parse the label that's already in the memo in YNAB, and then make sure I don't use that label for something else? The text would have to be verbatim, unless I could come up with some other unique identifier (amazon order # ??)
- [ ] Write function to actually apply the updates
- [ ] Have this app produce an output log of what its done, and also some sort of data to allow us to undo what we just did (ie transaction id, original memo, text that was added to the memo, whether it was appended/prepended, etc)
- [ ] Fix placement of version number (currently at the bottom of the screen, not the whole page)
