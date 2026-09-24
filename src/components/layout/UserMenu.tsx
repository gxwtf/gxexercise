'use client';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
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
                <Button variant="ghost" onClick={(e) => {
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

    const userName = session.username;
    const showAdminBadge = session.admin;

    return (
        <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <span className="hidden text-sm text-muted-foreground sm:inline">
                {userName}{showAdminBadge ? ' (admin)' : ''}
            </span>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
                        <Image
                            src={`https://gxwtf.cn/avatar?userId=${session.userid}`}
                            alt={userName}
                            fill
                            sizes="32px"
                            className="rounded-full object-cover"
                        />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <Link href="https://account.gxwtf.cn/">账号中心</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Link href="https://gxwtf.cn/feedback/new">网站反馈</Link>
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