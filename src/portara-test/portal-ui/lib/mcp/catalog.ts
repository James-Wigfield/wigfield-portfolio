// Client-safe catalog of the core portal MCP server and its tools, used to
// build per-role tool permissions. It carries only display metadata (labels,
// descriptions, groups) - no handlers or server imports - so the roles UI
// can import it without pulling the server tool registry into the browser
// bundle.
//
// This is the CORE tool set every tenant portal ships. As a tenant's own
// portal gets built out, additional (artifact-registered) servers/tools will
// stack on top; the catalog shape already supports more than one server.
//
// A tool's permission is stored on a role as the scope
// `<server.scopePrefix><tool>` (e.g. `portal.mcp.add_agent`), living in the
// same business_roles.scopes array as the portal scopes. Owner and admin are
// special-cased everywhere to hold every tool, so nothing here needs to be
// seeded onto those roles - by default the MCP is owner/admin only.
//
// tools.ts asserts at module load that the portal server here stays in sync
// with the real registry, so a newly added tool can never silently escape
// the roles toolbox. The database mirrors these grant strings in
// public.mcp_exec (migration 0012) - keep the three in step.

// The core server's groups, plus room for an app-registered server to name its
// own (HQ's support desk does - see apps/control-plane/app/lib/mcp/
// tickets-catalog.ts). `string & {}` keeps autocomplete on the known ones while
// leaving the type open, because this package must not enumerate the groups of
// servers it deliberately knows nothing about.
export type McpToolGroup =
  | "Departments"
  | "Agents"
  | "Mailbox"
  | "Office-wide"
  | "Organisation"
  | (string & {});

/**
 * How much damage a tool can do, in the terms a person granting it cares
 * about. Used by the Roles screen and by the worker task toolbelt
 * (lib/mcp/task-tools.ts) to colour-code a grant and to warn before a
 * sensitive one is handed to an agent.
 *   read      - looks, changes nothing
 *   write     - creates or edits
 *   sensitive - deletes, or changes who is allowed to do what
 */
export type McpToolRisk = "read" | "write" | "sensitive";

export type McpToolInfo = {
  /** Matches the tool's `name` in the server registry (lib/mcp/tools.ts). */
  name: string;
  label: string;
  desc: string;
  group: McpToolGroup;
  risk: McpToolRisk;
  /** Only an AGENT RUN may call this: the operation needs to know which agent
      is asking (its mailbox, its address), which it takes from the run token
      rather than from an argument. Still grantable per role, because that is
      what lets a member put it on an agent's task toolbelt - it is simply not
      served to a person's own MCP connection. */
  agentOnly?: true;
};

export type McpServer = {
  /** Stable id, also used to look the server up from a handler. */
  id: string;
  label: string;
  desc: string;
  /** Scope prefix for this server's tools: `<prefix><toolName>`. */
  scopePrefix: string;
  tools: McpToolInfo[];
};

