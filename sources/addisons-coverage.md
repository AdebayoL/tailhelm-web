# Addison's: what the registered sources cover

This is the Build Spec's Addison's care-rules table, checked against the documents in `register.json` on 9 October 2026. Quotes are copied from the stored copies. "SPC" means the Zycortal SPC unless stated otherwise. "AAHA" means the 2023 AAHA guidelines; its page numbers are the PDF's own (1–23), and the Addison's section is on pages 9–13.

Doses and dose changes appear throughout both documents. None of them is quoted here, and none may enter a pack.

| Rule in the Build Spec | What the sources say | Status |
|---|---|---|
| DOCP injection interval, "every 25 to 31 days" | SPC §3.9: Zycortal "is intended for long term administration at intervals and doses dependent upon individual response". In the trial the interval ranged from 20 to 99 days. AAHA p10: "The dose and the dosing interval are determined by electrolyte monitoring." | **No published window.** The interval is prescribed only. The pack format's required `windowDays` must become optional. |
| Blood tests around day 10 and day 25 | SPC §3.9: "approximately 10 days after the first dose" and "At approximately 25 days after the first dose". AAHA p10: "Check electrolyte levels 10–14 days after injection and again 25 days after injection." | **Covered, with a conflict to record.** The SPC says about day 10 after the first dose. AAHA says days 10–14 after an injection and gives no limit to the first. The pack stores both. The vet confirms which is the conservative default. |
| Na:K ratio as a derived value | SPC §3.9 names the "serum sodium/potassium ratio (Na⁺/K⁺ ratio)". AAHA p10 Table 7 lists "Na:K ratio <27" among "Laboratory Changes That Can Occur with Hypoadrenocorticism", and says "A sodium-to-potassium ratio <27 is suggestive". | **Covered** as a definition. The reference values are diagnostic or tied to dose changes, so showing them to owners needs the vet's view. |
| Daily glucocorticoid | SPC §3.9: dogs with combined deficiency "should also receive a glucocorticoid such as prednisolone". AAHA p10: "For cortisol deficiency, a small daily dose of glucocorticoids is recommended." | **Covered.** The pack can give the glucocorticoid a daily fixed schedule. The time and amount are prescribed. |
| Reminder 2 hours after the usual time | Product behaviour, not a clinical rule. | Needs no source. |
| Atypical Addison's (no DOCP) | AAHA p9–10: "the atypical form (clinical signs reflecting cortisol deficiency without electrolyte derangements) is more often chronic. Atypical HA is characterized by vomiting, lethargy, anorexia, and diarrhea". It also says "Recent studies suggest up to 25–30% of patients with HA have normal electrolytes (i.e., "atypical" HA)." | **Covered** as a variant and definition. Hiding the injection features is product behaviour that follows from it. |
| Fludrocortisone | AAHA p10: "If DOCP cannot be used, consideration can be given to using fludrocortisone." The SmPC covers people only. | **Covered** as a medicine the pack may list. It takes a fixed daily schedule, with the details prescribed. |
| Stress plan | SPC §3.9: "Prior to a stressful situation, consider temporarily increasing the dose of glucocorticoid." AAHA p10 gives a specific multiplier for this. | **Covered** for prompting the owner to agree a stress plan with their vet and for showing the vet's typed instructions. The AAHA multiplier is a dose instruction. It is excluded and is never shown, stored or used. |
| Signs to mention to the vet | AAHA p10 lists "clinical signs of Addison's disease, such as anorexia, lethargy, vomiting, diarrhea, hematochezia, and melena", and glucocorticoid side effects "including polyuria/polydipsia, polyphagia, panting, muscle wasting, elevated ALP, or hair loss". SPC §3.9 lists "depression, lethargy, vomiting, diarrhoea or weakness". | **Covered** as observation types and amber "mention this to your vet" alerts. The sources' surrounding text is about changing doses, so the only action the app ever takes from it is "contact your vet". |
| Crisis signs and "Call your vet now" | AAHA p12: "Group 3 dogs present in hypovolemic shock with or without historic episodic signs consistent with hypoadrenocorticism. This is the most serious and life-threatening manifestation". AAHA p9: "Often, sudden signs of volume depletion (shock) predominate in "typical" HA". SPC §3.4 describes the crisis in clinical terms only. | **Partial.** Both sources call it shock but neither lists what an owner would see, such as collapse or sudden weakness. Turning "shock" into owner-facing signs would be inference. This needs another source or the vet's explicit attestation of the wording. It is the most important open point. |
| Opened Zycortal vial, "use within 120 days" | SPC §5.2: "Shelf life after first opening the immediate packaging: 4 months." Label: "Once opened use within 4 months." SPC §5.3: "Do not store above 30 °C. Do not freeze." | **Covered, with a correction.** It is 4 calendar months, not 120 days. |
| Who can give the injection | AAHA p11, Clinical Tips: "Once a stable dose and dosing interval are achieved, monthly DOCP injections may be administered by someone other than the veterinarian." | **Covered**, for logging injections given at home. |
| Routine check-ups | AAHA p11, Clinical Tips: "Routine biannual health care visits are still encouraged." | **Covered** for an optional check-up reminder. The vet should confirm that "biannual" means twice a year. |
| Missed or late injection | Nothing in any source. | **No published rule.** An overdue banner against the vet's own date, with "contact your vet", needs none. |
| Other medicines | SPC §3.8 covers medicines that affect sodium or potassium. Prednisolone SPC §4.8 covers NSAIDs. | **Covered** for a prompt to tell the vet about any other medicine. |
| Heat and cold watch | Nothing. | **No rule.** It is out of launch scope. |
| Happening now thresholds for Addison's | Nothing. | **No rule.** For Addison's, Happening now is a timer with no thresholds. |
| Trend thresholds | Nothing. | **No rule.** Trends show the numbers without judging them. |

## Supplied but not registered

- **AAHA executive summary** from aaha.org. It is a secondary summary and is replaced by the full guidelines.
- **Fludrocortisone patient leaflet.** It is a human patient leaflet, and the SmPC is the registered document.
- **Post-authorisation assessment records.** These are product change history with no clinical content.
- **Duplicate prednisolone SPCs** under Vm 61300/5003 and 5004. The text is identical to 3003 and 3004.
