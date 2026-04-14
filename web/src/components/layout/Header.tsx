import { Search, Bell, Mail, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
    fullName?: string;
    avatarUrl?: string;
    settingsPath?: string;
    onMenuClick?: () => void;
}

export function Header({
    fullName,
    avatarUrl,
    settingsPath,
    onMenuClick,
}: HeaderProps) {
    const initials = fullName
        ? fullName
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()
        : "?";
    const navigate = useNavigate();

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center gap-3 px-4 lg:px-6 shrink-0">
            {/* Hamburger — mobile only */}
            <button
                onClick={onMenuClick}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
                aria-label="Abrir menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Search — hidden on small screens */}
            <div className="hidden sm:flex flex-1 max-w-xs relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary-400 focus:bg-white transition-colors"
                />
            </div>

            <div className="flex-1" />

            {/* Icons */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500">
                <Mail className="w-4 h-4" />
            </button>
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-gray-500">
                <Bell className="w-4 h-4" />
            </button>

            {/* User */}
            <div
                className="flex items-center gap-3 ml-1 cursor-pointer group"
                onClick={() => settingsPath && navigate(settingsPath)}
                title="Editar perfil"
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={fullName}
                        className="w-9 h-9 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-semibold group-hover:bg-primary-800 transition-colors">
                        {initials}
                    </div>
                )}
                <div className="leading-tight hidden sm:block">
                    <p className="text-sm font-medium text-gray-900 max-w-[120px] truncate">
                        {fullName}
                    </p>
                </div>
            </div>
        </header>
    );
}
