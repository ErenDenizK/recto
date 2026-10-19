# User-test kit: round 1

For the owner's first real user tests (B-16, `docs/process/brief-2026-10-16.md`). One observer,
five testers, 30 to 40 minutes each. Method: think-aloud with five users per round (Nielsen: five
find most of what a round can find; fix, then test again rather than add people), the Single
Ease Question (SEQ) after each task and the two-item UMUX-Lite (a short stand-in for SUS) at the
end. The earlier plan for these sessions is `docs/specs/redesign.md` §10.4.

## 1. What we want to learn (ranked)

1. Can a first-time user **sign a PDF on a phone** unaided and keep the signed copy?
2. Can they **find each core tool** on desktop or tablet (highlight, note, edit text, fill and
   sign, pages, redact) without being shown?
3. Do they **trust that the file stays on the device**, and do they **find their saved copy**?
4. Do they **notice what changed** (a mark placed, a word edited) and know how to undo it?
5. Does the glass look and the motion **help or get in the way** of reading the controls?

## 2. Recruiting and consent

Five people who have never used Recto; at least two who handle PDFs at work, at least one over
50. Primary device: two on a laptop or desktop, one on a tablet, two on their own phone.
Everyone also does task P1 (sign on a phone) on their own phone, so question 1 gets five
answers. Note each tester's device and browser.

**Consent (read aloud).** "We are testing the app, not you; nothing you do can be wrong. Please
think aloud as you go. You will only use a sample document we provide, none of your own files.
Recto runs in your browser and sends nothing anywhere. I will take written notes under your
first name only: no recording, no photos, and nothing about you is uploaded. You can stop at
any time." Go on only after a clear yes. Keep notes on paper or in a local file, one sheet per
tester.

## 3. Setup

- Live app: <https://erendenizk.github.io/recto/> (from `README.md`).
- File: the built-in **sample**, _Margin No. 07_ (TR _Kenar_), all fictional: 8 pages on
  desktop and tablet, 6 on the phone. The tester opens it from the Library in task D1; for the
  phone tasks open <https://erendenizk.github.io/recto/?sample=en> (or `?sample=tr`) before
  handing the phone over.
- Run each tester in the language they prefer (the app follows the browser; Settings changes
  it). Use a fresh private window per tester so no earlier work shows.
- The sample's pages carry "try" slips. If a tester follows one, note it: that is a finding
  about the sample, not a failure.
- Observer script: hand over the task card, then say only "What are you thinking?" Never point,
  name a control or confirm. Stop a task after 4 minutes or when the tester asks; mark it
  failed and move on.

## 4. Tasks

Read each card as written. The observer, not the tester, judges success.

**Desktop or tablet (full edition)**

| #   | Task card (tester reads)                                                                                         | Success                                  | Watch for                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| D1  | "You were sent a small magazine to try this app. Open it."                                                       | Sample open in under 1 min               | What they look at first; whether they expect to upload a file         |
| D2  | "On the editor's letter, mark one sentence you like and leave yourself a short reminder about it."               | Highlight plus an attached note          | Finding markup tools; seeing that the note was placed                 |
| D3  | "The editor's letter asks for a correction in the article. Make it."                                             | The word in the article changed in place | Looking for an edit mode; how they leave editing; surprise at result  |
| D4  | "Fill in the contributor agreement as if you were the contributor, and sign it."                                 | Fields filled, a signature on the page   | Finding the fields; making a signature; is it where they meant        |
| D5  | "Put the last page of the magazine first."                                                                       | Page order changed                       | Finding the pages view; drag or menu; do they believe it worked       |
| D6  | "The invoice shows bank details nobody else should see. Hide them, then keep a copy of your work on this device." | Redaction applied and a copy saved       | Box drawn vs. text removed; reading the warning; saying where it went |

**Phone (compact edition)**

| #   | Task card                                                         | Success                         | Watch for                                                          |
| --- | ----------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| P1  | "Sign the contributor agreement in this magazine."                | A signature on the agreement    | Finding editing and signature; scroll vs. draw; placing and sizing |
| P2  | "Next to one of the photos, write the word _approved_."           | Text placed near a photo        | Keyboard covering the page; how they finish typing                 |
| P3  | "Make the correction the editor asks for, on this phone."         | Word changed                    | Zoom and selection; the keyboard; leaving editing                  |
| P4  | "Send the signed magazine to yourself, or keep it on the phone."  | Share sheet or saved file       | Finding save; knowing the copy holds their changes                 |

