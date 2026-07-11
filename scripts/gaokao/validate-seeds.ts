#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { normalizeSeedDocument } from "./lib/seed-model";

function main(files: string[]): void {
  if (!files.length) throw new Error("Provide one or more seed JSON files");
  const results = files.map((input) => {
    const file = path.resolve(input);
    const model = normalizeSeedDocument(JSON.parse(fs.readFileSync(file, "utf8")));
    return {
      file,
      subject: model.subject,
      sections: model.sectionCount,
      questions: model.questionCount,
      total_score: model.totalScore,
      canonical_json_sha256: model.canonicalJsonHash,
      group_option_sets: model.sections.filter((section) => section.options !== null).length,
      blank_indexes: model.sections.reduce(
        (total, section) => total + section.questions.filter((question) => question.blankIndex !== null).length,
        0,
      ),
      empty_child_content: model.sections.reduce(
        (total, section) => total + section.questions.filter((question) => !question.content).length,
        0,
      ),
    };
  });
  process.stdout.write(`${JSON.stringify({ valid: true, files: results })}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
