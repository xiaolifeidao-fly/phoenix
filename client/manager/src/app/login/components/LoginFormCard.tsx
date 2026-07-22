"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { login } from "@/app/login/api/login.api";
import { isAuthenticated, setAuthSession } from "@/utils/auth";

interface LoginValues {
  account: string;
  password: string;
}

export function LoginFormCard() {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/manager-dashboard");
    }
  }, [router]);

  const handleFinish = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      const response = await login({
        username: values.account.trim(),
        password: values.password,
      });
      const username = response.username?.trim() || values.account.trim();
      setAuthSession(
        response.token,
        {
          username,
          displayName: response.name?.trim() || username,
          roleName: response.roleName?.trim() || "系统管理员",
        },
        true,
      );
      message.success("登录成功，正在进入后台");
      router.replace("/manager-dashboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "账号或密码有误";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="manager-login-card manager-form-skin">
      <div className="manager-login-card__brand">
        <span className="manager-login-card__crest" aria-hidden="true">
          P
        </span>
        <span className="manager-login-card__wordmark">PHOENIX</span>
      </div>

      <h1 className="manager-login-card__title">登录管理端</h1>
      <p className="manager-login-card__subtitle">使用运营账号继续</p>

      <Form<LoginValues> layout="vertical" onFinish={handleFinish} requiredMark={false} size="large">
        <Form.Item
          label="账号"
          name="account"
          rules={[{ required: true, message: "请输入登录账号" }]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[{ required: true, message: "请输入登录密码" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitting}
          className="manager-login-card__submit"
        >
          登录后台
        </Button>
      </Form>
    </div>
  );
}
