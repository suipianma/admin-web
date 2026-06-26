"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import { getConversations, type Conversation } from "@/services/conversation";
import {
  createMemory,
  forgetMemory,
  getMemories,
  type Memory,
  type MemoryScope,
  type MemoryType,
} from "@/services/memory";

interface MemoryFormValues {
  scope: MemoryScope;
  type: MemoryType;
  category: string;
  content: string;
  importance?: number;
  expiresAt?: Dayjs;
  sourceConversationId?: number;
  ownerUserId?: number;
}

interface FilterValues {
  query?: string;
  scope?: MemoryScope;
  type?: MemoryType;
  category?: string;
}

const SCOPE_META: Record<MemoryScope, { text: string; color: string }> = {
  USER: { text: "私有", color: "blue" },
  CONVERSATION: { text: "会话", color: "purple" },
  GLOBAL: { text: "全局", color: "gold" },
};

const MEMORY_TYPE_OPTIONS: { label: string; value: MemoryType }[] = [
  { label: "偏好 PREFERENCE", value: "PREFERENCE" },
  { label: "事实 FACT", value: "FACT" },
  { label: "画像 PROFILE", value: "PROFILE" },
  { label: "消息 MESSAGE", value: "MESSAGE" },
  { label: "摘要 SUMMARY", value: "SUMMARY" },
  { label: "提示 PROMPT", value: "PROMPT" },
  { label: "策略 POLICY", value: "POLICY" },
  { label: "RAG", value: "RAG" },
  { label: "其他 OTHER", value: "OTHER" },
];

function canForgetMemory(memory: Memory, userId: number, role: string) {
  if (role === "admin") {
    return true;
  }
  return memory.scope === "USER" && memory.ownerUserId === userId;
}

