"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Form, Input, message } from "antd";
import { register } from "@/services/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRegister(values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) {
    setLoading(true);
    try {
      await register(values.username, values.password);
      message.success("注册成功，请登录");
      router.replace("/login");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "注册失败");
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
          <h1 className="auth-card-title">注册</h1>
          <p className="auth-card-desc">创建你的管理账号</p>
        </div>
        <div className="auth-card-body">
          <Form layout="vertical" onFinish={handleRegister}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: "请输入用户名" },
                { min: 3, max: 20, message: "用户名 3-20 位" },
              ]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, max: 20, message: "密码 6-20 位" },
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            <Form.Item
              label="确认密码"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "请确认密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("两次密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请再次输入密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                注册
              </Button>
            </Form.Item>
            <div className="auth-footer">
              已有账号？
              <Link href="/login">去登录</Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
