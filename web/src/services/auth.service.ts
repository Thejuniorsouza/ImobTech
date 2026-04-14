import { supabase } from "./supabase";
import type { Profile } from "../types/domain.types";
import { UserRole } from "../lib/constants";

export const authService = {
    async signUp(
        email: string,
        password: string,
        fullName: string,
        cpf: string,
        role: UserRole,
    ) {
        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, cpf, role },
                emailRedirectTo: `${window.location.origin}/verify-email`,
            },
        });
    },

    async signIn(email: string, password: string) {
        return supabase.auth.signInWithPassword({ email, password });
    },

    async signOut() {
        return supabase.auth.signOut();
    },

    async getSession() {
        return supabase.auth.getSession();
    },

    onAuthStateChange(
        callback: Parameters<typeof supabase.auth.onAuthStateChange>[0],
    ) {
        return supabase.auth.onAuthStateChange(callback);
    },

    async getProfile(userId: string): Promise<Profile | null> {
        const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();
        return data;
    },

    async updateProfile(
        userId: string,
        data: Partial<
            Pick<
                Profile,
                | "full_name"
                | "phone"
                | "rg"
                | "address"
                | "nationality"
                | "marital_status"
                | "profession"
            >
        >,
    ): Promise<Profile> {
        const { data: result, error } = await supabase
            .from("profiles")
            .update(data)
            .eq("id", userId)
            .select()
            .single();
        if (error) throw error;
        return result;
    },
};
