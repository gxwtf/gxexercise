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

export const subjectNavItems: Record<string, {
  navButtons: { label: string; href: string }[];
}> = {
  '数学': {
    navButtons: [
      { label: '代数', href: '/math/algebra' },
      { label: '几何', href: '/math/geometry' },
      { label: '函数', href: '/math/function' },
      { label: '概率统计', href: '/math/probability' },
      { label: '微积分', href: '/math/calculus' },
    ],
  },
  '语文': {
    navButtons: [
      { label: '诗词鉴赏', href: '/chinese/poetry' },
      { label: '阅读理解', href: '/chinese/reading' },
      { label: '作文素材', href: '/chinese/writing' },
      { label: '文言文', href: '/chinese/classical' },
      { label: '现代文', href: '/chinese/modern' },
    ],
  },
  '英语': {
    navButtons: [
      { label: '完形填空', href: '/english/cloze' },
      { label: '语法填空', href: '/english/grammar' },
      { label: '阅读', href: '/english/reading' },
      { label: '七选五', href: '/english/seven-choose-five' },
      { label: '阅读表达', href: '/english/reading-expression' },
      { label: '作文', href: '/english/writing' },
    ],
  },
  '物理': {
    navButtons: [
      { label: '力学', href: '/physics/mechanics' },
      { label: '电磁学', href: '/physics/electromagnetism' },
      { label: '热学', href: '/physics/thermodynamics' },
      { label: '光学', href: '/physics/optics' },
      { label: '实验题', href: '/physics/experiment' },
    ],
  },
  '化学': {
    navButtons: [
      { label: '化学方程式', href: '/chemistry/equations' },
      { label: '有机化学', href: '/chemistry/organic' },
      { label: '无机化学', href: '/chemistry/inorganic' },
      { label: '实验操作', href: '/chemistry/experiment' },
      { label: '元素周期', href: '/chemistry/periodic' },
    ],
  },
};