const PORTAL_TOOLS: McpToolInfo[] = [
  // ── Departments ────────────────────────────────────────────────────────
  {
    name: "create_department",
    label: "Create department",
    desc: "Add a new coloured room to the floor.",
    group: "Departments",
    risk: "write",
  },
  {
    name: "rename_department",
    label: "Rename department",
    desc: "Change a department's name.",
    group: "Departments",
    risk: "write",
  },
  {
    name: "set_department_color",
    label: "Recolour department",
    desc: "Change a department's floor colour.",
    group: "Departments",
    risk: "write",
  },
  {
    name: "decorate_department",
    label: "Decorate department",
    desc: "Place or remove furniture in a room.",
    group: "Departments",
    risk: "write",
  },
  {
    name: "arrange_room",
    label: "Arrange room",
    desc: "Resize a room or move it next to another.",
    group: "Departments",
    risk: "write",
  },
  {
    name: "remove_department",
    label: "Remove department",
    desc: "Delete a room; its agents move elsewhere.",
    group: "Departments",
    risk: "sensitive",
  },
  // ── Agents ─────────────────────────────────────────────────────────────
  {
    name: "add_agent",
    label: "Hire agent",
    desc: "Create an agent and station it in a department.",
    group: "Agents",
    risk: "write",
  },
  {
    name: "update_agent",
    label: "Update agent brief",
    desc: "Edit an existing agent's name, objective and brief.",
    group: "Agents",
    risk: "write",
  },
  {
    name: "set_agent_status",
    label: "Halt / resume agent",
    desc: "Halt an agent or set it back to idle.",
    group: "Agents",
    risk: "write",
  },
  {
    name: "move_agent",
    label: "Move agent",
    desc: "Move an agent to a different department.",
    group: "Agents",
    risk: "write",
  },
  {
    name: "remove_agent",
    label: "Remove agent",
    desc: "Permanently delete (fire) an agent.",
    group: "Agents",
    risk: "sensitive",
  },
  // ── Mailbox ────────────────────────────────────────────────────────────
  // An agent's own email (migrations 0014 + 0050). These three are the only
  // tools in the catalog that a HUMAN connection cannot call: every one of
  // them resolves the agent from the run token, because the From address must
  // come from the run rather than from anything a model can type. Granting
  // them to a role is therefore about DELEGATION - it is what lets that member
  // put "send email" on an agent's task toolbelt.
  {
    name: "list_emails",
    label: "List conversations",
    desc: "Read the agent's own mailbox: who it is talking to, and when.",
    group: "Mailbox",
    risk: "read",
    agentOnly: true,
  },
  {
    name: "read_email_thread",
    label: "Read a conversation",
    desc: "Read the messages in one of the agent's email conversations.",
    group: "Mailbox",
    risk: "read",
    agentOnly: true,
  },
  {
    name: "send_email",
    label: "Send email",
    desc: "Reply to a conversation, or write to an approved address. Real mail, to real people.",
    group: "Mailbox",
    risk: "write",
    agentOnly: true,
  },
  // ── Office-wide ────────────────────────────────────────────────────────
  {
    name: "design_office",
    label: "Design whole office",
    desc: "Build many departments and agents in one call.",
    group: "Office-wide",
    risk: "write",
  },
  {
    name: "reset_office",
    label: "Reset office",
    desc: "Clear the entire office - every department and agent.",
    group: "Office-wide",
    risk: "sensitive",
  },
  // ── Organisation ───────────────────────────────────────────────────────
  // The read-only tools lead the group. They used to sit in a section of their
  // own called "Read", which grouped by RISK while every other section groups
  // by SUBJECT - so it was the one heading that answered a different question
  // from its neighbours, and the risk it named is already on every row as a
  // dot. Note this is presentation only: CORE_READ_ONLY_TOOLS is derived from
  // `risk`, never from `group`, so what a suggest-autonomy agent keeps is
  // untouched by how the picker files them.
  {
    name: "describe_office",
    label: "Describe office",
    desc: "Read the floor: departments, colours and the agents in each.",
    group: "Organisation",
    risk: "read",
  },
  {
    name: "list_worker_executions",
    label: "Worker history",
    desc: "Read agents' execution history - what ran, when, and how it went.",
    group: "Organisation",
    risk: "read",
  },
  {
    name: "get_company_details",
    label: "Company details",
    desc: "Read the business name, industry, size and contact details.",
    group: "Organisation",
    risk: "read",
  },
  {
    name: "list_users",
    label: "List users",
    desc: "Read the member roster - everyone in the organisation.",
    group: "Organisation",
    risk: "read",
  },
  {
    name: "list_roles",
    label: "List roles",
    desc: "Read the organisation's roles and what each one can do.",
    group: "Organisation",
    risk: "read",
  },
  {
    name: "update_company_details",
    label: "Edit company details",
    desc: "Change the business name, industry, size and contact details.",
    group: "Organisation",
    risk: "write",
  },
  {
    name: "rename_user",
    label: "Edit member names",
    desc: "Change a member's display name.",
    group: "Organisation",
    risk: "write",
  },
  {
    name: "create_role",
    label: "Create role",
    desc: "Add a new custom role.",
    group: "Organisation",
    risk: "write",
  },
  {
    name: "delete_role",
    label: "Delete role",
    desc: "Remove an unused custom role.",
    group: "Organisation",
    risk: "sensitive",
  },
  {
    name: "assign_role",
    label: "Assign roles",
    desc: "Change which role a member holds.",
    group: "Organisation",
    risk: "sensitive",
  },
  {
    name: "set_role_permissions",
    label: "Edit role permissions",
    desc: "Change what a role's permissions and MCP tools grant.",
    group: "Organisation",
    risk: "sensitive",
  },
];

