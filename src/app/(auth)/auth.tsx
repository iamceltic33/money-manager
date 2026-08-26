import { Authorization } from "@/components/authorization";
import { useAuthStore } from "@/store/auth-store";
import { Redirect } from "expo-router";

export default function Auth() {
    const { session } = useAuthStore();
    if (session) return <Redirect href={'/'} />
    return <Authorization />
}
