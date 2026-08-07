#!/usr/bin/env node

const fs = require("fs");

function normalizeMineruMarkdown(article) {
  article = article.replace(/\r\n/g, "\n");

  article = article.replace(
    /\\_\*\*(?:\\_|_)+(\d+)(?:\\_|_)+\*\*(?:\\_+|_+)?/g,
    (_, id) => `{{BLANK:${id}}}`
  );

  return article;
}

function parseExam(mdContent) {
  mdContent = normalizeMineruMarkdown(mdContent);
  const lines = mdContent.split("\n");

  const paper = extractPaperInfo(lines);
  const sections = [];
  const referenceAnswers = extractReferenceAnswers(mdContent);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^参考答案/.test(line)) {
      break;
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*选词填空/.test(line)) {
      const result = parseWordChoice(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
        continue;
      }
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*完形填空/.test(line)) {
      const result = parseCloze(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
        continue;
      }
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*阅读理解/.test(line)) {
      const result = parseReading(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(...result.sections);
        i = result.nextIndex;
        continue;
      }
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*语法填空/.test(line)) {
      const result = parseGrammarFill(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
        continue;
      }
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*书面表达/.test(line)) {
      const result = parseWritingSection(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(...result.sections);
        i = result.nextIndex;
        continue;
      }
    }

    i++;
  }

  return { paper, sections };
}

function extractPaperInfo(lines) {
  const fullText = lines.join("\n");

  let title = "";
  let grade = "";
  let year = null;
  let totalScore = null;
  let duration = null;
  let description = "";

  const titleMatch = fullText.match(/^(\d{4}[^\n]+)/m);
  if (titleMatch) title = titleMatch[1].trim();

  const gradeMatch = title.match(/高二|高一|高三|初一|初二|初三|小学/);
  if (gradeMatch) grade = gradeMatch[0];

  const yearMatch = title.match(/(\d{4})/);
  if (yearMatch) year = parseInt(yearMatch[1]);

  const scoreMatch = fullText.match(/共(\d+)分/);
  if (scoreMatch) totalScore = parseInt(scoreMatch[1]);

  const durationMatch = fullText.match(/考试时长(\d+)分钟/);
  if (durationMatch) duration = parseInt(durationMatch[1]);

  const descMatch = fullText.match(/^本试卷[^。]*。$/m);
  if (descMatch) description = descMatch[0];

  const { baseTags } = generateTagsAndSource(title, grade);
  const source = title;

  return {
    title,
    subject: "英语",
    source,
    grade,
    year,
    totalScore,
    duration,
    description,
    tags: baseTags,
  };
}

function generateTagsAndSource(title, grade) {
  const districts = ["西城", "东城", "海淀", "朝阳", "丰台", "石景山", "通州", "大兴", "昌平", "顺义", "房山", "门头沟", "平谷", "怀柔", "密云", "延庆"];

  let source = "";
  const baseTags = ["英语"];

  if (grade) baseTags.push(grade);

  const district = districts.find((d) => title.includes(d));
  if (district) baseTags.push(district);

  if (title.includes("高考")) {
    source = "高考真题";
    baseTags.push("真题");
  } else if (title.includes("一模") || title.includes("二模") || title.includes("三模")) {
    source = "高考模拟";
    baseTags.push("模拟");
  } else if (title.includes("期末")) {
    source = "各区期末";
    baseTags.push("期末");
  } else if (title.includes("期中")) {
    source = "各区期末";
    baseTags.push("期中");
  }

  const yearMatch = title.match(/(\d{4})/);
  if (yearMatch) baseTags.push(yearMatch[1]);

  if (title.includes("北京")) baseTags.push("北京");

  return { source, baseTags };
}

function extractReferenceAnswers(mdContent) {
  const answers = {};

  const refSectionMatch = mdContent.match(/^参考答案\n([\s\S]*)$/m);
  if (!refSectionMatch) return answers;

  const refText = refSectionMatch[1];
  const lines = refText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^\*\*/.test(trimmed)) continue;

    const inlineAnswerRegex = /(\d+)\\?\.([A-G])/g;

    if (/^(\d+)\\?\.([A-G])\s+(\d+)\\?\.([A-G])/.test(trimmed)) {
      let m;
      while ((m = inlineAnswerRegex.exec(trimmed)) !== null) {
        const num = parseInt(m[1]);
        answers[num] = [m[2]];
      }
      continue;
    }

    const parts = trimmed.split(/\s+(?=\d+\\?\.\s+)/);
    for (const part of parts) {
      const answerMatch = part.match(/^(\d+)\\?\.\s*(.+)$/);
      if (answerMatch) {
        const num = parseInt(answerMatch[1]);
        let answer = answerMatch[2].trim();
        if (answer.includes("##")) {
          answer = answer.split("##").map((s) => s.trim());
        } else {
          answer = [answer];
        }
        answers[num] = answer;
      }
    }
  }

  return answers;
}