/** Every MCP server whose tools are grantable per role. The core portal
    server is the first; artifact-added servers will register here over
    time. */
export const MCP_SERVERS: McpServer[] = [
  {
    id: "portal",
    label: "Portal",
    desc: "Run the portal in plain language - office, agents and organisation.",
    scopePrefix: "portal.mcp.",
    tools: PORTAL_TOOLS,
  },
];

export function getMcpServer(id: string): McpServer | undefined {
  return MCP_SERVERS.find((s) => s.id === id);
}

/** Tools a person's own MCP connection is never offered, whatever they hold.
    Derived from the flag rather than hand-listed, so adding one is a one-line
    change in one place - the same discipline CORE_READ_ONLY_TOOLS uses. */
export const AGENT_ONLY_TOOLS: string[] = MCP_SERVERS.flatMap((s) =>
  s.tools.filter((t) => t.agentOnly).map((t) => t.name),
);

const AGENT_ONLY_SET = new Set(AGENT_ONLY_TOOLS);

export function isAgentOnlyTool(name: string): boolean {
  return AGENT_ONLY_SET.has(name);
}

/** Core tools that only ever read. This is the set a `suggest`-autonomy agent
    keeps (lib/agent/models.ts asserts it matches
    internal.agent_read_only_grants() in migration 0019, so the UI can never
    promise an agent a tool the database will refuse). Derived from `risk`
    rather than hand-listed, so classifying a new tool as read-only is a
    one-line change in one place. */
export const CORE_READ_ONLY_TOOLS: string[] = MCP_SERVERS.flatMap((s) =>
  s.tools.filter((t) => t.risk === "read").map((t) => t.name),
);

/* ── Extension grants: one Allow per action, over a per-type data floor ──── */
//
// TWO SCOPE FAMILIES, AND THE SPLIT IS DELIBERATE. They answer different
// questions and they are enforced in different places.
//
//   portal.mcp.tool.<name>              THE ACTION BOUNDARY.
//     One Allow per overlay MCP tool, exactly like a core tool's grant. This
//     is what the Roles screen shows a person: a list of things Claude may DO,
//     grouped by the screen they belong to. It is as fine as the overlay
//     chooses to make it: "reschedule a job" is a different grant from
//     "cancel a job" when the overlay declares them as two tools. Checked by
//     the server before an action is offered in tools/list and again before it
//     is dispatched in tools/call.
//
//   portal.mcp.records.<type>.<read|write>   THE DATA FLOOR.
//     What the DATABASE checks on every single operation (migration 0017).
//     It cannot be finer than "may write Jobs", because the database has no
//     idea which tools an overlay ships - that declaration lives in TypeScript,
//     in the tenant's artifact. It is the backstop, not the thing a person is
//     asked to reason about.
//
// So the Roles screen stores BOTH: ticking an action writes its Allow scope
// and the record grants that action needs, and unticking it removes any record
// grant no other ticked action still needs. Nobody is asked to think about
// tables, and the database still refuses anything the role does not hold.
//
// Both live in the same `portal.mcp.` namespace as the core tool grants, so
// the DB's grant lookup (internal.mcp_grants) and the "can this role connect
// at all" test pick them up with no change and no migration. The dots make
// them impossible to confuse with a core tool name.

