"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Space,
  Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import PageHeader from "@/components/PageHeader";
import { useRole } from "@/hooks/useRole";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  type User,
} from "@/services/user";

interface UserFormValues {
  username: string;
  password?: string;
}

export default function UsersPage() {
  const { ready, authorized } = useRole("admin");

  if (!ready) return null;

  if (!authorized) {
    return (
      <div className="page-container">
        <div className="users-table-panel">
          <div style={{ padding: 48 }}>
            <Result
              status="403"
              title="无访问权限"
              subTitle="仅管理员可访问用户管理"
            />
          </div>
        </div>
      </div>
    );
  }

  return <UsersContent />;
}

function UsersContent() {
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<UserFormValues>();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "获取用户列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!modalOpen) return;
    if (editingUser) {
      form.setFieldsValue({ username: editingUser.username, password: "" });
    } else {
      form.resetFields();
    }
  }, [modalOpen, editingUser, form]);

  async function handleSubmit(values: UserFormValues) {
    setSubmitting(true);
    try {
      if (editingUser) {
        const payload: { username?: string; password?: string } = {
          username: values.username,
        };
        if (values.password) payload.password = values.password;
        await updateUser(editingUser.id, payload);
        message.success("更新成功");
      } else {
        await createUser({
          username: values.username,
          password: values.password!,
        });
        message.success("创建成功");
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteUser(id);
      message.success("删除成功");
      fetchUsers();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  const columns: ColumnsType<User> = [
    { title: "ID", dataIndex: "id" },
    { title: "用户名", dataIndex: "username" },
    {
      title: "角色",
      dataIndex: "role",
      render: (role: string) => (role === "admin" ? "管理员" : "普通用户"),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space size={8}>
          <Button type="link" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  function openCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setModalOpen(true);
  }

  return (
    <div className="page-container">
      <PageHeader
        title="用户管理"
        extra={
          <Button type="primary" onClick={openCreate}>
            新增
          </Button>
        }
      />

      <div className="table-responsive">
        <div className="users-table-panel">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={users}
            loading={loading}
            tableLayout="fixed"
            size="middle"
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </div>
      </div>

      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={modalOpen}
        forceRender
        centered
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width="calc(100vw - 32px)"
        style={{ maxWidth: 480 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
            rules={
              editingUser
                ? [{ min: 6, max: 20, message: "密码 6-20 位" }]
                : [
                    { required: true, message: "请输入密码" },
                    { min: 6, max: 20, message: "密码 6-20 位" },
                  ]
            }
          >
            <Input.Password
              placeholder={editingUser ? "留空则不修改密码" : "请输入密码"}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
