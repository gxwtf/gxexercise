// 广学账号的年级编号（users.grade）：7–9 = 初中，10–12 = 高中，13 = 其他
// 与 gxwtf_poem 的 gradeLabel 口径保持一致（那边只用了 10–12）。

export function gradeLabel(grade: number | null | undefined): string | null {
  switch (grade) {
    case 7:
      return "初一"
    case 8:
      return "初二"
    case 9:
      return "初三"
    case 10:
      return "高一"
    case 11:
      return "高二"
    case 12:
      return "高三"
    case 13:
      return "其他"
    default:
      return null
  }
}

/** 头像地址：广学账号的公开头像接口（按 userId，未设置头像时回退 Gravatar/默认图） */
export function accountAvatarUrl(userId: number | null | undefined): string | null {
  return userId ? `https://gxwtf.cn/avatar?userId=${userId}` : null
}
