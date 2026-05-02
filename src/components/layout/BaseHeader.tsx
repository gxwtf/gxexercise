'use client';

import { Button } from '@/components/ui/button';
import UserMenu from '@/components/layout/UserMenu';
import { Menu } from 'lucide-react';
import { useState, ReactNode } from 'react';

export interface BaseHeaderProps {
  sticky?: boolean;
  className?: string;
  children?: ReactNode;
  mobileMenuContent?: ReactNode;
  containerClassName?: string;
  showMobileMenuButton?: boolean;
}

export default function BaseHeader({
  sticky = false,
  className = '',
  children,
  mobileMenuContent,
  containerClassName = 'px-4 py-3',
  showMobileMenuButton = true,
}: BaseHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className={`${sticky ? 'sticky top-0 z-50' : ''} bg-background ${className}`}>
      <div className={`container mx-auto ${containerClassName}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-center">
            {children}
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {showMobileMenuButton && mobileMenuContent && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            
            <UserMenu />
          </div>
        </div>

        {mobileMenuOpen && mobileMenuContent && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            {mobileMenuContent}
          </div>
        )}
      </div>
    </header>
  );
}
