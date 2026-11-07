// Iron Session Server Routes /api/session

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { defaultSession, sessionOptions } from "@/lib/iron";
import { SessionData } from "@/lib/iron";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import { isQuestionBankReviewer, syncQuestionBankReviewerProfile } from "@/lib/question-bank-auth";

// login
export async function POST(request: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const { username = "No Name", password = "123456" } = (await request.json()) as {
        username: string;
        password: string;
    };

    try {
        const res = await axios.post(`${process.env.GXACCOUNT_URL}/sso/purelogin`, {
            username,
            password,
        });

        if (res.status === 200) {
            await prisma.user.upsert({
                where: { id: res.data.userId },
                update: res.data.userName ? { userName: res.data.userName } : {},
                create: { id: res.data.userId, userName: res.data.userName ?? null },
            });
            session.isLoggedIn = true;
            session.username = res.data.userName;
            session.userid = res.data.userId;
            session.admin = res.data.admin;
            session.real_name = res.data.userRealName;
            session.email = res.data.userEmail;
            session.grade = res.data.grade || 7;
            session.counter = 0;
            await session.save();

            // 审核名单里如果已有这个用户名，顺手同步 userId / 年级（用于头像、年级展示）
            await syncQuestionBankReviewerProfile(res.data.userId, res.data.userName, res.data.grade);

            // 题库审核名单是站内维护的，不在 SSO 里，这里顺带算一下（只用于显示入口）
            const questionBankEditor =
                Boolean(session.admin) || (await isQuestionBankReviewer(session.username));
            return Response.json({ ...session, questionBankEditor });
        }
        else {
            // 登录失败，不保存session，直接返回默认session
            return Response.json(defaultSession, { status: 401 });
        }
    } catch (e) {
        console.error(e);
        return Response.json(defaultSession, { status: 401 });
    }
}

export async function PATCH() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    session.counter = (session.counter ?? 0) + 1;
    await session.save();

    return Response.json(session);
}

// read session
export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn) {
        return Response.json(defaultSession);
    }

    // 题库管理权限 = 网站管理员 或 题库审核名单成员（名单可能随时变化，所以每次查一下）
    const questionBankEditor =
        Boolean(session.admin) || (await isQuestionBankReviewer(session.username));
    return Response.json({ ...session, questionBankEditor });
}

// logout
export async function DELETE() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    session.destroy();

    return Response.json(defaultSession);
}
