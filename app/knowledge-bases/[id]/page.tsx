"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  type UploadProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import PageHeader from "@/components/PageHeader";
import CitationBlock from "@/components/chat/CitationBlock";
import { useAuth } from "@/hooks/useAuth";
import { useUserInfo } from "@/hooks/useUserInfo";
import {
  deleteKnowledgeBaseDocument,
  getKnowledgeBase,
  getKnowledgeBaseDocuments,
  reindexKnowledgeBaseDocument,
  searchKnowledgeBase,
  updateKnowledgeBase,
  uploadKnowledgeBaseDocument,
  type DocumentItem,
  type KnowledgeBase,
  type KnowledgeBaseVisibility,
  type SearchResultCitation,
} from "@/services/knowledge-base";

const VISIBILITY_META: Record<
  KnowledgeBaseVisibility,
  { text: string; color: string }
> = {
  private: { text: "private", color: "default" },
  team: { text: "team", color: "processing" },
  public: { text: "public", color: "success" },
};

const DOC_STATUS_META: Record<DocumentItem["status"], { text: string; color: string }> =
  {
    pending: { text: "pending", color: "default" },
    processing: { text: "processing", color: "processing" },
    ready: { text: "ready", color: "success" },
    failed: { text: "failed", color: "error" },
  };

