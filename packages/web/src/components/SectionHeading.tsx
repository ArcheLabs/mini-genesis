import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "default" | "compact";
  level?: 1 | 2 | 3;
  id?: string;
  className?: string;
};

export function SectionHeading({ icon, children, description, action, size = "default", level = 2, id, className = "" }: Props) {
  const Heading: "h1" | "h2" | "h3" = `h${level}` as "h1" | "h2" | "h3";
  return <header className={`section-heading section-heading-${size}${className ? ` ${className}` : ""}`}>
    <span className="section-heading-icon" aria-hidden="true">{icon}</span>
    <div className="section-heading-copy">
      <Heading id={id}>{children}</Heading>
      {description && <p>{description}</p>}
    </div>
    {action && <div className="section-heading-action">{action}</div>}
  </header>;
}
