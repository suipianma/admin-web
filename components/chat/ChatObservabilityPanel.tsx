"use client";

import { useMemo } from "react";
import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { ClearOutlined, RadarChartOutlined } from "@ant-design/icons";
import { useObservability } from "@/hooks/useObservability";
import { observabilityStore } from "@/lib/observability";
import type { StreamRunTrace, ToolCallTrace } from "@/lib/observability";

interface ChatObservabilityPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatMs(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function statusTag(status: StreamRunTrace["status"]) {
  const map = {
    running: { color: "processing", label: "进行中" },
    completed: { color: "success", label: "完成" },
    error: { color: "error", label: "错误" },
    cancelled: { color: "default", label: "已取消" },
  } as const;
  const item = map[status];
  return <Tag color={item.color}>{item.label}</Tag>;
}

export default function ChatObservabilityPanel({
  open,
  onClose,
}: ChatObservabilityPanelProps) {
  const { totals, activeRun, runs, recentEvents } = useObservability();

  const toolColumns = useMemo(
    () => [
      {
        title: "toolCallId",
        dataIndex: "toolCallId",
        key: "toolCallId",
        ellipsis: true,
        width: 140,
      },
      {
        title: "工具",
        dataIndex: "tool",
        key: "tool",
        width: 120,
      },
      {
        title: "延迟",
        key: "latencyMs",
        width: 90,
        render: (_: unknown, row: ToolCallTrace) => formatMs(row.latencyMs),
      },
      {
        title: "状态",
        key: "status",
        width: 80,
        render: (_: unknown, row: ToolCallTrace) => {
          const color =
            row.status === "done"
              ? "success"
              : row.status === "error"
                ? "error"
                : "processing";
          return <Tag color={color}>{row.status}</Tag>;
        },
      },
    ],
    []
  );

  const runColumns = useMemo(
    () => [
      {
        title: "streamId",
        dataIndex: "streamId",
        key: "streamId",
        ellipsis: true,
        width: 120,
      },
      {
        title: "requestId",
        dataIndex: "requestId",
        key: "requestId",
        ellipsis: true,
        width: 120,
      },
      {
        title: "延迟",
        key: "latencyMs",
        width: 80,
        render: (_: unknown, row: StreamRunTrace) => formatMs(row.latencyMs),
      },
      {
        title: "TTFT",
        key: "ttftMs",
        width: 80,
        render: (_: unknown, row: StreamRunTrace) => formatMs(row.ttftMs),
      },
      {
        title: "Tokens",
        key: "tokens",
        width: 100,
        render: (_: unknown, row: StreamRunTrace) =>
          `${row.promptTokens ?? 0} / ${row.completionTokens ?? 0}`,
      },
      {
        title: "状态",
        key: "status",
        width: 80,
        render: (_: unknown, row: StreamRunTrace) => statusTag(row.status),
      },
    ],
    []
  );

  return (
    <Drawer
      title={
        <span className="obs-panel-title">
          <RadarChartOutlined />
          Observability
        </span>
      }
      placement="right"
      size={480}
      open={open}
      onClose={onClose}
      className="chat-observability-drawer"
      extra={
        <Button
          size="small"
          icon={<ClearOutlined />}
          onClick={() => observabilityStore.clear()}
        >
          清空
        </Button>
      }
    >
      <div className="obs-panel">
        <section className="obs-section">
          <Typography.Text type="secondary" className="obs-section-label">
            会话指标
          </Typography.Text>
          <div className="obs-stats-grid">
            <Statistic title="错误率" value={totals.errorRate} suffix="%" />
            <Statistic
              title="平均延迟"
              value={formatMs(totals.avgLatencyMs)}
            />
            <Statistic title="平均 TTFT" value={formatMs(totals.avgTtftMs)} />
            <Statistic
              title="Token (P/C)"
              value={`${totals.totalPromptTokens} / ${totals.totalCompletionTokens}`}
            />
          </div>
        </section>

        <section className="obs-section">
          <Typography.Text type="secondary" className="obs-section-label">
            当前流
          </Typography.Text>
          {activeRun ? (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="requestId">
                <Typography.Text copyable={{ text: activeRun.requestId }}>
                  {activeRun.requestId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="streamId">
                <Typography.Text copyable={{ text: activeRun.streamId }}>
                  {activeRun.streamId}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {statusTag(activeRun.status)}
              </Descriptions.Item>
              <Descriptions.Item label="延迟">
                {formatMs(
                  activeRun.completedAt
                    ? activeRun.latencyMs
                    : Date.now() - activeRun.startedAt
                )}
              </Descriptions.Item>
              <Descriptions.Item label="TTFT">
                {formatMs(activeRun.ttftMs)}
              </Descriptions.Item>
              <Descriptions.Item label="Tokens">
                {activeRun.promptTokens ?? 0} prompt /{" "}
                {activeRun.completionTokens ?? 0} completion
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无活跃流" />
          )}
        </section>

        {activeRun && activeRun.toolCalls.length > 0 && (
          <section className="obs-section">
            <Typography.Text type="secondary" className="obs-section-label">
              Tool Calls
            </Typography.Text>
            <Table<ToolCallTrace>
              size="small"
              rowKey="toolCallId"
              pagination={false}
              columns={toolColumns}
              dataSource={activeRun.toolCalls}
              scroll={{ x: 420 }}
            />
          </section>
        )}

        <section className="obs-section">
          <Typography.Text type="secondary" className="obs-section-label">
            历史流 ({totals.totalRuns})
          </Typography.Text>
          <Table<StreamRunTrace>
            size="small"
            rowKey="streamId"
            pagination={{ pageSize: 5, size: "small" }}
            columns={runColumns}
            dataSource={[...runs].reverse()}
            scroll={{ x: 520 }}
          />
        </section>

        <section className="obs-section">
          <Typography.Text type="secondary" className="obs-section-label">
            事件流 ({recentEvents.length})
          </Typography.Text>
          <div className="obs-event-log">
            {[...recentEvents].reverse().slice(0, 30).map((event, index) => (
              <div key={`${event.type}-${index}`} className="obs-event-item">
                <Tag>{event.type}</Tag>
                <code className="obs-event-code">
                  {JSON.stringify(event).slice(0, 160)}
                  {JSON.stringify(event).length > 160 ? "…" : ""}
                </code>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  );
}
