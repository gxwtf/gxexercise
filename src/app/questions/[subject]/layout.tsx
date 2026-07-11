// 分学科第二层布局

import SubHeader from "@/components/layout/SubHeader";
import Footer from "@/components/layout/Footer";
import { routeToSubject } from "@/constants/subjects";

export default async function SubLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ subject: string }>;
}>) {
    const { subject } = await params;
    return (
        <>
            <SubHeader subject={routeToSubject[subject] || subject} />
            <main className="flex-1">
                {children}
            </main>
            <Footer />
        </>
    );
}