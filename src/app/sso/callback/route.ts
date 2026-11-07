// Iron Session SSO Login Route /sso/callback

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/iron";
import { SessionData } from "@/lib/iron";
import axios from "axios";
import { prisma } from "@/lib/prisma";
import { syncQuestionBankReviewerProfile } from "@/lib/question-bank-auth";

// login
export async function GET(request: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const { token, back } = queryParams;

    try {
        const res = await axios.post(`${process.env.GXACCOUNT_URL}/sso/verify`, {
            token,
        });

        if (res.status === 200) {
            // login complete
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

            // 审核名单里如果已有这个用户名，顺手同步 userId / 年级（头像、年级展示用）
            await syncQuestionBankReviewerProfile(res.data.userId, res.data.userName, res.data.grade);

            return NextResponse.redirect(new URL(back + '?alert=登录成功&alerttype=normal&alertsec=欢迎回来！', 'http://'+host), 302);
        }
        else {
            return NextResponse.redirect(new URL('/login?back='+back + '&alert=单点登录失败&alerttype=destructive&alertsec=请尝试重新登录或使用用户名和密码登录', 'http://'+host), 302);
        }
    } catch (e) {
        console.error(e);
        return NextResponse.redirect(new URL('/login?back='+back + '&alert=单点登录失败&alerttype=destructive&alertsec=请尝试重新登录或使用用户名和密码登录。错误信息：'+e, 'http://'+host), 302);
    }
}
