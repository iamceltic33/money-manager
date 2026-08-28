import { Authorization } from "@/features/auth";
import { useAuthStore } from "@/features/auth";
import { Redirect } from "expo-router";

export default function Auth() {
    const { session } = useAuthStore();
    if (session) return <Redirect href={'/'} />
    return <Authorization />
}
