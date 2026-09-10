# Local Network Exam System

This project is a responsive, Bootstrap-inspired online exam room for candidates using phones, tablets, or computers on the same local Wi-Fi network. The interface is intentionally calm and focused: candidates enter their name and phone number, answer one question at a time, receive immediate feedback, and see a final score after submission.

## Question workbook

The exam reads `data/questions.xlsx` at runtime. Each new candidate receives an independently randomized question order, and that order is stored with the attempt so refreshes and mobile-browser recovery return to the same sequence. Use the first worksheet and keep the following column names exactly as shown:

| Column | Required content |
| --- | --- |
| `ExamName` | The name shown on the start screen and exam header. |
| `ID` | A unique question identifier such as `Q1`. |
| `Question` | The full question text. |
| `AnswerA` | Option A. |
| `AnswerB` | Option B. |
| `AnswerC` | Option C. |
| `AnswerD` | Option D. |
| `CorrectAnswer` | Exactly one of `A`, `B`, `C`, or `D`. |

A populated workbook is included at `data/questions.xlsx`. To create fresh samples after editing the generator, run `node scripts/create-sample-workbooks.mjs`.

## Results workbook

Every submitted attempt is appended to `data/results.xlsx` on the exam host only. Each row contains the exam name, candidate name, phone number, start and submit timestamps, submission reason, score, percentage, final result, and two columns per question: the selected answer and whether it was correct. Candidate devices receive only their own score summary; there is no results workbook download or public results endpoint.

## Run on the local network

Start the application on the computer that will act as the exam server:

```bash
pnpm install
node scripts/create-sample-workbooks.mjs
pnpm dev
```

The server binds to `0.0.0.0` and normally uses port `3000`. Find the host computer’s Wi-Fi IPv4 address, for example `192.168.1.25`, and open this address from every phone:

```text
http://192.168.1.25:3000
```

If port 3000 is already occupied, the server automatically selects the next available port and prints it in the terminal. Allow Node.js through the host computer’s firewall for private networks if phones cannot connect. All devices must be connected to the same Wi-Fi, and the router must not enable client/AP isolation.

## Timing and recovery

The server creates the deadline as 3:55 PM on the same server day and sends it with the attempt. If the server clock is already past 3:55 PM, the attempt is immediately expired and submission is triggered. The browser displays a live countdown, while the server checks the deadline during submission. Refreshes and mobile-browser restoration recover the attempt ID from local storage and restore saved answers from the server’s local attempt store. A visibility change, duplicate tab, or timer expiry triggers a best-effort submission with a recorded reason. Closing a browser cannot guarantee a network request in every mobile operating system, so each answer is saved immediately and the next recovery can still restore the attempt when possible.

The current implementation uses the server process’s local `data/` files, which is appropriate for a single exam host on a local network. `data/results.xlsx` is secret host-side data and is never sent to candidates. Back up `data/questions.xlsx` and `data/results.xlsx` between exam sessions, and do not place the data folder inside a shared network drive.
