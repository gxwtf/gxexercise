'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Menu, Monitor, Moon, Sun } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useState } from 'react';

export default function Header() {
  // 临时用户信息，demo阶段使用
  const currentUser = {
    name: 'Demo User',
    role: 'admin', // demo阶段默认管理员权限
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              广学五题坊
            </Link>
            <nav className="hidden md:flex space-x-6">
              <Link href="/" className="text-sm font-medium hover:text-primary">
                首页
              </Link>
              <Link href="/problems" className="text-sm font-medium hover:text-primary">
                题库
              </Link>
              <Link href="/games" className="text-sm font-medium hover:text-primary">
                游戏中心
              </Link>
              {currentUser.role === 'admin' && (
                <Link href="/users" className="text-sm font-medium hover:text-primary">
                  用户管理
                </Link>
              )}
            </nav>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* 移动端菜单按钮 */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            
            {/* 主题切换 */}
            <ThemeToggle />
            
            {/* 用户信息 - 移动端隐藏 */}
            <span className="hidden md:inline text-sm text-muted-foreground">
              {currentUser.name} ({currentUser.role})
            </span>
            
            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
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
                <DropdownMenuItem className="text-red-600">
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <nav className="flex flex-col space-y-4">
              <Link 
                href="/" 
                className="text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                首页
              </Link>
              <Link 
                href="/problems" 
                className="text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                题库
              </Link>
              <Link 
                href="/games" 
                className="text-sm font-medium hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                游戏中心
              </Link>
              {currentUser.role === 'admin' && (
                <Link 
                  href="/users" 
                  className="text-sm font-medium hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  用户管理
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}