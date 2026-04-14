import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Building2,
    FileText,
    Receipt,
    ClipboardCheck,
    FolderOpen,
    BookTemplate,
    Megaphone,
    Settings,
    LogOut,
    Home,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { authService } from "../../services/auth.service";

interface NavItem {
    label: string;
    to: string;
    icon: React.ElementType;
    badge?: number;
}

const ownerNav: NavItem[] = [
    { label: "Dashboard", to: "/owner/dashboard", icon: LayoutDashboard },
    { label: "Imóveis", to: "/owner/properties", icon: Building2 },
    { label: "Contratos", to: "/owner/contracts", icon: FileText },
    { label: "Faturas", to: "/owner/invoices", icon: Receipt },
];

const ownerGeneral: NavItem[] = [
    { label: "Vistorias", to: "/owner/inspections", icon: ClipboardCheck },
    { label: "Documentos", to: "/owner/documents", icon: FolderOpen },
    { label: "Modelos", to: "/owner/templates", icon: BookTemplate },
    { label: "Anúncios", to: "/owner/ads", icon: Megaphone },
    { label: "Configurações", to: "/owner/settings", icon: Settings },
];

const tenantNav: NavItem[] = [
    { label: "Dashboard", to: "/tenant/dashboard", icon: LayoutDashboard },
    { label: "Contratos", to: "/tenant/contracts", icon: FileText },
    { label: "Faturas", to: "/tenant/invoices", icon: Receipt },
    { label: "Documentos", to: "/tenant/documents", icon: FolderOpen },
];

interface SidebarProps {
    role: "owner" | "tenant";
    fullName?: string;
    open?: boolean;
    onClose?: () => void;
}

export function Sidebar({
    role,
    fullName,
    open = false,
    onClose,
}: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const mainNav = role === "owner" ? ownerNav : tenantNav;
    const generalNav = role === "owner" ? ownerGeneral : [];

    // Close on route change (mobile)
    useEffect(() => {
        onClose?.();
    }, [location.pathname]);

    async function handleLogout() {
        await authService.signOut();
        navigate("/login");
    }

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className="flex items-center gap-2 px-5 mb-8">
                <div className="w-8 h-8 rounded-xl bg-primary-700 flex items-center justify-center">
                    <Home className="w-4 h-4 text-white" />
                </div>
                <span className="text-[15px] font-semibold text-gray-900 tracking-tight">
                    ImobTech
                </span>
            </div>

            {/* MENU section */}
            <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
                <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    Menu
                </p>
                {mainNav.map((item) => (
                    <SidebarLink key={item.to} item={item} />
                ))}

                {generalNav.length > 0 && (
                    <>
                        <p className="px-2 mt-6 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                            Geral
                        </p>
                        {generalNav.map((item) => (
                            <SidebarLink key={item.to} item={item} />
                        ))}
                    </>
                )}
            </nav>

            {/* Bottom card */}
            <div className="px-3 mt-4">
                <div className="rounded-2xl bg-primary-800 text-white p-4 mb-3">
                    <p className="text-xs font-medium mb-1 opacity-80">
                        Acesso Mobile
                    </p>
                    <p className="text-[11px] opacity-60 leading-tight mb-3">
                        Gerencie seus imóveis de qualquer lugar
                    </p>
                    <button className="w-full text-[11px] font-semibold bg-primary-500 hover:bg-primary-400 transition-colors rounded-lg py-1.5">
                        Em breve
                    </button>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300",
                    open
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none",
                )}
                onClick={onClose}
            />

            {/* Sidebar — mobile drawer + desktop fixed */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-white border-r border-gray-100 py-6 transition-transform duration-300 lg:static lg:z-auto lg:w-56 lg:translate-x-0 lg:shrink-0",
                    open ? "translate-x-0" : "-translate-x-full",
                )}
            >
                {sidebarContent}
            </aside>
        </>
    );
}

function SidebarLink({ item }: { item: NavItem }) {
    const Icon = item.icon;
    return (
        <NavLink
            to={item.to}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium transition-colors",
                    isActive
                        ? "bg-primary-700 text-white"
                        : "text-gray-600 hover:bg-primary-50 hover:text-primary-800",
                )
            }
        >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
            {item.badge != null && (
                <span className="ml-auto text-[10px] font-bold bg-primary-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {item.badge}
                </span>
            )}
        </NavLink>
    );
}