function getScoreFromHeader(headerLine) {
  const match = headerLine.match(/每小题(\d+\.?\d*)分/);
  if (match) return parseFloat(match[1]);
  return 5;
}

function getTotalScoreFromHeader(headerLine) {
  const match = headerLine.match(/共(\d+)分\)/);
  if (match) return parseInt(match[1]);
  return null;
}

function isSectionHeader(line) {
  if (/^参考答案/.test(line)) return true;
  if (/^\*\*第[一二三ⅠⅡⅢ]卷/.test(line)) return true;
  if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(完形填空|阅读理解|语法填空|书面表达|选词填空)/.test(line)) return true;
  return false;
}

function isSubSectionHeader(line) {
  if (/^\*\*第[一二三]节/.test(line)) return true;
  if (/^\*\*[A-D]\*\*\s*$/.test(line.trim())) return true;
  return false;
}

function parseCloze(lines, startIndex, referenceAnswers, paper) {
  const headerLine = lines[startIndex];
  const perQuestionScore = getScoreFromHeader(headerLine);
  const totalScore = getTotalScoreFromHeader(headerLine);

  let articleLines = [];
  let optionLines = [];
  let i = startIndex + 1;
  let inArticle = true;

  while (i < lines.length) {
    const line = lines[i];

    if (isSectionHeader(line) && !/^\*\*[A-D]\*\*\s*$/.test(line.trim())) {
      break;
    }

    if (/^\d+\\?\.\s*[A-D]\\?\./.test(line.trim())) {
      inArticle = false;
    }

    if (inArticle) {
      articleLines.push(line);
    } else {
      optionLines.push(line.trim());
    }

    i++;
  }

  let article = articleLines.join("\n").trim();
  article = article.replace(/^>?\s*\*\*阅读下面短文[\s\S]*?在答题卡上将该选项涂黑。\*\*\s*/g, "").trim();

  const imageRegex = /!\[.*?\]\(([^\s)]+)\)/g;
  const imagePlaceholders = [];
  article = article.replace(imageRegex, (match) => {
    imagePlaceholders.push(match);
    return `__IMG_${imagePlaceholders.length - 1}__`;
  });

  article = article.replace(/{{BLANK:(\d+)}}/g, "<ClozeBlank></ClozeBlank>");

  article = article.replace(/\n{3,}/g, "\n\n").trim();

  article = article.replace(/__IMG_(\d+)__/g, (_, i) => imagePlaceholders[parseInt(i)]);

  let questions = [];
  const optionRegex = /^(\d+)\\?\.\s*A\\?\.\s*(.+?)\s*B\\?\.\s*(.+?)\s*C\\?\.\s*(.+?)\s*D\\?\.\s*(.+?)$/;

  for (const optLine of optionLines) {
    const match = optLine.match(optionRegex);
    if (match) {
      const originalNum = parseInt(match[1]);
      const options = [
        { id: "a", label: match[2].trim() },
        { id: "b", label: match[3].trim() },
        { id: "c", label: match[4].trim() },
        { id: "d", label: match[5].trim() },
      ];

      let answer = "";
      const refAns = referenceAnswers[originalNum];
      if (refAns && refAns[0]) {
        answer = refAns[0].toLowerCase();
      }

      questions.push({
        id: originalNum,
        questionType: "choice",
        options,
        answer,
        analysis: `第${originalNum}题解析: 根据上下文语境选择最合适的词汇。`,
        score: perQuestionScore,
        correctRate: 0.7,
      });
    }
  }

  questions = renumberQuestions(questions);

  const titleMatch = headerLine.match(/完形填空/);
  const title = titleMatch ? "完形填空" : "完形填空";

  return {
    section: {
      type: "完形填空",
      questionType: "cloze",
      title,
      category: "完形填空",
      score: totalScore || questions.length * perQuestionScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "完形填空"],
      article,
      questions,
    },
    nextIndex: i,
  };
}

