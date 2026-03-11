import * as fs from 'fs';
import * as path from 'path';
import { answerHints } from '../src/data/fr/answer-hints';

const targetFile = process.argv[2] || 'src/data/fr/07-subjonctif-present.ts';
const filePath = path.resolve(targetFile);

let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
const updatedLines: string[] = [];
let changes = 0;

let inInputQuestion = false;
let currentAnswer: string | null = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  
  if (line.includes('type: "input"')) {
    inInputQuestion = true;
    currentAnswer = null;
  }
  
  if (inInputQuestion) {
    const answerMatch = line.match(/^(\s*)answer:\s*"([^"]+)"/);
    if (answerMatch) {
      currentAnswer = answerMatch[2]!;
    }
    
    const hintMatch = line.match(/^(\s*)hint:\s*"([^"]+)"/);
    if (hintMatch && currentAnswer) {
      const expectedHint = answerHints[currentAnswer];
      if (expectedHint && expectedHint !== hintMatch[2]) {
        console.log(`Line ${i + 1}: "${currentAnswer}" -> "${expectedHint}" (was "${hintMatch[2]}")`);
        const newLine = line.replace(/hint:\s*"[^"]*"/, `hint: "${expectedHint}"`);
        updatedLines.push(newLine);
        changes++;
        inInputQuestion = false;
        currentAnswer = null;
        continue;
      }
    }
  }
  
  updatedLines.push(line);
}

if (changes > 0) {
  fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
  console.log(`\nUpdated ${changes} hint(s) in ${targetFile}`);
} else {
  console.log('No changes needed - all hints already match answerHints');
}
