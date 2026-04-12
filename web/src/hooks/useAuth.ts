import { useState, useEffect } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { authService } from "../services/auth.service";
import type { Profile } from "../types/domain.types";
import { UserRole } from "../lib/constants";

export interface AuthState {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: UserRole | null;
    loading: boolean;
}

export function useAuth(): AuthState {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authService.getSession().then(({ data }) => {
            setSession(data.session);
            if (data.session?.user) loadProfile(data.session.user.id);
            else setLoading(false);
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_event, s) => {
                setSession(s);
                if (s?.user) loadProfile(s.user.id);
                else {
                    setProfile(null);
                    setLoading(false);
                }
            },
        );

        return () => listener.subscription.unsubscribe();
    }, []);

    async function loadProfile(userId: string) {
        const p = await authService.getProfile(userId);
        setProfile(p);
        setLoading(false);
    }

    return {
        session,
        user: session?.user ?? null,
        profile,
        role: profile?.role ?? null,
        loading,
    };
}
