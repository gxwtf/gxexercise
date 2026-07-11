"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import Image from "next/image"
import useSession from "@/lib/use-session"
import {useRouter, useSearchParams} from "next/navigation"
import { useAlertContext } from "@/components/alert-provider"
import { useSyncExternalStore } from "react"

const subscribeToHost = () => () => undefined
const getClientHost = () => window.location.host
const getServerHost = () => 'localhost:3000'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const { session, login } = useSession()
  const { showAlert } = useAlertContext()
  const searchParams = useSearchParams()
  const back = searchParams.get("back") || "/"
  const host = useSyncExternalStore(subscribeToHost, getClientHost, getServerHost)

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>用户登录</CardTitle>
          <CardDescription>
            在下方输入你的用户名和密码以继续
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={function (event) {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const username = formData.get("username") as string
              const password = formData.get("password") as string
              login({ username, password }, {
                optimisticData: {
                  ...session
                },
              }).then(() => {
                  showAlert({
                    type: 'normal',
                    title: '登录成功',
                    description: '欢迎回来！'
                  })
                  router.push(back)
              }).catch((error) => {
                  showAlert({
                    type: 'destructive',
                    title: '登录失败',
                    description: `请检查用户名和密码后重试。错误信息：${error.message}`
                  })
              })
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="username">用户名</FieldLabel>
                <Input id="username" name="username" type="text" placeholder="请输入用户名" required />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="text-primary">密码</FieldLabel>
                  <Link
                    href="https://gxwtf.cn/emailVerify"
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input id="password" name="password" type="password" placeholder="请输入密码" required />
              </Field>
              <Field>
                <Button type="submit">登录</Button>
                <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                  <span className="bg-card text-muted-foreground relative z-10 px-2">
                    或者通过以下方式继续
                  </span>
                </div>
                <Button variant="outline" type="button" asChild>
                <a href={`/sso/login?system=${host}&back=${back}`}>
                  <Image src="https://account.gxwtf.cn/favicon.ico" alt="广学账号" width={20} height={20} />
                  使用广学账号登录
                </a>
                </Button>
                <FieldDescription className="text-center">
                  没有账号？{" "}
                  <Link href="https://account.gxwtf.cn/register?back=http://localhost:3000/login" className="underline underline-offset-4">
                    立即注册
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