function parseReading(lines, startIndex, referenceAnswers, paper) {
  const sections = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(完形填空|语法填空|书面表达|选词填空)/.test(line)) {
      break;
    }

    if (/^\*\*第二节/.test(line)) {
      const result = parseSevenChooseFive(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
      }
      continue;
    }

    if (/^\*\*第一节/.test(line)) {
      i++;
      continue;
    }

    if (/^\*\*[A-D]\*\*\s*$/.test(line.trim())) {
      const articleLabel = line.trim().match(/^\*\*([A-D])\*\*/)[1];
      const result = parseReadingArticle(lines, i, articleLabel, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
        continue;
      }
    }

    i++;
  }

  return { sections, nextIndex: i };
}

function parseReadingArticle(lines, startIndex, articleLabel, referenceAnswers, paper) {
  let allLines = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[A-D]\*\*\s*$/.test(line.trim()) && i > startIndex + 1) {
      break;
    }

    if (/^\*\*(第二节|第[一二三]节|[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、])/.test(line)) {
      break;
    }

    allLines.push(line);
    i++;
  }

  let fullText = allLines.join("\n").trim();
  fullText = fullText.replace(/^>?\s*\*\*阅读下面短文[\s\S]*?在答题卡上将该项涂黑。\*\*\s*/g, "").trim();

  const firstQuestionMatch = fullText.match(/\n(\d+)\\?\.\s/);
  let articleText = fullText;
  let questionText = "";

  if (firstQuestionMatch) {
    const splitIndex = fullText.indexOf(firstQuestionMatch[0]);
    articleText = fullText.substring(0, splitIndex).trim();
    questionText = fullText.substring(splitIndex + 1).trim();
  }

  articleText = articleText.replace(/\n{3,}/g, "\n\n").trim();
  articleText = "# " + articleLabel + "\n\n" + articleText;

  let questions = [];
  if (questionText) {
    const questionBlockRegex = /(\d+)\\?\.\s+(.+?)\s+A\\?\.\s*(.+?)\s*B\\?\.\s*(.+?)\s*C\\?\.\s*(.+?)\s*D\\?\.\s*(.+?)(?=\n?\d+\\?\.\s|$)/gs;
    let qm;
    while ((qm = questionBlockRegex.exec(questionText)) !== null) {
      const originalNum = parseInt(qm[1]);
      const content = qm[2].replace(/\n/g, " ").trim();
      const options = [
        { id: "a", label: qm[3].replace(/\n/g, " ").trim() },
        { id: "b", label: qm[4].replace(/\n/g, " ").trim() },
        { id: "c", label: qm[5].replace(/\n/g, " ").trim() },
        { id: "d", label: qm[6].replace(/\n/g, " ").trim() },
      ];

      let answer = "";
      const refAns = referenceAnswers[originalNum];
      if (refAns && refAns[0]) {
        answer = refAns[0].toLowerCase();
      }

      questions.push({
        id: originalNum,
        questionType: "choice",
        content,
        options,
        answer,
        analysis: `第${originalNum}题解析: 根据文章内容选择正确答案。`,
        score: 2,
        correctRate: 0.7,
      });
    }
  }

  questions = renumberQuestions(questions);
  const totalScore = questions.length * 2;

  return {
    section: {
      type: "阅读",
      questionType: "en-reading",
      title: "阅读理解" + articleLabel,
      category: "阅读",
      score: totalScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "阅读"],
      article: articleText,
      questions,
    },
    nextIndex: i,
  };
}

