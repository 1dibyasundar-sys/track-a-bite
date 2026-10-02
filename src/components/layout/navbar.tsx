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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e7e5e0] transition-all">
        <Container size="lg">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Brand Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-lg p-1"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs group-hover:bg-emerald-900 transition-colors">
                <LeafIcon size={19} className="text-emerald-300" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold tracking-tight text-stone-900 font-sans">
                    Track-a-Bite
                  </span>
                  <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Campus
                  </span>
                </div>
                <span className="text-2xs text-stone-500 font-medium tracking-wide">
                  Student Food Intelligence
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
              {navLinks.map(link => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'px-3.5 py-2 text-sm font-medium rounded-lg transition-colors',
                      active
                        ? 'text-emerald-900 bg-emerald-50 font-semibold'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Quick Actions: Hostel Mode Toggle, Auth & Scan */}
            <div className="hidden md:flex items-center gap-2.5">
              {/* Hostel Mode Pill Switch */}
              <button
                type="button"
                onClick={handleToggleHostelMode}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer',
                  profile.isHostelite
                    ? 'bg-amber-100/90 text-amber-950 border-amber-300 hover:bg-amber-200'
                    : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                )}
                title="Toggle Hostel Mode for campus-friendly recommendations"
              >
                <span className="text-sm">{profile.isHostelite ? '🏠' : '🍽️'}</span>
                <span>Hostel Mode:</span>
                <span className={cn('text-2xs font-extrabold uppercase px-1 rounded', profile.isHostelite ? 'bg-amber-200 text-amber-950' : 'bg-stone-200 text-stone-700')}>
                  {profile.isHostelite ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Dynamic Auth Actions */}
              {isAuthenticated ? (
                <>
                  {/* User Identity Pill */}
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 border border-stone-200/80 text-xs text-stone-800 transition-colors group"
                    title={`Signed in as ${user?.displayName || user?.email || 'User'}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-800 text-white flex items-center justify-center text-3xs font-bold uppercase shadow-2xs group-hover:bg-emerald-900">
                      {((user?.displayName || user?.email || 'U')[0]).toUpperCase()}
                    </div>
                    <span className="font-semibold max-w-[100px] truncate text-xs">
                      {user?.displayName || user?.email?.split('@')[0] || 'User'}
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-2 text-xs font-semibold rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                  <Link
                    href="/scan"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 transition-colors shadow-2xs"
                  >
                    <CameraIcon size={16} className="text-emerald-200" />
                    <span>Scan Food</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 transition-colors shadow-2xs"
                  >
                    <span>Register</span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Actions */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                type="button"
                onClick={handleToggleHostelMode}
                className={cn(
                  'p-1.5 px-2 rounded-lg text-2xs font-bold border transition-colors flex items-center gap-1',
                  profile.isHostelite ? 'bg-amber-100 text-amber-950 border-amber-300' : 'bg-stone-100 text-stone-600 border-stone-200'
                )}
                aria-label="Toggle Hostel Mode"
              >
                <span>{profile.isHostelite ? '🏠' : '🍽️'}</span>
                <span>Hostel</span>
              </button>

              <Link
                href="/scan"
                className="p-2 text-emerald-800 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                aria-label="Quick Scan"
              >
                <CameraIcon size={20} />
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 focus:outline-none"
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
            <div className="md:hidden py-4 border-t border-stone-200 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
              {/* Authenticated User Identity Header in Mobile Drawer */}
              {isAuthenticated && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {((user?.displayName || user?.email || 'U')[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">
                      {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Campus Foodie')}
                    </p>
                    <p className="text-2xs text-stone-500 truncate">
                      {user?.email || 'Logged in'}
                    </p>
                  </div>
                </div>
              )}

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
                          ? 'text-emerald-900 bg-emerald-50 font-semibold'
                          : 'text-stone-700 hover:bg-stone-50'
                      )}
                    >
                      <span>{link.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />}
                    </Link>
                  );
                })}
              </nav>

              {/* Mobile Auth and Quick Actions */}
              {isAuthenticated ? (
                <>
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 px-1">
                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold text-center border border-stone-200"
                    >
                      Personal Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold text-center border border-stone-200 cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                  <div className="pt-1">
                    <Link
                      href="/scan"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-800 text-white font-semibold shadow-xs"
                    >
                      <CameraIcon size={18} />
                      <span>Scan My Food</span>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="pt-2 border-t border-stone-100 flex items-center gap-2 px-1">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 text-stone-800 text-xs font-bold text-center border border-stone-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-800 text-white text-xs font-bold text-center shadow-2xs"
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
