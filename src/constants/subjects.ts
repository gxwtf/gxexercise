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
  '数学': ['代数', '几何', '函数', '概率统计', '微积分', '数学填空', '数学选择', '套卷'],
  '语文': ['诗词鉴赏', '阅读理解', '作文素材', '文言文', '现代文', '语文阅读', '套卷'],
  '英语': ['完形填空', '语法填空', '阅读', '七选五', '阅读表达', '作文', '套卷'],
  '物理': ['力学', '电磁学', '热学', '光学', '实验题', '套卷'],
  '化学': ['化学方程式', '有机化学', '无机化学', '实验操作', '元素周期', '套卷'],
};

export const categoryToRoute: Record<string, string> = {
  '代数': 'algebra',
  '几何': 'geometry',
  '函数': 'function',
  '概率统计': 'probability',
  '微积分': 'calculus',
  '数学填空': 'math-fill',
  '数学选择': 'math-choice',
  '诗词鉴赏': 'poetry',
  '阅读理解': 'reading',
  '作文素材': 'writing',
  '文言文': 'classical',
  '现代文': 'modern',
  '语文阅读': 'chinese-reading',
  '完形填空': 'cloze',
  '语法填空': 'grammar',
  '阅读': 'en-reading',
  '七选五': 'seven-choose-five',
  '阅读表达': 'reading-expression',
  '作文': 'en-writing',
  '力学': 'mechanics',
  '电磁学': 'electromagnetism',
  '热学': 'thermodynamics',
  '光学': 'optics',
  '实验题': 'experiment',
  '化学方程式': 'equations',
  '有机化学': 'organic',
  '无机化学': 'inorganic',
  '实验操作': 'experiment',
  '元素周期': 'periodic',
  '套卷': 'test-paper',
};

export const routeToCategory: Record<string, string> = Object.fromEntries(
  Object.entries(categoryToRoute).map(([k, v]) => [v, k])
);

export const subjectNavItems: Record<string, {
  navButtons: { label: string; href: string }[];
}> = Object.fromEntries(
  subjects.map(subject => [
    subject,
    {
      navButtons: (categoriesBySubject[subject] || []).map(category => ({
        label: category,
        href: `/questions/${subjectToRoute[subject]}/${categoryToRoute[category]}`,
      })),
    },
  ])
);