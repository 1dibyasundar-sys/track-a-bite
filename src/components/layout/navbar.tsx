'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '../../lib/utils';
import { Container } from './container';
import { CameraIcon, LeafIcon, XIcon } from '../ui/icons';
import { userProfileService, useUserProfile } from '../../lib/services/userProfileService';
import { useAuth } from '../auth/AuthProvider';
import { ProfileModal } from '../profile/profile-modal';
import { ThemeToggle } from '../theme/ThemeToggle';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const profile = useUserProfile();
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleToggleHostelMode = () => {
    userProfileService.toggleHostelMode();
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/scan', label: 'Scan Food' },
    { href: '/foods', label: 'Food Database' },
    { href: '/history', label: 'History' },
    { href: '/reports', label: 'Reports' },
    { href: '/about', label: 'About' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 dark:bg-[#151311]/95 backdrop-blur-md border-b border-[#E8DED2] dark:border-[#38312A] transition-all">
        <Container size="lg">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 sm:gap-3 shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E86A33] rounded-xl py-1 px-1 -ml-1 transition-colors"
              aria-label="Track-a-Bite Home"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-900 dark:bg-[#25211D] text-white flex items-center justify-center shadow-xs border border-stone-800 dark:border-[#38312A] group-hover:border-[#E86A33]/40 transition-colors shrink-0">
                <LeafIcon size={20} className="text-[#E86A33]" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans whitespace-nowrap">
                    Track-a-Bite
                  </span>
                </div>
                <span className="text-3xs sm:text-2xs text-[#6B6258] dark:text-[#A9A096] font-medium tracking-wide whitespace-nowrap mt-0.5">
                  AI Food Intelligence
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1" aria-label="Main Navigation">
              {navLinks.map(link => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'px-2.5 xl:px-3.5 py-2 text-xs xl:text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                      active
                        ? 'text-[#E86A33] dark:text-[#F4A340] bg-[#FDF3ED] dark:bg-[#2A1C14] font-bold'
                        : 'text-stone-600 dark:text-stone-300 hover:text-stone-950 dark:hover:text-stone-100 hover:bg-[#F3EDE4]/60 dark:hover:bg-[#25211D]/60'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Quick Actions: Theme, Hostel Mode Toggle, Auth & Scan */}
            <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0">
              {/* Theme Toggle Dropdown */}
              <ThemeToggle variant="dropdown" />

              {/* Hostel Mode Pill Switch */}
              <button
                type="button"
                onClick={handleToggleHostelMode}
                className={cn(
                  'px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer shrink-0 whitespace-nowrap',
                  profile.isHostelite
                    ? 'bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/60'
                    : 'bg-stone-100 dark:bg-[#1D1A17] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-[#38312A] hover:bg-stone-200 dark:hover:bg-[#25211D]'
                )}
                title="Toggle Hostel Mode for campus-friendly recommendations"
              >
                <span className="text-sm">{profile.isHostelite ? '🏠' : '🍽️'}</span>
                <span className="hidden xl:inline">Hostel Mode:</span>
                <span className="xl:hidden">Hostel:</span>
                <span className={cn('text-3xs xl:text-2xs font-extrabold uppercase px-1 rounded', profile.isHostelite ? 'bg-amber-200 dark:bg-amber-800/80 text-amber-950 dark:text-amber-100' : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300')}>
                  {profile.isHostelite ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Dynamic Auth Actions */}
              {isAuthenticated ? (
                <>
                  {/* User Identity Pill */}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-100 dark:bg-[#1D1A17] hover:bg-stone-200/80 dark:hover:bg-[#25211D] border border-stone-200/80 dark:border-[#38312A] text-xs text-stone-800 dark:text-stone-200 transition-colors group shrink-0 whitespace-nowrap"
                    title={`Signed in as ${user?.displayName || user?.email || 'User'}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#E86A33] text-white flex items-center justify-center text-3xs font-bold uppercase shadow-2xs">
                      {((user?.displayName || user?.email || 'U')[0]).toUpperCase()}
                    </div>
                    <span className="font-semibold max-w-[80px] xl:max-w-[110px] truncate text-xs">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 xl:px-3 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                  <Link
                    href="/scan"
                    className="inline-flex items-center gap-1.5 xl:gap-2 px-3.5 xl:px-4 py-2 text-xs xl:text-sm font-semibold rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white transition-all shadow-xs shrink-0 whitespace-nowrap"
                  >
                    <CameraIcon size={16} className="text-white/90" />
                    <span>Scan Food</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 xl:px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 whitespace-nowrap"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/scan"
                    className="inline-flex items-center gap-1.5 xl:gap-2 px-3.5 xl:px-4 py-2 text-xs xl:text-sm font-bold rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white transition-all shadow-sm hover:-translate-y-0.5 shrink-0 whitespace-nowrap"
                  >
                    <CameraIcon size={16} className="text-white/90" />
                    <span>Scan Food</span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile / Tablet Actions (< 1024px) */}
            <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden shrink-0">
              {/* Quick Cycle Theme Toggle for mobile top bar */}
              <ThemeToggle variant="cycle" className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" />

              <button
                type="button"
                onClick={handleToggleHostelMode}
                className={cn(
                  'p-2 px-2.5 rounded-xl text-2xs font-bold border transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap min-h-[44px]',
                  profile.isHostelite
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                    : 'bg-stone-100 dark:bg-stone-900/90 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                )}
                aria-label="Toggle Hostel Mode"
                title={`Hostel Mode: ${profile.isHostelite ? 'ON' : 'OFF'}`}
              >
                <span>{profile.isHostelite ? '🏠' : '🍽️'}</span>
                <span className="hidden min-[360px]:inline">Hostel</span>
              </button>

              <Link
                href="/scan"
                className="p-2 text-white bg-[#E86A33] hover:bg-[#d65f2c] rounded-xl transition-colors shrink-0 shadow-2xs min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Quick Scan"
                title="Scan Food"
              >
                <CameraIcon size={20} />
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 focus:outline-none transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle Navigation Menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <XIcon size={22} />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-stone-200 dark:border-stone-800 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
              {/* Authenticated User Identity Header in Mobile Drawer */}
              {isAuthenticated && (
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#1D1A17] border border-stone-200/80 dark:border-[#38312A] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E86A33] text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {((user?.displayName || user?.email || 'U')[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                      {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Foodie')}
                    </p>
                    <p className="text-2xs text-[#6B6258] dark:text-[#A9A096] truncate">
                      {user?.email || 'Logged in'}
                    </p>
                  </div>
                </div>
              )}

              {/* Theme Preference in Mobile Drawer */}
              <div className="px-1 py-1">
                <span className="text-3xs sm:text-2xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Appearance
                </span>
                <ThemeToggle variant="segmented" />
              </div>

              <nav className="flex flex-col gap-1">
                {navLinks.map(link => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'px-4 py-3 text-base font-medium rounded-xl transition-colors flex items-center justify-between',
                        active
                          ? 'text-[#E86A33] dark:text-[#F4A340] bg-[#FDF3ED] dark:bg-[#2A1C14] font-bold'
                          : 'text-stone-700 dark:text-stone-200 hover:bg-[#F3EDE4]/60 dark:hover:bg-[#25211D]/60'
                      )}
                    >
                      <span>{link.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#E86A33]" />}
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Auth and Quick Actions */}
              {isAuthenticated ? (
                <>
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2 px-1">
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 text-xs font-bold text-center border border-stone-200 dark:border-[#38312A]"
                    >
                      Personal Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-[#1D1A17] text-stone-700 dark:text-stone-300 text-xs font-bold text-center border border-stone-200 dark:border-[#38312A] cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="pt-1">
                    <Link
                      href="/scan"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white font-bold shadow-xs transition-colors"
                    >
                      <CameraIcon size={18} />
                      <span>Scan My Food</span>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 px-1">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-[#1D1A17] text-stone-800 dark:text-stone-200 text-xs font-bold text-center border border-stone-200 dark:border-[#38312A]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#E86A33] hover:bg-[#d65f2c] text-white text-xs font-bold text-center shadow-2xs transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          )}
        </Container>
      </header>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