function parseSevenChooseFive(lines, startIndex, referenceAnswers, paper) {
  const headerLine = lines[startIndex];
  const perQuestionScore = getScoreFromHeader(headerLine) || 2;

  let allLines = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(完形填空|语法填空|书面表达|选词填空|第[一二三ⅠⅡⅢ]卷)/.test(line)) {
      break;
    }

    if (/^\*\*第[一二三ⅠⅡⅢ]卷/.test(line)) {
      break;
    }

    allLines.push(line);
    i++;
  }

  let fullText = allLines.join("\n").trim();
  fullText = fullText.replace(/^>?\s*\*\*根据短文内容[\s\S]*?选项中共?有两项为多余选项。\*\*\s*/g, "").trim();

  const optionRegex = /\s+A\\?\.\s+(.+?)\s+B\\?\.\s+(.+?)\s+C\\?\.\s+(.+?)\s+D\\?\.\s+(.+?)\s+E\\?\.\s+(.+?)\s+F\\?\.\s+(.+?)\s+G\\?\.\s+(.+?)$/s;
  const optionMatch = fullText.match(optionRegex);

  let article = fullText;
  let options = [];

  if (optionMatch) {
    article = fullText.substring(0, fullText.indexOf(optionMatch[0])).trim();
    const optionLabels = ["A", "B", "C", "D", "E", "F", "G"];
    for (let j = 1; j <= 7; j++) {
      options.push({ id: optionLabels[j - 1], label: optionMatch[j].trim() });
    }
  } else {
    const optionLines = [];
    for (const line of allLines) {
      const trimmed = line.trim();
      if (trimmed && /^[A-G]\.\s/.test(trimmed)) {
        optionLines.push(trimmed);
      }
    }
    const optionMap = {};
    for (const optLine of optionLines) {
      const match = optLine.match(/^([A-G])\.\s+(.+)$/);
      if (match) {
        optionMap[match[1]] = match[2].trim();
      }
    }
    options = Object.entries(optionMap).map(([id, label]) => ({ id, label }));
  }

  article = article.replace(/\n{3,}/g, "\n\n").trim();

  const blankRegex = /{{BLANK:(\d+)}}/g;
  const blankNums = [];
  let bm;
  while ((bm = blankRegex.exec(article)) !== null) {
    const num = parseInt(bm[1]);
    if (!blankNums.includes(num)) {
      blankNums.push(num);
    }
  }
  blankNums.sort((a, b) => a - b);

  article = article.replace(/{{BLANK:(\d+)}}/g, "<Blank></Blank>");

  let questions = [];
  for (let idx = 0; idx < blankNums.length; idx++) {
    const originalNum = blankNums[idx];
    let answer = "";
    const refAns = referenceAnswers[originalNum];
    if (refAns && refAns[0]) {
      answer = refAns[0].toUpperCase();
    }

    questions.push({
      id: idx + 1,
      questionType: "choice",
      options,
      blankIndex: idx,
      answer,
      analysis: `第${originalNum}题解析: 根据上下文逻辑选择最佳选项。`,
      score: perQuestionScore,
      correctRate: 0.7,
    });
  }

  const totalScore = questions.length * perQuestionScore;

  return {
    section: {
      type: "七选五",
      questionType: "seven-choose-five",
      title: "七选五",
      category: "七选五",
      score: totalScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "七选五"],
      content: "",
      article,
      options,
      questions,
    },
    nextIndex: i,
  };
}

function parseGrammarFill(lines, startIndex, referenceAnswers, paper) {
  const headerLine = lines[startIndex];
  const perQuestionScore = getScoreFromHeader(headerLine) || 1.5;
  const totalScore = getTotalScoreFromHeader(headerLine);

  let articleLines = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(书面表达|选词填空|完形填空)/.test(line)) {
      break;
    }

    if (/^\*\*第[一二三ⅠⅡⅢ]卷/.test(line)) {
      break;
    }

    articleLines.push(line);
    i++;
  }

  let article = articleLines.join("\n").trim();
  article = article.replace(/阅读下面短文，根据短文内容填空。在未给提示词的空白处仅填写1个恰当的单词，在给出提示词的空白处用括号内所给词的正确形式填空。\s*/g, "").trim();
  article = article.replace(/\n{3,}/g, "\n\n").trim();

  article = article.replace(/^\*\*([A-D])\*\*\s*$/gm, "## $1");

  const blankRegex = /{{BLANK:(\d+)}}/g;
  const blankNums = [];
  let gm;
  while ((gm = blankRegex.exec(article)) !== null) {
    const num = parseInt(gm[1]);
    if (!blankNums.includes(num)) {
      blankNums.push(num);
    }
  }
  blankNums.sort((a, b) => a - b);

  const validBlankNums = blankNums.filter((num) => referenceAnswers[num] !== undefined);

  article = article.replace(/{{BLANK:(\d+)}}/g, " <Input></Input> ");
  article = article.replace(/ {2,}/g, " ");

  let questions = [];
  for (let idx = 0; idx < validBlankNums.length; idx++) {
    const originalNum = validBlankNums[idx];
    let answer = "";
    const refAns = referenceAnswers[originalNum];
    if (refAns) {
      answer = refAns.join("##");
    }

    questions.push({
      id: idx + 1,
      questionType: "input",
      answer,
      analysis: `第${originalNum}题解析: 根据上下文和语法规则填写正确答案。`,
      score: perQuestionScore,
      correctRate: 0.7,
    });
  }

  return {
    section: {
      type: "语法填空",
      questionType: "grammar",
      title: "语法填空",
      category: "语法填空",
      score: totalScore || questions.length * perQuestionScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "语法填空"],
      article,
      questions,
    },
    nextIndex: i,
  };
}