export default function KnowledgeBaseDetailPage() {
  useAuth();
  const { message } = App.useApp();
  const userInfo = useUserInfo();
  const params = useParams<{ id: string }>();
  const kbId = Number(params.id);

  const [detail, setDetail] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reindexingId, setReindexingId] = useState<number | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibility, setVisibility] = useState<KnowledgeBaseVisibility>("private");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [citations, setCitations] = useState<SearchResultCitation[]>([]);

  const canManage = useMemo(() => {
    if (!detail || !userInfo) return false;
    return userInfo.role === "admin" || userInfo.userId === detail.userId;
  }, [detail, userInfo]);

  const loadData = useCallback(async () => {
    if (!Number.isInteger(kbId) || kbId <= 0) return;
    setLoading(true);
    try {
      const [kbRes, docsRes] = await Promise.all([
        getKnowledgeBase(kbId),
        getKnowledgeBaseDocuments(kbId),
      ]);
      setDetail(kbRes.data);
      setVisibility(kbRes.data.visibility);
      setDocuments(docsRes.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载知识库详情失败");
    } finally {
      setLoading(false);
    }
  }, [kbId, message]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleDeleteDocument(documentId: number) {
    try {
      await deleteKnowledgeBaseDocument(kbId, documentId);
      message.success("文档已删除");
      await loadData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除文档失败");
    }
  }

  async function handleSaveVisibility() {
    if (!detail || visibility === detail.visibility) return;
    setSavingVisibility(true);
    try {
      const res = await updateKnowledgeBase(kbId, { visibility });
      setDetail(res.data);
      setVisibility(res.data.visibility);
      message.success("可见性已更新");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "更新可见性失败");
    } finally {
      setSavingVisibility(false);
    }
  }

  async function handleUpload(
    option: Parameters<NonNullable<UploadProps["customRequest"]>>[0]
  ) {
    const file = option.file as File;
    setUploading(true);
    try {
      await uploadKnowledgeBaseDocument(kbId, file);
      message.success("上传成功，正在后台处理");
      option.onSuccess?.({}, new XMLHttpRequest());
      await loadData();
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error("上传失败");
      option.onError?.(uploadError);
      message.error(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleReindexDocument(documentId: number) {
    setReindexingId(documentId);
    try {
      await reindexKnowledgeBaseDocument(kbId, documentId);
      message.success("已提交重新索引，请稍后刷新查看状态");
      await loadData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "重新索引失败");
    } finally {
      setReindexingId(null);
    }
  }

  async function handleSearchPreview() {
    const trimmed = query.trim();
    if (!trimmed) {
      message.warning("请输入检索内容");
      return;
    }
    setSearching(true);
    try {
      const res = await searchKnowledgeBase(kbId, trimmed);
      const list = res.data?.citations ?? [];
      setCitations(list);
      setSearchDone(true);
      if (!list.length) {
        message.info("未检索到相关内容");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "检索失败");
    } finally {
      setSearching(false);
    }
  }

  const columns: ColumnsType<DocumentItem> = [
    { title: "文件名", dataIndex: "filename" },
    {
      title: "状态",
      dataIndex: "status",
      render: (status: DocumentItem["status"]) => (
        <Tag color={DOC_STATUS_META[status].color}>{DOC_STATUS_META[status].text}</Tag>
      ),
    },
    { title: "切片数", dataIndex: "chunkCount" },
    {
      title: "错误信息",
      dataIndex: "errorMessage",
      render: (value: string | null) => value || "-",
    },
    {
      title: "上传时间",
      dataIndex: "createdAt",
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "操作",
      render: (_, record) =>
        canManage ? (
          <Space size={4}>
            {(record.status === "ready" || record.status === "failed") && (
              <Button
                type="link"
                size="small"
                loading={reindexingId === record.id}
                onClick={() => handleReindexDocument(record.id)}
              >
                重新索引
              </Button>
            )}
            <Popconfirm
              title="确认删除该文档？"
              onConfirm={() => handleDeleteDocument(record.id)}
            >
              <Button type="link" danger size="small">
                删除
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        backHref="/knowledge-bases"
        backLabel="返回知识库列表"
        title={detail?.name || "知识库详情"}
        description={detail?.description || "管理文档、检索预览与可见性"}
      />

      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Card className="content-card" loading={loading}>
          <Space wrap size={12} style={{ width: "100%", justifyContent: "space-between" }}>
            <Space align="center" size={8}>
              <Typography.Text type="secondary">可见性</Typography.Text>
              <Tag color={detail ? VISIBILITY_META[detail.visibility].color : "default"}>
                {detail ? VISIBILITY_META[detail.visibility].text : "-"}
              </Tag>
            </Space>
            {canManage && (
              <Space size={8}>
                <Select<KnowledgeBaseVisibility>
                  value={visibility}
                  style={{ width: 160 }}
                  options={[
                    { label: "private", value: "private" },
                    { label: "team", value: "team" },
                    { label: "public", value: "public" },
                  ]}
                  onChange={setVisibility}
                />
                <Button
                  type="primary"
                  loading={savingVisibility}
                  onClick={handleSaveVisibility}
                  disabled={!detail || visibility === detail.visibility}
                >
                  保存
                </Button>
              </Space>
            )}
          </Space>
        </Card>

        <Card
          className="content-card"
          title="文档管理"
          extra={
            canManage ? (
              <Upload
                accept=".txt,.md,.pdf,.docx"
                showUploadList={false}
                customRequest={handleUpload}
                disabled={uploading}
              >
                <Button type="primary" loading={uploading}>
                  上传文档
                </Button>
              </Upload>
            ) : null
          }
        >
          <Table
            rowKey="id"
            columns={columns}
            dataSource={documents}
            loading={loading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        </Card>

        <Card className="content-card" title="检索预览">
          <Space orientation="vertical" size={12} style={{ width: "100%" }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={query}
                placeholder="输入问题，测试检索命中效果"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchDone(false);
                }}
                onPressEnter={handleSearchPreview}
              />
              <Button type="primary" loading={searching} onClick={handleSearchPreview}>
                检索
              </Button>
            </Space.Compact>
            {searchDone && citations.length === 0 && (
              <Typography.Text type="secondary">
                未找到相关内容。请确认文档状态为 ready，或尝试更换关键词。
              </Typography.Text>
            )}
            {citations.length > 0 && (
              <>
                <Typography.Text type="secondary">
                  共 {citations.length} 条命中（相似度 ≥ 55% 的片段）
                </Typography.Text>
                <CitationBlock
                  citations={citations}
                  title="检索结果"
                  showIndex
                />
              </>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
}
