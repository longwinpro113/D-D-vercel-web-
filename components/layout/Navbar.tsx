"use client";

import { useState, type MouseEventHandler, type ReactNode } from "react";
import Link from "next/link";
import { ChevronUp, Database, ChartBar, ChartGantt, Menu, X, House } from "lucide-react";

type DropdownItemProps = {
  icon: ReactNode;
  title: string;
  desc?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const DropdownItem = ({ icon, title, desc, href = "#", onClick }: DropdownItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-white/5 group/item"
  >
    <div className="mt-1 text-gray-500 group-hover/item:text-white">{icon}</div>
    <div>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-white">{title}</span>
      </div>
      {desc && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{desc}</p>}
    </div>
  </Link>
);

export function Navbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMenu = (menu: string) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setOpenMenu(null);
  };

  return (
    <nav className="relative z-1000 w-full shrink-0 border-b border-white/10 bg-black text-white">
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-8 min-w-0">
          <a
            href="/"
            title="Trang chủ"
            aria-label="Trang chủ"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-blue-500 transition-colors hover:bg-white/10"
          >
            <span className="sr-only">Trang chủ</span>
            <House size={24} />
          </a>

          <div className="hidden min-w-0 items-center gap-6 text-base font-medium text-gray-400 xl:flex">
            <div
              className="group relative flex h-20 items-center"
              onMouseEnter={() => setOpenMenu("entry")}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button type="button" className="flex items-center gap-1 py-6 transition-colors hover:text-white">
                Entry Form
                <ChevronUp size={14} className={`transition-transform ${openMenu === "entry" ? "rotate-180" : ""}`} />
              </button>

              {openMenu === "entry" && (
                <div className="absolute left-0 top-full z-50 w-72 rounded-xl border border-white/10 bg-[#1a1a1a] p-2 shadow-2xl">
                  <DropdownItem
                    href="/orders-entry-form"
                    icon={<Database size={18} />}
                    title="Nhập Đơn Hàng"
                    desc="Nhập thông tin đơn hàng mới"
                  />
                  <DropdownItem
                    href="/export-entry-form"
                    icon={<Database size={18} />}
                    title="Nhập Phiếu Xuất Kho"
                    desc="Nhập thông tin giao hàng"
                  />
                </div>
              )}
            </div>

            <Link href="/client-orders" className="whitespace-nowrap py-6 transition-colors hover:text-white">
              Theo dõi đơn hàng
            </Link>

            <div
              className="group relative flex h-20 items-center"
              onMouseEnter={() => setOpenMenu("management")}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button type="button" className="flex items-center gap-1 py-6 transition-colors hover:text-white">
                Quản Lý Đơn Hàng
                <ChevronUp size={14} className={`transition-transform ${openMenu === "management" ? "rotate-180" : ""}`} />
              </button>

              {openMenu === "management" && (
                <div className="absolute left-0 top-full z-50 w-72 rounded-xl border border-white/10 bg-[#1a1a1a] p-2 shadow-2xl">
                  <DropdownItem
                    href="/daily-report"
                    icon={<ChartBar size={18} />}
                    title="Báo Biểu Giao Hàng"
                    desc="Xem và quản lý báo biểu giao hàng"
                  />
                  <DropdownItem
                    href="/remaining-report"
                    icon={<ChartGantt size={18} />}
                    title="Tiến Độ Giao Hàng"
                    desc="Xem và quản lý tiến độ giao hàng"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          aria-label={isMobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-controls="mobile-navbar-menu"
          aria-expanded={isMobileMenuOpen}
          className="relative z-1001 flex touch-manipulation p-2 text-gray-400 transition-colors hover:text-white xl:hidden"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Dong menu nen"
            className="fixed inset-0 z-999 bg-black/40 xl:hidden"
            onClick={closeMobileMenu}
          />

          <div id="mobile-navbar-menu" className="fixed left-0 top-20 z-1000 max-h-[calc(100vh-80px)] w-full overflow-y-auto border-b border-white/10 bg-black shadow-2xl xl:hidden">
            <div className="flex flex-col gap-4 p-4">
              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg p-3 text-lg font-semibold text-white transition-colors hover:bg-white/5"
                  onClick={() => toggleMenu("entry")}
                >
                  Entry Form
                  <ChevronUp size={18} className={`transition-transform ${openMenu === "entry" ? "rotate-180" : ""}`} />
                </button>
                {openMenu === "entry" && (
                  <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
                    <a href="/orders-entry-form" onClick={closeMobileMenu} className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-white/5">
                      <div className="mt-1 text-gray-500"><Database size={18} /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-white">Nhập Đơn Hàng</span>
                        </div>
                      </div>
                    </a>
                    <a href="/export-entry-form" onClick={closeMobileMenu} className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-white/5">
                      <div className="mt-1 text-gray-500"><Database size={18} /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-white">Nhập Phiếu Xuất Kho</span>
                        </div>
                      </div>
                    </a>
                  </div>
                )}
              </div>

              <a
                href="/client-orders"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 rounded-lg p-3 text-lg font-semibold text-white transition-colors hover:bg-white/5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Database size={18} />
                </span>
                Theo dõi đơn hàng
              </a>

              <div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg p-3 text-lg font-semibold text-white transition-colors hover:bg-white/5"
                  onClick={() => toggleMenu("management")}
                >
                  Quản Lý Đơn Hàng
                  <ChevronUp size={18} className={`transition-transform ${openMenu === "management" ? "rotate-180" : ""}`} />
                </button>
                {openMenu === "management" && (
                  <div className="ml-3 mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
                    <a href="/daily-report" onClick={closeMobileMenu} className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-white/5">
                      <div className="mt-1 text-gray-500"><ChartBar size={18} /></div>
                      <div><span className="text-base font-semibold text-white">Báo Biểu Giao Hàng</span></div>
                    </a>
                    <a href="/remaining-report" onClick={closeMobileMenu} className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-white/5">
                      <div className="mt-1 text-gray-500"><ChartGantt size={18} /></div>
                      <div><span className="text-base font-semibold text-white">Tiến Độ Giao Hàng</span></div>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
