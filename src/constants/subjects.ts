export const subjects = ['数学', '语文', '英语', '物理', '化学'];

export const subjectToRoute: Record<string, string> = {
  '数学': 'math',
  '语文': 'chinese',
  '英语': 'english',
  '物理': 'physics',
  '化学': 'chemistry',
};

export const routeToSubject: Record<string, string> = {
  'math': '数学',
  'chinese': '语文',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
};

export const categoriesBySubject: Record<string, string[]> = {
  '数学': ['选择','填空', '三角', '概统', '立几', '解几', '导数', '新定义', '套卷'],
  '语文': ['多文本', '文言文', '古诗', '默写', '名著', '文学类', '语用', '微写作', '作文', '套卷'],
  '英语': ['完形填空', '语法填空', '选词填空', '阅读', '七选五', '阅读表达', '作文', '套卷'],
  '物理': ['力学', '电磁学', '热学', '光学', '实验题', '套卷'],
  '化学': ['化学方程式', '有机化学', '无机化学', '实验操作', '元素周期', '套卷'],
};

export const categoryToRoute: Record<string, Record<string, string>> = {
  '数学': {
    '选择': 'math-choice',
    '填空': 'math-fill',
    '三角': 'trigonometry',
    '概统': 'probability',
    '立几': 'solid-geometry',
    '解几': 'analytic-geometry',
    '导数': 'derivatives',
    '套卷': 'test-paper',
  },
  '语文': {
    '多文本': 'multi-text',
    '文言文': 'classical',
    '古诗': 'poetry',
    '默写': 'dictation',
    '名著': 'classics',
    '文学类': 'literary',
    '语用': 'language-basics',
    '微写作': 'micro-writing',
    '作文': 'essay',
    '套卷': 'test-paper',
  },
  '英语': {
    '完形填空': 'cloze',
    '语法填空': 'grammar',
    '选词填空': 'word-choice',
    '阅读': 'en-reading',
    '七选五': 'seven-choose-five',
    '阅读表达': 'reading-expression',
    '作文': 'en-writing',
    '套卷': 'test-paper',
  },
  '物理': {
    '力学': 'mechanics',
    '电磁学': 'electromagnetism',
    '热学': 'thermodynamics',
    '光学': 'optics',
    '实验题': 'experiment',
    '套卷': 'test-paper',
  },
  '化学': {
    '化学方程式': 'equations',
    '有机化学': 'organic',
    '无机化学': 'inorganic',
    '实验操作': 'experiment',
    '元素周期': 'periodic',
    '套卷': 'test-paper',
  },
};

export const routeToCategory: Record<string, string> = Object.fromEntries(
  Object.values(categoryToRoute).flatMap(map => Object.entries(map).map(([k, v]) => [v, k]))
);

export const subjectNavItems: Record<string, {
  navButtons: { label: string; href: string }[];
}> = Object.fromEntries(
  subjects.map(subject => [
    subject,
    {
      navButtons: (categoriesBySubject[subject] || []).map(category => ({
        label: category,
        href: `/questions/${subjectToRoute[subject]}/${categoryToRoute[subject]?.[category]}`,
      })),
    },
  ])
);