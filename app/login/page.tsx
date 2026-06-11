"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Form, Input, message } from "antd";
import { login } from "@/services/auth";
import { setRefreshToken, setToken } from "@/utils/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogin(values: { username: string; password: string }) {
    setLoading(true);
    try {
      const res = await login(values.username, values.password);
      setToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      message.success("登录成功");
      router.replace("/dashboard");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo">AI</div>
          <h1 className="auth-card-title">登录</h1>
          <p className="auth-card-desc">AI 后台管理系统</p>
        </div>
        <div className="auth-card-body">
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, message: "密码至少 6 位" },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>
            <div className="auth-footer">
              还没有账号？
              <Link href="/register">去注册</Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
