// Iron Session Options

import { SessionOptions } from "iron-session";

export interface SessionData {
    username: string;
    isLoggedIn: boolean;
    counter: number;
    email: string;
    userid: number;
    admin: boolean;
    /** 题库审核名单成员（前端只用来决定是否显示「题库管理」入口，服务端会重新校验） */
    questionBankEditor?: boolean;
    real_name: string;
    grade: number;
}

export const defaultSession: SessionData = {
    username: "",
    isLoggedIn: false,
    counter: 0,
    email: "",
    userid: 0,
    admin: false,
    questionBankEditor: false,
    real_name: "",
    grade: 0,
};

export const sessionOptions: SessionOptions = {
    password: process.env.SES_SECRET as string,
    cookieName: "gxexercise_session",
    cookieOptions: {
        secure: process.env.NODE_ENV === "production",
    },
};