export default function MemoriesPage() {
  useAuth();
  const userInfo = useUserInfo();
  const { message } = App.useApp();

  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});

  const [form] = Form.useForm<MemoryFormValues>();
  const [filterForm] = Form.useForm<FilterValues>();

  const isAdmin = userInfo?.role === "admin";
  const watchedScope = Form.useWatch("scope", form);

  const scopeOptions = useMemo(() => {
    const options = [
      { label: "私有 USER", value: "USER" as MemoryScope },
      { label: "会话 CONVERSATION", value: "CONVERSATION" as MemoryScope },
    ];
    if (isAdmin) {
      options.push({ label: "全局 GLOBAL", value: "GLOBAL" });
    }
    return options;
  }, [isAdmin]);

  const fetchMemories = useCallback(async (nextFilters: FilterValues = {}) => {
      setLoading(true);
      try {
        const res = await getMemories({
          query: nextFilters.query?.trim() || undefined,
          scope: nextFilters.scope,
          type: nextFilters.type,
          category: nextFilters.category?.trim() || undefined,
          limit: 50,
        });
        setItems(res.data);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "获取记忆列表失败");
      } finally {
        setLoading(false);
      }
    }, [message]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations();
      setConversations(res.data);
    } catch {
      // 会话列表加载失败不阻断记忆页主流程
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    if (modalOpen) {
      void fetchConversations();
    }
  }, [modalOpen, fetchConversations]);

  async function handleSearch(values: FilterValues) {
    setFilters(values);
    await fetchMemories(values);
  }

  async function handleResetFilters() {
    filterForm.resetFields();
    const empty: FilterValues = {};
    setFilters(empty);
    await fetchMemories(empty);
  }

  async function handleCreate(values: MemoryFormValues) {
    setSubmitting(true);
    try {
      await createMemory({
        scope: values.scope,
        type: values.type,
        category: values.category.trim(),
        content: values.content.trim(),
        importance: values.importance,
        expiresAt: values.expiresAt?.toISOString(),
        sourceConversationId:
          values.scope === "CONVERSATION" ? values.sourceConversationId : undefined,
        ownerUserId: isAdmin ? values.ownerUserId : undefined,
      });
      message.success("创建记忆成功");
      setModalOpen(false);
      form.resetFields();
      await fetchMemories();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "创建记忆失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForget(id: number) {
    try {
      await forgetMemory(id);
      message.success("已遗忘该记忆");
      await fetchMemories();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "遗忘失败");
    }
  }

  function openCreateModal() {
    form.setFieldsValue({
      scope: "USER",
      type: "FACT",
      importance: 50,
    });
    setModalOpen(true);
  }

  const columns: ColumnsType<Memory> = [
    { title: "ID", dataIndex: "id", width: 72 },
    {
      title: "范围",
      dataIndex: "scope",
      width: 88,
      render: (scope: MemoryScope) => (
        <Tag color={SCOPE_META[scope].color}>{SCOPE_META[scope].text}</Tag>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      width: 120,
      render: (type: MemoryType) => <Tag>{type}</Tag>,
    },
    {
      title: "分类",
      dataIndex: "category",
      width: 120,
      ellipsis: true,
    },
    {
      title: "内容",
      dataIndex: "content",
      ellipsis: true,
      render: (value: string) => value,
    },
    {
      title: "重要度",
      dataIndex: "importance",
      width: 80,
    },
    {
      title: "归属用户",
      dataIndex: "ownerUserId",
      width: 96,
    },
    {
      title: "会话 ID",
      dataIndex: "sourceConversationId",
      width: 88,
      render: (value: number | null) => value ?? "-",
    },
    {
      title: "过期时间",
      dataIndex: "expiresAt",
      width: 168,
      render: (value: string | null) =>
        value ? new Date(value).toLocaleString() : "-",
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      width: 168,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "操作",
      width: 88,
      fixed: "right",
      render: (_, record) => {
        if (!userInfo || !canForgetMemory(record, userInfo.userId, userInfo.role)) {
          return "-";
        }
        return (
          <Popconfirm
            title="确认遗忘该记忆？"
            description="遗忘后不会再进入 AI 上下文。"
            onConfirm={() => handleForget(record.id)}
          >
            <Button type="link" danger size="small">
              遗忘
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="记忆管理"
        description="管理 AI 长期/会话记忆，支持按范围检索与遗忘。"
        extra={
          <Button type="primary" onClick={openCreateModal}>
            新建记忆
          </Button>
        }
      />

      <div className="users-table-panel" style={{ marginBottom: 16 }}>
        <Form
          form={filterForm}
          layout="inline"
          onFinish={handleSearch}
          style={{ rowGap: 12 }}
        >
          <Form.Item name="query" label="关键词">
            <Input allowClear placeholder="搜索内容" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="scope" label="范围">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 140 }}
              options={[
                { label: "私有", value: "USER" },
                { label: "会话", value: "CONVERSATION" },
                { label: "全局", value: "GLOBAL" },
              ]}
            />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 160 }}
              options={MEMORY_TYPE_OPTIONS}
            />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input allowClear placeholder="例如：偏好" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={() => void handleResetFilters()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <div className="table-responsive">
        <div className="users-table-panel">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            tableLayout="fixed"
            size="middle"
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </div>
      </div>

      <Modal
        title="新建记忆"
        open={modalOpen}
        centered
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width="calc(100vw - 32px)"
        style={{ maxWidth: 560 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scope: "USER", type: "FACT", importance: 50 }}
          onFinish={handleCreate}
        >
          <Form.Item
            label="范围"
            name="scope"
            rules={[{ required: true, message: "请选择范围" }]}
          >
            <Select options={scopeOptions} />
          </Form.Item>

          {watchedScope === "CONVERSATION" && (
            <Form.Item
              label="关联会话"
              name="sourceConversationId"
              rules={[{ required: true, message: "请选择会话" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择会话"
                options={conversations.map((item) => ({
                  label: `#${item.id} ${item.title}`,
                  value: item.id,
                }))}
              />
            </Form.Item>
          )}

          {isAdmin && watchedScope === "GLOBAL" && (
            <Form.Item label="归属用户 ID" name="ownerUserId">
              <InputNumber min={1} style={{ width: "100%" }} placeholder="默认当前用户" />
            </Form.Item>
          )}

          <Form.Item
            label="类型"
            name="type"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select options={MEMORY_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            rules={[
              { required: true, message: "请输入分类" },
              { max: 100, message: "分类最多 100 字符" },
            ]}
          >
            <Input placeholder="例如：偏好、任务、组织政策" />
          </Form.Item>

          <Form.Item
            label="内容"
            name="content"
            rules={[
              { required: true, message: "请输入内容" },
              { max: 5000, message: "内容最多 5000 字符" },
            ]}
          >
            <Input.TextArea rows={4} placeholder="记忆正文" />
          </Form.Item>

          <Form.Item label="重要度" name="importance">
            <InputNumber min={1} max={100} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="过期时间" name="expiresAt">
            <DatePicker
              showTime
              style={{ width: "100%" }}
              disabledDate={(current) => !!current && current < dayjs().startOf("day")}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
