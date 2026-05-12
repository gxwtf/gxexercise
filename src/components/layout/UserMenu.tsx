'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { User } from 'lucide-react';
import useSession from '@/lib/use-session';
import { useRouter } from 'next/navigation';
import { useAlertContext } from '@/components/alert-provider';

export default function UserMenu() {
    const { session, logout, isLoading } = useSession();
    const router = useRouter();
    const { showAlert } = useAlertContext();

    const handleLogout = async () => {
        try {
            await logout();
            showAlert({
                type: 'normal',
                title: '退出成功',
                description: '期待您的再次光临！'
            });
            router.push('/');
        } catch (error) {
            showAlert({
                type: 'destructive',
                title: '退出失败',
                description: `请稍后重试。`
            });
        }
    };

    if (!session.isLoggedIn) {
        return (
            <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                <Button onClick={(e) => {
                    e.preventDefault()
                    if (typeof window !== 'undefined') {
                        router.push(`/login?back=${window.location.pathname}`)
                    }
                }}>
                    登录
                </Button>
            </div>
        );
    }

    const userName = session.real_name || session.username;
    const userRole = session.admin ? 'admin' : 'user';

    return (
        <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <span className="hidden text-sm text-muted-foreground sm:inline">
                {userName} ({userRole})
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
                        <Link href="/dashboard">个人信息</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Link href="/settings">设置</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                        退出登录
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}