# iPhone hand check: editing text

The owner's hand check for the text-editing robustness work (decisions TXT-1 to TXT-6). Safari
on an iPhone, the sample document or any outside PDF, Edit text armed. What a Playwright phone
run cannot prove: the real keyboard's trackpad, autocorrect, dictation and WebKit's caret.

1. Tap a long paragraph. The keyboard rises in the tap and the page does not zoom.
2. Hold the space bar and drag left and right. The blue caret moves through the text; a typed
   letter lands where it stopped.
3. The same, dragging up and down: the caret goes to the line above or below, near the same
   spot.
4. Type "teh " and let autocorrect make it "the". The word is replaced, not doubled, and nothing
   bunches. Tap a predictive suggestion in the middle of a word: the same.
5. Hold Backspace until the paragraph is empty (it speeds up to whole words), then type a
   sentence. It is typed in place in the paragraph's own font, and Done applies it.
6. In a paragraph of six lines or more, type near the end so it rewraps; move across the new
   lines with the space-bar trackpad.
7. Type Turkish letters: ğ, ş, ı, İ, ç, ö, ü (also from the long-press menus). The right letters
   appear; if the document's font lacks one, the header names the font that stands in.
8. Dictate a sentence with the microphone. It is inserted once, at the caret.
9. Select a word (double tap or long press), type over it, then use Paste from the edit menu.
10. Tap Done and read the page. Then Undo on the island brings the old text back.

Report a failing step with the step number, the document and a screenshot or screen recording.
