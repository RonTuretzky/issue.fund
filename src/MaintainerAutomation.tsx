import { Mail } from "lucide-react";
import { maintainerAutomation } from "../shared/documentation.mjs";

export function MaintainerAutomation() {
  const contact = maintainerAutomation.links[0];
  return (
    <aside
      className="maintainer-service"
      aria-label={maintainerAutomation.title}
    >
      <div>
        <h2>{maintainerAutomation.title}</h2>
        <p>{maintainerAutomation.paragraphs[0]}</p>
      </div>
      <a href={contact.url}>
        <Mail size={18} aria-hidden="true" />
        <span>{contact.label}</span>
      </a>
    </aside>
  );
}
