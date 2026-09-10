import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const root = path.resolve(process.cwd());
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const questions = [
  { ExamName: "Network Foundations • Practice Exam", ID: "Q1", Question: "Which protocol automatically assigns an IP address to a device on a network?", AnswerA: "DNS", AnswerB: "DHCP", AnswerC: "HTTP", AnswerD: "FTP", CorrectAnswer: "B" },
  { ExamName: "Network Foundations • Practice Exam", ID: "Q2", Question: "Which device forwards packets between different networks?", AnswerA: "Switch", AnswerB: "Access point", AnswerC: "Router", AnswerD: "Repeater", CorrectAnswer: "C" },
  { ExamName: "Network Foundations • Practice Exam", ID: "Q3", Question: "What does HTTPS add to standard HTTP?", AnswerA: "Encryption", AnswerB: "Faster DNS", AnswerC: "More bandwidth", AnswerD: "A larger IP address", CorrectAnswer: "A" },
  { ExamName: "Network Foundations • Practice Exam", ID: "Q4", Question: "Which address identifies a network interface at the data-link layer?", AnswerA: "URL", AnswerB: "MAC address", AnswerC: "Port number", AnswerD: "Subnet mask", CorrectAnswer: "B" },
  { ExamName: "Network Foundations • Practice Exam", ID: "Q5", Question: "Which command is commonly used to test reachability to another host?", AnswerA: "ping", AnswerB: "mkdir", AnswerC: "whoami", AnswerD: "grep", CorrectAnswer: "A" },
  { ExamName: "Network Foundations • Practice Exam", ID: "Q6", Question: "In a typical private IPv4 network, which range is private?", AnswerA: "8.8.8.0/24", AnswerB: "172.16.0.0/12", AnswerC: "1.1.1.0/24", AnswerD: "224.0.0.0/4", CorrectAnswer: "B" },
];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(questions), "Questions");
XLSX.writeFile(workbook, path.join(dataDir, "questions.xlsx"));
const results = XLSX.utils.book_new();
const sampleResult = [{ ExamName: "Network Foundations • Practice Exam", CandidateName: "Sample Candidate", PhoneNumber: "01000000000", StartedAt: "2026-08-28T01:00:00.000Z", SubmittedAt: "2026-08-28T01:18:00.000Z", SubmissionReason: "manual", Score: "4/6", Percentage: 67, FinalResult: "PASS", "Q1 Answer": "B", "Q1 Correct": "Correct", "Q2 Answer": "C", "Q2 Correct": "Correct", "Q3 Answer": "A", "Q3 Correct": "Correct", "Q4 Answer": "D", "Q4 Correct": "Wrong", "Q5 Answer": "A", "Q5 Correct": "Correct", "Q6 Answer": "A", "Q6 Correct": "Wrong" }];
XLSX.utils.book_append_sheet(results, XLSX.utils.json_to_sheet(sampleResult), "Results");
XLSX.writeFile(results, path.join(dataDir, "results.xlsx"));
if (!fs.existsSync(path.join(dataDir, "attempts.json"))) fs.writeFileSync(path.join(dataDir, "attempts.json"), "{}\n");
console.log("Sample workbooks created in data/");