/** One Allow per overlay MCP tool. The action boundary. */
export const EXT_TOOL_GRANT_PREFIX = "portal.mcp.tool.";

export function extToolGrantScope(name: string): string {
  return EXT_TOOL_GRANT_PREFIX + name;
}

export function isMcpExtToolScope(scope: string): boolean {
  if (!scope.startsWith(EXT_TOOL_GRANT_PREFIX)) return false;
  // Same shape EXT_MCP_NAME_RE enforces on the declaration, restated here so
  // this package stays free of a tenant-config import.
  return /^[a-z][a-z0-9_]{0,47}$/.test(scope.slice(EXT_TOOL_GRANT_PREFIX.length));
}

export const RECORDS_GRANT_PREFIX = "portal.mcp.records.";

export type RecordsAccess = "read" | "write";

export function recordsGrantScope(type: string, access: RecordsAccess): string {
  return `${RECORDS_GRANT_PREFIX}${type}.${access}`;
}

export function isMcpDataScope(scope: string): boolean {
  if (!scope.startsWith(RECORDS_GRANT_PREFIX)) return false;
  const rest = scope.slice(RECORDS_GRANT_PREFIX.length);
  return /^[a-z0-9][a-z0-9_-]{0,62}\.(read|write)$/.test(rest);
}

/** Any grant that makes an MCP connection worth having: a core tool, one of
    the overlay's actions, or access to one of the overlay's record types. */
export function isMcpGrantScope(scope: string): boolean {
  return isMcpToolScope(scope) || isMcpExtToolScope(scope) || isMcpDataScope(scope);
}

/** The scope string that grants a role one of a server's tools. */
export function toolScope(server: McpServer, toolName: string): string {
  return server.scopePrefix + toolName;
}

/** Every grantable scope for one server, in tool order. */
export function serverToolScopes(server: McpServer): string[] {
  return server.tools.map((t) => toolScope(server, t.name));
}

/** Every grantable MCP tool scope across all servers. */
export const ALL_MCP_TOOL_SCOPES: string[] = MCP_SERVERS.flatMap(serverToolScopes);

const ALL_MCP_TOOL_SCOPE_SET = new Set(ALL_MCP_TOOL_SCOPES);

export function isMcpToolScope(scope: string): boolean {
  return ALL_MCP_TOOL_SCOPE_SET.has(scope);
}

/** Tool names of one server a role may call, from its stored scopes. Owner/
    admin get all; for them, skip this and treat access as unrestricted. */
export function allowedToolNames(server: McpServer, scopes: string[]): Set<string> {
  const names = new Set<string>();
  for (const t of server.tools) {
    if (scopes.includes(toolScope(server, t.name))) names.add(t.name);
  }
  return names;
}

/** Total MCP tools a role is granted across every server (for card summaries). */
export function grantedToolCount(scopes: string[]): number {
  let n = 0;
  for (const s of scopes) if (ALL_MCP_TOOL_SCOPE_SET.has(s)) n++;
  return n;
}

/** Total grantable tools across every server. */
export const MCP_TOOL_TOTAL = ALL_MCP_TOOL_SCOPES.length;

/** A server's tools grouped for display, preserving first-seen group order. */
export function groupServerTools(
  server: McpServer,
): { group: McpToolGroup; tools: McpToolInfo[] }[] {
  const order: McpToolGroup[] = [];
  const byGroup = new Map<McpToolGroup, McpToolInfo[]>();
  for (const t of server.tools) {
    if (!byGroup.has(t.group)) {
      byGroup.set(t.group, []);
      order.push(t.group);
    }
    byGroup.get(t.group)!.push(t);
  }
  return order.map((group) => ({ group, tools: byGroup.get(group)! }));
}
