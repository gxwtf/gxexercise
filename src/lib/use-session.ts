// Iron Session Client Component with SWR

"use client"

import useSWR from "swr";
import { SessionData, defaultSession } from "./iron";
import useSWRMutation from "swr/mutation";

const sessionApiRoute =
    "/api/session";

async function fetchJson<JSON = unknown>(
    input: RequestInfo,
    init?: RequestInit,
): Promise<JSON> {
    const response = await fetch(input, {
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        ...init,
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

async function doLogin(url: string, { arg }: { arg: {username: string, password: string} }) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
        },
        body: JSON.stringify(arg),
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

function doLogout(url: string) {
    return fetchJson<SessionData>(url, {
        method: "DELETE",
    });
}

function doIncrement(url: string) {
    return fetchJson<SessionData>(url, {
        method: "PATCH",
    });
}

export default function useSession() {
    const { data: session, isLoading } = useSWR(
        sessionApiRoute,
        fetchJson<SessionData>,
        {
            fallbackData: defaultSession,
            // fallbackData 会跳过挂载时的自动重新验证，导致刷新后 Header 一直显示「登录」、
            // 「管理」菜单不出现；强制挂载时拉一次真实会话（顺带拿到 questionBankEditor 标记）
            revalidateOnMount: true,
        },
    );

    const { trigger: login } = useSWRMutation(sessionApiRoute, doLogin, {
        // 登录失败时需要重新验证以恢复正确状态
        revalidate: true,
    });
    const { trigger: logout } = useSWRMutation(sessionApiRoute, doLogout);
    const { trigger: increment } = useSWRMutation(sessionApiRoute, doIncrement);

    return { session, logout, login, increment, isLoading };
}
