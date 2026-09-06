// run_one_question.cjs -- D-BP164-M0-114/BISHOP/M0/seg-resume, THROWAWAY LAUNCH WRAPPER.
// Reads the question text from a file (argv[2]) so LaTeX/special characters never have to survive
// shell quoting, then re-invokes the EXISTING teach_by_hand_cli.js (dist/main/liana_cycle/) with
// process.argv rewritten to --input=<text> --auto-approve, exactly the same entry point and CLI
// contract that file already defines. This wrapper adds no logic of its own to the Liana Cycle
// path -- it only gets the question text into the process the safe way.
const fs = require('fs');

const questionFile = process.argv[2];
if (!questionFile) {
  console.error('usage: node run_one_question.cjs <question_text_file>');
  process.exit(1);
}
const question = fs.readFileSync(questionFile, 'utf8').replace(/\r?\n/g, ' ').trim();

process.argv = [process.argv[0], process.argv[1], `--input=${question}`, '--auto-approve'];

require('../../dist/main/liana_cycle/teach_by_hand_cli.js');
