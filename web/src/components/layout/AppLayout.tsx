import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "../../hooks/useAuth";

export function OwnerLayout() {
    const { profile } = useAuth();
    return (
        <div className="flex h-screen overflow-hidden bg-[#f3f8f5]">
            <Sidebar role="owner" fullName={profile?.full_name} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header fullName={profile?.full_name} />
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export function TenantLayout() {
    const { profile } = useAuth();
    return (
        <div className="flex h-screen overflow-hidden bg-[#f3f8f5]">
            <Sidebar role="tenant" fullName={profile?.full_name} />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Header fullName={profile?.full_name} />
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
