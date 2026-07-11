# Gaokao ingestion coverage

[中文](gaokao-coverage.zh-CN.md)

The fixed ingestion window is 2016–2025. It is a reproducible, review-gated
snapshot of the sources below; it is **not** a claim that every provincial paper
or every question in those years is complete.

## Current structured inventory

| Exam year | Source records | Status |
| --- | ---: | --- |
| 2016 | 285 | National-paper subset |
| 2017 | 288 | National-paper subset |
| 2018 | 278 | National-paper subset |
| 2019 | 289 | National-paper subset |
| 2020 | 295 | National-paper subset |
| 2021 | 214 | National/new-curriculum subset plus translated Shanghai mathematics |
| 2022 | 210 | National-paper subset plus translated Shanghai mathematics |
| 2023 | 201 | Mostly objective questions plus translated Shanghai mathematics; 4 corrupt source rows quarantined |
| 2024 | 158 | Objective-question update plus translated Shanghai mathematics |
| 2025 | 26 | Translated Shanghai mathematics only |

The 2,244 accepted source records expand to 3,247 answer slots across 248
paper identities. Eleven 2021 rows use exact, revision-pinned metadata
overrides. Four other corrupt 2023 rows remain quarantined instead of being
guessed. Exact section text also produces cross-subject duplicate candidates;
these are reported for review and are never merged automatically.

## Source snapshots

| Provider | Pinned revision | Repository license | Content rights |
| --- | --- | --- | --- |
| OpenLMLab/GAOKAO-Bench | `6dbb24f8d8439041e5431c4c184a582182a6ce9c` | Apache-2.0 | Review required |
| OpenLMLab/GAOKAO-Bench-Updates | `a606c88ab6039f9282d5135c767e13bc0ec99079` | Not declared | Review required |
| FrankieYao/GaoKaoMath | `4b994833f5fa730d9967f450b5a4454173afdc52` | MIT | Review required |

A repository license does not by itself prove permission to republish embedded
exam papers or third-party explanations. Every imported row therefore remains
in the independent `Bank*` staging tables with `REVIEW_REQUIRED` rights and
content status. Nothing is published into `Question`, `QuestionGroup`, or
`TestPaper` without an explicit publication record containing reviewer evidence.

## Known gaps

- The current structured sources emphasize nationwide papers and do not cover
  all independently authored Beijing, Shanghai, Tianjin, Zhejiang, or provincial
  elective-subject papers.
- The 2023–2024 OpenLMLab updates are not full papers. For 2025, the only
  structured source is a 26-row English translation of Shanghai mathematics;
  it is marked with source/original language metadata and is not presented as
  the original Chinese paper.
- Some compound subjective questions still contain multiple sub-parts inside one
  answer string and need editorial splitting.
- A small number of chemistry questions reference external Mathpix images.
  Assets have their own staging tables and remain review-required until copied,
  hashed, and verified.
- 2026 is intentionally outside this fixed ten-year snapshot until an auditable,
  stable source revision is selected.

Public web indexes and PDF collections can help inventory the missing papers,
but they are not imported merely because they are downloadable. A candidate
source must first have a stable snapshot, provenance, content-rights review,
paper metadata verification, and a repeatable extraction test.
