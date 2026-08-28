import { supabase } from ".";

export async function signUp(params: {
    email: string;
    password: string;
    displayName?: string
}) {
    const { data, error }  = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
            data: {
                display_name: params.displayName
            }
        }
    })   

    if (error) {
        throw error;
    }

    return data;
}

export async function signIn(params: {
    email: string;
    password: string;
}) {
    const { data, error }  = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
    })   

    if (error) {
        throw error;
    }

    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}