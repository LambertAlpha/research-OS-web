"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Droplets,
  TrendingUp,
  History,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/liquidity", label: "Liquidity", icon: Droplets },
  { href: "/macro", label: "Macro", icon: TrendingUp },
  { href: "/history", label: "History", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#050508]/90 border-r border-cyan-500/10 backdrop-blur-2xl">
      {/* 顶部渐变光效 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Logo 区域 */}
      <div className="p-6 relative">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <Image
              src="/logo.png"
              alt="Research OS"
              width={40}
              height={40}
              className="w-full h-full object-contain"
            />
            {/* 呼吸灯效果 */}
            <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-lg animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              Research OS
            </h1>
            <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
              Macro Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

      {/* 导航菜单 */}
      <nav className="px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden",
                isActive
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
              )}
            >
              {/* 活跃状态的边框辉光 */}
              {isActive && (
                <>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full shadow-lg shadow-cyan-500/50" />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent" />
                </>
              )}

              <div
                className={cn(
                  "relative z-10 p-2 rounded-lg transition-all duration-300",
                  isActive
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-zinc-800/50 group-hover:bg-zinc-700/50"
                )}
              >
                <Icon size={16} />
              </div>

              <span className="relative z-10 text-sm font-medium">
                {item.label}
              </span>

              {/* Hover 光效 */}
              <div
                className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  "bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* 底部状态区 */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* 分隔线 */}
        <div className="mb-4 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

        {/* 系统状态 */}
        <div className="px-3 py-2 mb-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">System Status</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse" />
              <span className="text-emerald-400 font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Settings 链接 */}
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 transition-all duration-300"
        >
          <div className="p-2 rounded-lg bg-zinc-800/50">
            <Settings size={16} />
          </div>
          <span className="text-sm font-medium">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
