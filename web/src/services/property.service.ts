import { supabase } from "./supabase";
import type { Property } from "../types/domain.types";

export const propertyService = {
    async list(ownerId: string): Promise<Property[]> {
        const { data, error } = await supabase
            .from("properties")
            .select("*")
            .eq("owner_id", ownerId)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
    },

    async get(id: string): Promise<Property | null> {
        const { data, error } = await supabase
            .from("properties")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async create(
        payload: Omit<Property, "id" | "created_at" | "updated_at">,
    ): Promise<Property> {
        const { data, error } = await supabase
            .from("properties")
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, payload: Partial<Property>): Promise<Property> {
        const { data, error } = await supabase
            .from("properties")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from("properties")
            .delete()
            .eq("id", id);
        if (error) throw error;
    },

    async uploadPhoto(ownerId: string, file: File): Promise<string> {
        const path = `${ownerId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from("property-photos")
            .upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage
            .from("property-photos")
            .getPublicUrl(path);
        return data.publicUrl;
    },
};
