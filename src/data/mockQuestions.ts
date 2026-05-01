export interface Question {
  id: string
  title: string
  imageUrl?: string
  subject: string
  questionType: string
  year?: number
  source: string
  tags: string[]
}

export const mockQuestions: Question[] = [
  {
    id: '1',
    title: '已知函数 f(x) = x³ - 3x + 1，求函数的极值点和极值',
    subject: '数学',
    questionType: '解答题',
    year: 2024,
    source: '高考真题',
    tags: ['导数', '极值', '单调性'],
  },
  {
    id: '2',
    title: '下列词语中，加点字的注音完全正确的一项是',
    subject: '语文',
    questionType: '选择题',
    year: 2023,
    source: '模拟试卷',
    tags: ['字音', '基础'],
  },
  {
    id: '3',
    title: 'The weather forecast says it _____ rain tomorrow.',
    subject: '英语',
    questionType: '选择题',
    year: 2024,
    source: '中考真题',
    tags: ['时态', '语法'],
  },
  {
    id: '4',
    title: '如图所示，在光滑水平面上，质量为 m 的物块在水平恒力 F 作用下运动',
    imageUrl: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=physics%20mechanics%20force%20motion%20diagram%20blue&image_size=square',
    subject: '物理',
    questionType: '计算题',
    year: 2023,
    source: '高考真题',
    tags: ['力学', '牛顿定律', '运动学'],
  },
  {
    id: '5',
    title: '写出下列化学方程式：碳酸钙与盐酸反应',
    subject: '化学',
    questionType: '填空题',
    year: 2022,
    source: '期中考试',
    tags: ['化学反应', '方程式'],
  },
  {
    id: '6',
    title: '证明：等腰三角形两底角相等',
    subject: '数学',
    questionType: '证明题',
    year: 2024,
    source: '竞赛题',
    tags: ['几何', '证明', '等腰三角形'],
  },
  {
    id: '7',
    title: '下列关于细胞呼吸的叙述，正确的是',
    subject: '生物',
    questionType: '选择题',
    year: 2023,
    source: '高考真题',
    tags: ['细胞呼吸', '代谢'],
  },
  {
    id: '8',
    title: '简述辛亥革命的历史意义',
    subject: '历史',
    questionType: '解答题',
    year: 2024,
    source: '模拟试卷',
    tags: ['近代史', '辛亥革命', '意义'],
  },
  {
    id: '9',
    title: '分析影响气候的主要因素',
    subject: '地理',
    questionType: '解答题',
    year: 2023,
    source: '期末考试',
    tags: ['气候', '影响因素'],
  },
  {
    id: '10',
    title: '社会主义核心价值观包括哪些内容',
    subject: '政治',
    questionType: '填空题',
    year: 2024,
    source: '中考真题',
    tags: ['价值观', '时政'],
  },
  {
    id: '11',
    title: '计算不定积分 ∫(x² + 1)dx',
    subject: '数学',
    questionType: '计算题',
    year: 2023,
    source: '大学高数',
    tags: ['积分', '微积分'],
  },
  {
    id: '12',
    title: '阅读下面的文言文，完成后面的题目',
    imageUrl: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=chinese%20ancient%20text%20calligraphy%20scroll%20traditional&image_size=square',
    subject: '语文',
    questionType: '解答题',
    year: 2024,
    source: '高考真题',
    tags: ['文言文', '阅读'],
  },
]