After each task ask the SEQ: "Overall, how easy or hard was that task? 1 is very hard, 7 is
very easy." Record the number, the time taken and the tester's words.

## 5. Post-test questions

1. "This app's features meet my needs." (1 strongly disagree to 7 strongly agree)
2. "This app is easy to use." (same scale)
3. "Where do you think your file was while you worked on it?"
4. "What was the most annoying moment?"
5. "Would you use this instead of what you use now? Why, or why not?"

Questions 1 and 2 are UMUX-Lite; report their mean per tester and do not compare it with a full
SUS score. Question 3 tests goal 3.

## 6. Findings template

One row per problem, merged across testers. The CEO ranks rows by **score = severity × testers
affected** and turns the top rows into roadmap lanes.

**Severity** (Nielsen, 0 to 4): 0 not a problem · 1 cosmetic · 2 minor, slows them down ·
3 major, they succeed only after effort or a wrong turn · 4 blocker, they fail or lose work.

| Id  | Goal | Task | Screen or control      | Device / browser | What happened                 | Quote                        | Testers | Sev. | Score | Fix idea |
| --- | ---- | ---- | ---------------------- | ---------------- | ----------------------------- | ---------------------------- | ------- | ---- | ----- | -------- |
| F-1 | 1    | P1   | Phone tools, signature | iPhone, Safari   | Looked under ⋯ for "sign" first | "Where do I put my name?" | 3/5     | 3    | 9     |          |

Also keep one line per task: success n/5, median SEQ, median time. A task below 4/5 success or
with median SEQ under 5 is a candidate lane even if no single row scores high. As in §10.4,
anything two or more testers stumble on earns a change.

## 7. Türkçe: katılımcıya okunanlar

**Onay (sesli okuyun).** "Uygulamayı test ediyoruz, sizi değil; yanlış bir şey yapamazsınız.
Lütfen ilerlerken aklınızdan geçenleri sesli söyleyin. Yalnızca bizim verdiğimiz örnek belgeyi
kullanacaksınız, kendi dosyalarınızı değil. Recto tarayıcınızda çalışır ve hiçbir yere bir şey
göndermez. Yalnızca adınızla yazılı not alacağım; ses ya da görüntü kaydı yok, sizinle ilgili
hiçbir şey yüklenmiyor. İstediğiniz an bırakabilirsiniz."

**Bilgisayar veya tablet**

- D1. "Bu uygulamayı denemeniz için size küçük bir dergi gönderildi. Onu açın."
- D2. "Editörün mektubunda beğendiğiniz bir cümleyi işaretleyin ve kendinize onunla ilgili kısa
  bir hatırlatma bırakın."
- D3. "Editörün mektubu makalede bir düzeltme istiyor. Bu düzeltmeyi yapın."
- D4. "Yazar sözleşmesini yazar sizmişsiniz gibi doldurun ve imzalayın."
- D5. "Derginin son sayfasını en başa alın."
- D6. "Faturada kimsenin görmemesi gereken banka bilgileri var. Onları gizleyin, sonra
  yaptıklarınızın bir kopyasını bu cihazda saklayın."

**Telefon**

- P1. "Bu dergideki yazar sözleşmesini imzalayın."
- P2. "Fotoğraflardan birinin yanına _onaylandı_ yazın."
- P3. "Editörün istediği düzeltmeyi bu telefonda yapın."
- P4. "İmzalı dergiyi kendinize gönderin ya da telefonda saklayın."

**Her görevden sonra.** "Genel olarak bu görev ne kadar kolay ya da zordu? 1 çok zor, 7 çok
kolay."

**Testin sonunda**

1. "Bu uygulamanın özellikleri ihtiyaçlarımı karşılıyor." (1 hiç katılmıyorum, 7 tamamen
   katılıyorum)
2. "Bu uygulamayı kullanmak kolay." (aynı ölçek)
3. "Siz çalışırken dosyanız sizce neredeydi?"
4. "En sinir bozucu an hangisiydi?"
5. "Şu an kullandığınız şeyin yerine bunu kullanır mıydınız? Neden?"
