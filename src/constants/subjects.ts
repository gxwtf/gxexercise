export const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '思想政治'];

export const subjectToRoute: Record<string, string> = {
  '数学': 'math',
  '语文': 'chinese',
  '英语': 'english',
  '物理': 'physics',
  '化学': 'chemistry',
  '生物': 'biology',
  '历史': 'history',
  '地理': 'geography',
  '思想政治': 'politics',
};

export const routeToSubject: Record<string, string> = {
  'math': '数学',
  'chinese': '语文',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'history': '历史',
  'geography': '地理',
  'politics': '思想政治',
};

export const categoriesBySubject: Record<string, string[]> = {
  '数学': ['选择', '填空', '解答题', '套卷'],
  '语文': ['多文本', '文言文', '古诗', '默写', '文学类', '语用', '套卷'],
  '英语': ['完形填空', '语法填空', '阅读', '七选五', '短文改错', '套卷'],
  '物理': ['选择', '解答题', '套卷'],
  '化学': ['选择', '解答题', '套卷'],
  '生物': ['选择', '解答题', '套卷'],
  '历史': ['选择', '解答题', '套卷'],
  '地理': ['选择', '解答题', '套卷'],
  '思想政治': ['选择', '解答题', '套卷'],
};

export const categoryToRoute: Record<string, Record<string, string>> = {
  '数学': {
    '选择': 'math-choice',
    '填空': 'math-fill',
    '解答题': 'open-ended',
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
    '阅读': 'en-reading',
    '七选五': 'seven-choose-five',
    '短文改错': 'error-correction',
    '作文': 'en-writing',
    '套卷': 'test-paper',
  },
  '物理': {
    '选择': 'choice',
    '解答题': 'open-ended',
    '力学': 'mechanics',
    '电磁学': 'electromagnetism',
    '热学': 'thermodynamics',
    '光学': 'optics',
    '实验题': 'experiment',
    '套卷': 'test-paper',
  },
  '化学': {
    '选择': 'choice',
    '解答题': 'open-ended',
    '化学方程式': 'equations',
    '有机化学': 'organic',
    '无机化学': 'inorganic',
    '实验操作': 'experiment',
    '元素周期': 'periodic',
    '套卷': 'test-paper',
  },
  '生物': {
    '选择': 'choice',
    '解答题': 'open-ended',
    '套卷': 'test-paper',
  },
  '历史': {
    '选择': 'choice',
    '解答题': 'open-ended',
    '套卷': 'test-paper',
  },
  '地理': {
    '选择': 'choice',
    '解答题': 'open-ended',
    '套卷': 'test-paper',
  },
  '思想政治': {
    '选择': 'choice',
    '解答题': 'open-ended',
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
