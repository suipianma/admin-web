import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

// AI 回复 Markdown 渲染
export default function ChatMarkdown({
  content,
  className,
}: ChatMarkdownProps) {
  return (
    <div className={`chat-markdown ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
