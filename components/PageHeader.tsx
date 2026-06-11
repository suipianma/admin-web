import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  extra,
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