function parseWordChoice(lines, startIndex, referenceAnswers, paper) {
  const headerLine = lines[startIndex];
  const perQuestionScore = getScoreFromHeader(headerLine) || 2;
  const totalScore = getTotalScoreFromHeader(headerLine);

  let wordBank = "";
  let questionLines = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(语法填空|书面表达|完形填空)/.test(line)) {
      break;
    }

    if (/^\*\*第[一二三ⅠⅡⅢ]卷/.test(line)) {
      break;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (/^(\d+)\\?\.\s/.test(trimmed)) {
      questionLines.push(trimmed);
    } else if (/^[a-zA-Z]/.test(trimmed) && trimmed.includes(",")) {
      wordBank = trimmed;
    }

    i++;
  }

  let questions = [];
  for (let idx = 0; idx < questionLines.length; idx++) {
    const qLine = questionLines[idx];
    const qMatch = qLine.match(/^(\d+)\\?\.\s+(.+)$/);
    if (!qMatch) continue;

    const originalNum = parseInt(qMatch[1]);
    let content = qMatch[2].trim();

    content = content.replace(/\\_\*\*(?:\\_|_)+\*\*(?:\\_+|_+)?/g, "<Input2></Input2>");

    let answer = "";
    const refAns = referenceAnswers[originalNum];
    if (refAns) {
      answer = refAns.join("##");
    }

    questions.push({
      id: idx + 1,
      questionType: "input2",
      content,
      answer,
      analysis: `第${originalNum}题解析: 根据句意和单词的适当形式填空。`,
      score: perQuestionScore,
      correctRate: 0.7,
    });
  }

  return {
    section: {
      type: "选词填空",
      questionType: "word-choice",
      title: "选词填空",
      category: "选词填空",
      score: totalScore || questions.length * perQuestionScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "选词填空"],
      content: wordBank,
      article: "",
      questions,
    },
    nextIndex: i,
  };
}

function parseWritingSection(lines, startIndex, referenceAnswers, paper) {
  const sections = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^参考答案/.test(line)) {
      break;
    }

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]\s*(完形填空|语法填空|阅读理解|选词填空)/.test(line)) {
      break;
    }

    if (/^\*\*第一节/.test(line)) {
      let isReadingExpression = false;
      for (let j = i + 1; j < lines.length; j++) {
        const forwardLine = lines[j];
        if (/^\*\*第二节/.test(forwardLine)) break;
        if (/阅读下面的短文，根据题目要求用英文回答问题/.test(forwardLine)) {
          isReadingExpression = true;
          break;
        }
      }

      if (isReadingExpression) {
        const result = parseReadingExpression(lines, i, referenceAnswers, paper);
        if (result) {
          sections.push(result.section);
          i = result.nextIndex;
          continue;
        }
      }
    }

    if (/^\*\*第二节/.test(line) && /20分/.test(line)) {
      const result = parseWriting(lines, i, referenceAnswers, paper);
      if (result) {
        sections.push(result.section);
        i = result.nextIndex;
        continue;
      }
    }

    i++;
  }

  return { sections, nextIndex: i };
}

