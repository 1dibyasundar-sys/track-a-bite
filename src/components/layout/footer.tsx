import React from 'react';
import Link from 'next/link';
import { Container } from './container';
import { LeafIcon, ShieldCheckIcon } from '../ui/icons';

export function Footer() {
  return (
    <footer className="bg-stone-900 text-stone-300 pt-16 pb-12 mt-auto border-t border-stone-800">
      <Container size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-stone-800">
          {/* Brand Info */}
          <div className="space-y-4 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E86A33] text-white flex items-center justify-center shadow-xs">
                <LeafIcon size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Track-a-Bite
              </span>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Honoring regional diversity with intelligent, practical nutrition analysis. Built for real Indian plates—from home thalis to rural millets and budget hostel staples.
            </p>
            <div className="flex items-center gap-2 text-2xs text-stone-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#3F8F68] animate-pulse" />
              Production Ready • Phase 12
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-100 mb-4">
              Explore Application
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/dashboard" className="hover:text-[#E86A33] transition-colors">
                  Personal Dashboard
                </Link>
              </li>
              <li>
                <Link href="/scan" className="hover:text-[#E86A33] transition-colors">
                  Scan Your Meal
                </Link>
              </li>
              <li>
                <Link href="/foods" className="hover:text-[#E86A33] transition-colors">
                  Indian Food Database
                </Link>
              </li>
              <li>
                <Link href="/history" className="hover:text-[#E86A33] transition-colors">
                  Meal History
                </Link>
              </li>
              <li>
                <Link href="/reports" className="hover:text-[#E86A33] transition-colors">
                  Nutrition Reports
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-[#E86A33] transition-colors">
                  Vision &amp; Philosophy
                </Link>
              </li>
            </ul>
          </div>

          {/* Regional Foods Covered */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-100 mb-4">
              Regional Breadth
            </h4>
            <ul className="space-y-2 text-xs text-stone-400">
              <li>• Lentils & Dals (Toor, Moong, Masoor, Chana)</li>
              <li>• Millets (Ragi, Jowar, Bajra, Foxtail)</li>
              <li>• Traditional Ferments (Idli, Dosa, Dhokla)</li>
              <li>• Budget Proteins (Roasted Sattu, Sprouts, Curd)</li>
              <li>• Seasonal & Regional Sabzis</li>
            </ul>
          </div>

          {/* Estimation & Safety */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-100 flex items-center gap-1.5">
              <ShieldCheckIcon size={14} className="text-emerald-400" />
              <span>Scientific Estimation</span>
            </h4>
            <p className="text-2xs leading-relaxed text-stone-400">
              Track-a-Bite provides approximations based on visual segmentation and standardized nutritional references. Portions, cooking oils, and regional recipes naturally vary.
            </p>
            <p className="text-2xs text-stone-400 leading-relaxed">
              We never categorize whole foods simplistically as &quot;good&quot; or &quot;bad&quot;. Always consult qualified healthcare professionals for therapeutic dietary needs.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-2xs text-stone-400">
          <p>© {new Date().getFullYear()} Track-a-Bite. Designed for balanced, accessible, and regional food awareness.</p>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-stone-300">
              Estimation Methodology
            </Link>
            <span>•</span>
            <Link href="/about" className="hover:text-stone-300">
              Medical Notice
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
