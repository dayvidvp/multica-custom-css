// Multica custom JS — injected by multica-custom-css (press Ctrl+R in Multica to reload)
//
// Marks issue comments that need your attention, so custom.css can give them their own background:
//   data-for-me="mention"   the comment @mentions you
//   data-for-me="question"  the comment asks you something (your name, or a phrase like "please confirm")
// Your own comments are never marked.
(() => {
  // Your name as Multica shows it. Matching is case-insensitive and a part is enough ("Dayvid" matches "Dayvid Van Parijs").
  const MY_NAMES = [];

  // Phrases that count as a question to you, as long as the comment doesn't @mention someone else.
  const QUESTION_PATTERNS = [
    /\bgraag (je|jouw|uw) (akkoord|bevestiging|beslissing|keuze|feedback|input|goedkeuring)\b/i,
    /\b(kun|kan|wil|zou) je\b[^.?!\n]*\?/i,
    /\b(moet|zal|mag) ik\b[^.?!\n]*\?/i,
    /\blaat (me|maar) (even )?weten\b/i,
    /\bwacht(en|end)? op (je|jouw|uw)\b/i,
    /\b(beslissing|keuze|akkoord) (van|door) (jou|je|u)\b/i,
    /\b(please|could you|can you|would you)\b[^.?!\n]*\?/i,
    /\bshould I\b[^.?!\n]*\?/i,
    /\bplease (confirm|approve|decide|review)\b/i,
    /\b(waiting|wait) (for|on) your\b/i,
    /\bneeds? your\b/i,
  ];

  if (window.__multicaForMe || MY_NAMES.length === 0) return;
  window.__multicaForMe = true;

  const names = MY_NAMES.map((n) => n.toLowerCase());
  const isMe = (text) => names.some((n) => text.toLowerCase().includes(n));
  const nameRe = new RegExp(`\\b(${MY_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

  function classify(block) {
    // Replies may sit inside their parent's block; only look at this comment's own header and body
    const own = (sel) => [...block.querySelectorAll(sel)].find((el) => el.closest("[data-comment-block]") === block);
    const author = own(".cursor-pointer.text-body.font-medium");
    if (author && isMe(author.textContent)) return null;
    const body = own("[data-comment-content]");
    if (!body) return null;
    const mentions = [...body.querySelectorAll(".mention")].map((m) => m.textContent);
    if (mentions.some(isMe)) return "mention";
    const text = body.textContent;
    if (nameRe.test(text)) return "question";
    if (mentions.length === 0 && QUESTION_PATTERNS.some((re) => re.test(text))) return "question";
    return null;
  }

  function scan() {
    for (const block of document.querySelectorAll("[data-comment-block]")) {
      const kind = classify(block);
      if (kind) {
        if (block.dataset.forMe !== kind) block.dataset.forMe = kind;
      } else if (block.dataset.forMe) {
        delete block.dataset.forMe;
      }
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  scan();
})();