function parseReadingExpression(lines, startIndex, referenceAnswers, paper) {
  const headerLine = lines[startIndex];
  const scorePattern = /第(\d+)、(\d+)题各(\d+)分，第(\d+)题(\d+)分，第(\d+)题(\d+)分/;
  const scoreMatch = headerLine.match(scorePattern);
  let scores = [2, 2, 3, 5];
  if (scoreMatch) {
    scores = [
      parseInt(scoreMatch[3]),
      parseInt(scoreMatch[3]),
      parseInt(scoreMatch[5]),
      parseInt(scoreMatch[7]),
    ];
  }

  let articleLines = [];
  let questionLines = [];
  let i = startIndex + 1;
  let inArticle = true;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*第二节/.test(line)) {
      break;
    }

    if (/^(\d+)\\?\.\s/.test(line.trim()) && inArticle) {
      inArticle = false;
    }

    if (inArticle) {
      articleLines.push(line);
    } else {
      questionLines.push(line);
    }

    i++;
  }

  let article = articleLines.join("\n").trim();
  article = article.replace(/^>?\s*\*\*阅读下面的短文[^。]*。?\*\*\s*/g, "").trim();
  article = article.replace(/^阅读下面的短文，根据题目要求用英文回答问题。\s*/gm, "").trim();
  article = article.replace(/\n{3,}/g, "\n\n").trim();

  let questions = [];
  const questionRegex = /^(\d+)\\?\.\s+(.+)$/;
  let currentQuestion = null;

  for (const qLine of questionLines) {
    const trimmed = qLine.trim();
    if (!trimmed) continue;

    const match = trimmed.match(questionRegex);
    if (match) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      const originalNum = parseInt(match[1]);
      let content = match[2].trim();

      content = content.replace(/(the following statement[^.]*?explain why\.)\s*([\s\S]+)$/i, "$1\n\n➢ $2");

      const readingExpressionScores = { 45: 2, 46: 2, 47: 3, 48: 5 };

      let answer = "";
      const refAns = referenceAnswers[originalNum];
      if (refAns) {
        answer = refAns.join("##");
      } else if (referenceAnswers[originalNum + 33]) {
        answer = referenceAnswers[originalNum + 33].join("##");
      }

      const score = readingExpressionScores[originalNum] || 2;

      currentQuestion = {
        id: originalNum,
        questionType: "text",
        content,
        answer,
        analysis: `第${originalNum}题解析: 根据文章内容回答问题。`,
        score,
        correctRate: 0.7,
      };
    } else if (currentQuestion && !/^\\_/.test(trimmed) && !/^答案/.test(trimmed)) {
      currentQuestion.content += "\n\n" + trimmed;
    }
  }
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  questions = renumberQuestions(questions);
  questions = questions.map((q, idx) => ({
    ...q,
    score: scores[idx] || 2,
  }));
  const totalScore = questions.reduce((sum, q) => sum + q.score, 0);

  return {
    section: {
      type: "阅读表达",
      questionType: "reading-expression",
      title: "阅读表达",
      category: "阅读表达",
      score: totalScore,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "阅读表达"],
      article,
      questions,
    },
    nextIndex: i,
  };
}

function parseWriting(lines, startIndex, referenceAnswers, paper) {
  let contentLines = [];
  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[IVⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+[.、]/.test(line)) {
      break;
    }
    if (/^参考答案/.test(line)) {
      break;
    }

    contentLines.push(line);
    i++;
  }

  let content = contentLines.join("\n").trim();
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  let originalNum = 49;
  const questionMatch = content.match(/^(\d+)\\?\.\s*/);
  if (questionMatch) {
    originalNum = parseInt(questionMatch[1]);
    content = content.replace(/^\d+\\?\.\s*/, "").trim();
  }

  content = content.replace(/\n(\d+)\\?\.(\S)/g, "\n$1. $2");
  content = content.replace(/^(\d+)\\?\.(\S)/, "$1. $2");

  content = content.replace(/\n{2,}_+[\s\S]*$/i, "").trim();

  let answer = "";
  const refAns = referenceAnswers[originalNum];
  if (refAns) {
    answer = refAns.join("##");
  }

  return {
    section: {
      type: "作文",
      questionType: "en-writing",
      title: "写作",
      category: "作文",
      score: 20,
      grade: paper.grade,
      source: paper.source,
      tags: [...paper.tags, "作文"],
      article: content,
      questions: [
        {
          id: 1,
          questionType: "text",
          content,
          answer,
          analysis: "写作题评分标准：内容要点完整，语言表达准确流畅，结构清晰，词数符合要求。",
          score: 20,
          correctRate: 0.7,
        },
      ],
    },
    nextIndex: i,
  };
}

function renumberQuestions(questions) {
  return questions.map((q, idx) => ({
    ...q,
    id: idx + 1,
  }));
}

module.exports = { parseExam };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: node parse-exam.js <md-file-path> [output-json-path]");
    process.exit(1);
  }

  const mdPath = args[0];
  const outputPath = args[1] || mdPath.replace(/\.md$/, ".json");

  const mdContent = fs.readFileSync(mdPath, "utf-8");
  const result = parseExam(mdContent);

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Parsed exam saved to: ${outputPath}`);
  console.log(`  Paper: ${result.paper.title}`);
  console.log(`  Sections: ${result.sections.length}`);
  for (const sec of result.sections) {
    console.log(`    - ${sec.type} (${sec.questions.length} questions, ${sec.score} points)`);
  }
}