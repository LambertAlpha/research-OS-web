/**
 * [INPUT]: 无 props。内部读取 usePathname() 获取当前路由路径。
 * [OUTPUT]: (<aside>) - 固定左侧导航栏，含 Logo、七个导航项、系统状态、Settings 入口。
 * [POS]: 位于 /components，被 layout.tsx 引用。全局唯一的导航组件，固定于屏幕左侧 (w-60, h-screen)。
 *
 * [PROTOCOL]:
 * 1. 一旦本文件逻辑变更，必须同步更新此 Header。
 * 2. 更新后必须上浮检查 /src/components/.folder.md 的描述是否依然准确。
 */
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Droplets,
  TrendingUp,
  BarChart3,
  History,
  Settings,
  Database,
  BookOpen,
  Bitcoin,
} from "lucide-react";

const navItems = [
  { href: "/macro", label: "Macro", icon: TrendingUp },
  { href: "/liquidity", label: "Liquidity", icon: Droplets },
  { href: "/equity", label: "US Equities", icon: BarChart3 },
  { href: "/btc", label: "Bitcoin", icon: Bitcoin },
  { href: "/history", label: "History", icon: History },
  { href: "/registry", label: "Registry", icon: Database },
  { href: "/indicators", label: "Indicators", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[var(--bg)] border-r border-[var(--border-subtle)] z-20">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Research OS"
              width={28}
              height={28}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-200 tracking-tight leading-tight">
              Research OS
            </h1>
            <p className="text-[9px] text-[var(--text-faint)] font-medium tracking-widest uppercase">
              Macro Intelligence
            </p>
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-[var(--border-subtle)]" />

      {/* Nav */}
      <nav className="px-3 py-3 space-y-px">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 relative text-[15px]",
                isActive
                  ? "bg-[var(--bg-elevated)] text-zinc-200"
                  : "text-[var(--text-muted)] hover:text-zinc-300 hover:bg-[var(--bg-card)]"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-zinc-500 rounded-r" />
              )}
              <Icon size={15} strokeWidth={1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
        <div className="mx-2 mb-2 h-px bg-[var(--border-subtle)]" />

        <div className="px-3 py-2 mb-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--text-faint)]">Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[var(--text-muted)]">Online</span>
            </div>
          </div>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--text-muted)] hover:text-zinc-300 hover:bg-[var(--bg-card)] transition-colors duration-100 text-[15px]"
        >
          <Settings size={15} strokeWidth={1.7} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
