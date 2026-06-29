import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export default function PageHeader({
  title,
  description,
  extra,
  backHref,
  backLabel = "返回",
}: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        {backHref && (
          <Link href={backHref} className="page-header-back">
            ← {backLabel}
          </Link>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {extra && <div className="page-header-extra">{extra}</div>}
    </div>
  );
}
