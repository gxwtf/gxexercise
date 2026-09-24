import packageJson from "../../../package.json";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const version = packageJson.version;
  
  // 计算稳定运行天数（从2026年9月24日开始）
  const startDate = new Date(2026, 8, 23); // 注意：月份从0开始，9月是8
  const currentDate = new Date();
  const daysRunning = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return (
    <footer className="border-t bg-background py-4">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between space-y-2 md:flex-row md:space-y-0">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © {currentYear} 广学五题坊
            </p>
          </div>
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <span>系统版本 v{version}</span>
            <span>•</span>
            <span>已稳定运行 {daysRunning} 天</span>
          </div>
        </div>
      </div>
    </footer>
  );
}