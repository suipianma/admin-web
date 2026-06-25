"use client";

import { ReadOutlined } from "@ant-design/icons";
import { Typography } from "antd";

/** 知识库检索引用展示（聊天页 / 检索预览共用） */
export interface CitationItem {
  chunkId: number;
  documentName: string;
  page?: number | null;
  snippet: string;
  score: number;
}

interface CitationBlockProps {
  citations: CitationItem[];
  /** 区块标题，默认「知识库检索命中」 */
  title?: string;
  /** 是否显示 [资料1] 序号 */
  showIndex?: boolean;
}

export default function CitationBlock({
  citations,
  title = "知识库检索命中",
  showIndex = false,
}: CitationBlockProps) {
  if (citations.length === 0) return null;

  return (
    <div className="chat-citation-block">
      <div className="chat-citation-block-title">
        <ReadOutlined />
        <span>{title}</span>
      </div>
      <div className="chat-citation-list">
        {citations.map((item, index) => (
          <div key={item.chunkId} className="chat-citation-item">
            <div className="chat-citation-head">
              {showIndex && (
                <span className="chat-citation-index">资料{index + 1}</span>
              )}
              <span className="chat-citation-doc">{item.documentName || "未知文档"}</span>
              {item.page != null && (
                <span className="chat-citation-page">第 {item.page} 页</span>
              )}
              <span className="chat-citation-score">
                相关度 {(item.score * 100).toFixed(0)}%
              </span>
            </div>
            <Typography.Paragraph
              className="chat-citation-snippet"
              ellipsis={{ rows: 4, expandable: true, symbol: "展开" }}
              style={{ marginBottom: 0 }}
            >
              {item.snippet || "（无摘要）"}
            </Typography.Paragraph>
          </div>
        ))}
      </div>
    </div>
  );
}
