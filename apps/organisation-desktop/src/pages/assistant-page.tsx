import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BookOpen, Plus, Search, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, User } from "lucide-react";
import type { AssistantActionRequest, AssistantConversation, AssistantMessage } from "@nexora/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Reveal, useToast } from "@nexora/ui";
import { NexoraApiError } from "@nexora/api-client";
import { AppShell } from "../components/app-shell";
import { apiClient } from "../lib/api-client";
import { decodeAccessToken } from "../lib/jwt";
import { useAuthStore } from "../store/auth-store";

const textareaClassName =
  "flex w-full resize-none rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

const selectClassName =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function AssistantPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showKnowledgeSearch, setShowKnowledgeSearch] = useState(false);
  const [showKnowledgeManage, setShowKnowledgeManage] = useState(false);
  const [showActions, setShowActions] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Reveal>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Powered by SAPOK AI. Every reply today is an honest placeholder — see the notice in each response — while real usage data accumulates for a future trained model.
              </p>
            </div>
            <div className="flex gap-2">
              {hasPermission("assistant:manage_knowledge") && (
                <Button variant="outline" size="sm" onClick={() => setShowKnowledgeManage((value) => !value)}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Manage knowledge
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowKnowledgeSearch((value) => !value)}>
                <Search className="mr-2 h-4 w-4" />
                Knowledge search
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowActions((value) => !value)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Actions
              </Button>
            </div>
          </div>
        </Reveal>

        {showActions && (
          <Reveal delayMs={20}>
            <ActionsCard />
          </Reveal>
        )}

        {showKnowledgeManage && (
          <Reveal delayMs={30}>
            <KnowledgeManageCard />
          </Reveal>
        )}

        {showKnowledgeSearch && (
          <Reveal delayMs={40}>
            <KnowledgeSearchCard />
          </Reveal>
        )}

        <Reveal delayMs={60}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
            <div className="flex flex-col gap-4">
              <ConversationList activeId={activeConversationId} onSelect={setActiveConversationId} />
              <FeedbackSummaryCard />
            </div>
            <ConversationThread conversationId={activeConversationId} />
          </div>
        </Reveal>
      </div>
    </AppShell>
  );
}

