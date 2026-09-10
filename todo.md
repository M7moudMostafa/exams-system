# Project TODO

- [x] Create the polished responsive exam shell with a start screen and candidate identity form
- [x] Enforce required candidate name and phone number validation before exam start
- [x] Load exam name, questions, four answer options, and correct answers from the question workbook
- [x] Provide a fullscreen single-question experience with navigation and exactly four options
- [x] Show immediate correct/incorrect feedback after each answer selection
- [x] Add server-authoritative countdown to the next 4:00 AM and display the remaining time
- [x] Persist attempts and recover them after refreshes or mobile browser restoration
- [x] Add best-effort submission on page hide, tab close, duplicate-tab detection, and timer expiry
- [x] Store submissions with candidate details, every answer, correctness, score, reason, and final result
- [x] Export candidate results to a separate Excel workbook
- [x] Include populated sample question and result workbooks
- [x] Add local-network Node.js run configuration and concise Wi-Fi access instructions
- [x] Add Vitest coverage for exam timing, validation, scoring, and workbook mapping
- [x] Verify desktop and mobile layouts, build, typecheck, and tests
- [x] Save a final project checkpoint for delivery

- [x] Enforce the 4:00 AM deadline on server answer and submit operations and synchronize client clock to server time
- [x] Add pagehide and beforeunload best-effort close submission handling
- [x] Generate a populated sample results workbook with a representative submission row
- [x] Add Vitest coverage for candidate validation and workbook import/export mapping
- [x] Create and record the final project checkpoint before delivery

- [x] Randomize the question order independently for each new attempt and persist that order during recovery
- [x] Change the server-authoritative deadline to 3:55 PM on the same server day and auto-submit at expiry
- [x] Update tests and local-network documentation for randomized order and the 3:55 PM same-day cutoff

- [x] Add a test that verifies a new attempt stores a questionOrder permutation and recovery preserves it
- [x] Document that each candidate receives a randomized question order that remains stable after refresh or recovery

- [x] Keep results.xlsx on the host only and remove all candidate-facing result workbook downloads
- [x] Keep any future result access administrator-only; the public workbook endpoint is intentionally removed
- [x] Document the host-only results privacy model and verify it with tests

- [x] Clarify that public results access is intentionally removed rather than replaced with a candidate-accessible endpoint
- [x] Add automated privacy assertions that no public results workbook procedure or candidate download control exists
