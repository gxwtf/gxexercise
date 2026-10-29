-- 选择题答案字母统一大写
--
-- 背景：题库里 choice / single / multiple 类题目的正确答案有大量录成了小写字母
-- （英语完形、阅读、七选五几乎全是 a/b/c），而选项 id 有的是大写 A-G，
-- 回顾页按字母匹配高亮正确选项时对不上，导致「正确选项不标绿」。
-- 字母大小写本身对选择题没有意义，这里把答案统一成大写（全站约定：选项字母用大写）。
--
-- 只动「纯选项字母」的答案（如 a、bd、B,D），不碰：
--   * input / input2 / text 等以单词作答的题型（语法填空 the / which 等，大小写有意义）
--   * 混了中文/解析的脏答案（如「B（…解析…）」「无法判断」），保持原样人工处理
--
-- 回滚（备份表记录了每行原值）：
--   UPDATE "Question" q SET answer = b.answer
--   FROM "_backup_choice_answer_case" b WHERE q.id = b.id;
--
-- 用法：psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/normalize-choice-answer-case.sql

BEGIN;

-- 1) 备份本次会被改动的行（幂等：表已存在则保留最早的一份原值）
CREATE TABLE IF NOT EXISTS "_backup_choice_answer_case" AS
SELECT id, answer
FROM "Question"
WHERE "questionType" IN ('choice', 'single', 'multiple')
  AND answer ~ '[a-z]';

CREATE UNIQUE INDEX IF NOT EXISTS "_backup_choice_answer_case_id_key"
  ON "_backup_choice_answer_case" (id);

-- 2) 纯选项字母的答案统一大写
UPDATE "Question"
SET answer = upper(answer)
WHERE "questionType" IN ('choice', 'single', 'multiple')
  AND answer ~ '[a-z]'
  AND answer ~ '^[a-gA-G]([ ,;、，；]?[a-gA-G])*$';

COMMIT;

-- 校验 1：这三类题目还剩多少小写字母答案（应只剩脏数据）
SELECT count(*) AS remaining_lowercase
FROM "Question"
WHERE "questionType" IN ('choice', 'single', 'multiple')
  AND answer ~ '[a-z]';

-- 校验 2：答案字母能否与某个选项 id（忽略大小写）对上
SELECT g."questionType" AS group_type,
       count(*) FILTER (WHERE q.answer ~ '^[A-Ga-g]$') AS letter_answers,
       count(*) FILTER (
         WHERE q.answer ~ '^[A-Ga-g]$'
           AND NOT EXISTS (
             SELECT 1
             FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(q.options) = 'array' THEN q.options ELSE '[]'::jsonb END
             ) AS o
             WHERE lower(o->>'id') = lower(q.answer)
           )
       ) AS letter_not_in_options
FROM "Question" q
JOIN "GroupItem" gi ON gi."questionId" = q.id
JOIN "QuestionGroup" g ON g.id = gi."groupId"
GROUP BY 1
ORDER BY 2 DESC;