function ConversationList({ activeId, onSelect }: { activeId: string | null; onSelect: (id: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const conversationsQuery = useQuery({ queryKey: ["assistant-conversations"], queryFn: () => apiClient.assistant.listConversations() });

  const createMutation = useMutation({
    mutationFn: () => apiClient.assistant.createConversation({}),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
      onSelect(conversation.id);
    },
    onError: (error) => toast({ title: "Could not start a new conversation", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  return (
    <Card className="flex h-[32rem] flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Conversations</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pt-0">
        {conversationsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {conversationsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet — start one above.</p>}
        <div className="flex flex-col gap-1">
          {conversationsQuery.data?.map((conversation: AssistantConversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activeId === conversation.id ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              {conversation.title ?? "Untitled conversation"}
              <div className="text-xs text-muted-foreground">{new Date(conversation.updatedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationThread({ conversationId }: { conversationId: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery({
    queryKey: ["assistant-conversation", conversationId],
    queryFn: () => apiClient.assistant.getConversation(conversationId!),
    enabled: !!conversationId,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiClient.assistant.postMessage(conversationId!, { content }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["assistant-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
    onError: (error) => toast({ title: "Message failed to send", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationQuery.data?.messages.length]);

  if (!conversationId) {
    return (
      <Card className="flex h-[32rem] items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a conversation, or start a new one.</p>
      </Card>
    );
  }

  return (
    <Card className="flex h-[32rem] flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto pt-4">
        {conversationQuery.data?.messages.map((message: AssistantMessage) => <MessageBubble key={message.id} message={message} />)}
        <div ref={bottomRef} />
      </CardContent>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          className={textareaClassName}
          rows={2}
          placeholder="Ask the assistant…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim()) sendMutation.mutate(draft.trim());
            }
          }}
        />
        <Button onClick={() => draft.trim() && sendMutation.mutate(draft.trim())} disabled={sendMutation.isPending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function MessageBubble({ message }: { message: AssistantMessage }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isUser = message.role === "user";
  // Local only: which way this person rated it in this session. SAPOK AI
  // upserts (rating again updates the one row), so there's no server-side
  // "my rating" read to hydrate from — this just reflects what was clicked.
  const [rated, setRated] = useState<"UP" | "DOWN" | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (rating: "UP" | "DOWN") => apiClient.assistant.submitMessageFeedback(message.conversationId, message.id, { rating }),
    onSuccess: (_result, rating) => {
      setRated(rating);
      queryClient.invalidateQueries({ queryKey: ["assistant-feedback-summary"] });
    },
    onError: (error) => toast({ title: "Could not save feedback", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${isUser ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"}`}>
        {message.content}
        {message.provider && <div className="mt-1 text-xs opacity-60">{message.provider}</div>}
        {!isUser && (
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Helpful"
              disabled={feedbackMutation.isPending}
              onClick={() => feedbackMutation.mutate("UP")}
              className={`rounded p-1 transition-colors hover:bg-background/60 ${rated === "UP" ? "text-emerald-500" : "text-muted-foreground"}`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Not helpful"
              disabled={feedbackMutation.isPending}
              onClick={() => feedbackMutation.mutate("DOWN")}
              className={`rounded p-1 transition-colors hover:bg-background/60 ${rated === "DOWN" ? "text-red-500" : "text-muted-foreground"}`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackSummaryCard() {
  const summaryQuery = useQuery({ queryKey: ["assistant-feedback-summary"], queryFn: () => apiClient.assistant.getFeedbackSummary() });
  const rows = summaryQuery.data?.byProvider ?? [];
  const up = rows.reduce((total, row) => total + row.upCount, 0);
  const down = rows.reduce((total, row) => total + row.downCount, 0);
  const total = up + down;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Reply feedback</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {total === 0 ? (
          <p className="text-muted-foreground">No replies rated yet — use the thumbs under any assistant reply.</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="text-foreground">
                <ThumbsUp className="mr-1 inline h-4 w-4 text-emerald-500" />
                {up}
              </span>
              <span className="text-foreground">
                <ThumbsDown className="mr-1 inline h-4 w-4 text-red-500" />
                {down}
              </span>
              <span className="text-muted-foreground">{Math.round((up / total) * 100)}% helpful</span>
            </div>
            {rows.map((row) => (
              <div key={row.provider ?? "unknown"} className="text-xs text-muted-foreground">
                {row.provider ?? "Unknown provider"}: {row.upCount} up / {row.downCount} down
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const ACTION_STATUS_VARIANT: Record<AssistantActionRequest["status"], "default" | "success" | "danger" | "outline"> = {
  PENDING_APPROVAL: "outline",
  APPROVED: "outline",
  REJECTED: "danger",
  EXECUTED: "success",
  FAILED: "danger",
};

function ActionsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUserId = accessToken ? decodeAccessToken(accessToken)?.sub : undefined;

  const [toolName, setToolName] = useState("");
  const [payrollRunId, setPayrollRunId] = useState("");
  const [reasoning, setReasoning] = useState("");

  const toolsQuery = useQuery({ queryKey: ["assistant-action-tools"], queryFn: () => apiClient.assistant.listActionTools() });
  const actionsQuery = useQuery({ queryKey: ["assistant-actions"], queryFn: () => apiClient.assistant.listActions() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assistant-actions"] });
  const onError = (title: string) => (error: unknown) => toast({ title, description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" });

  const proposeMutation = useMutation({
    mutationFn: () => apiClient.assistant.proposeAction({ toolName, arguments: { payrollRunId }, reasoning: reasoning || undefined }),
    onSuccess: () => {
      setToolName("");
      setPayrollRunId("");
      setReasoning("");
      invalidate();
      toast({ title: "Action proposed — awaiting a different authorised user's approval", variant: "success" });
    },
    onError: onError("Could not propose action"),
  });

  const approveMutation = useMutation({ mutationFn: (id: string) => apiClient.assistant.approveAction(id), onSuccess: invalidate, onError: onError("Could not approve action") });
  const rejectMutation = useMutation({ mutationFn: (id: string) => apiClient.assistant.rejectAction(id), onSuccess: invalidate, onError: onError("Could not reject action") });
  const executeMutation = useMutation({ mutationFn: (id: string) => apiClient.assistant.executeAction(id), onSuccess: invalidate, onError: onError("Could not execute action") });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Real business actions, gated the same way as everywhere else in NEXORA: proposing, approving, and executing all require the exact permission the underlying action needs
          (e.g. <code>payroll:disburse</code>). A proposal can never be approved by the same person who made it — a different authorised user has to review it.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="action-tool">Action</Label>
          <select id="action-tool" className={selectClassName} value={toolName} onChange={(event) => setToolName(event.target.value)}>
            <option value="">Select an action…</option>
            {toolsQuery.data?.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {tool.name} — {tool.description}
              </option>
            ))}
          </select>
        </div>
        {toolName === "disburse_payroll_run" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="action-payroll-run-id">Payroll run ID</Label>
            <Input id="action-payroll-run-id" value={payrollRunId} onChange={(event) => setPayrollRunId(event.target.value)} placeholder="Paste the payroll run's id" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="action-reasoning">Reasoning (optional)</Label>
          <Input id="action-reasoning" value={reasoning} onChange={(event) => setReasoning(event.target.value)} placeholder="Why this action is needed" />
        </div>
        <Button className="self-start" onClick={() => toolName && proposeMutation.mutate()} disabled={proposeMutation.isPending || !toolName}>
          Propose
        </Button>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {actionsQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No actions proposed yet.</p>}
          {actionsQuery.data?.map((action) => {
            const isOwnProposal = action.proposedById === currentUserId;
            return (
              <div key={action.id} className="rounded-md border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{action.toolName}</span>
                  <Badge variant={ACTION_STATUS_VARIANT[action.status]}>{action.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(action.createdAt).toLocaleString()}</span>
                </div>
                {action.reasoning && <p className="mb-2 text-muted-foreground">{action.reasoning}</p>}
                <div className="flex gap-2">
                  {action.status === "PENDING_APPROVAL" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(action.id)}
                        disabled={approveMutation.isPending || isOwnProposal}
                        title={isOwnProposal ? "You proposed this — a different authorised user must approve it" : undefined}
                      >
                        Approve
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => rejectMutation.mutate(action.id)} disabled={rejectMutation.isPending}>
                        Reject
                      </Button>
                    </>
                  )}
                  {action.status === "APPROVED" && (
                    <Button size="sm" onClick={() => executeMutation.mutate(action.id)} disabled={executeMutation.isPending}>
                      Execute
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeManageCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [requiredPermission, setRequiredPermission] = useState("");

  const entriesQuery = useQuery({ queryKey: ["assistant-knowledge-entries"], queryFn: () => apiClient.assistant.listKnowledgeEntries() });
  const permissionsQuery = useQuery({ queryKey: ["organisation-permissions"], queryFn: () => apiClient.organisationRbac.listPermissions() });

  const createMutation = useMutation({
    mutationFn: () => apiClient.assistant.createKnowledgeEntry({ title, content, requiredPermission: requiredPermission || undefined }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      setRequiredPermission("");
      queryClient.invalidateQueries({ queryKey: ["assistant-knowledge-entries"] });
      toast({ title: "Knowledge entry added", variant: "success" });
    },
    onError: (error) => toast({ title: "Could not add knowledge entry", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.assistant.deleteKnowledgeEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant-knowledge-entries"] }),
    onError: (error) => toast({ title: "Could not delete knowledge entry", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Manage knowledge</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Text content the assistant can retrieve — a policy, an FAQ, a handbook excerpt. Separate from employee document attachments (Documents page); those are files, not
          searchable text. Set a required permission to gate an entry to only the roles that hold it — leave it unset to make it visible to anyone with assistant access.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="knowledge-title">Title</Label>
          <Input id="knowledge-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Leave Policy" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="knowledge-content">Content</Label>
          <textarea
            id="knowledge-content"
            className={textareaClassName}
            rows={5}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Paste the text the assistant should know…"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="knowledge-permission">Required permission (optional)</Label>
          <select id="knowledge-permission" className={selectClassName} value={requiredPermission} onChange={(event) => setRequiredPermission(event.target.value)}>
            <option value="">Visible to anyone with assistant access</option>
            {permissionsQuery.data?.map((permission) => (
              <option key={permission.id} value={permission.key}>
                {permission.key} — {permission.description}
              </option>
            ))}
          </select>
        </div>
        <Button
          className="self-start"
          onClick={() => title.trim() && content.trim() && createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim() || !content.trim()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add entry
        </Button>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {entriesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No knowledge entries yet.</p>}
          {entriesQuery.data?.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div>
                <div className="font-medium text-foreground">{entry.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={entry.status === "READY" ? "success" : "outline"}>{entry.status}</Badge>
                  <span>{entry.chunkCount} chunk(s)</span>
                  {entry.requiredPermission && <Badge variant="outline">{entry.requiredPermission}</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(entry.id)} disabled={deleteMutation.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function KnowledgeSearchCard() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const searchMutation = useMutation({
    mutationFn: () => apiClient.assistant.searchKnowledge({ query }),
    onError: (error) => toast({ title: "Search failed", description: error instanceof NexoraApiError ? error.message : "Unknown error", variant: "error" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Knowledge search</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Permission-aware — only ever returns documents your own role's permissions allow, via SAPOK AI's internal search. Empty until your organisation's documents have been ingested.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Search the knowledge base…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && query.trim() && searchMutation.mutate()}
          />
          <Button onClick={() => query.trim() && searchMutation.mutate()} disabled={searchMutation.isPending || !query.trim()}>
            Search
          </Button>
        </div>
        {searchMutation.data && searchMutation.data.length === 0 && <p className="text-sm text-muted-foreground">No matching documents.</p>}
        <div className="flex flex-col gap-2">
          {searchMutation.data?.map((result) => (
            <div key={result.chunkId} className="rounded-md border border-border p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline">{result.documentTitle}</Badge>
                {result.requiredPermission && <Badge variant="outline">{result.requiredPermission}</Badge>}
                <span className="text-xs text-muted-foreground">distance {result.distance.toFixed(3)}</span>
              </div>
              <p className="text-muted-foreground">{result.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
