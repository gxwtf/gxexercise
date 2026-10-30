export const subjects = ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '政治', '地理'];

export const subjectToRoute: Record<string, string> = {
  '数学': 'math',
  '语文': 'chinese',
  '英语': 'english',
  '物理': 'physics',
  '化学': 'chemistry',
  '生物': 'biology',
  '历史': 'history',
  '政治': 'politics',
  '地理': 'geography',
};

export const routeToSubject: Record<string, string> = {
  'math': '数学',
  'chinese': '语文',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'history': '历史',
  'politics': '政治',
  'geography': '地理',
};

export const categoriesBySubject: Record<string, string[]> = {
  '数学': ['选择','填空', '三角', '概统', '立几', '解几', '导数', '新定义', '套卷'],
  '语文': ['多文本', '文言文', '古诗', '默写', '名著', '文学类', '语用', '微写作', '作文', '套卷'],
  '英语': ['完形填空', '语法填空', '选词填空', '阅读', '七选五', '阅读表达', '作文', '套卷'],
  '物理': ['选择', '力学', '电磁学', '热学', '光学', '实验题', '套卷'],
  // 化学：按新课标选择性必修模块拆分（物质结构与性质 / 化学反应原理 / 有机化学基础），
  // 另加高考综合题的两种稳定题型（工业流程、实验探究）。
  '化学': ['选择', '物质结构与性质', '化学反应原理', '有机化学基础', '工业流程', '实验探究', '套卷'],
  // 以下四科为公测期预留：题型按北京卷近年非选择题的稳定功能板块划分，
  // 不锁定「题号—考点」映射，入库时按实际题目内容归到对应板块即可。
  '生物': ['选择', '遗传与进化', '稳态与调节', '生物与环境', '生物技术与工程', '实验探究', '套卷'],
  '历史': ['选择', '观点论证', '史料分析', '修改补写', '套卷'],
  '政治': ['选择', '中特', '经济社会', '政治法治', '哲学文化', '国政国经', '法律生活', '逻辑思维', '套卷'],
  '地理': ['选择', '自然地理', '人文地理', '区域发展', '图表判读', '套卷'],
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
    '新定义': 'new-definition',
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
    '选择': 'select',
    '力学': 'mechanics',
    '电磁学': 'electromagnetism',
    '热学': 'thermodynamics',
    '光学': 'optics',
    '实验题': 'experiment',
    '套卷': 'test-paper',
  },
  '化学': {
    '选择': 'select',
    '物质结构与性质': 'structure-properties',
    '化学反应原理': 'reaction-principles',
    '有机化学基础': 'organic-basics',
    '工业流程': 'industrial-process',
    '实验探究': 'experiment-inquiry',
    '套卷': 'test-paper',
  },
  '生物': {
    '选择': 'select',
    '遗传与进化': 'genetics-evolution',
    '稳态与调节': 'homeostasis-regulation',
    '生物与环境': 'ecology-environment',
    '生物技术与工程': 'biotech-engineering',
    '实验探究': 'experiment-inquiry',
    '套卷': 'test-paper',
  },
  '历史': {
    '选择': 'select',
    '观点论证': 'argumentation',
    '史料分析': 'source-analysis',
    '修改补写': 'correction-supplement',
    '套卷': 'test-paper',
  },
  '政治': {
    '选择': 'select',
    '中特': 'socialism',
    '经济社会': 'economy',
    '政治法治': 'politics-law',
    '哲学文化': 'philosophy-culture',
    '国政国经': 'intl-politics',
    '法律生活': 'law-life',
    '逻辑思维': 'logic',
    '套卷': 'test-paper',
  },
  '地理': {
    '选择': 'select',
    '自然地理': 'physical-geography',
    '人文地理': 'human-geography',
    '区域发展': 'regional-development',
    '图表判读': 'chart-interpretation',
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