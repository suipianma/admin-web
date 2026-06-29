"use client";

import { useState } from "react";
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Spin,
} from "antd";
import type { MenuProps } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  PushpinOutlined,
} from "@ant-design/icons";
import type { Conversation } from "@/services/conversation";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  loading: boolean;
  disabled?: boolean;
  streamingIds?: number[];
  onSelect: (id: number) => void;
  onCreate: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onDeleteAll?: () => void;
  onPin?: (id: number, pinned: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  loading,
  disabled = false,
  streamingIds = [],
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDeleteAll,
  onPin,
  searchQuery = "",
  onSearchChange,
}: ConversationSidebarProps) {
  const [renameTarget, setRenameTarget] = useState<Conversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  function openRename(conv: Conversation) {
    setRenameTarget(conv);
    setRenameTitle(conv.title);
  }

  function handleRenameOk() {
    if (!renameTarget) return;
    const title = renameTitle.trim();
    if (!title) return;
    onRename(renameTarget.id, title);
    setRenameTarget(null);
  }

  function handleRenameCancel() {
    setRenameTarget(null);
    setRenameTitle("");
  }

  function handleDeleteOk() {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
  }

  function getMenuItems(conv: Conversation): MenuProps["items"] {
    const pinned = Boolean(conv.pinnedAt);
    return [
      {
        key: "pin",
        icon: <PushpinOutlined />,
        label: pinned ? "取消置顶" : "置顶",
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          onPin?.(conv.id, !pinned);
        },
      },
      {
        key: "rename",
        icon: <EditOutlined />,
        label: "重命名",
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          openRename(conv);
        },
      },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        danger: true,
        label: "删除",
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          setDeleteTarget(conv);
        },
      },
    ];
  }

  return (
    <>
      <div className="conv-sidebar">
        <div className="conv-sidebar-header">
          <div className="conv-sidebar-brand">
            <MessageOutlined />
            <span>对话</span>
          </div>
          <Button
            type="primary"
            className="conv-new-btn"
            icon={<PlusOutlined />}
            block
            disabled={disabled}
            onClick={onCreate}
          >
            新建会话
          </Button>
          {onSearchChange && (
            <Input.Search
              allowClear
              placeholder="搜索会话"
              value={searchQuery}
              disabled={disabled}
              onChange={(e) => onSearchChange(e.target.value)}
              className="conv-search-input"
            />
          )}
        </div>

        <div className="conv-list">
          {loading ? (
            <div className="conv-list-loading">
              <Spin size="small" />
            </div>
          ) : conversations.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无会话"
              className="conv-list-empty"
            />
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              const isStreaming = streamingIds.includes(conv.id);

              return (
                <div
                  key={conv.id}
                  className={`conv-item${isActive ? " conv-item-active" : ""}`}
                  onClick={() => {
                    if (!disabled && conv.id !== activeId) {
                      onSelect(conv.id);
                    }
                  }}
                >
                  <span className="conv-item-icon">
                    {conv.pinnedAt ? <PushpinOutlined /> : <MessageOutlined />}
                  </span>
                  <span className="conv-item-title" title={conv.title}>
                    {conv.title}
                    {isStreaming && (
                      <span className="conv-item-streaming">···</span>
                    )}
                  </span>
                  <Dropdown
                    menu={{ items: getMenuItems(conv) }}
                    trigger={["click"]}
                    disabled={disabled}
                  >
                    <Button
                      type="text"
                      size="small"
                      className="conv-item-menu"
                      icon={<MoreOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Dropdown>
                </div>
              );
            })
          )}
        </div>

        {onDeleteAll && conversations.length > 0 && (
          <div className="conv-sidebar-footer">
            <Button
              danger
              block
              className="conv-delete-all-btn"
              icon={<DeleteOutlined />}
              disabled={disabled}
              onClick={() => setDeleteAllOpen(true)}
            >
              删除全部会话
            </Button>
          </div>
        )}
      </div>

      <Modal
        title="重命名会话"
        open={!!renameTarget}
        okText="保存"
        cancelText="取消"
        onOk={handleRenameOk}
        onCancel={handleRenameCancel}
        destroyOnHidden
      >
        <Input
          value={renameTitle}
          maxLength={100}
          placeholder="请输入会话标题"
          onChange={(e) => setRenameTitle(e.target.value)}
          onPressEnter={handleRenameOk}
        />
      </Modal>

      <Modal
        title="确定删除此会话？"
        open={!!deleteTarget}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={handleDeleteOk}
        onCancel={handleDeleteCancel}
        destroyOnHidden
      >
        <p style={{ margin: 0, color: "rgba(0,0,0,0.65)" }}>
          删除后消息不可恢复
        </p>
      </Modal>
      <Modal
        title="确定删除全部会话？"
        open={deleteAllOpen}
        okText="全部删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={() => {
          setDeleteAllOpen(false);
          onDeleteAll?.();
        }}
        onCancel={() => setDeleteAllOpen(false)}
        destroyOnHidden
      >
        <p style={{ margin: 0, color: "rgba(0,0,0,0.65)" }}>
          将清空所有会话及消息，且不可恢复
        </p>
      </Modal>
    </>
  );
}
