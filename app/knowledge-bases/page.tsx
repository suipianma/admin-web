"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBases,
  type KnowledgeBase,
  type KnowledgeBaseVisibility,
} from "@/services/knowledge-base";

interface KnowledgeBaseFormValues {
  name: string;
  description?: string;
  visibility: KnowledgeBaseVisibility;
}

const VISIBILITY_META: Record<
  KnowledgeBaseVisibility,
  { text: string; color: string }
> = {
  private: { text: "private", color: "default" },
  team: { text: "team", color: "processing" },
  public: { text: "public", color: "success" },
};

export default function KnowledgeBasesPage() {
  useAuth();
  const { message } = App.useApp();
  const [items, setItems] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<KnowledgeBaseFormValues>();

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeBases();
      setItems(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "获取知识库失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  async function handleCreate(values: KnowledgeBaseFormValues) {
    setSubmitting(true);
    try {
      await createKnowledgeBase({
        name: values.name,
        description: values.description?.trim() || undefined,
        visibility: values.visibility,
      });
      message.success("创建知识库成功");
      setModalOpen(false);
      form.resetFields();
      await fetchKnowledgeBases();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建知识库失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteKnowledgeBase(id);
      message.success("删除成功");
      await fetchKnowledgeBases();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: "名称",
      dataIndex: "name",
      render: (_, record) => (
        <Link href={`/knowledge-bases/${record.id}`}>{record.name}</Link>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      render: (value: string | null) => value || "-",
    },
    {
      title: "可见性",
      dataIndex: "visibility",
      render: (visibility: KnowledgeBaseVisibility) => (
        <Tag color={VISIBILITY_META[visibility].color}>
          {VISIBILITY_META[visibility].text}
        </Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space size={8}>
          <Link href={`/knowledge-bases/${record.id}`}>详情</Link>
          <Popconfirm
            title="确认删除该知识库？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="知识库"
        description="管理知识库与文档，支持 RAG 检索接入聊天。"
        extra={
          <Button type="primary" onClick={() => setModalOpen(true)}>
            新建知识库
          </Button>
        }
      />

      <div className="table-responsive">
        <div className="users-table-panel">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            tableLayout="fixed"
            size="middle"
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </div>
      </div>

      <Modal
        title="新建知识库"
        open={modalOpen}
        centered
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width="calc(100vw - 32px)"
        style={{ maxWidth: 520 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ visibility: "private" }}
          onFinish={handleCreate}
        >
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: "请输入名称" },
              { max: 100, message: "名称最多 100 字符" },
            ]}
          >
            <Input placeholder="例如：产品知识库" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
            rules={[{ max: 500, message: "描述最多 500 字符" }]}
          >
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
          <Form.Item
            label="可见性"
            name="visibility"
            rules={[{ required: true, message: "请选择可见性" }]}
          >
            <Select
              options={[
                { label: "private", value: "private" },
                { label: "team", value: "team" },
                { label: "public", value: "public" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
