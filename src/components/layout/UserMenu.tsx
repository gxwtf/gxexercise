import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';

export default function UserMenu() {
    // 临时用户信息，demo阶段使用
    const currentUser = {
        name: 'Demo User',
        role: 'admin', // demo阶段默认管理员权限
    };

    return (
        <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <span className="hidden text-sm text-muted-foreground sm:inline">
                {currentUser.name} ({currentUser.role})
            </span>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <User className="h-4 w-4" />
                        <span className="sr-only">用户菜单</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Link href="/dashboard/1">个人信息</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Link href="/settings">设置</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                        退出登录
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}