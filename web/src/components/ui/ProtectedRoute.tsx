import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { UserRole } from "../../lib/constants";

interface ProtectedRouteProps {
    children: React.ReactNode;
    role?: UserRole;
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
    const { session, profile, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;
        if (!session) {
            navigate("/login");
            return;
        }
        if (role && profile?.role && profile.role !== role) {
            navigate(
                profile.role === UserRole.Owner
                    ? "/owner/dashboard"
                    : "/tenant/dashboard",
            );
        }
    }, [session, profile, loading, role, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f3f8f5] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
